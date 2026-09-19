# zsh Skill Promotion — Task Plan

## Goal

Promote personal zsh skill into fork-shipped `packages/coding-agent/skills/zsh`,
with upstream `rlm.bash` reuse, typed API, tests, branch coverage, loader-backed
personal symlink, and fork validation wiring.

## Current Phase

`W3 pending` — W2a registration wiring is complete and independently
ratified. Final battery still needs root rerun: loader/import, one-shot and
background behavior, kill/restore, coverage, and final status review.

## Phases

- [x] W1a — Add fork skill package. Commit `3ab601872`.
- [x] W1b — Add pytest suite and branch coverage. Commit `afa7e4270`.
- [x] W2b — Point personal skill directory at fork via whole-directory symlink.
- [x] W2a — Verify or add fork validation registration. Commit `67e1d6038`;
  focused Vitest `23/23` passed; root diff and whitespace checks passed.
- [ ] W3 — Root ratification: final battery, coverage, loader, docs, state,
  and completion decision.

## Decisions

- Reuse upstream `rlm.bash`; do not create parallel process structure.
- Direct reports use `zai/glm-5.3` or `openai-codex/gpt-5.6-sol`, thinking high.
- Descendants use `hierarchical-delegation` and `zai/glm-5.3-flash`, thinking high.
- Workers do not commit. Root ratifies and commits.
- User-owned changes under `.planning/**`, `scripts/install.xsh`, `report/`,
  and `scripts/install-xsh.test.xsh` are immutable.
- Generated `packages/coding-agent/skills/zsh/uv.lock` is not commit material.

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| `zai/glm-5.3` returned `429 Usage limit reached for 5 hour` | W2a dispatch | Marked W2a BLOCKED; preserved state; retry with `openai-codex/gpt-5.6-sol` high after compression/recovery protocol. |
| `ty check --fix` unavailable in skillz ty `0.0.29` | Justfile wiring | Capability-probed; Justfile uses plain `uv run ty check src/`, while ruff keeps `--fix`. |

## Next Step

Run final W3 battery and inspect `git diff`/status. Do not add generated
`packages/coding-agent/skills/zsh/uv.lock` or unrelated user files.
