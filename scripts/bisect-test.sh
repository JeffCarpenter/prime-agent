#!/usr/bin/env bash
set -e

AUTH_FILE="$HOME/.prime/agent/auth.json"
AUTH_BACKUP="$HOME/.prime/agent/auth.json.bak"

# Restore auth.json on exit (success or failure)
cleanup() {
    if [[ -f "$AUTH_BACKUP" ]]; then
        mv "$AUTH_BACKUP" "$AUTH_FILE"
        echo "Restored auth.json"
    fi
}
trap cleanup EXIT

# Move auth.json out of the way
if [[ -f "$AUTH_FILE" ]]; then
    mv "$AUTH_FILE" "$AUTH_BACKUP"
    echo "Moved auth.json to backup"
fi

# Skip local LLM tests (ollama, lmstudio)
export PI_NO_LOCAL_LLM=1

# Unset API keys (see packages/ai/src/stream.ts getEnvApiKey)
unset ANTHROPIC_API_KEY
unset ANTHROPIC_OAUTH_TOKEN
unset OPENAI_API_KEY
unset GEMINI_API_KEY
unset GROQ_API_KEY
unset CEREBRAS_API_KEY
unset XAI_API_KEY
unset OPENROUTER_API_KEY
unset ZAI_API_KEY
unset MISTRAL_API_KEY
unset MINIMAX_API_KEY
unset MINIMAX_CN_API_KEY
unset KIMI_API_KEY
unset HF_TOKEN
unset AI_GATEWAY_API_KEY
unset OPENCODE_API_KEY
unset COPILOT_GITHUB_TOKEN
unset GH_TOKEN
unset GITHUB_TOKEN
unset GOOGLE_APPLICATION_CREDENTIALS
unset GOOGLE_CLOUD_PROJECT
unset GCLOUD_PROJECT
unset GOOGLE_CLOUD_LOCATION
unset AWS_PROFILE
unset AWS_ACCESS_KEY_ID
unset AWS_SECRET_ACCESS_KEY
unset AWS_SESSION_TOKEN
unset AWS_REGION
unset AWS_DEFAULT_REGION
unset AWS_BEARER_TOKEN_BEDROCK
unset AWS_CONTAINER_CREDENTIALS_RELATIVE_URI
unset AWS_CONTAINER_CREDENTIALS_FULL_URI
unset AWS_WEB_IDENTITY_TOKEN_FILE
unset BEDROCK_EXTENSIVE_MODEL_TEST
unset FIREWORKS_API_KEY

# Avoid inherited Prime Agent and terminal state changing test behavior.
while IFS="=" read -r name _; do
    case "$name" in
        RLM_*|PRIME_AGENT*) unset "$name" ;;
    esac
done < <(env)
unset FORCE_COLOR
export NO_COLOR=1

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VITEST_ARGS=(
    --run
    --cache
    --maxWorkers=2
    --maxConcurrency=2
    --bail=1
)

run_vitest() {
    echo "Running $1 tests without API keys..."
    local package="$1"
    shift
    (
        cd "$ROOT_DIR/packages/$package"
        pnpx vitest --clearCache
        pnpx vitest "${VITEST_ARGS[@]}" "$@"
    )
}

# Test the package that failed during the initial bisect attempt first.
run_vitest coding-agent \
    --exclude test/acp-cold-cli.test.ts \
    --exclude test/acp-kernel-features.test.ts \
    --exclude test/daemon-supervisor-process.test.ts \
    --exclude test/kernel-agent-observe-skill.test.ts \
    --exclude test/kernel-agent-message-skill.test.ts \
    --exclude test/kernel-attach-image-skill.test.ts \
    --exclude test/kernel-execute-reply-fallback.test.ts \
    --exclude test/kernel-goal-skill.test.ts \
    --exclude test/kernel-rlm-heartbeat-skill.test.ts \
    --exclude test/kernel-state-roundtrip.test.ts \
    --exclude test/suite/daemon-serialized-refine-process.test.ts \
    --exclude test/suite/regressions/4685-daemon-client-modes.test.ts \
    --exclude test/suite/regressions/4603-worker-recovery.test.ts
run_vitest coding-agent test/daemon-supervisor-process.test.ts
KERNEL_TESTS=(
    test/acp-cold-cli.test.ts \
    test/acp-kernel-features.test.ts \
    test/kernel-agent-message-skill.test.ts \
    test/kernel-agent-observe-skill.test.ts \
    test/kernel-attach-image-skill.test.ts \
    test/kernel-execute-reply-fallback.test.ts \
    test/kernel-goal-skill.test.ts \
    test/kernel-rlm-heartbeat-skill.test.ts \
    test/kernel-state-roundtrip.test.ts
)
for test_file in "${KERNEL_TESTS[@]}"; do
    run_vitest coding-agent "$test_file"
done
run_vitest coding-agent test/suite/daemon-serialized-refine-process.test.ts
run_vitest coding-agent test/suite/regressions/4603-worker-recovery.test.ts
run_vitest coding-agent test/suite/regressions/4685-daemon-client-modes.test.ts
run_vitest agent
run_vitest ai

(
    cd "$ROOT_DIR/packages/tui"
    node --test --test-concurrency=2 --import tsx test/*.test.ts
)
