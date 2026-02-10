---
name: tavily-search
description: Use Tavily Search API to do web research with controllable depth and structured JSON results. Use when a user asks to “Tavilyで検索して”, “tavily検索”, wants Tavily’s answer/raw_content, or when Brave/web_search is insufficient and Tavily is preferred.
---

# Tavily search (CLI)

## Prereq

- Set env `TAVILY_API_KEY` before running.
  - Example (do not commit keys): `export TAVILY_API_KEY=tvly-...`

## Run

Use the bundled CLI script:

```bash
node skills/tavily-search/scripts/tavily-search.mjs "QUERY" --max 5 --depth basic --answer
```

### Options

- `--max N` (default 5)
- `--depth basic|advanced` (default basic)
- `--answer` include Tavily’s synthesized answer
- `--raw` include `raw_content` in results

## Workflow (recommended)

1. Run search with `--depth basic` and `--max 5`.
2. If results are thin, retry with `--depth advanced` or higher `--max`.
3. If the user needs citations/quotes, use `--raw` and cite from `raw_content` with URLs.
4. Present: short bullet summary + sources (URLs).
