#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_FILE="$ROOT_DIR/packages/coding-agent/test/rlm-ledger.test.ts"

# The regression test was added after last-known-good; revisions before it are
# good for this focused predicate.
[[ -f "$TEST_FILE" ]] || exit 0

while IFS="=" read -r name _; do
    case "$name" in
        RLM_*|PRIME_AGENT*) unset "$name" ;;
    esac
done < <(env)
unset FORCE_COLOR
export NO_COLOR=1
export PI_NO_LOCAL_LLM=1

cd "$ROOT_DIR/packages/coding-agent"
pnpx vitest run test/rlm-ledger.test.ts \
    --testNamePattern "appends spawn at admission, rename at the rename write point, and delete with a reason" \
    --cache \
    --experimental.fsModuleCache \
    --maxWorkers=2 \
    --maxConcurrency=2 \
    --bail=1
