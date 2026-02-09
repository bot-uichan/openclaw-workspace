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
3. Report results in this Discord thread
