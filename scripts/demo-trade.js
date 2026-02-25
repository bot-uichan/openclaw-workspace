#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const STATE_PATH = path.join(__dirname, '..', 'memory', 'demo-trade-wallet.json');
const LOG_PATH = path.join(__dirname, '..', 'memory', 'demo-trade-log.jsonl');
const SYMBOLS = ['BTCUSDC', 'ETHUSDC', 'SOLUSDC'];

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function loadState() {
  ensureDir(STATE_PATH);
  if (!fs.existsSync(STATE_PATH)) {
    return {
      usdc: 1000,
      positions: {},
      history: [],
      lastTradeAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
}

function saveState(state) {
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

async function fetchTickers() {
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(SYMBOLS))}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'openclaw-demo-trade/1.0' } });
  if (!res.ok) throw new Error(`Failed to fetch tickers: ${res.status}`);
  const data = await res.json();
  const map = {};
  for (const t of data) {
    map[t.symbol] = {
      price: Number(t.lastPrice),
      changePct: Number(t.priceChangePercent),
    };
  }
  return map;
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

function topGainer(tickers) {
  return Object.entries(tickers).sort((a, b) => b[1].changePct - a[1].changePct)[0];
}

async function main() {
  const state = loadState();
  const tickers = await fetchTickers();
  const now = new Date().toISOString();
  const trades = [];

  for (const [symbol, pos] of Object.entries(state.positions)) {
    const mkt = tickers[symbol];
    if (!mkt) continue;
    const pnlPct = ((mkt.price - pos.entryPrice) / pos.entryPrice) * 100;
    if (pnlPct >= 2.0 || pnlPct <= -1.5) {
      const proceeds = pos.qty * mkt.price;
      state.usdc += proceeds;
      delete state.positions[symbol];
      trades.push({ side: 'SELL', symbol, qty: pos.qty, price: mkt.price, pnlPct: Number(pnlPct.toFixed(2)), reason: pnlPct >= 2 ? 'take-profit' : 'stop-loss' });
      state.lastTradeAt = now;
    }
  }

  const currentTop = topGainer(tickers);
  if (currentTop) {
    const [symbol, mkt] = currentTop;
    const already = state.positions[symbol];
    const hasAnyPosition = Object.keys(state.positions).length > 0;

    if (!already && !hasAnyPosition && state.usdc >= 50 && mkt.changePct > 0) {
      const spend = state.usdc * 0.3;
      const qty = spend / mkt.price;
      state.usdc -= spend;
      state.positions[symbol] = { qty, entryPrice: mkt.price, openedAt: now };
      trades.push({ side: 'BUY', symbol, qty, price: mkt.price, reason: 'top-gainer-momentum' });
      state.lastTradeAt = now;
    }
  }

  const total = portfolioValue(state, tickers);
  const entry = {
    at: now,
    usdc: Number(state.usdc.toFixed(4)),
    positions: Object.fromEntries(
      Object.entries(state.positions).map(([s, p]) => [s, { qty: Number(p.qty.toFixed(8)), entryPrice: p.entryPrice }])
    ),
    tickers,
    totalUsdcValue: Number(total.toFixed(4)),
    trades,
  };

  state.history.push({ at: now, totalUsdcValue: entry.totalUsdcValue });
  if (state.history.length > 500) state.history = state.history.slice(-500);

  saveState(state);
  appendLog(entry);

  const tradeText = trades.length
    ? trades.map(t => `${t.side} ${t.symbol}`).join(', ')
    : 'NO_TRADE';
  console.log(`[demo-trade] ${tradeText} | total=${entry.totalUsdcValue} USDC | cash=${entry.usdc}`);
}

main().catch((err) => {
  console.error('[demo-trade] error', err);
  process.exit(1);
});
