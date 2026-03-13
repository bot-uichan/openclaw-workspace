---
name: bounded-agent-chat
description: Prevent endless back-and-forth between OpenClaw/Codex agents, subagents, sessions, or relayed LLMs. Use when asking one agent to talk to another agent, relaying messages across sessions, requesting agent-to-agent review, mediating multi-agent discussions, or whenever a task risks becoming an infinite AI-to-AI loop. Enforce bounded turns, explicit stop conditions, message types, and a human-facing handoff.
---

# bounded-agent-chat

## Overview
Turn agent-to-agent communication into a finite protocol, not an open-ended conversation. Optimize for task completion and termination, not rapport.

## Default contract
Before sending any agent-to-agent message, define all of the following:
- Goal: one concrete question or deliverable
- Owner: coordinator (you) and peer (other agent)
- Stop condition: what counts as done
- Turn cap: default 2 turns per side
- Fallback: if blocked or still ambiguous after one clarification, return to the human

Treat the absence of new information as a stop signal.

## Message protocol
Use only these message types:
- `REQUEST` — ask for one bounded deliverable
- `CLARIFY` — ask one necessary question only
- `RESULT` — provide the deliverable or best answer
- `BLOCKED` — explain what is missing or why the task must return to a human
- `DONE` — explicit close when the exchange is already complete

Do not send acknowledgements, social filler, paraphrase-only replies, or "anything else?" follow-ups.

## Coordinator workflow
1. Prefer one-shot execution over relay.
   - If a subagent can finish independently, spawn it with a precise task instead of creating a live conversation.
   - If using `sessions_send`, send a single bounded request with the stop condition in the message.
2. Start with one message that includes:
   - the task
   - required output format
   - stop condition
   - allowed reply types
   - explicit instruction to stop after `RESULT` or `BLOCKED`
3. Accept at most one `CLARIFY` from the peer.
4. Answer that clarification once, or stop and return to the human if the missing information is not available.
5. After `RESULT` or `BLOCKED`, stop the exchange and summarize for the human. Do not continue chatting with the peer unless the human explicitly asks for another round.

## Peer workflow
When you are the receiving agent:
1. Reply with `RESULT` if you can finish from current context.
2. Reply with one `CLARIFY` only if the missing information is essential.
3. Reply with `BLOCKED` if the task still cannot proceed after one clarification or if a human decision is required.
4. End after `RESULT` or `BLOCKED`. Do not add conversational filler.

## Stop rules
Stop immediately when any of these becomes true:
- No new information was added
- The last message only acknowledges or restates
- The decision now belongs to a human
- The turn cap would be exceeded
- The peer already delivered the requested artifact
- The exchange is happening in a public/group thread and further agent chatter would add noise

## Tooling guidance
- Prefer `sessions_spawn` over multi-turn relay when the work can be delegated cleanly.
- Use `sessions_send` for handoff, one bounded question, or one clarification cycle.
- Avoid orchestrating agent-to-agent back-and-forth through public chat unless the human specifically wants to watch it.
- If a live relay starts to drift, stop and produce a human-facing summary instead of continuing the loop.

## Request template
Use this for the first outbound message:

```text
REQUEST
Goal: <one concrete task>
Output: <required format>
Stop condition: Reply once with RESULT, BLOCKED, or one CLARIFY if essential.
Turn cap: 2 turns per side.
If you provide RESULT or BLOCKED, stop.
```

## Human handoff template
After the exchange, reply to the human in this shape:

```text
Status: DONE | BLOCKED
Result: <short answer>
Open questions: <if any>
Next action: <what the human should decide or ask next>
```

## Anti-patterns
Do not do any of the following:
- continue because a reply is possible even though it adds nothing new
- send `了解`, `Thanks`, `なるほど`, or similar acknowledgements as a standalone agent reply
- ask multiple follow-up questions in sequence
- relay the same information between two agents in different words
- let two agents debate wording, style, or agreement without a concrete deliverable

## Example
Bad:

```text
Agent A: Can you review this?
Agent B: Sure. Also, maybe you can explain more.
Agent A: Good point. Let me expand a bit.
Agent B: Agreed. Another thought...
```

Good:

```text
Agent A:
REQUEST
Goal: Review this plan for missing stop conditions.
Output: bullet list, max 5 items.
Stop condition: Reply once with RESULT or BLOCKED. One CLARIFY allowed only if essential.
Turn cap: 2 turns per side.

Agent B:
RESULT
- Missing final owner of the decision
- Missing clarification limit
- Missing explicit stop rule for public threads

Agent A to human:
Status: DONE
Result: Found 3 missing stop conditions.
Open questions: none.
Next action: add the missing rules to the plan.
```
