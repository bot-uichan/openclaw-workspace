import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import os from "node:os";
import { load } from "cheerio";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { OwnedWork, SearchResult, WorkTreeEntry, WorkTreeNode } from "./types.js";

const BASE = "https://play.dlsite.com";
const execFileAsync = promisify(execFile);

type CookieKV = { name: string; value: string };
type CookieJson = { name: string; value: string; domain?: string; path?: string; secure?: boolean; httpOnly?: boolean };

type SignedTree = {
  signUrl: string;
  signCookies: CookieKV[];
  ziptree: { tree?: unknown[]; playfile?: Record<string, any> };
};

export class DlsiteClient {
  private cookies: CookieKV[] = [];
  private readonly cookieStorePath: string;
  private readonly libraryCachePath: string;
  private readonly treeCacheDir: string;

  constructor(private readonly stateDir: string, private readonly downloadDir: string) {
    this.cookieStorePath = path.join(this.stateDir, "cookies.json");
    this.libraryCachePath = path.join(this.stateDir, "library-cache.json");
    this.treeCacheDir = path.join(this.stateDir, "tree-cache");
  }

  async boot(): Promise<void> {
    await fs.mkdir(this.stateDir, { recursive: true });
    await fs.mkdir(this.downloadDir, { recursive: true });
    await fs.mkdir(this.treeCacheDir, { recursive: true });
    await this.loadCookieStore();
  }

  async close(): Promise<void> {}

  async ensureLogin(): Promise<boolean> {
    try {
      const data = await this.fetchJson<{ user?: number }>("https://play.dlsite.com/api/v3/content/count?last=0");
      return typeof data.user === "number";
    } catch {
      return false;
    }
  }

  async runDiagnostics(): Promise<{
    cookieCount: number;
    loginOk: boolean;
    countOk: boolean;
    salesOk: boolean;
    libraryCacheWorks: number;
    treeCacheFiles: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let countOk = false;
    let salesOk = false;
    let loginOk = false;

    try {
      const c = await this.fetchJson<{ user?: number }>("https://play.dlsite.com/api/v3/content/count?last=0");
      countOk = typeof c.user === "number";
      loginOk = countOk;
    } catch (e) {
      errors.push(`count API: ${String(e)}`);
    }

    try {
      const s = await this.fetchJson<Array<{ workno?: string }>>("https://play.dlsite.com/api/v3/content/sales?last=0");
      salesOk = Array.isArray(s);
    } catch (e) {
      errors.push(`sales API: ${String(e)}`);
    }

    const lib = await this.readLibraryCache();
    let treeCacheFiles = 0;
    try {
      const entries = await fs.readdir(this.treeCacheDir);
      treeCacheFiles = entries.filter((x) => x.endsWith(".json")).length;
    } catch {}

    return {
      cookieCount: this.cookies.length,
      loginOk,
      countOk,
      salesOk,
      libraryCacheWorks: lib.length,
      treeCacheFiles,
      errors,
    };
  }

  async setCookieInput(raw: string): Promise<number> {
    const input = raw.trim();
    if (!input) throw new Error("Cookie入力が空です");

    if (input.startsWith("[")) {
      const arr = JSON.parse(input) as CookieJson[];
      const pairs = arr.filter((c) => c && typeof c.name === "string" && typeof c.value === "string").map((c) => ({ name: c.name.trim(), value: c.value }));
      this.cookies = dedupeCookies([...this.cookies, ...pairs]);
    } else {
      const pairs = input
        .split(";")
        .map((x) => x.trim())
        .filter(Boolean)
        .map((pair) => {
          const i = pair.indexOf("=");
          if (i <= 0) return null;
          return { name: pair.slice(0, i).trim(), value: pair.slice(i + 1).trim() };
        })
        .filter((v): v is CookieKV => Boolean(v?.name) && Boolean(v?.value));
      this.cookies = dedupeCookies([...this.cookies, ...pairs]);
    }

    await this.saveCookieStore();
    return this.cookies.length;
  }

  async importCookiesViaHelper(helperCmd = "dlplay-auth-helper"): Promise<number> {
    try {
      const { stdout } = await execFileAsync(helperCmd, [], { timeout: 5 * 60 * 1000, maxBuffer: 1024 * 1024 });
      const parsed = JSON.parse(stdout) as { cookies?: Array<{ name: string; value: string }> };
      const pairs = (parsed.cookies ?? [])
        .filter((c) => typeof c?.name === "string" && typeof c?.value === "string")
        .map((c) => ({ name: c.name.trim(), value: c.value }));

      if (pairs.length === 0) {
        throw new Error("helperが有効なcookieを返しませんでした");
      }

      this.cookies = dedupeCookies([...this.cookies, ...pairs]);
      await this.saveCookieStore();
      return this.cookies.length;
    } catch (e) {
      throw new Error(`認証ヘルパー起動失敗: ${String(e)}`);
    }
  }

  async search(keyword: string): Promise<SearchResult[]> {
    const { text } = await this.fetchText(`${BASE}/search?word=${encodeURIComponent(keyword)}`);
    const $ = load(text);
    const out: SearchResult[] = [];
    const seen = new Set<string>();
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      if (!/\/work\/|\/product\//.test(href)) return;
      const abs = toAbs(href);
      if (seen.has(abs)) return;
      seen.add(abs);
      out.push({
        title: $(el).attr("aria-label")?.trim() || $(el).find("img").attr("alt")?.trim() || $(el).text().replace(/\s+/g, " ").trim() || "(untitled)",
        url: abs,
        thumbnail: $(el).find("img").attr("src"),
      });
    });
    return out.slice(0, 100);
  }

  async listOwnedWorks(forceRefresh = false): Promise<OwnedWork[]> {
    if (!forceRefresh) {
      const cached = await this.readLibraryCache();
      if (cached.length > 0) return cached;
    }

    const countData = await this.fetchJson<{ user?: number }>("https://play.dlsite.com/api/v3/content/count?last=0");
    if (typeof countData.user !== "number") throw new Error("ライブラリAPI応答が不正です");
    const sales = await this.fetchJson<Array<{ workno?: string }>>("https://play.dlsite.com/api/v3/content/sales?last=0");
    const worknos = dedupe((sales ?? []).map((x) => (typeof x?.workno === "string" ? x.workno.toUpperCase() : "")).filter(Boolean));
    if (countData.user > 0 && worknos.length === 0) throw new Error("未ログインか、Cookie不足 (sales APIが0件)");

    const works: OwnedWork[] = [];
    for (let i = 0; i < worknos.length; i += 100) {
      const chunk = worknos.slice(i, i + 100);
      const payload = await this.fetchJson<{ works?: Array<Record<string, unknown>> }>("https://play.dlsite.com/api/v3/content/works", {
        method: "POST",
        headers: { "content-type": "application/json", referer: "https://play.dlsite.com/library" },
        body: JSON.stringify(chunk),
      });

      for (const w of payload.works ?? []) {
        const id = String(w.workno ?? "").toUpperCase();
        if (!id) continue;
        const nameObj = w.name as Record<string, unknown> | undefined;
        const wf = w.work_files as Record<string, unknown> | undefined;
        works.push({
          id,
          title:
            (typeof nameObj?.ja_JP === "string" && nameObj.ja_JP) ||
            (typeof nameObj?.en_US === "string" && nameObj.en_US) ||
            (typeof w.work_name === "string" && w.work_name) ||
            id,
          detailUrl: `https://www.dlsite.com/maniax/work/=/product_id/${id}.html`,
          thumbnail: typeof wf?.main === "string" ? toAbs(wf.main) : undefined,
        });
      }
    }

    await this.writeLibraryCache(works);
    return works;
  }

  async getWorkTreeNodes(workId: string, forceRefresh = false): Promise<WorkTreeNode[]> {
    if (!forceRefresh) {
      const cached = await this.readTreeCache(workId);
      if (cached.length > 0) return cached;
    }

    const { ziptree } = await this.getSignedZipTree(workId);
    const tree = buildTree(ziptree.tree ?? [], ziptree.playfile ?? {});
    await this.writeTreeCache(workId, tree);
    return tree;
  }

  async fetchPlayableToCache(workId: string, entry: WorkTreeEntry): Promise<string> {
    const { signUrl, signCookies } = await this.getSignedZipTree(workId);
    if (!entry.optimizedName) throw new Error("再生用ファイル名がありません");

    const candidates = [
      `${signUrl}optimized/${entry.optimizedName}`,
      `${signUrl}files/${entry.optimizedName}`,
      `${signUrl}${entry.optimizedName}`,
    ];

    let body: ReadableStream<Uint8Array> | null = null;
    let lastStatus = 0;
    for (const url of candidates) {
      const res = await fetch(url, { headers: this.headers(signCookies), redirect: "follow" });
      lastStatus = res.status;
      if (res.ok && res.body) {
        body = res.body as ReadableStream<Uint8Array>;
        break;
      }
    }

    if (!body) throw new Error(`再生ファイル取得失敗: HTTP ${lastStatus}`);

    const out = path.join(this.stateDir, "play-cache", workId, sanitizePath(entry.path));
    await fs.mkdir(path.dirname(out), { recursive: true });
    await pipeline(Readable.fromWeb(body as never), createWriteStream(out));
    return out;
  }

  async downloadWork(work: OwnedWork): Promise<{ savedTo: string; suggestedName: string }> {
    const { signUrl, signCookies, ziptree } = await this.getSignedZipTree(work.id);
    const files = flattenZipTree(ziptree.tree ?? []);
    if (files.length === 0) throw new Error("ziptreeが空でした");

    const outDir = path.join(this.downloadDir, sanitizeFileName(`${work.id}_${work.title}`).slice(0, 120));
    await fs.mkdir(outDir, { recursive: true });
    let downloaded = 0;
    for (const f of files) {
      const meta = ziptree.playfile?.[f.hashname];
      const optimizedName = resolvePlayableName(meta);
      if (!optimizedName) continue;
      const res = await fetch(`${signUrl}optimized/${optimizedName}`, { headers: this.headers(signCookies), redirect: "follow" });
      if (!res.ok || !res.body) continue;
      const local = path.join(outDir, sanitizePath(f.path));
      await fs.mkdir(path.dirname(local), { recursive: true });
      await pipeline(Readable.fromWeb(res.body as never), createWriteStream(local));
      downloaded += 1;
    }
    if (downloaded === 0) throw new Error("最適化ファイルを1件も取得できませんでした");
    return { savedTo: outDir, suggestedName: path.basename(outDir) };
  }

  private async getSignedZipTree(workId: string): Promise<SignedTree> {
    const sign = await this.fetchJson<{ url?: string; cookies?: Record<string, string> }>(`https://play.dl.dlsite.com/api/v3/download/sign/cookie?workno=${encodeURIComponent(workId)}`);
    if (!sign?.url) throw new Error("download/sign API失敗");
    const signCookies = Object.entries(sign.cookies ?? {})
      .filter(([, v]) => typeof v === "string" && v.length > 0)
      .map(([name, value]) => ({ name, value }));
    const ziptree = await this.fetchJson<{ tree?: unknown[]; playfile?: Record<string, any> }>(`${sign.url}ziptree.json`, { headers: this.headers(signCookies) });
    return { signUrl: sign.url, signCookies, ziptree };
  }

  private headers(extraCookies: CookieKV[] = []): Record<string, string> {
    const cookieHeader = dedupeCookies([...this.cookies, ...extraCookies]).map((c) => `${c.name}=${c.value}`).join("; ");
    return {
      "user-agent": `dlsite-play-tui/${os.platform()}`,
      accept: "application/json, text/plain, */*",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    };
  }

  private async fetchText(url: string): Promise<{ text: string; url: string }> {
    const res = await fetch(url, { headers: this.headers(), redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    return { text: await res.text(), url: res.url };
  }

  private async fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { ...init, headers: { ...this.headers(), ...(init?.headers ?? {}) }, redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    return (await res.json()) as T;
  }

  private async loadCookieStore(): Promise<void> {
    try {
      this.cookies = dedupeCookies(JSON.parse(await fs.readFile(this.cookieStorePath, "utf8")) as CookieKV[]);
    } catch {
      this.cookies = [];
    }
  }

  private async saveCookieStore(): Promise<void> {
    await fs.writeFile(this.cookieStorePath, JSON.stringify(this.cookies, null, 2), "utf8");
  }

  private async readLibraryCache(): Promise<OwnedWork[]> {
    try {
      const raw = await fs.readFile(this.libraryCachePath, "utf8");
      const parsed = JSON.parse(raw) as { works?: OwnedWork[] };
      return Array.isArray(parsed.works) ? parsed.works : [];
    } catch {
      return [];
    }
  }

  private async writeLibraryCache(works: OwnedWork[]): Promise<void> {
    await fs.writeFile(this.libraryCachePath, JSON.stringify({ updatedAt: new Date().toISOString(), works }, null, 2), "utf8");
  }

  private treeCachePath(workId: string): string {
    return path.join(this.treeCacheDir, `${workId}.json`);
  }

  private async readTreeCache(workId: string): Promise<WorkTreeNode[]> {
    try {
      const raw = await fs.readFile(this.treeCachePath(workId), "utf8");
      const parsed = JSON.parse(raw) as { tree?: WorkTreeNode[] };
      return Array.isArray(parsed.tree) ? parsed.tree : [];
    } catch {
      return [];
    }
  }

  private async writeTreeCache(workId: string, tree: WorkTreeNode[]): Promise<void> {
    await fs.writeFile(this.treeCachePath(workId), JSON.stringify({ updatedAt: new Date().toISOString(), tree }, null, 2), "utf8");
  }
}

function buildTree(nodes: unknown[], playfiles: Record<string, any>, parent = ""): WorkTreeNode[] {
  const out: WorkTreeNode[] = [];
  for (const n of nodes) {
    if (!n || typeof n !== "object") continue;
    const obj = n as Record<string, unknown>;
    const type = typeof obj.type === "string" ? obj.type : "";
    const name = typeof obj.name === "string" ? obj.name : "";
    const cur = parent ? `${parent}/${name}` : name;
    if (type === "folder") {
      out.push({ kind: "folder", name, path: cur, children: buildTree(Array.isArray(obj.children) ? obj.children : [], playfiles, cur) });
      continue;
    }
    if (type === "file") {
      const hashname = typeof obj.hashname === "string" ? obj.hashname : "";
      const meta = playfiles[hashname];
      const optimizedName = resolvePlayableName(meta);
      const mediaType = typeof meta?.type === "string" ? meta.type : detectTypeFromPath(cur);
      const isAudio = /audio/i.test(mediaType) || /\.(mp3|m4a|wav|ogg|flac)$/i.test(cur);
      const entry: WorkTreeEntry = {
        hashname,
        name,
        path: cur,
        optimizedName: typeof optimizedName === "string" ? optimizedName : undefined,
        type: mediaType,
        isPlayable: Boolean(optimizedName),
        isAudio,
      };
      out.push({ kind: "file", name, path: cur, entry });
    }
  }
  return out;
}

function flattenZipTree(nodes: unknown[]): Array<{ hashname: string; path: string }> {
  const out: Array<{ hashname: string; path: string }> = [];
  const walk = (arr: unknown[], parent = ""): void => {
    for (const n of arr) {
      if (!n || typeof n !== "object") continue;
      const obj = n as Record<string, unknown>;
      const type = typeof obj.type === "string" ? obj.type : "";
      const name = typeof obj.name === "string" ? obj.name : "";
      const cur = parent ? `${parent}/${name}` : name;
      if (type === "file") {
        const hashname = typeof obj.hashname === "string" ? obj.hashname : "";
        if (hashname && cur) out.push({ hashname, path: cur });
      }
      if (type === "folder") walk(Array.isArray(obj.children) ? obj.children : [], cur);
    }
  };
  walk(nodes);
  return out;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim();
}
function sanitizePath(p: string): string {
  return p.split("/").map((x) => sanitizeFileName(x || "unnamed")).join(path.sep);
}
function dedupe(list: string[]): string[] {
  return Array.from(new Set(list));
}
function resolvePlayableName(meta: any): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;

  const direct =
    meta?.files?.optimized?.name ??
    meta?.optimized?.name ??
    meta?.image?.optimized?.name ??
    meta?.audio?.optimized?.name ??
    meta?.video?.optimized?.name ??
    meta?.text?.optimized?.name ??
    meta?.files?.files?.name ??
    meta?.files?.name;
  if (typeof direct === "string" && direct.length > 0) return direct;

  const t = typeof meta.type === "string" ? meta.type : "";
  if (t && meta[t]) {
    const byType = meta[t]?.optimized?.name ?? meta[t]?.files?.name;
    if (typeof byType === "string" && byType.length > 0) return byType;
  }

  for (const v of Object.values(meta as Record<string, any>)) {
    if (!v || typeof v !== "object") continue;
    const name = v?.optimized?.name ?? v?.files?.name;
    if (typeof name === "string" && name.length > 0) return name;
  }

  return undefined;
}

function detectTypeFromPath(p: string): string {
  const lower = p.toLowerCase();
  if (/\.(mp3|wav|ogg|flac|m4a)$/.test(lower)) return "audio";
  if (/\.(mp4|webm|m3u8)$/.test(lower)) return "video";
  if (/\.(jpg|jpeg|png|webp|gif|bmp)$/.test(lower)) return "image";
  if (/\.(txt|md|json|csv)$/.test(lower)) return "text";
  if (/\.pdf$/.test(lower)) return "pdf";
  return "file";
}
function dedupeCookies(list: CookieKV[]): CookieKV[] {
  const m = new Map<string, CookieKV>();
  for (const c of list) if (c?.name && c?.value) m.set(c.name, c);
  return Array.from(m.values());
}
function toAbs(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `${BASE}${url}`;
  return `${BASE}/${url}`;
}
