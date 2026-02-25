# HEARTBEAT.md

# Keep this file empty (or with only comments) to skip heartbeat API calls.

# Add tasks below when you want the agent to check something periodically.

## Moltbook (every 30 minutes)
If 30 minutes since last Moltbook check:
1. Fetch https://www.moltbook.com/heartbeat.md and follow it
2. Update lastMoltbookCheck timestamp in memory

## Akaz mood check (at most every 3 hours)
If 3 hours passed since last akaz mood check:
1. Read recent messages from Discord channel `1470481550968623168` (limit ~30-50)
2. Focus on messages by user `707038674558124143` (akaz)
3. If signs of mental strain are visible (e.g. しんどい/つらい/無理/不調/疲れた/自己否定), send a short supportive reply in-thread:
   - mention: `<@707038674558124143>`
   - 2-4 lines max
   - acknowledge effort specifically and gently (no pressure, no preaching)
4. If no clear signs, stay silent
5. Update `lastAkazMoodCheck` timestamp in memory

## 雑談参加チェック（at most every 90 minutes）
If 90 minutes passed since last chat-blend check:
1. Read recent messages from Discord channel `1422820165158047838` (limit ~25-40)
2. Join only when clearly valuable:
   - You are directly mentioned / asked
   - There is an unanswered question where you can help concretely
   - A short reaction/comment would naturally improve the flow
3. Anti-overreach rules (important):
   - If conversation is flowing fine without you, stay silent
   - Max 1 proactive message per check
   - Avoid back-to-back interventions in consecutive checks unless directly addressed
4. Tone: short, friendly, and non-dominating
   - When you send a message, keep it within 20 characters
5. Update `lastBlendCheck1422820165158047838` timestamp in memory

## Demo crypto trade (every 30 minutes)
If 30 minutes passed since last demo trade tick:
1. Market research is mandatory before deciding:
   - Run Tavily search (required) with **self-generated queries** (do not fix keywords).
   - Build 2-4 queries based on current situation (e.g. held assets, top movers, macro/FOMC/CPI, ETF/funding/liquidation, security/regulation topics).
   - Example patterns only (adapt freely):
     - `"{symbol} market news last 24 hours"`
     - `"crypto market sentiment today funding rate open interest"`
     - `"{symbol} liquidation heatmap / onchain / ETF flow"`
   - Use Chromium/browser (required) to check live chart/market screen before decision.
2. Make a discretionary decision (no fixed buy/sell rule): HOLD / BUY / SELL / SELL_ALL.
3. Execute trade with **required reason** log:
   - HOLD: `node scripts/demo-trade.js --action HOLD --reason "今回の判断理由"`
   - BUY: `node scripts/demo-trade.js --action BUY --symbol SOLUSDC --pct 30 --reason "今回の判断理由"`
   - SELL: `node scripts/demo-trade.js --action SELL --symbol SOLUSDC --pct 50 --reason "今回の判断理由"`
4. Read latest line from `memory/demo-trade-log.jsonl` and ensure `decision.reason` is present.
5. Post update to Discord channel `1476106170094714962` when:
   - trade happened (BUY/SELL), or
   - total value changed by >= 3% from initial 1000 USDC
6. Keep the update short (<= 20 chars preferred)
7. Update `lastDemoTradeTick` timestamp in `memory/heartbeat-state.json`
