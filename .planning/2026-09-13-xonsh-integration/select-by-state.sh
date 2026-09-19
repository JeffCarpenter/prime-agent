#!/usr/bin/env bash
# Usage:
#   select-by-state.sh                # group all graph tasks by state
#   select-by-state.sh <state>        # list task keys with given state
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FILE="$DIR/project-state.json"

if [ $# -eq 0 ]; then
  jq '.graph | to_entries | group_by(.value.state) | map({state: .[0].value.state, tasks: map(.key)})' "$FILE"
else
  result="$(jq --arg s "$1" '.graph | to_entries | map(select(.value.state == $s)) | map(.key)' "$FILE")"
  echo "$result"
  if [ "$result" = "[]" ]; then
    echo "No tasks with state '$1'. Run enumerate-states.sh to list valid states." >&2
  fi
fi
