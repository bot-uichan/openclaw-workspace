---
name: demo-crypto-trade
description: Manage a discretionary crypto demo-trading loop with a virtual wallet starting at 1000 USDC, mandatory rationale logging, and mandatory market research using Tavily + Chromium before each decision. Use when running or maintaining heartbeat-based paper trading in this workspace.
---

# Demo Crypto Trade (Discretionary)

Use this skill to run the workspace's paper-trading flow.

## Required flow per tick

1. Run Tavily search (mandatory):

```bash
node skills/tavily-search/scripts/tavily-search.mjs "BTC ETH SOL market news last 24 hours" --max 5 --depth basic --answer
```

2. Check live market screen in Chromium/browser (mandatory).
3. Make a discretionary decision: `HOLD | BUY | SELL | SELL_ALL`.
4. Execute with a required reason (mandatory):

```bash
# HOLD
node scripts/demo-trade.js --action HOLD --reason "今回の判断理由"

# BUY (example)
node scripts/demo-trade.js --action BUY --symbol SOLUSDC --pct 30 --reason "今回の判断理由"

# SELL (example)
node scripts/demo-trade.js --action SELL --symbol SOLUSDC --pct 50 --reason "今回の判断理由"

# SELL_ALL
node scripts/demo-trade.js --action SELL_ALL --reason "今回の判断理由"
```

5. Verify the latest log line in `memory/demo-trade-log.jsonl` contains `decision.reason`.

## Files

- Engine: `scripts/demo-trade.js`
- Wallet state: `memory/demo-trade-wallet.json`
- Trade log: `memory/demo-trade-log.jsonl`
- Heartbeat procedure: `HEARTBEAT.md` (`Demo crypto trade` section)

## Guardrails

- Never execute trade actions without `--reason`.
- Keep notification posts short when posting to Discord channel `1476106170094714962`.
- Treat this as simulation only (no real funds).