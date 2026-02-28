import blessed from "blessed";
import path from "node:path";
import os from "node:os";
import clipboard from "clipboardy";
import Jimp from "jimp";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { DlsiteClient } from "./dlsiteClient.js";
import type { OwnedWork, SearchResult, WorkTreeNode, WorkTreeEntry } from "./types.js";

const execFileAsync = promisify(execFile);
const HOME = os.homedir();
const stateDir = path.join(HOME, ".cache", "dlsite-play-tui");
const downloadDir = path.join(HOME, "Downloads", "dlsite");

const screen = blessed.screen({ smartCSR: true, title: "DLsite Play TUI", fullUnicode: true });
const header = blessed.box({ parent: screen, top: 0, left: 0, width: "100%", height: 1, style: { fg: "black", bg: "cyan" }, content: " DLsite TUI | TAB c i s l ENTER a A n d x/del y | space [ ] -/= q" });

const library = blessed.listtable({ parent: screen, top: 1, left: 0, width: "48%", height: "62%", border: "line", keys: true, vi: true, mouse: true, style: { header: { fg: "yellow", bold: true }, cell: { selected: { bg: "blue" } } }, data: [["Type", "Title", "ID"]] });
const tree = blessed.list({
  parent: screen,
  top: 1,
  left: "48%",
  width: "34%",
  height: "62%",
  border: "line",
  label: " Tree ",
  keys: true,
  vi: true,
  mouse: true,
  tags: true,
  style: {
    selected: { bg: "yellow", fg: "black", bold: true },
    item: { fg: "white" },
  },
  items: ["(load with t)"],
});
const thumb = blessed.box({ parent: screen, top: 1, left: "82%", width: "18%", height: "31%", border: "line", label: " Thumb ", tags: true, content: "(none)" });
let thumbImage: blessed.Widgets.BoxElement | null = null;
let thumbTmpPath: string | null = null;
const queue = blessed.list({ parent: screen, top: "32%", left: "82%", width: "18%", height: "31%", border: "line", label: " Queue ", keys: true, vi: true, mouse: true, items: ["(empty)"] });
const selectionInfo = blessed.box({ parent: screen, top: "63%", left: 0, width: "100%", height: 3, border: "line", tags: true, content: " {cyan-fg}Selection{/cyan-fg}: -" });
const logs = blessed.log({ parent: screen, top: "66%", left: 0, width: "100%", height: "31%-2", border: "line", label: " Logs ", tags: true });
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
let activeQueueFolder: string | null = null;
let player: ChildProcess | null = null;
let playerPaused = false;
let playerVolume = 100;
let currentPlayingPath: string | null = null;
let currentStartSec = 0;
let currentStartedAtMs = 0;
let isRestartingPlayer = false;

const client = new DlsiteClient(stateDir, downloadDir);

const info = (m: string) => { logs.log(`{green-fg}${m}{/green-fg}`); screen.render(); };
const warn = (m: string) => { logs.log(`{yellow-fg}${m}{/yellow-fg}`); screen.render(); };
const err = (m: string) => { logs.log(`{red-fg}${m}{/red-fg}`); screen.render(); };
const setStatus = (m: string) => { status.setContent(` ${m}`); screen.render(); };

function updateFocusDecor(): void {
  const f = screen.focused;
  library.style.border = { fg: f === library ? "cyan" : "gray" };
  tree.style.border = { fg: f === tree ? "cyan" : "gray" };
  queue.style.border = { fg: f === queue ? "cyan" : "gray" };
}

function updateSelectionInfo(): void {
  if (screen.focused === library) {
    const r = currentRow();
    selectionInfo.setContent(` {cyan-fg}Library{/cyan-fg}: ${r ? `${r.title} (${currentWorkId() ?? "?"})` : "-"}`);
  } else if (screen.focused === tree) {
    const tr = currentTreeRow();
    selectionInfo.setContent(` {cyan-fg}Tree{/cyan-fg}: ${tr ? tr.node.path : "-"}`);
  } else {
    const idx = ((queue as unknown as { selected: number }).selected ?? 0);
    selectionInfo.setContent(` {cyan-fg}Queue{/cyan-fg}: ${audioQueue[idx]?.entry.path ?? "-"}`);
  }
  screen.render();
}

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

function clearThumbImage(): void {
  if (thumbImage) {
    try { thumbImage.destroy(); } catch {}
    thumbImage = null;
  }
  if (thumbTmpPath) {
    void execFileAsync("bash", ["-lc", `rm -f '${thumbTmpPath}'`]).catch(() => undefined);
    thumbTmpPath = null;
  }
}

async function tryRenderThumbWithBlessedImage(tmpPath: string): Promise<boolean> {
  const imageCtor = (blessed as unknown as { image?: (opts: any) => blessed.Widgets.BoxElement }).image;
  if (!imageCtor) return false;

  try {
    clearThumbImage();
    thumb.setContent("");
    thumbImage = imageCtor({
      parent: thumb,
      top: 0,
      left: 0,
      width: "100%-2",
      height: "100%-2",
      file: tmpPath,
      shrink: true,
      search: false,
    });
    return true;
  } catch {
    clearThumbImage();
    return false;
  }
}

async function renderThumb(row?: Row): Promise<void> {
  const u = row?.kind === "owned" ? (row.raw as OwnedWork).thumbnail : row?.raw.thumbnail;
  if (!u) {
    clearThumbImage();
    thumb.setContent("(no thumbnail)");
    screen.render();
    return;
  }

  try {
    const res = await fetch(u);
    if (!res.ok) throw new Error(`thumb fetch failed: ${res.status}`);
    const arr = await res.arrayBuffer();
    const buf = Buffer.from(arr);

    const img = await Jimp.read(buf);
    const targetW = 28;
    const targetH = 14;
    const chars = " .:-=+*#%@";

    img.resize(targetW, targetH).grayscale();
    const lines: string[] = [];
    for (let y = 0; y < targetH; y++) {
      let line = "";
      for (let x = 0; x < targetW; x++) {
        const c = Jimp.intToRGBA(img.getPixelColor(x, y));
        const b = c.r / 255;
        const idx = Math.min(chars.length - 1, Math.floor(b * (chars.length - 1)));
        line += chars[idx];
      }
      lines.push(line);
    }

    clearThumbImage();
    thumb.setContent(lines.join("\n"));
  } catch {
    clearThumbImage();
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
  const prev = ((tree as unknown as { selected: number }).selected ?? 0);
  tree.setItems(
    treeFlat.map((r) => {
      const indent = "  ".repeat(r.depth);
      if (r.node.kind === "folder") {
        const icon = r.expanded ? "▾ " : "▸ ";
        return `${indent}{cyan-fg}${icon}${r.node.name}{/cyan-fg}`;
      }
      const file = r.node.entry;
      const tone = file.isAudio ? "green-fg" : "white-fg";
      return `${indent}{${tone}}  ♪ ${r.node.name}{/${tone}}`;
    }),
  );
  if (treeFlat.length > 0) tree.select(Math.min(prev, treeFlat.length - 1));
  updateSelectionInfo();
  screen.render();
}

function currentTreeRow(): FlatTreeRow | undefined {
  const idx = ((tree as unknown as { selected: number }).selected ?? 0);
  return treeFlat[idx];
}

function queueRefresh(): void {
  const prev = ((queue as unknown as { selected: number }).selected ?? 0);
  queue.setItems(audioQueue.length ? audioQueue.map((q, i) => `${i + 1}. ${q.entry.path}`) : ["(empty)"]);
  if (audioQueue.length > 0) queue.select(Math.min(prev, audioQueue.length - 1));
  updateSelectionInfo();
  screen.render();
}

function folderOf(p: string): string {
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(0, i) : "";
}

function clearQueue(stopCurrent = false): void {
  audioQueue.length = 0;
  if (stopCurrent && player) player.kill("SIGTERM");
  queueRefresh();
}

function enqueueFollowingInFolder(workId: string, title: string, targetPath: string): void {
  const folder = folderOf(targetPath);
  const files = treeFlat
    .filter((r) => r.node.kind === "file")
    .map((r) => (r.node.kind === "file" ? r.node.entry : null))
    .filter((e): e is WorkTreeEntry => Boolean(e));

  const startIdx = files.findIndex((f) => f.path === targetPath);
  if (startIdx < 0) return;

  if (activeQueueFolder !== null && activeQueueFolder !== folder) {
    clearQueue(true);
    info(`フォルダ切替: キューをクリア (${activeQueueFolder} -> ${folder})`);
  }
  activeQueueFolder = folder;

  for (let i = startIdx; i < files.length; i++) {
    const f = files[i];
    if (folderOf(f.path) !== folder) break;
    enqueueEntry(workId, title, f);
  }
}

function removeQueueSelected(): void {
  if (audioQueue.length === 0) return;
  const idx = ((queue as unknown as { selected: number }).selected ?? 0);
  if (idx < 0 || idx >= audioQueue.length) return;
  const [rm] = audioQueue.splice(idx, 1);
  info(`queue-: ${rm.entry.path}`);
  if (audioQueue.length === 0) activeQueueFolder = null;
  queueRefresh();
}

async function ensurePlay(bin = "ffplay"): Promise<boolean> {
  try {
    await execFileAsync("bash", ["-lc", `command -v ${bin}`]);
    return true;
  } catch {
    warn(`${bin} が見つかりません。インストールしてください`);
    return false;
  }
}

function elapsedSec(): number {
  if (!currentPlayingPath) return 0;
  if (playerPaused) return currentStartSec;
  return currentStartSec + Math.max(0, (Date.now() - currentStartedAtMs) / 1000);
}

function spawnPlayer(pathToPlay: string, startSec: number): void {
  const args = ["-nodisp", "-autoexit", "-loglevel", "warning", "-volume", String(playerVolume), "-ss", String(Math.max(0, startSec)), pathToPlay];
  const proc = spawn("ffplay", args, { stdio: ["ignore", "ignore", "ignore"] });
  player = proc;
  playerPaused = false;
  currentPlayingPath = pathToPlay;
  currentStartSec = Math.max(0, startSec);
  currentStartedAtMs = Date.now();

  proc.on("exit", () => {
    player = null;
    playerPaused = false;
    if (isRestartingPlayer) {
      isRestartingPlayer = false;
      return;
    }
    currentPlayingPath = null;
    currentStartSec = 0;
    setStatus("再生終了");
    void playNextFromQueue();
  });
}

function restartCurrentAt(sec: number): void {
  if (!player || !currentPlayingPath) return;
  isRestartingPlayer = true;
  player.kill("SIGTERM");
  spawnPlayer(currentPlayingPath, sec);
}

async function playNextFromQueue(): Promise<void> {
  if (player || audioQueue.length === 0) return;
  if (!(await ensurePlay("ffplay"))) return;
  const item = audioQueue.shift()!;
  queueRefresh();
  setStatus(`再生中: ${item.entry.path}`);

  try {
    const local = await client.fetchPlayableToCache(item.workId, item.entry);
    spawnPlayer(local, 0);
  } catch (e) {
    err(`再生スキップ: ${String(e)}`);
    player = null;
    void playNextFromQueue();
  }
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
  if (folder.kind !== "folder") return;
  if (activeQueueFolder !== null && activeQueueFolder !== folder.path) {
    clearQueue(true);
    info(`フォルダ切替: キューをクリア (${activeQueueFolder} -> ${folder.path})`);
  }
  activeQueueFolder = folder.path;

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
  enqueueFollowingInFolder(treeWorkId, currentRow()?.title ?? treeWorkId, n.entry.path);
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
  updateSelectionInfo();
});
tree.on("select", () => updateSelectionInfo());
queue.on("select", () => updateSelectionInfo());

screen.key(["tab"], () => {
  if (screen.focused === library) tree.focus();
  else if (screen.focused === tree) queue.focus();
  else library.focus();
  updateFocusDecor();
  updateSelectionInfo();
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
screen.key(["enter"], () => {
  if (screen.focused === library) {
    void doLoadTree().then(() => {
      tree.focus();
      updateFocusDecor();
      updateSelectionInfo();
    }).catch((e) => err(String(e)));
    return;
  }
  if (screen.focused === tree) {
    toggleTreeRow();
    return;
  }
  if (screen.focused === queue) {
    if (player) player.kill("SIGTERM");
    else void playNextFromQueue();
  }
});
screen.key(["right", "l"], () => {
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
  if (row.node.kind === "file") {
    enqueueFollowingInFolder(treeWorkId, currentRow()?.title ?? treeWorkId, row.node.entry.path);
  }
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

screen.key(["x", "delete", "backspace"], () => {
  if (screen.focused !== queue) return;
  removeQueueSelected();
});

screen.key(["space"], () => {
  if (!player) return;
  if (!playerPaused) {
    currentStartSec = elapsedSec();
    playerPaused = true;
    player.kill("SIGSTOP");
    setStatus("一時停止");
  } else {
    player.kill("SIGCONT");
    playerPaused = false;
    currentStartedAtMs = Date.now();
    setStatus("再開");
  }
});

screen.key(["-"], () => {
  playerVolume = Math.max(0, playerVolume - 5);
  setStatus(`音量 ${playerVolume}%`);
  if (player && currentPlayingPath) restartCurrentAt(elapsedSec());
});

screen.key(["="], () => {
  playerVolume = Math.min(200, playerVolume + 5);
  setStatus(`音量 ${playerVolume}%`);
  if (player && currentPlayingPath) restartCurrentAt(elapsedSec());
});

screen.key(["["], () => {
  if (!player || !currentPlayingPath) return;
  const sec = Math.max(0, elapsedSec() - 10);
  setStatus(`-10秒シーク (${sec.toFixed(1)}s)`);
  restartCurrentAt(sec);
});

screen.key(["]"], () => {
  if (!player || !currentPlayingPath) return;
  const sec = Math.max(0, elapsedSec() + 10);
  setStatus(`+10秒シーク (${sec.toFixed(1)}s)`);
  restartCurrentAt(sec);
});

(async () => {
  await client.boot();
  if (await client.ensureLogin()) await doLibrary();
  else warn("未ログイン: c か i でCookie登録");
  library.focus();
  updateFocusDecor();
  updateSelectionInfo();
  screen.render();
})().catch((e) => err(String(e)));
