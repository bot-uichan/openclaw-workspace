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
const header = blessed.box({ parent: screen, top: 0, left: 0, width: "100%", height: 1, style: { fg: "black", bg: "cyan" }, content: " DLsite TUI | ?:help !:diag TAB c i s l ENTER t a A n d x y space [ ] -/= q" });

const library = blessed.listtable({ parent: screen, top: 1, left: 0, width: "48%", height: "62%", border: "line", keys: true, vi: true, mouse: true, style: { header: { fg: "yellow", bold: true }, cell: { selected: { bg: "blue" } } }, data: [["Title", "ID"]] });
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
const miniPlayer = blessed.box({ parent: screen, top: "63%", left: 0, width: "100%", height: 3, border: "line", tags: true, content: " {magenta-fg}Player{/magenta-fg}: idle" });
const selectionInfo = blessed.box({ parent: screen, top: "66%", left: 0, width: "100%", height: 3, border: "line", tags: true, content: " {cyan-fg}Selection{/cyan-fg}: -" });
const logs = blessed.log({ parent: screen, top: "69%", left: 0, width: "100%", height: "28%-2", border: "line", label: " Logs ", tags: true });
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
const playCache = new Map<string, string>();
const prefetchJobs = new Map<string, Promise<string>>();

const client = new DlsiteClient(stateDir, downloadDir);

const info = (m: string) => { logs.log(`{green-fg}${m}{/green-fg}`); screen.render(); };
const warn = (m: string) => { logs.log(`{yellow-fg}${m}{/yellow-fg}`); screen.render(); };
const err = (m: string) => { logs.log(`{red-fg}${m}{/red-fg}`); screen.render(); };
const setStatus = (m: string) => { status.setContent(` ${m}`); updateMiniPlayer(); screen.render(); };

function updateFocusDecor(): void {
  const f = screen.focused;
  library.style.border = { fg: f === library ? "cyan" : "gray" };
  tree.style.border = { fg: f === tree ? "cyan" : "gray" };
  queue.style.border = { fg: f === queue ? "cyan" : "gray" };
}

function updateMiniPlayer(): void {
  const state = player ? (playerPaused ? "paused" : "playing") : "idle";
  const pos = currentPlayingPath ? `${elapsedSec().toFixed(1)}s` : "0.0s";
  const title = currentPlayingPath ? path.basename(currentPlayingPath) : "-";
  miniPlayer.setContent(` {magenta-fg}Player{/magenta-fg}: ${state} | ${title} | ${pos} | vol ${playerVolume}%`);
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
  library.setData([["Title", "ID"], ...newRows.map((r) => [r.title.slice(0, 72), r.kind === "owned" ? (r.raw as OwnedWork).id : "SEARCH"])]);
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

function showOverlay(title: string, content: string): void {
  const box = blessed.box({
    parent: screen,
    top: "center",
    left: "center",
    width: "80%",
    height: "70%",
    border: "line",
    tags: true,
    scrollable: true,
    keys: true,
    vi: true,
    mouse: true,
    label: ` ${title} (q/esc to close) `,
    content,
  });
  box.focus();
  const close = () => {
    box.destroy();
    updateFocusDecor();
    updateSelectionInfo();
    screen.render();
  };
  box.key(["q", "escape"], close);
  screen.render();
}

function showHelp(): void {
  const focus = screen.focused === library ? "Library" : screen.focused === tree ? "Tree" : "Queue";
  const focusTips =
    focus === "Library"
      ? "ENTER: treeロード, l:更新, s:検索"
      : focus === "Tree"
      ? "ENTER: 展開/キュー投入, a:同フォルダ以降, A:配下全部"
      : "x/del: 1件削除, n:次へ";

  showOverlay(
    "Help",
    `{bold}Global{/bold}\nTAB focus | c cookie | i auth-helper | l refresh library | t refresh tree | d download | y copy URL\n\n{bold}Playback{/bold}\nspace pause/resume | [ ] seek | -/= volume | n next\n\n{bold}Focus Now{/bold}: ${focus}\n${focusTips}\n`,
  );
}

async function showDiagnostics(): Promise<void> {
  const d = await client.runDiagnostics();
  const content = [
    `{bold}Cookie{/bold}: ${d.cookieCount}`,
    `{bold}Login{/bold}: ${d.loginOk ? "OK" : "NG"}`,
    `{bold}API count{/bold}: ${d.countOk ? "OK" : "NG"}`,
    `{bold}API sales{/bold}: ${d.salesOk ? "OK" : "NG"}`,
    `{bold}Library cache{/bold}: ${d.libraryCacheWorks} works`,
    `{bold}Tree cache files{/bold}: ${d.treeCacheFiles}`,
    "",
    `{bold}Errors{/bold}:`,
    ...(d.errors.length ? d.errors : ["none"]),
  ].join("\n");
  showOverlay("Diagnostics", content);
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

function queueItemKey(workId: string, entryPath: string): string {
  return `${workId}::${entryPath}`;
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
  if (stopCurrent) killPlayer("SIGKILL");
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

function prefetchQueue(limit = 2): void {
  for (const item of audioQueue.slice(0, limit)) {
    const key = queueItemKey(item.workId, item.entry.path);
    if (playCache.has(key) || prefetchJobs.has(key)) continue;
    const job = client
      .fetchPlayableToCache(item.workId, item.entry)
      .then((local) => {
        playCache.set(key, local);
        prefetchJobs.delete(key);
        return local;
      })
      .catch((e) => {
        prefetchJobs.delete(key);
        throw e;
      });
    prefetchJobs.set(key, job);
  }
}

async function resolvePlayablePath(item: QueueItem): Promise<string> {
  const key = queueItemKey(item.workId, item.entry.path);
  if (playCache.has(key)) return playCache.get(key)!;
  if (prefetchJobs.has(key)) return prefetchJobs.get(key)!;
  const local = await client.fetchPlayableToCache(item.workId, item.entry);
  playCache.set(key, local);
  return local;
}

function elapsedSec(): number {
  if (!currentPlayingPath) return 0;
  if (playerPaused) return currentStartSec;
  return currentStartSec + Math.max(0, (Date.now() - currentStartedAtMs) / 1000);
}

function killPlayer(signal: NodeJS.Signals = "SIGTERM"): void {
  if (!player) return;
  try {
    player.kill(signal);
  } catch {
    // ignore
  }
}

function sendPlayerKey(key: string, note?: string): void {
  if (!player?.stdin?.writable) return;
  try {
    player.stdin.write(key);
    if (note) setStatus(note);
  } catch {
    // ignore
  }
}

function spawnPlayer(pathToPlay: string, startSec: number): void {
  const args = ["-nodisp", "-autoexit", "-loglevel", "warning", "-volume", String(playerVolume), "-ss", String(Math.max(0, startSec)), pathToPlay];
  const proc = spawn("ffplay", args, { stdio: ["pipe", "ignore", "ignore"] });
  player = proc;
  playerPaused = false;
  currentPlayingPath = pathToPlay;
  currentStartSec = Math.max(0, startSec);
  currentStartedAtMs = Date.now();

  proc.on("exit", () => {
    if (player === proc) {
      player = null;
      playerPaused = false;
      currentPlayingPath = null;
      currentStartSec = 0;
      setStatus("再生終了");
      prefetchQueue(2);
      void playNextFromQueue();
    }
  });
}

function restartCurrentAt(sec: number): void {
  if (!currentPlayingPath) return;
  killPlayer("SIGKILL");
  spawnPlayer(currentPlayingPath, sec);
}

async function playNextFromQueue(): Promise<void> {
  if (player || audioQueue.length === 0) return;
  if (!(await ensurePlay("ffplay"))) return;
  const item = audioQueue.shift()!;
  queueRefresh();
  setStatus(`再生中: ${item.entry.path}`);

  try {
    const local = await resolvePlayablePath(item);
    spawnPlayer(local, 0);
    prefetchQueue(2);
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
  prefetchQueue(2);
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

async function doLibrary(forceRefresh = false): Promise<void> {
  setStatus(forceRefresh ? "ライブラリ更新中..." : "ライブラリ読み込み中(キャッシュ優先)...");
  const works = await client.listOwnedWorks(forceRefresh);
  setRows(works.map((w) => ({ kind: "owned", title: w.title, url: w.detailUrl, raw: w })));
  setStatus(`ライブラリ ${works.length}件${forceRefresh ? " (更新)" : ""}`);
}

async function doLoadTree(forceRefresh = false): Promise<void> {
  const id = currentWorkId();
  const row = currentRow();
  if (!id || !row) return warn("作品未選択");
  treeWorkId = id;
  treeRoots = await client.getWorkTreeNodes(id, forceRefresh);
  expanded.clear();
  treeRoots.forEach((n) => n.kind === "folder" && expanded.add(n.path));
  rebuildTreeList();
  info(`tree loaded: ${id}${forceRefresh ? " (refresh)" : ""}`);
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
  clearQueue(false);
  killPlayer("SIGKILL");
  await client.close();
  process.exit(0);
});
screen.key(["c"], () => void (async () => {
  const s = await prompt("Cookie文字列 or JSON");
  if (!s) return;
  await client.setCookieInput(s);
  info("cookie saved");
})().catch((e) => err(String(e))));
screen.key(["i"], () => void client.importCookiesViaHelper().then(() => info("cookie imported via helper")).catch((e) => err(String(e))));
screen.key(["?"], () => showHelp());
screen.key(["!"], () => void showDiagnostics().catch((e) => err(String(e))));
screen.key(["s"], () => void doSearch().catch((e) => err(String(e))));
screen.key(["l"], () => void doLibrary(true).catch((e) => err(String(e))));
screen.key(["t"], () => void doLoadTree(true).catch((e) => err(String(e))));
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
  if (player) killPlayer("SIGKILL");
  else void playNextFromQueue();
});

screen.key(["x", "delete", "backspace"], () => {
  if (screen.focused !== queue) return;
  removeQueueSelected();
});

screen.key(["space"], () => {
  if (!player) return;
  sendPlayerKey("p", playerPaused ? "再開" : "一時停止");
  playerPaused = !playerPaused;
  if (!playerPaused) currentStartedAtMs = Date.now();
});

screen.key(["-"], () => {
  if (!player) return;
  playerVolume = Math.max(0, playerVolume - 5);
  sendPlayerKey("9", `音量 ${playerVolume}%`);
});

screen.key(["="], () => {
  if (!player) return;
  playerVolume = Math.min(200, playerVolume + 5);
  sendPlayerKey("0", `音量 ${playerVolume}%`);
});

screen.key(["["], () => {
  if (!player) return;
  sendPlayerKey("\u001b[D", "-10秒シーク");
});

screen.key(["]"], () => {
  if (!player) return;
  sendPlayerKey("\u001b[C", "+10秒シーク");
});

const cleanup = () => {
  killPlayer("SIGKILL");
};
process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

(async () => {
  await client.boot();
  if (await client.ensureLogin()) await doLibrary();
  else warn("未ログイン: c か i でCookie登録");
  library.focus();
  updateFocusDecor();
  updateMiniPlayer();
  updateSelectionInfo();
  setInterval(() => {
    updateMiniPlayer();
    screen.render();
  }, 500);
  screen.render();
})().catch((e) => err(String(e)));
