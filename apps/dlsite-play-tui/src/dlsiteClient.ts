import fs from "node:fs/promises";
import path from "node:path";
import { chromium, BrowserContext, Page } from "playwright";
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
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    const hasAvatar = await page.locator('a[href*="/mypage"], img[alt*="avatar"]').first().isVisible().catch(() => false);
    if (hasAvatar) return true;

    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" }).catch(() => undefined);
    return false;
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
    await page.waitForTimeout(800);

    const works = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a[href*='/work/'], a[href*='/product/']"));
      const map = new Map<string, { id: string; title: string; detailUrl: string; playUrl?: string; downloadUrl?: string }>();

      for (const a of anchors) {
        const href = (a as HTMLAnchorElement).href;
        if (!href) continue;
        const m = href.match(/(RJ\d+|BJ\d+|VJ\d+|[A-Z]{2}\d+)/i);
        const id = m?.[1] ?? href;
        const title = a.getAttribute("aria-label")?.trim() || a.textContent?.trim() || id;
        if (!map.has(id)) {
          map.set(id, { id, title, detailUrl: href });
        }
      }

      const playLinks = Array.from(document.querySelectorAll("a[href*='viewer'], a[href*='play']"));
      for (const a of playLinks) {
        const href = (a as HTMLAnchorElement).href;
        const txt = a.textContent ?? "";
        if (!href || !txt) continue;

        const nearest = a.closest("article, li, div");
        const idMatch = nearest?.textContent?.match(/(RJ\d+|BJ\d+|VJ\d+|[A-Z]{2}\d+)/i)?.[1];
        if (!idMatch || !map.has(idMatch)) continue;
        map.get(idMatch)!.playUrl = href;
      }

      return Array.from(map.values()).slice(0, 200);
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
}
