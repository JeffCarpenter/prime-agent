#!/usr/bin/env bash
# Lists unique states present in .graph
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FILE="$DIR/project-state.json"

jq -r '.graph[].state' "$FILE" | sort -u
