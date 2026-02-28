#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function resolveNwBinary(pkgRoot: string): Promise<string> {
  const local = path.join(pkgRoot, "node_modules", ".bin", process.platform === "win32" ? "nw.cmd" : "nw");
  if (await exists(local)) return local;

  try {
    const { stdout } = await execFileAsync("bash", ["-lc", process.platform === "win32" ? "where nw" : "command -v nw"]);
    const bin = stdout.trim().split(/\r?\n/)[0];
    if (bin) return bin;
  } catch {
    // ignore
  }

  throw new Error("NW.js binary not found. Run `npm i` in apps/dlsite-play-auth-helper (or install nw globally).");
}

async function main(): Promise<void> {
  const selfPath = fileURLToPath(import.meta.url);
  const pkgRoot = path.resolve(path.dirname(selfPath), "..");
  const appDir = path.join(pkgRoot, "nw-app");
  const nwBin = await resolveNwBinary(pkgRoot);

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "dlplay-auth-"));
  const outPath = path.join(tmpDir, "cookies.json");

  const child = spawn(nwBin, [appDir, `--output=${outPath}`, "--target=https://play.dlsite.com/library"], {
    stdio: "inherit",
  });

  let spawnErr: Error | null = null;
  child.on("error", (e) => {
    spawnErr = e as Error;
  });

  try {
    const timeoutMs = 5 * 60 * 1000;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (spawnErr) throw spawnErr;
      if (await exists(outPath)) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!(await exists(outPath))) {
      throw new Error("NW.js helper timed out before writing cookies");
    }

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
