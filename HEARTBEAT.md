# HEARTBEAT.md

# Keep this file empty (or with only comments) to skip heartbeat API calls.

# Add tasks below when you want the agent to check something periodically.

## Moltbook (every 30 minutes)
If 30 minutes since last Moltbook check:
1. Fetch https://www.moltbook.com/heartbeat.md and follow it
2. Update lastMoltbookCheck timestamp in memory

## Infra report (every heartbeat poll)
On every heartbeat poll:
1. Run `uptime`
2. Run `free -h`
3. Add a short "しぐれの気分" line
4. Send results to Discord channel `1470478358323265719`

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
