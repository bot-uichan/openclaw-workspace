#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const STATE_PATH = path.join(__dirname, '..', 'memory', 'demo-trade-wallet.json');
const LOG_PATH = path.join(__dirname, '..', 'memory', 'demo-trade-log.jsonl');
const BINANCE_SYMBOLS = ['BTCUSDC', 'ETHUSDC', 'SOLUSDC'];

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    out[key] = val;
  }
  return out;
}

function toNum(v, d = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function isPumpSymbol(symbol) {
  return /^PUMP:[1-9A-HJ-NP-Za-km-z]{32,44}$/i.test(symbol || '');
}

function getPumpMint(symbol) {
  return String(symbol).split(':')[1];
}

function loadState() {
  ensureDir(STATE_PATH);
  if (!fs.existsSync(STATE_PATH)) {
    return {
      usdc: 1000,
      positions: {},
      history: [],
      decisionHistory: [],
      lastTradeAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  if (!Array.isArray(state.history)) state.history = [];
  if (!Array.isArray(state.decisionHistory)) state.decisionHistory = [];
  if (!state.positions || typeof state.positions !== 'object') state.positions = {};
  if (typeof state.usdc !== 'number') state.usdc = 1000;
  return state;
}

function saveState(state) {
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

async function fetchBinanceTickers(symbols) {
  if (!symbols.length) return {};
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'openclaw-demo-trade/3.0' } });
  if (!res.ok) throw new Error(`Failed to fetch Binance tickers: ${res.status}`);
  const data = await res.json();
  const map = {};
  for (const t of data) {
    map[t.symbol] = {
      price: Number(t.lastPrice),
      changePct: Number(t.priceChangePercent),
      source: 'binance',
    };
  }
  return map;
}

async function fetchPumpTicker(symbol) {
  const mint = getPumpMint(symbol);
  const url = `https://api.dexscreener.com/latest/dex/tokens/${mint}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'openclaw-demo-trade/3.0' } });
  if (!res.ok) throw new Error(`Failed to fetch DexScreener token ${mint}: ${res.status}`);
  const data = await res.json();
  const pairs = Array.isArray(data.pairs) ? data.pairs : [];
  if (!pairs.length) throw new Error(`No DexScreener pairs for ${symbol}`);

  const ranked = pairs
    .filter((p) => Number(p?.priceUsd) > 0)
    .sort((a, b) => Number(b?.liquidity?.usd || 0) - Number(a?.liquidity?.usd || 0));

  if (!ranked.length) throw new Error(`No USD-priced DexScreener pairs for ${symbol}`);
  const best = ranked[0];

  return {
    price: Number(best.priceUsd),
    changePct: Number(best?.priceChange?.h24 || 0),
    source: 'dexscreener',
    pair: best.pairAddress,
    dexId: best.dexId,
    chainId: best.chainId,
    tokenAddress: mint,
  };
}

async function fetchTickers(state, requestedSymbol) {
  const universe = new Set(BINANCE_SYMBOLS);
  Object.keys(state.positions || {}).forEach((s) => universe.add(s));
  if (requestedSymbol) universe.add(requestedSymbol);

  const all = [...universe];
  const binanceSymbols = all.filter((s) => BINANCE_SYMBOLS.includes(s));
  const pumpSymbols = all.filter((s) => isPumpSymbol(s));

  const out = await fetchBinanceTickers(binanceSymbols);
  for (const s of pumpSymbols) {
    out[s] = await fetchPumpTicker(s);
  }
  return out;
}

function portfolioValue(state, tickers) {
  let total = state.usdc;
  for (const [symbol, pos] of Object.entries(state.positions)) {
    if (!tickers[symbol]) continue;
    total += pos.qty * tickers[symbol].price;
  }
  return total;
}

function appendLog(entry) {
  ensureDir(LOG_PATH);
  fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n');
}

function validateSymbol(symbol) {
  if (BINANCE_SYMBOLS.includes(symbol)) return;
  if (isPumpSymbol(symbol)) return;
  throw new Error(
    `Unsupported symbol: ${symbol}. Use Binance: ${BINANCE_SYMBOLS.join(', ')} or pump token as PUMP:<solana_mint>`
  );
}

function ensureReason(reason) {
  if (!reason || !String(reason).trim()) {
    throw new Error('Decision reason is required. Pass --reason "なぜこの判断か"');
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const action = String(args.action || 'HOLD').toUpperCase();
  const symbol = args.symbol ? String(args.symbol).toUpperCase() : null;
  const reason = args.reason || args.why;
  const usdcAmount = toNum(args.usdc, null);
  const amountPct = toNum(args.pct, null);
  const qty = toNum(args.qty, null);

  ensureReason(reason);

  const state = loadState();
  const tickers = await fetchTickers(state, symbol);
  const now = new Date().toISOString();
  const trades = [];

  if (action === 'BUY') {
    if (!symbol) throw new Error('BUY requires --symbol');
    validateSymbol(symbol);
    const mkt = tickers[symbol];
    if (!mkt) throw new Error(`No market price for ${symbol}`);

    const spend = usdcAmount ?? (amountPct != null ? state.usdc * (amountPct / 100) : 0);
    if (!Number.isFinite(spend) || spend <= 0) {
      throw new Error('BUY requires --usdc <amount> or --pct <0-100>');
    }
    if (spend > state.usdc) throw new Error(`Insufficient USDC. cash=${state.usdc}, spend=${spend}`);

    const buyQty = spend / mkt.price;
    state.usdc -= spend;
    if (!state.positions[symbol]) {
      state.positions[symbol] = { qty: 0, entryPrice: mkt.price, openedAt: now };
    }
    const pos = state.positions[symbol];
    const oldCost = pos.qty * pos.entryPrice;
    const newCost = oldCost + spend;
    pos.qty += buyQty;
    pos.entryPrice = newCost / pos.qty;

    trades.push({ side: 'BUY', symbol, qty: Number(buyQty.toFixed(8)), price: mkt.price, spendUsdc: Number(spend.toFixed(4)), reason, source: mkt.source });
    state.lastTradeAt = now;
  } else if (action === 'SELL') {
    if (!symbol) throw new Error('SELL requires --symbol');
    validateSymbol(symbol);
    const pos = state.positions[symbol];
    if (!pos || pos.qty <= 0) throw new Error(`No position for ${symbol}`);
    const mkt = tickers[symbol];
    if (!mkt) throw new Error(`No market price for ${symbol}`);

    const sellQty = qty ?? (amountPct != null ? pos.qty * (amountPct / 100) : pos.qty);
    if (!Number.isFinite(sellQty) || sellQty <= 0) throw new Error('Invalid sell qty. Use --qty or --pct');
    if (sellQty > pos.qty) throw new Error(`Sell qty exceeds position. pos=${pos.qty}, sell=${sellQty}`);

    const proceeds = sellQty * mkt.price;
    state.usdc += proceeds;
    pos.qty -= sellQty;
    if (pos.qty <= 1e-12) delete state.positions[symbol];

    const pnlPct = ((mkt.price - pos.entryPrice) / pos.entryPrice) * 100;
    trades.push({ side: 'SELL', symbol, qty: Number(sellQty.toFixed(8)), price: mkt.price, proceedsUsdc: Number(proceeds.toFixed(4)), pnlPct: Number(pnlPct.toFixed(2)), reason, source: mkt.source });
    state.lastTradeAt = now;
  } else if (action === 'SELL_ALL') {
    for (const [s, pos] of Object.entries(state.positions)) {
      const mkt = tickers[s];
      if (!mkt) continue;
      const proceeds = pos.qty * mkt.price;
      const pnlPct = ((mkt.price - pos.entryPrice) / pos.entryPrice) * 100;
      state.usdc += proceeds;
      trades.push({ side: 'SELL', symbol: s, qty: Number(pos.qty.toFixed(8)), price: mkt.price, proceedsUsdc: Number(proceeds.toFixed(4)), pnlPct: Number(pnlPct.toFixed(2)), reason, source: mkt.source });
      delete state.positions[s];
    }
    if (trades.length) state.lastTradeAt = now;
  } else if (action !== 'HOLD') {
    throw new Error('action must be HOLD|BUY|SELL|SELL_ALL');
  }

  const total = portfolioValue(state, tickers);
  const entry = {
    at: now,
    decision: {
      action,
      symbol,
      reason: String(reason),
      params: { usdcAmount, amountPct, qty },
    },
    usdc: Number(state.usdc.toFixed(4)),
    positions: Object.fromEntries(
      Object.entries(state.positions).map(([s, p]) => [s, { qty: Number(p.qty.toFixed(8)), entryPrice: Number(p.entryPrice.toFixed(8)) }])
    ),
    tickers,
    totalUsdcValue: Number(total.toFixed(4)),
    trades,
  };

  state.history.push({ at: now, totalUsdcValue: entry.totalUsdcValue });
  state.decisionHistory.push({ at: now, action, symbol, reason: String(reason) });
  if (state.history.length > 500) state.history = state.history.slice(-500);
  if (state.decisionHistory.length > 500) state.decisionHistory = state.decisionHistory.slice(-500);

  saveState(state);
  appendLog(entry);

  const tradeText = trades.length ? trades.map((t) => `${t.side} ${t.symbol}`).join(', ') : 'NO_TRADE';
  console.log(`[demo-trade] ${tradeText} | decision=${action} | total=${entry.totalUsdcValue} USDC | cash=${entry.usdc}`);
}

main().catch((err) => {
  console.error('[demo-trade] error', err.message || err);
  process.exit(1);
});
