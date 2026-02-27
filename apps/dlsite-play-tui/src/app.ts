import blessed from "blessed";
import path from "node:path";
import os from "node:os";
import clipboard from "clipboardy";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DlsiteClient } from "./dlsiteClient.js";
import type { OwnedWork, SearchResult, WorkTreeEntry } from "./types.js";

const execFileAsync = promisify(execFile);
const HOME = os.homedir();
const stateDir = path.join(HOME, ".cache", "dlsite-play-tui");
const downloadDir = path.join(HOME, "Downloads", "dlsite");

const screen = blessed.screen({ smartCSR: true, title: "DLsite Play TUI", fullUnicode: true });

const header = blessed.box({
  parent: screen,
  top: 0,
  left: 0,
  width: "100%",
  height: 1,
  tags: true,
  style: { fg: "black", bg: "cyan" },
  content: " DLsite Play TUI | c:cookie i:pw-cookie s:search l:library t:tree r:play-file p:open-work d:download y:copy-url /:cmd q:quit",
});

const body = blessed.listtable({
  parent: screen,
  top: 1,
  left: 0,
  width: "68%",
  height: "68%",
  border: "line",
  keys: true,
  vi: true,
  mouse: true,
  interactive: true,
  style: { header: { fg: "yellow", bold: true }, cell: { selected: { bg: "blue" } }, border: { fg: "gray" } },
  data: [["Type", "Title", "ID/URL"]],
});

const thumbPanel = blessed.box({
  parent: screen,
  top: 1,
  left: "68%",
  width: "32%",
  height: "34%",
  border: "line",
  tags: true,
  label: " Thumbnail ",
  scrollable: true,
  alwaysScroll: true,
  content: "(no thumbnail)",
});

const treePanel = blessed.list({
  parent: screen,
  top: "35%",
  left: "68%",
  width: "32%",
  height: "34%",
  border: "line",
  keys: true,
  vi: true,
  mouse: true,
  label: " File Tree ",
  style: { selected: { bg: "magenta" }, border: { fg: "gray" } },
  items: ["(tree not loaded)"],
});

const logBox = blessed.log({
  parent: screen,
  top: "69%",
  left: 0,
  width: "100%",
  height: "27%-2",
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
let currentTree: WorkTreeEntry[] = [];
let treeWorkId: string | null = null;

const client = new DlsiteClient(stateDir, downloadDir);

const info = (m: string) => { logBox.log(`{green-fg}${m}{/green-fg}`); screen.render(); };
const warn = (m: string) => { logBox.log(`{yellow-fg}${m}{/yellow-fg}`); screen.render(); };
const err = (m: string) => { logBox.log(`{red-fg}${m}{/red-fg}`); screen.render(); };
const setStatus = (m: string) => { status.setContent(` ${m}`); screen.render(); };

function selected(): Row | undefined {
  const idx = ((body as unknown as { selected: number }).selected ?? 0) - 1;
  return idx >= 0 ? rows[idx] : undefined;
}

function selectedWorkId(): string | null {
  const row = selected();
  if (!row) return null;
  if (row.kind === "owned") return (row.raw as OwnedWork).id;
  return row.url.match(/(RJ\d+|BJ\d+|VJ\d+|[A-Z]{2}\d{4,})/i)?.[1]?.toUpperCase() ?? null;
}

function setTable(newRows: Row[]): void {
  rows.length = 0;
  rows.push(...newRows);
  body.setData([["Type", "Title", "ID/URL"], ...newRows.map((r) => [r.kind, r.title.slice(0, 70), rowIdOrUrl(r)])]);
  body.select(newRows.length > 0 ? 1 : 0);
  screen.render();
}

function rowIdOrUrl(r: Row): string {
  if (r.kind === "owned") return (r.raw as OwnedWork).id;
  return r.url;
}

function promptLine(label: string, initial = ""): Promise<string | null> {
  return new Promise((resolve) => {
    const p = blessed.prompt({ parent: screen, border: "line", width: "80%", height: 7, top: "center", left: "center", label: ` ${label} ` });
    p.input(label, initial, (_, value) => {
      p.destroy();
      screen.render();
      resolve(value ?? null);
    });
  });
}

async function renderThumbnail(row?: Row): Promise<void> {
  const thumb = row && row.kind === "owned" ? (row.raw as OwnedWork).thumbnail : row?.raw.thumbnail;
  if (!thumb) {
    thumbPanel.setContent("(no thumbnail)\n");
    screen.render();
    return;
  }

  try {
    const { stdout } = await execFileAsync("bash", ["-lc", `tmp=$(mktemp); curl -fsSL '${thumb}' -o "$tmp" && chafa "$tmp" --size=34x14 --symbols=block,border,stipple && rm -f "$tmp"`], { maxBuffer: 1024 * 1024 });
    thumbPanel.setContent(`${stdout}\n{cyan-fg}${thumb}{/cyan-fg}`);
  } catch {
    thumbPanel.setContent(`thumbnail: ${thumb}\n(chafa未導入なら画像プレビューはURL表示のみ)`);
  }
  screen.render();
}

async function doSearch(): Promise<void> {
  const q = await promptLine("検索ワード");
  if (!q) return;
  setStatus(`検索中: ${q}`);
  const result = await client.search(q);
  setTable(result.map((r) => ({ kind: "search", title: r.title, url: r.url, raw: r })));
  currentTree = [];
  treePanel.setItems(["(tree not loaded)"]);
  info(`検索完了: ${result.length}件`);
  setStatus(`検索結果 ${result.length}件`);
}

async function setCookieInteractive(): Promise<void> {
  const cookieInput = await promptLine("Cookie文字列 or JSON配列");
  if (!cookieInput) return;
  const count = await client.setCookieInput(cookieInput);
  info(`cookieを ${count} 件保存しました`);
  if (await client.ensureLogin()) await loadLibrary();
}

async function importCookieViaPlaywright(): Promise<void> {
  info("ブラウザでログインしてください");
  const count = await client.importCookiesViaPlaywright();
  info(`cookieを ${count} 件保存しました`);
  if (await client.ensureLogin()) await loadLibrary();
}

async function loadLibrary(): Promise<void> {
  setStatus("ライブラリ読み込み中...");
  const works = await client.listOwnedWorks();
  setTable(works.map((r) => ({ kind: "owned", title: r.title, url: r.detailUrl, raw: r })));
  info(`ライブラリ: ${works.length}件`);
  setStatus(`ライブラリ ${works.length}件`);
}

async function loadTreeForSelected(): Promise<void> {
  const workId = selectedWorkId();
  if (!workId) return warn("作品IDを特定できません");
  setStatus(`tree取得中: ${workId}`);
  currentTree = await client.getWorkTree(workId);
  treeWorkId = workId;
  treePanel.setItems(currentTree.map((x, i) => `${String(i + 1).padStart(3, "0")} [${x.type ?? "file"}] ${x.path}`));
  treePanel.select(0);
  info(`tree取得: ${currentTree.length}件`);
  setStatus(`tree ${currentTree.length}件`);
  screen.render();
}

async function playSelectedTreeFile(): Promise<void> {
  if (!treeWorkId || currentTree.length === 0) return warn("先に t でtreeを読み込んでください");
  const idx = ((treePanel as unknown as { selected: number }).selected ?? 0) as number;
  const entry = currentTree[idx];
  if (!entry) return;
  await client.playTreeEntry(treeWorkId, entry);
  info(`再生/表示: ${entry.path}`);
}

async function openSelectedWork(): Promise<void> {
  const row = selected();
  if (!row) return;
  if (row.kind === "owned") {
    await client.openForPlay(row.raw as OwnedWork);
  } else {
    await client.openWorkDetail(row.url);
  }
  info(`open: ${row.title}`);
}

async function downloadSelected(): Promise<void> {
  const row = selected();
  if (!row) return warn("先に作品を選択してください");
  const work: OwnedWork = row.kind === "owned" ? (row.raw as OwnedWork) : {
    id: selectedWorkId() ?? "UNKNOWN",
    title: row.title,
    detailUrl: row.url,
  };
  setStatus(`ダウンロード中: ${work.id}`);
  const dl = await client.downloadWork(work);
  info(`保存完了: ${dl.suggestedName}`);
  info(`path: ${dl.savedTo}`);
  setStatus(`downloaded: ${dl.suggestedName}`);
}

async function commandPalette(): Promise<void> {
  const cmd = await promptLine("command", "search ");
  if (!cmd) return;
  const [name] = cmd.trim().split(/\s+/);
  if (name === "search") return doSearch();
  if (name === "library" || name === "ls") return loadLibrary();
  if (name === "cookie") return setCookieInteractive();
  if (name === "pcookie" || name === "cookie-pw") return importCookieViaPlaywright();
  if (name === "tree") return loadTreeForSelected();
  if (name === "play-file") return playSelectedTreeFile();
  if (name === "play") return openSelectedWork();
  if (name === "download") return downloadSelected();
  warn(`unknown command: ${name}`);
}

body.on("select", async (_, index) => {
  if (index <= 0) return;
  const row = rows[index - 1];
  setStatus(`選択: ${row.title}`);
  await renderThumbnail(row);
});

screen.key(["q", "C-c"], async () => {
  await client.close().catch(() => undefined);
  process.exit(0);
});
screen.key(["/"], () => void commandPalette().catch((e) => err(String(e))));
screen.key(["c"], () => void setCookieInteractive().catch((e) => err(String(e))));
screen.key(["i"], () => void importCookieViaPlaywright().catch((e) => err(String(e))));
screen.key(["s"], () => void doSearch().catch((e) => err(String(e))));
screen.key(["l"], () => void loadLibrary().catch((e) => err(String(e))));
screen.key(["t"], () => void loadTreeForSelected().catch((e) => err(String(e))));
screen.key(["r"], () => void playSelectedTreeFile().catch((e) => err(String(e))));
screen.key(["p", "enter"], () => void openSelectedWork().catch((e) => err(String(e))));
screen.key(["d"], () => void downloadSelected().catch((e) => err(String(e))));
screen.key(["y"], () => {
  const row = selected();
  if (!row) return;
  clipboard.writeSync(row.url);
  info(`URLをコピー: ${row.url}`);
});

(async () => {
  info("起動中...");
  await client.boot();
  if (!(await client.ensureLogin())) warn("未ログインです。[c]手動Cookie or [i]Playwright Cookie取得");
  else await loadLibrary().catch((e) => err(String(e)));
  body.focus();
  screen.render();
})().catch(async (e) => {
  err(`fatal: ${String(e)}`);
  await client.close().catch(() => undefined);
});
