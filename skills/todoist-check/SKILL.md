---
name: todoist-check
description: Read Todoist tasks and projects from this OpenClaw workspace using the local Todoist token setup, and add tasks with project-aware placement. Use when a user asks to confirm Todoist tasks, list today or overdue items, inspect all tasks, check project names, filter Todoist work before planning, or add a Todoist task while choosing the best existing project first.
---

# Todoist Check

Use this skill to inspect Todoist quickly from the workspace without re-deriving the local setup.

## Read workflow

1. Assume the local token lives in `<workspace>/.env.todoist`.
2. Run the workspace helper script from the workspace root:
   - Today + overdue: `node scripts/todoist-read.mjs`
   - All tasks: `node scripts/todoist-read.mjs all --limit=50`
   - Projects: `node scripts/todoist-read.mjs projects`
3. Summarize the result in plain Japanese.
4. If the user wants narrowing, filter after retrieval or extend the script carefully.

## Add-task workflow

When the user asks to add a Todoist task, do not immediately throw it into Inbox.

1. First confirm the project list:
   - `node scripts/todoist-read.mjs projects`
2. Compare the task intent with existing projects.
   - Prefer the most semantically fitting project.
   - Match on obvious keywords, ongoing workstreams, or named contexts from the user.
   - Example: 研究関連なら `研究部`、仕事文脈なら `CARTA`、個人雑務なら `Inbox` や個人プロジェクト。
3. If one project is clearly the best fit, add the task there.
4. If multiple projects are plausible and confidence is low, ask the user a short clarification instead of guessing.
5. If no suitable project exists, say that and default deliberately (usually `Inbox`) or ask whether a new project should exist.
6. After adding, report:
   - task name
   - chosen project
   - due date if set

## What to return

Prefer compact lists with:
- task name
- due date when present
- project names when relevant

Good reply patterns:
- 「今日/期限切れはこれです」
- 「研究部だけ拾うとこれです」
- 「プロジェクト一覧はこれです」
- 「`研究部` に追加しました」

## Guardrails

- Treat `.env.todoist` as secret. Never echo the token back to the user.
- For task creation, inspect existing projects before choosing a destination.
- Do not create new projects unless the user explicitly wants that.
- If project choice is ambiguous, ask briefly instead of pretending confidence.
- If the script fails with an API version error, update it to Todoist API v1 before retrying.
- Keep Discord replies free of markdown tables.
