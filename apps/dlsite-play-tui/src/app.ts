import blessed from "blessed";
import path from "node:path";
import os from "node:os";
import clipboard from "clipboardy";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { DlsiteClient } from "./dlsiteClient.js";
import type { OwnedWork, SearchResult, WorkTreeNode, WorkTreeEntry } from "./types.js";

const execFileAsync = promisify(execFile);
const HOME = os.homedir();
const stateDir = path.join(HOME, ".cache", "dlsite-play-tui");
const downloadDir = path.join(HOME, "Downloads", "dlsite");

const screen = blessed.screen({ smartCSR: true, title: "DLsite Play TUI", fullUnicode: true });
const header = blessed.box({ parent: screen, top: 0, left: 0, width: "100%", height: 1, style: { fg: "black", bg: "cyan" }, content: " DLsite TUI | TAB:focus c:cookie i:pw s:search l:library t:tree ENTER:expand/play a:queue A:queue-folder n:next d:download y:copy q:quit" });

const library = blessed.listtable({ parent: screen, top: 1, left: 0, width: "48%", height: "62%", border: "line", keys: true, vi: true, mouse: true, style: { header: { fg: "yellow", bold: true }, cell: { selected: { bg: "blue" } } }, data: [["Type", "Title", "ID"]] });
const tree = blessed.list({ parent: screen, top: 1, left: "48%", width: "34%", height: "62%", border: "line", label: " Tree ", keys: true, vi: true, mouse: true, items: ["(load with t)"] });
const thumb = blessed.box({ parent: screen, top: 1, left: "82%", width: "18%", height: "31%", border: "line", label: " Thumb ", tags: true, content: "(none)" });
const queue = blessed.list({ parent: screen, top: "32%", left: "82%", width: "18%", height: "31%", border: "line", label: " Queue ", keys: true, vi: true, mouse: true, items: ["(empty)"] });
const logs = blessed.log({ parent: screen, top: "63%", left: 0, width: "100%", height: "34%-2", border: "line", label: " Logs ", tags: true });
const status = blessed.box({ parent: screen, bottom: 0, left: 0, width: "100%", height: 3, border: "line", content: " Ready" });

type Row = { kind: "search" | "owned"; title: string; url: string; raw: SearchResult | OwnedWork };
type FlatTreeRow = { depth: number; node: WorkTreeNode; expanded?: boolean };
type QueueItem = { workId: string; title: string; entry: WorkTreeEntry };

const rows: Row[] = [];
let treeRoots: WorkTreeNode[] = [];
let treeFlat: FlatTreeRow[] = [];
const expanded = new Set<string>();
let treeWorkId: string | null = null;
const audioQueue: QueueItem[] = [];
let player: ChildProcess | null = null;

const client = new DlsiteClient(stateDir, downloadDir);

const info = (m: string) => { logs.log(`{green-fg}${m}{/green-fg}`); screen.render(); };
const warn = (m: string) => { logs.log(`{yellow-fg}${m}{/yellow-fg}`); screen.render(); };
const err = (m: string) => { logs.log(`{red-fg}${m}{/red-fg}`); screen.render(); };
const setStatus = (m: string) => { status.setContent(` ${m}`); screen.render(); };

function currentRow(): Row | undefined {
  const idx = ((library as unknown as { selected: number }).selected ?? 0) - 1;
  return idx >= 0 ? rows[idx] : undefined;
}
function currentWorkId(): string | null {
  const row = currentRow();
  if (!row) return null;
  if (row.kind === "owned") return (row.raw as OwnedWork).id;
  return row.url.match(/(RJ\d+|BJ\d+|VJ\d+|[A-Z]{2}\d{4,})/i)?.[1]?.toUpperCase() ?? null;
}

function setRows(newRows: Row[]): void {
  rows.length = 0;
  rows.push(...newRows);
  library.setData([["Type", "Title", "ID"], ...newRows.map((r) => [r.kind, r.title.slice(0, 56), r.kind === "owned" ? (r.raw as OwnedWork).id : r.url])]);
  if (newRows.length > 0) library.select(1);
  screen.render();
}

function prompt(label: string, initial = ""): Promise<string | null> {
  return new Promise((resolve) => {
    const p = blessed.prompt({ parent: screen, border: "line", width: "78%", height: 7, top: "center", left: "center", label: ` ${label} ` });
    p.input(label, initial, (_, value) => {
      p.destroy();
      screen.render();
      resolve(value ?? null);
    });
  });
}

async function renderThumb(row?: Row): Promise<void> {
  const u = row?.kind === "owned" ? (row.raw as OwnedWork).thumbnail : row?.raw.thumbnail;
  if (!u) {
    thumb.setContent("(no thumbnail)");
    screen.render();
    return;
  }
  try {
    const { stdout } = await execFileAsync("bash", ["-lc", `tmp=$(mktemp); curl -fsSL '${u}' -o "$tmp" && chafa "$tmp" --size=20x10 --symbols=block && rm -f "$tmp"`], { maxBuffer: 1024 * 1024 });
    thumb.setContent(stdout);
  } catch {
    thumb.setContent(`thumb url:\n${u}`);
  }
  screen.render();
}

function rebuildTreeList(): void {
  treeFlat = [];
  const walk = (nodes: WorkTreeNode[], depth: number) => {
    for (const n of nodes) {
      const ex = n.kind === "folder" ? expanded.has(n.path) : false;
      treeFlat.push({ depth, node: n, expanded: ex });
      if (n.kind === "folder" && ex) walk(n.children, depth + 1);
    }
  };
  walk(treeRoots, 0);
  tree.setItems(treeFlat.map((r) => `${"  ".repeat(r.depth)}${r.node.kind === "folder" ? (r.expanded ? "▾ " : "▸ ") : "  ♪ "}${r.node.name}`));
  if (treeFlat.length > 0) tree.select(0);
  screen.render();
}

function currentTreeRow(): FlatTreeRow | undefined {
  const idx = ((tree as unknown as { selected: number }).selected ?? 0);
  return treeFlat[idx];
}

function queueRefresh(): void {
  queue.setItems(audioQueue.length ? audioQueue.map((q, i) => `${i + 1}. ${q.entry.path}`) : ["(empty)"]);
  screen.render();
}

async function ensurePlay(bin = "mpv"): Promise<boolean> {
  try {
    await execFileAsync("bash", ["-lc", `command -v ${bin}`]);
    return true;
  } catch {
    warn(`${bin} が見つかりません。インストールしてください`);
    return false;
  }
}

async function playNextFromQueue(): Promise<void> {
  if (player || audioQueue.length === 0) return;
  if (!(await ensurePlay("mpv"))) return;
  const item = audioQueue.shift()!;
  queueRefresh();
  setStatus(`再生中: ${item.entry.path}`);

  const local = await client.fetchPlayableToCache(item.workId, item.entry);
  const proc = spawn("mpv", ["--no-video", "--really-quiet", local], { stdio: "ignore" });
  player = proc;
  proc.on("exit", () => {
    player = null;
    setStatus("再生終了");
    void playNextFromQueue();
  });
}

function enqueueEntry(workId: string, title: string, entry: WorkTreeEntry): void {
  if (!entry.isAudio) {
    warn(`音声ではないためキュー追加スキップ: ${entry.path}`);
    return;
  }
  audioQueue.push({ workId, title, entry });
  queueRefresh();
  info(`queue+: ${entry.path}`);
}

function enqueueFolderRecursive(workId: string, title: string, folder: WorkTreeNode): void {
  const walk = (n: WorkTreeNode) => {
    if (n.kind === "file") return enqueueEntry(workId, title, n.entry);
    n.children.forEach(walk);
  };
  walk(folder);
  void playNextFromQueue();
}

async function doSearch(): Promise<void> {
  const q = await prompt("検索ワード");
  if (!q) return;
  const result = await client.search(q);
  setRows(result.map((r) => ({ kind: "search", title: r.title, url: r.url, raw: r })));
  info(`検索: ${result.length}件`);
}

async function doLibrary(): Promise<void> {
  setStatus("ライブラリ読み込み中...");
  const works = await client.listOwnedWorks();
  setRows(works.map((w) => ({ kind: "owned", title: w.title, url: w.detailUrl, raw: w })));
  setStatus(`ライブラリ ${works.length}件`);
}

async function doLoadTree(): Promise<void> {
  const id = currentWorkId();
  const row = currentRow();
  if (!id || !row) return warn("作品未選択");
  treeWorkId = id;
  treeRoots = await client.getWorkTreeNodes(id);
  expanded.clear();
  treeRoots.forEach((n) => n.kind === "folder" && expanded.add(n.path));
  rebuildTreeList();
  info(`tree loaded: ${id}`);
}

function toggleTreeRow(): void {
  const row = currentTreeRow();
  if (!row) return;
  const n = row.node;
  if (n.kind === "folder") {
    if (expanded.has(n.path)) expanded.delete(n.path);
    else expanded.add(n.path);
    rebuildTreeList();
    return;
  }
  if (!treeWorkId) return;
  enqueueEntry(treeWorkId, currentRow()?.title ?? treeWorkId, n.entry);
  void playNextFromQueue();
}

function enqueueCurrent(): void {
  const row = currentTreeRow();
  if (!row || !treeWorkId) return;
  if (row.node.kind === "file") enqueueEntry(treeWorkId, currentRow()?.title ?? treeWorkId, row.node.entry);
  else enqueueFolderRecursive(treeWorkId, currentRow()?.title ?? treeWorkId, row.node);
  void playNextFromQueue();
}

async function doDownload(): Promise<void> {
  const row = currentRow();
  const id = currentWorkId();
  if (!row || !id) return warn("作品未選択");
  const work: OwnedWork = row.kind === "owned" ? (row.raw as OwnedWork) : { id, title: row.title, detailUrl: row.url };
  const r = await client.downloadWork(work);
  info(`downloaded: ${r.savedTo}`);
}

library.on("select", async (_, idx) => {
  if (idx <= 0) return;
  await renderThumb(rows[idx - 1]);
});

screen.key(["tab"], () => {
  if (screen.focused === library) tree.focus();
  else if (screen.focused === tree) queue.focus();
  else library.focus();
});
screen.key(["q", "C-c"], async () => {
  player?.kill("SIGTERM");
  await client.close();
  process.exit(0);
});
screen.key(["c"], () => void (async () => {
  const s = await prompt("Cookie文字列 or JSON");
  if (!s) return;
  await client.setCookieInput(s);
  info("cookie saved");
})().catch((e) => err(String(e))));
screen.key(["i"], () => void client.importCookiesViaPlaywright().then(() => info("cookie imported via playwright")).catch((e) => err(String(e))));
screen.key(["s"], () => void doSearch().catch((e) => err(String(e))));
screen.key(["l"], () => void doLibrary().catch((e) => err(String(e))));
screen.key(["t"], () => void doLoadTree().catch((e) => err(String(e))));
screen.key(["d"], () => void doDownload().catch((e) => err(String(e))));
screen.key(["y"], () => {
  const r = currentRow();
  if (!r) return;
  clipboard.writeSync(r.url);
  info(`copied: ${r.url}`);
});
screen.key(["enter", "right", "l"], () => {
  if (screen.focused === tree) toggleTreeRow();
});
screen.key(["left", "h"], () => {
  if (screen.focused !== tree) return;
  const row = currentTreeRow();
  if (!row || row.node.kind !== "folder") return;
  expanded.delete(row.node.path);
  rebuildTreeList();
});
screen.key(["a"], () => {
  if (screen.focused !== tree) return;
  const row = currentTreeRow();
  if (!row || !treeWorkId) return;
  if (row.node.kind === "file") enqueueEntry(treeWorkId, currentRow()?.title ?? treeWorkId, row.node.entry);
  queueRefresh();
  void playNextFromQueue();
});
screen.key(["A"], () => {
  if (screen.focused !== tree) return;
  enqueueCurrent();
});
screen.key(["n"], () => {
  if (player) player.kill("SIGTERM");
  else void playNextFromQueue();
});

(async () => {
  await client.boot();
  if (await client.ensureLogin()) await doLibrary();
  else warn("未ログイン: c か i でCookie登録");
  library.focus();
  screen.render();
})().catch((e) => err(String(e)));
