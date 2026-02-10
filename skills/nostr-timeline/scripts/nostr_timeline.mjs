#!/usr/bin/env node
/**
 * Nostr timeline fetcher (no deps)
 * - Fetch kind:3 contact list for a user (follow pubkeys)
 * - Fetch kind:1 notes (and optionally kind:6 reposts) from those authors
 * - Wait for EOSE per subscription (with timeout)
 */

import { setTimeout as sleep } from 'node:timers/promises';

function usage(exitCode = 0) {
  const msg = `Usage:
  node scripts/nostr_timeline.mjs --relay wss://relay.example --npub npub1... [options]
  node scripts/nostr_timeline.mjs --relay wss://relay.example --pubkey <hex64> [options]

Options:
  --relay <wss://...>        (repeatable) relay URL(s)
  --npub <npub...>           user npub (bech32)
  --pubkey <hex64>           user pubkey hex
  --limit <n>                number of events (default 50)
  --since <unixSec>          filter since
  --until <unixSec>          filter until
  --format text|md|jsonl      output format (default text)
  --includeReposts           include kind:6
  --timeoutMs <ms>           EOSE wait timeout per request (default 8000)
  --maxAuthors <n>           chunk authors per REQ (default 250)
  -h, --help
`;
  console.log(msg);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {
    relays: [],
    npub: null,
    pubkey: null,
    limit: 50,
    since: null,
    until: null,
    format: 'text',
    includeReposts: false,
    timeoutMs: 8000,
    maxAuthors: 250,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') usage(0);
    if (a === '--relay') args.relays.push(argv[++i]);
    else if (a === '--npub') args.npub = argv[++i];
    else if (a === '--pubkey') args.pubkey = argv[++i];
    else if (a === '--limit') args.limit = Number(argv[++i]);
    else if (a === '--since') args.since = Number(argv[++i]);
    else if (a === '--until') args.until = Number(argv[++i]);
    else if (a === '--format') args.format = argv[++i];
    else if (a === '--includeReposts') args.includeReposts = true;
    else if (a === '--timeoutMs') args.timeoutMs = Number(argv[++i]);
    else if (a === '--maxAuthors') args.maxAuthors = Number(argv[++i]);
    else {
      console.error('Unknown arg:', a);
      usage(2);
    }
  }
  if (!args.relays.length) throw new Error('Missing --relay');
  if (!args.npub && !args.pubkey) throw new Error('Missing --npub or --pubkey');
  if (args.format !== 'text' && args.format !== 'md' && args.format !== 'jsonl') {
    throw new Error('Invalid --format');
  }
  return args;
}

// ---------- minimal bech32 decode (BIP-0173-ish), enough for npub ----------

const BECH32_ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32_MAP = new Map([...BECH32_ALPHABET].map((c, i) => [c, i]));

function bech32Polymod(values) {
  const GENERATORS = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((top >>> i) & 1) chk ^= GENERATORS[i];
    }
  }
  return chk;
}

function bech32HrpExpand(hrp) {
  const ret = [];
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) >>> 5);
  ret.push(0);
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) & 31);
  return ret;
}

function bech32VerifyChecksum(hrp, data) {
  return bech32Polymod([...bech32HrpExpand(hrp), ...data]) === 1;
}

function bech32Decode(str) {
  const s = str.toLowerCase();
  const pos = s.lastIndexOf('1');
  if (pos < 1 || pos + 7 > s.length) throw new Error('Invalid bech32');
  const hrp = s.slice(0, pos);
  const dataPart = s.slice(pos + 1);
  const data = [];
  for (const c of dataPart) {
    const v = BECH32_MAP.get(c);
    if (v === undefined) throw new Error('Invalid bech32 char');
    data.push(v);
  }
  if (!bech32VerifyChecksum(hrp, data)) throw new Error('Invalid bech32 checksum');
  return { hrp, data: data.slice(0, -6) };
}

function convertBits(data, fromBits, toBits, pad = true) {
  let acc = 0;
  let bits = 0;
  const ret = [];
  const maxv = (1 << toBits) - 1;
  for (const value of data) {
    if (value < 0 || (value >>> fromBits) !== 0) throw new Error('convertBits invalid value');
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      ret.push((acc >>> bits) & maxv);
    }
  }
  if (pad) {
    if (bits) ret.push((acc << (toBits - bits)) & maxv);
  } else {
    if (bits >= fromBits) throw new Error('convertBits excess padding');
    if ((acc << (toBits - bits)) & maxv) throw new Error('convertBits non-zero padding');
  }
  return ret;
}

function npubToHex(npub) {
  const { hrp, data } = bech32Decode(npub);
  if (hrp !== 'npub') throw new Error('Expected npub');
  const bytes = Uint8Array.from(convertBits(data, 5, 8, false));
  return Buffer.from(bytes).toString('hex');
}

function isHex64(s) {
  return /^[0-9a-fA-F]{64}$/.test(s);
}

// ---------- nostr relay client ----------

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function makeSubId(prefix = 'sub') {
  return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

async function withWebSocket(url, fn) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error(`WebSocket error: ${url}`)), { once: true });
  });
  try {
    return await fn(ws);
  } finally {
    try { ws.close(); } catch {}
  }
}

function send(ws, msg) {
  ws.send(JSON.stringify(msg));
}

async function reqOnce(ws, filter, { timeoutMs = 8000, subId = makeSubId('req') } = {}) {
  const events = [];
  let eose = false;

  const onMessage = (ev) => {
    let data;
    try { data = JSON.parse(ev.data); } catch { return; }
    if (!Array.isArray(data)) return;
    const [type, sid, payload] = data;
    if (sid !== subId) return;
    if (type === 'EVENT') events.push(payload);
    if (type === 'EOSE') eose = true;
  };
  ws.addEventListener('message', onMessage);

  send(ws, ['REQ', subId, filter]);

  const start = Date.now();
  while (!eose && Date.now() - start < timeoutMs) {
    await sleep(20);
  }
  // Close subscription to be nice.
  send(ws, ['CLOSE', subId]);
  ws.removeEventListener('message', onMessage);

  return { events, eose, subId };
}

function uniq(arr) {
  return [...new Set(arr)];
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function normalizeEvent(e) {
  return {
    id: e.id,
    pubkey: e.pubkey,
    created_at: e.created_at,
    kind: e.kind,
    content: e.content,
    tags: e.tags,
    sig: e.sig,
  };
}

function formatText(e) {
  const ts = new Date(e.created_at * 1000).toISOString();
  const who = e.pubkey.slice(0, 8);
  const body = (e.content || '').replace(/\s+$/g, '');
  const kindLabel = e.kind === 6 ? 'repost' : 'note';
  return `[${ts}] (${kindLabel}) ${who}: ${body}`;
}

function formatMd(e) {
  const ts = new Date(e.created_at * 1000).toISOString();
  const who = e.pubkey;
  const body = (e.content || '').replace(/\r/g, '');
  const kindLabel = e.kind === 6 ? 'repost' : 'note';
  return `- ${ts} \`${kindLabel}\` \`${who}\`\n\n  ${body.split('\n').map(l => l ? l : ' ').join('\n  ')}\n`;
}

async function fetchFollowsFromRelay(relay, userPubkey, timeoutMs) {
  return await withWebSocket(relay, async (ws) => {
    const filter = { kinds: [3], authors: [userPubkey], limit: 1 };
    const { events } = await reqOnce(ws, filter, { timeoutMs, subId: makeSubId('contacts') });
    if (!events.length) return [];
    const ev = events.sort((a, b) => b.created_at - a.created_at)[0];
    const follows = [];
    for (const t of ev.tags || []) {
      if (Array.isArray(t) && t[0] === 'p' && typeof t[1] === 'string' && isHex64(t[1])) follows.push(t[1]);
    }
    return uniq(follows);
  });
}

async function fetchTimelineFromRelay(relay, authors, opts) {
  const { limit, since, until, includeReposts, timeoutMs, maxAuthors } = opts;
  const kinds = includeReposts ? [1, 6] : [1];
  const authorChunks = chunk(authors, maxAuthors);

  const all = [];
  await withWebSocket(relay, async (ws) => {
    for (const authorsChunk of authorChunks) {
      const filter = { kinds, authors: authorsChunk, limit };
      if (since != null) filter.since = since;
      if (until != null) filter.until = until;
      const { events } = await reqOnce(ws, filter, { timeoutMs, subId: makeSubId('tl') });
      for (const e of events) all.push(e);
    }
  });

  // Dedup by id and sort
  const byId = new Map();
  for (const e of all) {
    if (e && e.id && !byId.has(e.id)) byId.set(e.id, e);
  }
  const out = [...byId.values()].sort((a, b) => b.created_at - a.created_at);
  return out.slice(0, limit).map(normalizeEvent);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const userPubkey = args.pubkey ? args.pubkey.toLowerCase() : npubToHex(args.npub);
  if (!isHex64(userPubkey)) throw new Error('Invalid pubkey');

  // Try relays in order for follows; first success wins.
  let follows = [];
  let lastErr;
  for (const r of args.relays) {
    try {
      follows = await fetchFollowsFromRelay(r, userPubkey, args.timeoutMs);
      if (follows.length) break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (!follows.length) {
    // Fallback: at least include self so we can show *something*.
    follows = [userPubkey];
    if (lastErr) console.error(String(lastErr));
    console.error('No follows found; using self only.');
  }

  // Always include self
  const authors = uniq([userPubkey, ...follows]);

  // Fetch timeline: try each relay and merge
  const merged = new Map();
  for (const r of args.relays) {
    try {
      const evs = await fetchTimelineFromRelay(r, authors, args);
      for (const e of evs) merged.set(e.id, e);
    } catch (e) {
      console.error(`Relay failed: ${r} (${e?.message || e})`);
    }
  }

  const events = [...merged.values()].sort((a, b) => b.created_at - a.created_at).slice(0, args.limit);

  if (args.format === 'jsonl') {
    for (const e of events) console.log(JSON.stringify(e));
  } else if (args.format === 'md') {
    for (const e of events) process.stdout.write(formatMd(e) + '\n');
  } else {
    for (const e of events) console.log(formatText(e));
  }
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(1);
});
