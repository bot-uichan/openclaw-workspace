#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   comment.sh <owner/repo> <number> <body-file>
# Example:
#   comment.sh yanorei32/discord-tts 659 /tmp/comment.md

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 <owner/repo> <number> <body-file>" >&2
  exit 1
fi

REPO="$1"
NUMBER="$2"
BODY_FILE="$3"

if [[ ! -f "$BODY_FILE" ]]; then
  echo "Body file not found: $BODY_FILE" >&2
  exit 1
fi

gh issue comment "$NUMBER" --repo "$REPO" --body-file "$BODY_FILE"
