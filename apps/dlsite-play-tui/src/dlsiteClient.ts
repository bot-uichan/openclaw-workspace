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
    const res = await this.fetchText(`${BASE}/library`);
    if (res.url.includes("/login")) return false;
    if (/ログイン|login/i.test(res.text) && /password|パスワード/i.test(res.text)) return false;
    return true;
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
    const { text, url } = await this.fetchText(`${BASE}/library`);
    if (url.includes("/login")) {
      throw new Error("未ログインです。Cookieを登録してください。");
    }

    const $ = load(text);
    const map = new Map<string, OwnedWork>();

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const m = href.match(/(RJ\d+|BJ\d+|VJ\d+|[A-Z]{2}\d{4,})/i);
      if (!m) return;

      const id = m[1].toUpperCase();
      const abs = toAbs(href);
      const title =
        $(el).attr("aria-label")?.trim() ||
        $(el).find("img").attr("alt")?.trim() ||
        $(el).text().replace(/\s+/g, " ").trim() ||
        id;

      if (!map.has(id)) {
        map.set(id, {
          id,
          title,
          detailUrl: /\/work\/|\/product\//.test(href) ? abs : `${BASE}/work/${id}`,
        });
      }

      const w = map.get(id)!;
      if (/viewer|play/i.test(href)) w.playUrl = abs;
      if (/download/i.test(href)) w.downloadUrl = abs;
      if (/\/work\/|\/product\//.test(href)) w.detailUrl = abs;
    });

    return Array.from(map.values()).slice(0, 500);
  }

  async openForPlay(work: OwnedWork): Promise<void> {
    await open(work.playUrl ?? work.detailUrl);
  }

  async openWorkDetail(url: string): Promise<void> {
    await open(url);
  }

  async downloadWork(work: OwnedWork): Promise<{ savedTo: string; suggestedName: string }> {
    const target = work.downloadUrl ?? (await this.findDownloadUrl(work.detailUrl));
    if (!target) {
      throw new Error("ダウンロードURLを見つけられませんでした。購入済み作品か確認してください。");
    }

    const res = await fetch(target, {
      headers: this.headers(),
      redirect: "follow",
    });

    if (!res.ok || !res.body) {
      throw new Error(`ダウンロード失敗: HTTP ${res.status}`);
    }

    const cd = res.headers.get("content-disposition") ?? "";
    const fromHeader = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd);
    const guessed = decodeURIComponent(fromHeader?.[1] ?? fromHeader?.[2] ?? `${work.id}.bin`);
    const safe = guessed.replace(/[\\/:*?"<>|]/g, "_");
    const outPath = path.join(this.downloadDir, safe);

    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(outPath));
    return { savedTo: outPath, suggestedName: safe };
  }

  private async findDownloadUrl(detailUrl: string): Promise<string | null> {
    const { text } = await this.fetchText(detailUrl);
    const $ = load(text);
    const cand = $("a[href*='download'], button[data-href*='download']").first();
    const href = cand.attr("href") ?? cand.attr("data-href");
    return href ? toAbs(href) : null;
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
