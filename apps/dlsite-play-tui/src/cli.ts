#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { DlsiteClient } from "./dlsiteClient.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runDoctor(): Promise<void> {
  const home = process.env.HOME ?? process.cwd();
  const stateDir = path.join(home, ".cache", "dlsite-play-tui");
  const downloadDir = path.join(home, "Downloads", "dlsite");
  const client = new DlsiteClient(stateDir, downloadDir);
  await client.boot();
  const d = await client.runDiagnostics();

  console.log("DLsite TUI Doctor");
  console.log(`cookieCount: ${d.cookieCount}`);
  console.log(`loginOk: ${d.loginOk}`);
  console.log(`countApi: ${d.countOk}`);
  console.log(`salesApi: ${d.salesOk}`);
  console.log(`libraryCacheWorks: ${d.libraryCacheWorks}`);
  console.log(`treeCacheFiles: ${d.treeCacheFiles}`);
  if (d.errors.length) {
    console.log("errors:");
    for (const e of d.errors) console.log(`- ${e}`);
  }
}

async function runCookieImport(): Promise<void> {
  const home = process.env.HOME ?? process.cwd();
  const stateDir = path.join(home, ".cache", "dlsite-play-tui");
  const downloadDir = path.join(home, "Downloads", "dlsite");
  const client = new DlsiteClient(stateDir, downloadDir);
  await client.boot();
  const count = await client.importCookiesViaHelper();
  console.log(`cookie imported: ${count}`);
}

function runTui(): void {
  const appPath = path.join(__dirname, "app.js");
  const child = spawn(process.execPath, [appPath], { stdio: "inherit", env: process.env });
  child.on("exit", (code) => process.exit(code ?? 0));
}

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? "run";
  if (cmd === "doctor") return runDoctor();
  if (cmd === "cookie-import") return runCookieImport();
  if (cmd === "run" || cmd === "tui") return runTui();

  console.log("Usage: dlsite-tui [run|tui|doctor|cookie-import]");
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
