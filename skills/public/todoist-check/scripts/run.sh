#!/usr/bin/env bash
set -euo pipefail
cd /home/openclaw/.openclaw/workspace
node scripts/todoist-read.mjs "$@"
