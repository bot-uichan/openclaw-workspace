---
name: browser-fallback-check
description: Fall back to the browser tool when a page is JS-rendered or lightweight fetch/search results are incomplete. Use when web_fetch returns placeholders like "Loading...", important fields are missing from extracted text, a product/article/detail page needs confirmation from the rendered DOM, or the user explicitly asks to verify what the live page shows.
---

# Browser Fallback Check

Use this skill to verify page contents from the rendered page instead of trusting partial text extraction.

## Workflow

1. Start with the cheap path.
   - Use `web_fetch` or search results first when they already answer the question.
2. Detect failure modes.
   - Trigger browser fallback when any of these happen:
     - `web_fetch` returns placeholders such as `Loading...`
     - key fields are missing (price, stock, variant, button label, publication date, author, etc.)
     - the page is a product/app/search result that likely hydrates on the client
     - different sources disagree and the user wants the page truth
3. Open the exact page in `browser`.
   - Prefer the precise product/detail URL over a top page.
4. Inspect the rendered page.
   - First try `snapshot`.
   - If the snapshot is noisy or incomplete, use `act` with `evaluate` and read `document.body.innerText`, selected DOM text, or targeted attributes.
   - If needed, interact with obvious controls (variant picker, expand/collapse, tabs) before re-checking.
5. Answer with the rendered result.
   - State clearly what the browser-confirmed page shows.
   - If still uncertain, say what remains unknown instead of guessing.

## Good browser checks

- Product pages: edition/variant, stock state, price, paper vs ebook, shipping text
- Articles/docs: actual title, published date, headings, visible body text
- Authenticated or JS-heavy apps: labels, status text, visible controls

## Practical patterns

- For a quick truth check:
  - `browser.open` -> `browser.snapshot`
- When snapshot misses the payload:
  - `browser.act(kind="evaluate", fn="() => document.body.innerText")`
- When a variant may matter:
  - inspect current visible label first, then interact only if necessary

## Guardrails

- Do not present unconfirmed guesses as facts just because search snippets imply them.
- Prefer rendered page evidence over secondary summaries when they conflict.
- Keep the fallback narrow: inspect only the page needed for the user’s question.
- If the browser still cannot expose the needed content, say so plainly.
