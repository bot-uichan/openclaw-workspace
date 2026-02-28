#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function waitForFile(file: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await exists(file)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("NW.js helper timed out before writing cookies");
}

async function main(): Promise<void> {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
  const appDir = path.join(root, "nw-app");
  const nwBin = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "nw.cmd" : "nw");

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "dlplay-auth-"));
  const outPath = path.join(tmpDir, "cookies.json");

  const child = spawn(nwBin, [appDir, `--output=${outPath}`, "--target=https://play.dlsite.com/library"], {
    stdio: "inherit",
  });

  try {
    await waitForFile(outPath, 5 * 60 * 1000);
    const raw = await fs.readFile(outPath, "utf8");
    process.stdout.write(raw);
  } finally {
    if (!child.killed) child.kill("SIGTERM");
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

main().catch((e) => {
  process.stderr.write(`auth-helper error: ${String(e)}\n`);
  process.exit(1);
});
