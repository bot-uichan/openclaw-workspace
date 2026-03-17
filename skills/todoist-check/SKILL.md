---
name: todoist-check
description: Read Todoist tasks and projects from this OpenClaw workspace using the local Todoist token setup. Use when a user asks to confirm Todoist tasks, list today or overdue items, inspect all tasks, check project names, or filter Todoist work before planning. This skill is for read-oriented Todoist checks in this workspace, not full task management.
---

# Todoist Check

Use this skill to inspect Todoist quickly from the workspace without re-deriving the local setup.

## Workflow

1. Assume the local token lives in `<workspace>/.env.todoist`.
2. Run the workspace helper script from the workspace root:
   - Today + overdue: `node scripts/todoist-read.mjs`
   - All tasks: `node scripts/todoist-read.mjs all --limit=50`
   - Projects: `node scripts/todoist-read.mjs projects`
3. Summarize the result in plain Japanese.
4. If the user wants narrowing, filter after retrieval or extend the script carefully.

## What to return

Prefer compact lists with:
- task name
- due date when present
- project names when relevant

Good reply patterns:
- 「今日/期限切れはこれです」
- 「研究部だけ拾うとこれです」
- 「プロジェクト一覧はこれです」

## Guardrails

- Treat `.env.todoist` as secret. Never echo the token back to the user.
- This skill is read-first. If the user asks to add, complete, or reschedule tasks, handle that deliberately instead of pretending this skill already covers writes.
- If the script fails with an API version error, update it to Todoist API v1 before retrying.
- Keep Discord replies free of markdown tables.
