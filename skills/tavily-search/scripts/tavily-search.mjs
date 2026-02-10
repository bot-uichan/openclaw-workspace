#!/usr/bin/env node
/**
 * Tavily Search CLI
 *
 * Usage:
 *   TAVILY_API_KEY=tvly-... node scripts/tavily-search.mjs "query" --max 5 --depth basic --answer
 *
 * Output:
 *   Prints JSON response to stdout.
 */

const args = process.argv.slice(2);
if (args.length === 0 || args[0].startsWith('-')) {
  console.error('Usage: tavily-search.mjs "query" [--max N] [--depth basic|advanced] [--answer] [--raw]');
  process.exit(2);
}

const query = args[0];
let max = 5;
let depth = 'basic';
let includeAnswer = false;
let includeRaw = false;

for (let i = 1; i < args.length; i++) {
  const a = args[i];
  if (a === '--max') max = Number(args[++i] ?? '5');
  else if (a === '--depth') depth = String(args[++i] ?? 'basic');
  else if (a === '--answer') includeAnswer = true;
  else if (a === '--raw') includeRaw = true;
  else {
    console.error('Unknown arg:', a);
    process.exit(2);
  }
}

const apiKey = process.env.TAVILY_API_KEY;
if (!apiKey) {
  console.error('Missing env TAVILY_API_KEY');
  process.exit(2);
}

const body = {
  api_key: apiKey,
  query,
  search_depth: depth,
  max_results: max,
  include_answer: includeAnswer,
  include_raw_content: includeRaw,
  include_images: false,
};

const res = await fetch('https://api.tavily.com/search', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

if (!res.ok) {
  const text = await res.text().catch(() => '');
  console.error(`HTTP ${res.status} ${res.statusText}`);
  if (text) console.error(text);
  process.exit(1);
}

const json = await res.json();
process.stdout.write(JSON.stringify(json, null, 2));
