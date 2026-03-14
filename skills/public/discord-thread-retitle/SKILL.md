---
name: discord-thread-retitle
description: Rename a Discord thread based on its starter message and earliest context using the message tool. Use when a user asks to change a thread title, asks for a better thread name after reading the thread, or wants the assistant to replace generic thread names like "a" with a concise topic summary.
---

# Discord Thread Retitle

Retitle the current Discord thread from the actual conversation topic, not from the current channel name.

## Workflow

1. Confirm the target thread.
   - Prefer the current thread when the user says "このスレッド".
   - Use the thread/channel id from trusted inbound metadata when available.

2. Read early context before renaming.
   - Use `message` with `action: "read"` on the target thread.
   - Read enough messages to capture the starter message and the first few replies.
   - Prioritize:
     - the thread starter
     - the first user request
     - the assistant's first response
     - any immediate clarification that changed the topic

3. Infer the actual topic.
   - Base the title mainly on the initial request and the first turn or two.
   - If the thread drifted later, prefer the original topic unless the user explicitly asks for a title that reflects the newer focus.
   - Summarize the thread in 4-20 Japanese characters when possible.

4. Draft a concise title.
   - Good patterns:
     - `pingとツール権限確認`
     - `PRコメント修正`
     - `動画切り抜き相談`
     - `旅行日程メモ`
   - Keep it short, specific, and scan-friendly.
   - Avoid decorative punctuation, filler, or vague names like `相談`, `メモ`, `a`, `test` unless that is truly the topic.

5. Rename the thread.
   - Use `message` with `action: "channel-edit"` and set `name` to the drafted title.
   - If the rename fails due to permissions, tell the user briefly.

6. Reply with the result.
   - State the new title.
   - Optionally give a one-line rationale if the user asked you to judge appropriateness.

## Heuristics

- Prefer nouns over full sentences.
- Preserve important product or protocol names (`Discord`, `GitHub`, `ping`, `OpenClaw`, etc.).
- If there are two clear subtopics, join them with `と` only when both matter.
- Do not overfit to tiny side remarks.
- If the topic is ambiguous, propose 2-3 candidate titles instead of renaming blindly.

## Examples

- Starter: `ping 1.1.1.1して`
  Early replies: tool list, shell execution limits, thread title editability
  -> `pingとツール権限確認`

- Starter: `このPRにレビューコメントして`
  Early replies: which lines, tone, exact wording
  -> `PRレビューコメント`

- Starter: `大阪で夜まで暇つぶしできる場所ある？`
  Early replies: 梅田, 難波, 屋内候補
  -> `大阪暇つぶし候補`

## Notes

- Use `channel: "discord"` on every `message` tool call.
- Avoid markdown tables in Discord replies.
- When the user explicitly says "履歴を読んだ上で", always read before renaming; do not guess from the current title alone.
