import fs from "node:fs/promises";
import path from "node:path";
import { chromium, BrowserContext, Cookie, Page } from "playwright";
import type { OwnedWork, SearchResult } from "./types.js";

const BASE = "https://play.dlsite.com";

export class DlsiteClient {
  private context?: BrowserContext;
  private page?: Page;

  constructor(
    private readonly userDataDir: string,
    private readonly downloadDir: string,
    private readonly headless = true,
  ) {}

  async boot(): Promise<void> {
    await fs.mkdir(this.userDataDir, { recursive: true });
    await fs.mkdir(this.downloadDir, { recursive: true });

    this.context = await chromium.launchPersistentContext(this.userDataDir, {
      headless: this.headless,
      acceptDownloads: true,
      viewport: { width: 1440, height: 900 },
    });

    this.page = this.context.pages()[0] ?? (await this.context.newPage());
    await this.page.goto(BASE, { waitUntil: "domcontentloaded" });
  }

  async close(): Promise<void> {
    await this.context?.close();
  }

  async ensureLogin(): Promise<boolean> {
    const page = this.mustPage();
    await page.goto(`${BASE}/library`, { waitUntil: "domcontentloaded" });

    const url = page.url();
    if (url.includes("/login")) {
      return false;
    }

    const hasMyPageLink = await page.locator('a[href*="/mypage"], a[href*="/library"]').first().isVisible().catch(() => false);
    return hasMyPageLink;
  }

  async setCookieHeader(raw: string): Promise<number> {
    const context = this.mustContext();
    const parsed = raw
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((pair) => {
        const idx = pair.indexOf("=");
        if (idx <= 0) return null;
        const name = pair.slice(0, idx).trim();
        const value = pair.slice(idx + 1).trim();
        if (!name || !value) return null;
        const c: Cookie = {
          name,
          value,
          domain: ".dlsite.com",
          path: "/",
          httpOnly: false,
          secure: true,
          sameSite: "Lax",
          expires: -1,
        };
        return c;
      })
      .filter((c): c is Cookie => c !== null);

    if (parsed.length === 0) {
      throw new Error("有効なCookieが見つかりませんでした");
    }

    await context.addCookies(parsed);
    await this.mustPage().goto(`${BASE}/library`, { waitUntil: "domcontentloaded" });
    return parsed.length;
  }

  async search(keyword: string): Promise<SearchResult[]> {
    const page = this.mustPage();
    const url = `${BASE}/search?word=${encodeURIComponent(keyword)}`;
    await page.goto(url, { waitUntil: "domcontentloaded" });

    await page.waitForTimeout(700);

    return page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("a[href*='/work/'], a[href*='/product/']"));
      const seen = new Set<string>();
      const out: Array<{ title: string; url: string; creator?: string; thumbnail?: string }> = [];

      for (const a of cards) {
        const href = (a as HTMLAnchorElement).href;
        if (!href || seen.has(href)) continue;

        const title =
          a.getAttribute("aria-label")?.trim() ||
          (a.querySelector("img") as HTMLImageElement | null)?.alt?.trim() ||
          a.textContent?.trim() ||
          "(untitled)";

        if (title.length < 2) continue;

        seen.add(href);
        out.push({
          title,
          url: href,
          thumbnail: (a.querySelector("img") as HTMLImageElement | null)?.src,
        });
      }

      return out.slice(0, 80);
    });
  }

  async listOwnedWorks(): Promise<OwnedWork[]> {
    const page = this.mustPage();
    await page.goto(`${BASE}/library`, { waitUntil: "domcontentloaded" });

    if (page.url().includes("/login")) {
      throw new Error("未ログインです。cookieコマンドでCookieを登録してください。");
    }

    await page.waitForTimeout(1200);

    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 3000);
      await page.waitForTimeout(300);
    }

    const works = await page.evaluate(() => {
      const idPattern = /(RJ\d+|BJ\d+|VJ\d+|[A-Z]{2}\d{4,})/i;
      const anchors = Array.from(document.querySelectorAll("a[href]"));
      const map = new Map<string, { id: string; title: string; detailUrl: string; playUrl?: string; downloadUrl?: string }>();

      const ensure = (id: string, title: string, detailUrl: string) => {
        if (!map.has(id)) {
          map.set(id, { id, title: title || id, detailUrl });
        }
      };

      for (const a of anchors) {
        const href = (a as HTMLAnchorElement).href;
        if (!href) continue;

        const m = href.match(idPattern);
        if (!m) continue;

        const id = m[1].toUpperCase();
        const title =
          a.getAttribute("aria-label")?.trim() ||
          (a.querySelector("img") as HTMLImageElement | null)?.alt?.trim() ||
          a.textContent?.replace(/\s+/g, " ").trim() ||
          id;

        if (href.includes("/work/") || href.includes("/product/") || href.includes("/announce/")) {
          ensure(id, title, href);
        } else if (href.includes("viewer") || href.includes("play")) {
          ensure(id, title, `${location.origin}/work/${id}`);
          map.get(id)!.playUrl = href;
        } else if (href.includes("download")) {
          ensure(id, title, `${location.origin}/work/${id}`);
          map.get(id)!.downloadUrl = href;
        }
      }

      return Array.from(map.values()).slice(0, 500);
    });

    return works;
  }

  async openForPlay(work: OwnedWork): Promise<void> {
    const page = this.mustPage();
    await page.goto(work.playUrl ?? work.detailUrl, { waitUntil: "domcontentloaded" });
  }

  async queueDownloadByOpenPage(): Promise<{ savedTo: string; suggestedName: string }> {
    const page = this.mustPage();

    const downloadButton = page
      .locator("a:has-text('ダウンロード'), button:has-text('ダウンロード'), a:has-text('Download'), button:has-text('Download')")
      .first();

    const isVisible = await downloadButton.isVisible().catch(() => false);
    if (!isVisible) {
      throw new Error("ダウンロードボタンが見つかりませんでした。作品ページを開いてから再実行してください。");
    }

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 60_000 }),
      downloadButton.click(),
    ]);

    const suggestedName = download.suggestedFilename();
    const outPath = path.join(this.downloadDir, suggestedName);
    await download.saveAs(outPath);

    return { savedTo: outPath, suggestedName };
  }

  async openWorkDetail(url: string): Promise<void> {
    const page = this.mustPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
  }

  private mustPage(): Page {
    if (!this.page) throw new Error("client is not booted");
    return this.page;
  }

  private mustContext(): BrowserContext {
    if (!this.context) throw new Error("client is not booted");
    return this.context;
  }
}
