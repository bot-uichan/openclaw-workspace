---
name: bounded-agent-chat
description: Prevent endless back-and-forth between OpenClaw/Codex agents, subagents, sessions, or relayed LLMs without forcing premature stop by hard turn counts. Use when asking one agent to talk to another agent, relaying messages across sessions, requesting agent-to-agent review, mediating multi-agent discussions, or whenever a task risks becoming an infinite AI-to-AI loop. Enforce semantic continuation rules, explicit stop conditions, message types, and a human-facing handoff.
---

# bounded-agent-chat

## Overview
Turn agent-to-agent communication into a finite protocol, not an open-ended conversation. Allow multi-turn collaboration while each turn materially advances the task. Stop when the exchange stops changing the state of the work.

## Default contract
Before sending any agent-to-agent message, define all of the following:
- Goal: one concrete question, decision, or deliverable
- Owner: coordinator (you), peer (other agent), and final human recipient if relevant
- Finish state: what completion looks like
- Continuation condition: what kind of next message would still count as progress
- Fallback: what to do if progress stalls or a human decision becomes necessary

Treat "can still reply" and "should still reply" as different questions.

## Message protocol
Use only these message types:
- `REQUEST` — ask for one bounded deliverable or analysis pass
- `CLARIFY` — request missing information that is necessary to continue
- `PROGRESS` — provide an intermediate result that narrows the problem or advances the artifact
- `RESULT` — provide the final deliverable or best answer
- `BLOCKED` — explain what is missing or why the task must return to a human
- `DONE` — explicitly close when the exchange is already complete

Do not send acknowledgements, social filler, paraphrase-only replies, or "anything else?" follow-ups.

## Continuation rules
Continue only when the next message is expected to do at least one of the following:
- add new evidence, constraints, or context
- answer an actually open question
- reduce uncertainty between remaining options
- improve a draft toward the requested deliverable
- surface a concrete flaw, risk, or missing assumption
- convert discussion into a decision, artifact, or handoff

Stop when the next message would mostly do any of the following:
- acknowledge, agree, or restate without changing the work state
- repeat an already-known concern without narrowing it
- open a side topic that is not required for the original goal
- ask a human-preference or policy question that only the human can answer
- continue analysis even though a sufficient result is already available

## Coordinator workflow
1. Prefer one-shot execution over relay.
   - If a subagent can finish independently, spawn it with a precise task instead of creating a live conversation.
   - If using `sessions_send`, send a bounded request with the finish state and continuation condition in the message.
2. Start with one message that includes:
   - the task
   - required output format
   - finish state
   - continuation condition
   - allowed reply types
   - explicit instruction to stop at `RESULT`, `BLOCKED`, or `DONE`
3. Allow the exchange to continue while each reply materially changes the state of the task.
4. If the peer asks for clarification, answer only if the clarification unlocks progress.
5. As soon as the peer provides a sufficient `RESULT`, or the exchange stops narrowing the problem, stop and summarize for the human.

## Peer workflow
When you are the receiving agent:
1. Reply with `RESULT` if you can finish from current context.
2. Reply with `CLARIFY` if a missing fact is necessary to continue.
3. Reply with `PROGRESS` if partial work genuinely advances the task but more work remains.
4. Reply with `BLOCKED` if the task cannot proceed without a human decision or missing external input.
5. Reply with `DONE` when the goal has already been satisfied and no further agent discussion is useful.
6. End when further messages would only restate, acknowledge, or decorate what is already known.

## Stop rules
Stop immediately when any of these becomes true:
- the requested artifact, answer, or decision is already good enough for the human
- the latest turn did not materially change the state of the work
- the exchange is circling the same uncertainty without narrowing it
- remaining questions belong to human judgment, preference, or authority
- the conversation is happening in a public/group thread and extra agent chatter would add more noise than value

## Tooling guidance
- Prefer `sessions_spawn` over live relay when the work can be delegated cleanly.
- Use `sessions_send` for a bounded handoff, targeted review, or a short collaborative pass.
- Avoid orchestrating agent-to-agent back-and-forth through public chat unless the human specifically wants to watch it.
- If a live relay starts to drift, stop and produce a human-facing summary instead of continuing the loop.
- Do not terminate solely because the exchange lasted more than a fixed number of turns; terminate because the latest turn no longer changes the task state.

## Request template
Use this for the first outbound message:

```text
REQUEST
Goal: <one concrete task>
Output: <required format>
Finish state: <what counts as done>
Continuation condition: Continue only if your next reply adds new information, reduces uncertainty, or advances the artifact.
Stop condition: Reply with RESULT, BLOCKED, or DONE once further agent discussion would not materially improve the outcome.
```

## Human handoff template
After the exchange, reply to the human in this shape:

```text
Status: DONE | BLOCKED
Result: <short answer>
Progress made: <what changed during the exchange>
Open questions: <if any>
Next action: <what the human should decide or ask next>
```

## Anti-patterns
Do not do any of the following:
- continue because a reply is possible even though it adds nothing new
- send `了解`, `Thanks`, `なるほど`, or similar acknowledgements as a standalone agent reply
- relay the same information between two agents in different words
- let two agents debate wording, style, or agreement without improving the requested deliverable
- end too early when there is still clear unresolved work and the next turn would materially help

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
Output: bullet list, then revised wording if needed.
Finish state: We either have a sufficient list of missing stop conditions or a revised paragraph ready to paste.
Continuation condition: Continue only if the next reply adds a missing issue, resolves an open ambiguity, or improves the draft.
Stop condition: Reply with RESULT, BLOCKED, or DONE once further discussion would not materially improve the plan.

Agent B:
PROGRESS
- Missing final owner of the decision
- Missing explicit rule for public threads
- Missing distinction between "can reply" and "should reply"
Suggested wording: "Stop when the next reply would not change the work state."

Agent A:
PROGRESS
Applied the distinction.
Open point: Should the skill use hard turn caps or semantic stop rules?

Agent B:
RESULT
Use semantic stop rules as the default. Hard caps can be an optional stricter variant, but default behavior should allow continued exchange while each turn adds new information or narrows uncertainty.

Agent A to human:
Status: DONE
Result: The skill should default to semantic stop rules instead of hard turn caps.
Progress made: Identified the missing stop conditions and resolved the turn-cap question.
Open questions: none.
Next action: update the skill text accordingly.
```
