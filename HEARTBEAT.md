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
4. Report results in this Discord thread

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
