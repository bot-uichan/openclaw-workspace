import blessed from "blessed";
import path from "node:path";
import os from "node:os";
import clipboard from "clipboardy";
import { DlsiteClient } from "./dlsiteClient.js";
import type { OwnedWork, SearchResult } from "./types.js";

const HOME = os.homedir();
const stateDir = path.join(HOME, ".cache", "dlsite-play-tui");
const userDataDir = path.join(stateDir, "browser-profile");
const downloadDir = path.join(HOME, "Downloads", "dlsite");

const screen = blessed.screen({
  smartCSR: true,
  title: "DLsite Play TUI",
  fullUnicode: true,
});

const header = blessed.box({
  parent: screen,
  top: 0,
  left: 0,
  width: "100%",
  height: 1,
  tags: true,
  style: { fg: "black", bg: "cyan" },
  content: " DLsite Play TUI | /:command  s:search  l:library  p:play  d:download  y:copy-url  q:quit",
});

const body = blessed.listtable({
  parent: screen,
  top: 1,
  left: 0,
  width: "100%",
  height: "75%",
  border: "line",
  keys: true,
  vi: true,
  mouse: true,
  interactive: true,
  style: {
    header: { fg: "yellow", bold: true },
    cell: { selected: { bg: "blue" } },
    border: { fg: "gray" },
  },
  data: [["Type", "Title", "URL"]],
});

const logBox = blessed.log({
  parent: screen,
  bottom: 3,
  left: 0,
  width: "100%",
  height: "25%-3",
  border: "line",
  tags: true,
  label: " Logs ",
  scrollbar: { ch: " ", track: { bg: "gray" }, style: { inverse: true } },
});

const status = blessed.box({
  parent: screen,
  bottom: 0,
  left: 0,
  width: "100%",
  height: 3,
  border: "line",
  tags: true,
  content: " Ready",
});

type Row = { kind: "search" | "owned"; title: string; url: string; raw: SearchResult | OwnedWork };
const rows: Row[] = [];

const client = new DlsiteClient(userDataDir, downloadDir, false);

function info(msg: string): void {
  logBox.log(`{green-fg}${msg}{/green-fg}`);
  screen.render();
}

function warn(msg: string): void {
  logBox.log(`{yellow-fg}${msg}{/yellow-fg}`);
  screen.render();
}

function err(msg: string): void {
  logBox.log(`{red-fg}${msg}{/red-fg}`);
  screen.render();
}

function setStatus(msg: string): void {
  status.setContent(` ${msg}`);
  screen.render();
}

function setTable(newRows: Row[]): void {
  rows.length = 0;
  rows.push(...newRows);
  const tableData = [["Type", "Title", "URL"], ...newRows.map((r) => [r.kind, r.title.slice(0, 80), r.url])];
  body.setData(tableData);
  body.select(1);
  screen.render();
}

function selected(): Row | undefined {
  const idx = ((body as unknown as { selected: number }).selected ?? 0) - 1;
  if (idx < 0) return undefined;
  return rows[idx];
}

function promptLine(label: string, initial = ""): Promise<string | null> {
  return new Promise((resolve) => {
    const p = blessed.prompt({
      parent: screen,
      border: "line",
      width: "70%",
      height: 7,
      top: "center",
      left: "center",
      label: ` ${label} `,
    });
    p.input(label, initial, (_, value) => {
      p.destroy();
      screen.render();
      resolve(value ?? null);
    });
  });
}

async function doSearch(): Promise<void> {
  const q = await promptLine("検索ワード");
  if (!q) return;

  setStatus(`検索中: ${q}`);
  const result = await client.search(q);
  setTable(result.map((r) => ({ kind: "search", title: r.title, url: r.url, raw: r })));
  info(`検索完了: ${result.length}件`);
  setStatus(`検索結果 ${result.length}件`);
}

async function loadLibrary(): Promise<void> {
  setStatus("ライブラリ読み込み中...");
  const works = await client.listOwnedWorks();
  setTable(works.map((r) => ({ kind: "owned", title: r.title, url: r.detailUrl, raw: r })));
  info(`ライブラリ: ${works.length}件`);
  setStatus(`ライブラリ ${works.length}件`);
}

async function openSelectedForPlay(): Promise<void> {
  const row = selected();
  if (!row) return;

  if (row.kind === "owned") {
    await client.openForPlay(row.raw as OwnedWork);
    info(`再生ページを開きました: ${row.title}`);
  } else {
    await client.openWorkDetail(row.url);
    info(`作品ページを開きました: ${row.title}`);
  }

  setStatus(`open: ${row.title}`);
}

async function downloadFromCurrentPage(): Promise<void> {
  setStatus("ダウンロード中...");
  const dl = await client.queueDownloadByOpenPage();
  info(`保存完了: ${dl.suggestedName}`);
  info(`path: ${dl.savedTo}`);
  setStatus(`downloaded: ${dl.suggestedName}`);
}

async function commandPalette(): Promise<void> {
  const cmd = await promptLine("command", "search ");
  if (!cmd) return;
  const [name, ...args] = cmd.trim().split(/\s+/);

  switch (name) {
    case "search":
      await doSearch();
      break;
    case "library":
    case "ls":
      await loadLibrary();
      break;
    case "open": {
      const url = args[0];
      if (!url) {
        warn("open <url>");
        return;
      }
      await client.openWorkDetail(url);
      info(`opened ${url}`);
      break;
    }
    case "download":
      await downloadFromCurrentPage();
      break;
    case "play":
      await openSelectedForPlay();
      break;
    default:
      warn(`unknown command: ${name}`);
  }
}

body.on("select", (_, index) => {
  if (index <= 0) return;
  const row = rows[index - 1];
  setStatus(`選択: ${row.title}`);
});

screen.key(["q", "C-c"], async () => {
  await client.close().catch(() => undefined);
  process.exit(0);
});

screen.key(["/"], () => void commandPalette().catch((e) => err(String(e))));
screen.key(["s"], () => void doSearch().catch((e) => err(String(e))));
screen.key(["l"], () => void loadLibrary().catch((e) => err(String(e))));
screen.key(["p", "enter"], () => void openSelectedForPlay().catch((e) => err(String(e))));
screen.key(["d"], () => void downloadFromCurrentPage().catch((e) => err(String(e))));
screen.key(["y"], () => {
  const row = selected();
  if (!row) return;
  clipboard.writeSync(row.url);
  info(`URLをコピー: ${row.url}`);
});

(async () => {
  info("起動中...");
  await client.boot();

  const logged = await client.ensureLogin();
  if (!logged) {
    warn("未ログインです。開いたブラウザでログインしてから [l] か [s] を押してください。");
  } else {
    info("ログイン確認OK");
    await loadLibrary().catch((e) => err(String(e)));
  }

  body.focus();
  screen.render();
})().catch(async (e) => {
  err(`fatal: ${String(e)}`);
  await client.close().catch(() => undefined);
});
