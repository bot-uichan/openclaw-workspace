import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import os from "node:os";
import { load } from "cheerio";
import open from "open";
import { chromium } from "playwright";
import type { OwnedWork, SearchResult } from "./types.js";

const BASE = "https://play.dlsite.com";

type CookieKV = { name: string; value: string };
type CookieJson = { name: string; value: string; domain?: string; path?: string; secure?: boolean; httpOnly?: boolean };

export class DlsiteClient {
  private cookies: CookieKV[] = [];
  private readonly cookieStorePath: string;

  constructor(
    private readonly stateDir: string,
    private readonly downloadDir: string,
  ) {
    this.cookieStorePath = path.join(this.stateDir, "cookies.json");
  }

  async boot(): Promise<void> {
    await fs.mkdir(this.stateDir, { recursive: true });
    await fs.mkdir(this.downloadDir, { recursive: true });
    await this.loadCookieStore();
  }

  async close(): Promise<void> {
    return;
  }

  async ensureLogin(): Promise<boolean> {
    try {
      const data = await this.fetchJson<{ user?: number }>("https://play.dlsite.com/api/v3/content/count?last=0");
      return typeof data.user === "number";
    } catch {
      return false;
    }
  }

  async setCookieInput(raw: string): Promise<number> {
    const input = raw.trim();
    if (!input) throw new Error("Cookie入力が空です");

    if (input.startsWith("[")) {
      const arr = JSON.parse(input) as CookieJson[];
      const pairs = arr
        .filter((c) => c && typeof c.name === "string" && typeof c.value === "string")
        .map((c) => ({ name: c.name.trim(), value: c.value }));
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

  async importCookiesViaPlaywright(maxWaitMs = 180_000): Promise<number> {
    const userDataDir = path.join(this.stateDir, "pw-cookie-profile");
    await fs.mkdir(userDataDir, { recursive: true });

    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      viewport: { width: 1366, height: 900 },
    });

    try {
      const page = context.pages()[0] ?? (await context.newPage());
      await page.goto(`${BASE}/library`, { waitUntil: "domcontentloaded" });

      const started = Date.now();
      while (Date.now() - started < maxWaitMs) {
        await page.waitForTimeout(1000);
        if (page.url().includes("/library") && !page.url().includes("/login")) {
          const ck = await context.cookies(["https://play.dlsite.com", "https://www.dlsite.com"]);
          const pairs = ck.map((c) => ({ name: c.name, value: c.value }));
          this.cookies = dedupeCookies([...this.cookies, ...pairs]);
          await this.saveCookieStore();
          return this.cookies.length;
        }
      }

      throw new Error("Playwrightでのログイン待機がタイムアウトしました");
    } finally {
      await context.close();
    }
  }

  async search(keyword: string): Promise<SearchResult[]> {
    const url = `${BASE}/search?word=${encodeURIComponent(keyword)}`;
    const { text } = await this.fetchText(url);
    const $ = load(text);

    const out: SearchResult[] = [];
    const seen = new Set<string>();

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      if (!/\/work\/|\/product\//.test(href)) return;
      const abs = toAbs(href);
      if (seen.has(abs)) return;

      const title =
        $(el).attr("aria-label")?.trim() ||
        $(el).find("img").attr("alt")?.trim() ||
        $(el).text().replace(/\s+/g, " ").trim() ||
        "(untitled)";

      seen.add(abs);
      out.push({ title, url: abs, thumbnail: $(el).find("img").attr("src") });
    });

    return out.slice(0, 100);
  }

  async listOwnedWorks(): Promise<OwnedWork[]> {
    // DLsite Play internal API (v3)
    const countData = await this.fetchJson<{ user?: number }>("https://play.dlsite.com/api/v3/content/count?last=0");
    if (!countData || typeof countData.user !== "number") {
      throw new Error("ライブラリAPI応答が不正です");
    }

    const sales = await this.fetchJson<Array<{ workno?: string }>>("https://play.dlsite.com/api/v3/content/sales?last=0");
    const worknos = dedupe(
      (sales ?? [])
        .map((x) => (typeof x?.workno === "string" ? x.workno.toUpperCase() : ""))
        .filter(Boolean),
    );

    if (countData.user > 0 && worknos.length === 0) {
      throw new Error("未ログインか、Cookieが不足しています (sales APIが0件)");
    }

    const works: OwnedWork[] = [];
    for (let i = 0; i < worknos.length; i += 100) {
      const chunk = worknos.slice(i, i + 100);
      const payload = await this.fetchJson<{ works?: Array<Record<string, unknown>> }>(
        "https://play.dlsite.com/api/v3/content/works",
        {
          method: "POST",
          headers: { "content-type": "application/json", referer: "https://play.dlsite.com/library" },
          body: JSON.stringify(chunk),
        },
      );

      for (const w of payload.works ?? []) {
        const id = String(w.workno ?? "").toUpperCase();
        if (!id) continue;

        const nameObj = w.name as Record<string, unknown> | undefined;
        const title =
          (typeof nameObj?.ja_JP === "string" && nameObj.ja_JP) ||
          (typeof nameObj?.en_US === "string" && nameObj.en_US) ||
          (typeof w.work_name === "string" && w.work_name) ||
          id;

        works.push({
          id,
          title,
          detailUrl: `https://www.dlsite.com/maniax/work/=/product_id/${id}.html`,
          playUrl: `https://play.dlsite.com/work/${id}`,
        });
      }
    }

    return works;
  }

  async openForPlay(work: OwnedWork): Promise<void> {
    await open(work.playUrl ?? work.detailUrl);
  }

  async openWorkDetail(url: string): Promise<void> {
    await open(url);
  }

  async downloadWork(work: OwnedWork): Promise<{ savedTo: string; suggestedName: string }> {
    const sign = await this.fetchJson<{ url?: string }>(`https://play.dl.dlsite.com/api/v3/download/sign/cookie?workno=${encodeURIComponent(work.id)}`);
    if (!sign?.url) {
      throw new Error("download/sign APIからURL取得に失敗しました");
    }

    const ziptree = await this.fetchJson<{ tree?: unknown[]; playfile?: Record<string, any> }>(`${sign.url}ziptree.json`);
    const files = flattenZipTree(ziptree.tree ?? []);
    if (files.length === 0) {
      throw new Error("ziptreeが空でした");
    }

    const outDir = path.join(this.downloadDir, sanitizeFileName(`${work.id}_${work.title}`).slice(0, 120));
    await fs.mkdir(outDir, { recursive: true });

    let downloaded = 0;
    for (const f of files) {
      const meta = ziptree.playfile?.[f.hashname];
      const optimizedName = meta?.files?.optimized?.name ?? meta?.optimized?.name ?? meta?.image?.optimized?.name;
      if (!optimizedName || typeof optimizedName !== "string") continue;

      const url = `${sign.url}optimized/${optimizedName}`;
      const res = await fetch(url, { headers: this.headers(), redirect: "follow" });
      if (!res.ok || !res.body) continue;

      const local = path.join(outDir, sanitizePath(f.path));
      await fs.mkdir(path.dirname(local), { recursive: true });
      await pipeline(Readable.fromWeb(res.body as never), createWriteStream(local));
      downloaded += 1;
    }

    if (downloaded === 0) {
      throw new Error("最適化ファイルを1件も取得できませんでした");
    }

    return { savedTo: outDir, suggestedName: path.basename(outDir) };
  }

  private headers(): Record<string, string> {
    const cookieHeader = this.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    return {
      "user-agent": `dlsite-play-tui/${os.platform()}`,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    };
  }

  private async fetchText(url: string): Promise<{ text: string; url: string }> {
    const res = await fetch(url, {
      headers: this.headers(),
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    const text = await res.text();
    return { text, url: res.url };
  }

  private async fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      ...init,
      headers: {
        ...this.headers(),
        accept: "application/json, text/plain, */*",
        ...(init?.headers ?? {}),
      },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    return (await res.json()) as T;
  }

  private async loadCookieStore(): Promise<void> {
    try {
      const raw = await fs.readFile(this.cookieStorePath, "utf8");
      const data = JSON.parse(raw) as CookieKV[];
      this.cookies = dedupeCookies(data);
    } catch {
      this.cookies = [];
    }
  }

  private async saveCookieStore(): Promise<void> {
    await fs.writeFile(this.cookieStorePath, JSON.stringify(this.cookies, null, 2), "utf8");
  }
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
        continue;
      }

      const children = Array.isArray(obj.children) ? obj.children : [];
      if (children.length) walk(children, cur || parent);
    }
  };

  walk(nodes);
  return out;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim();
}

function sanitizePath(p: string): string {
  return p
    .split("/")
    .map((x) => sanitizeFileName(x || "unnamed"))
    .join(path.sep);
}

function dedupe(list: string[]): string[] {
  return Array.from(new Set(list));
}

function dedupeCookies(list: CookieKV[]): CookieKV[] {
  const m = new Map<string, CookieKV>();
  for (const c of list) {
    if (!c?.name || !c?.value) continue;
    m.set(c.name, c);
  }
  return Array.from(m.values());
}

function toAbs(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `${BASE}${url}`;
  return `${BASE}/${url}`;
}
