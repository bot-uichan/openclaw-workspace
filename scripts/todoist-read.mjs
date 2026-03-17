#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = '/home/openclaw/.openclaw/workspace';
const envPath = path.join(workspaceRoot, '.env.todoist');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || /^\s*#/.test(line)) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(envPath);

const token = process.env.TODOIST_API_TOKEN || process.env.TODOIST_TOKEN;
if (!token) {
  console.error('TODOIST_API_TOKEN is missing. Put it in .env.todoist');
  process.exit(1);
}

const view = process.argv[2] || 'today';
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const limit = Number.parseInt(limitArg?.split('=')[1] || '20', 10);

async function apiGet(endpoint, params = {}) {
  const url = new URL(`https://api.todoist.com/api/v1/${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Todoist API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : (data.results ?? data);
}

function fmtTask(task) {
  const due = task.due?.date || task.deadline?.date || '期限なし';
  const priority = task.priority || 1;
  const content = task.content || task.description || '(無題タスク)';
  return `- [p${priority}] ${content} (${due})`;
}

async function main() {
  if (view === 'projects') {
    const projects = await apiGet('projects');
    for (const project of projects) {
      console.log(`- ${project.name} (${project.id})`);
    }
    return;
  }

  if (view === 'all') {
    const tasks = await apiGet('tasks');
    tasks.slice(0, limit).forEach((task) => console.log(fmtTask(task)));
    return;
  }

  if (view === 'today') {
    const tasks = await apiGet('tasks', { filter: 'today | overdue' });
    tasks.slice(0, limit).forEach((task) => console.log(fmtTask(task)));
    return;
  }

  console.error('Usage: node scripts/todoist-read.mjs [today|all|projects] [--limit=20]');
  process.exit(1);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
