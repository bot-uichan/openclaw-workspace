#!/usr/bin/env node
import { chromium } from "playwright";

const BASE = "https://play.dlsite.com";

async function main() {
  const userDataDir = process.env.DLPLAY_COOKIE_PROFILE_DIR || `${process.env.HOME || process.cwd()}/.cache/dlsite-play-cookie-helper/profile`;
  const maxWaitMs = 5 * 60 * 1000;

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
        const cookies = await context.cookies(["https://play.dlsite.com", "https://www.dlsite.com"]);
        const out = cookies.map((c) => ({ name: c.name, value: c.value })).filter((c) => c.name && c.value);
        process.stdout.write(JSON.stringify({ cookies: out }));
        return;
      }
    }

    throw new Error("login timeout");
  } finally {
    await context.close();
  }
}

main().catch((e) => {
  process.stderr.write(`cookie-helper error: ${String(e)}\n`);
  process.exit(1);
});
