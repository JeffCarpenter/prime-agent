# zsh Skill Promotion — Findings

## Source and design

- Personal source: `~/.prime/agent/skills/zsh/`.
- Fork target: `/home/jeff/code/fork/prime-agent/packages/coding-agent/skills/zsh/`.
- Upstream implementation: `prime-agent-runtime/src/rlm/bash.py`.
- `rlm.bash._shell()` reads `PRIME_AGENT_BASH_SHELL` per call and accepts an
  absolute path. `/usr/sbin/zsh` works through upstream process groups, status
  channel, orphan journal, bounded buffers, kill escalation, and cancellation.
- Facade exports `zsh`, `zshq`, `current_shell`, `restore_default_shell`,
  `BashHandle`, and `BashResult`. No second process structure.

## Verified artifacts

- `3ab601872`: package files, ty clean against kernel `rlm` types, import smoke,
  fork pre-commit checks green.
- `afa7e4270`: 10 tests; 24/24 statements, 6/6 branches, 100% coverage.
- Personal directory is whole-dir symlink to fork package. Loader source and
  existing `prime-self-intellect` symlink precedent support this topology.
- Fork branch: `xonsh-repl`.

## Delegation protocol

- Code Napoleon: one owner per scope; exact ProcessState keys
  `{agent,state,evidence,blocker,next}`; no descendant commits; root ratifies
  scope, transcript, gates, then commits.
- `mcpls` first for Python; `pydoc` fallback; fix-first lint with capability
  probe; xonsh direct for synchronous commands; zsh before bash.
- A quota/rate-limit 429 marks compression boundary, not completion. Preserve
  state; use `openai-codex/gpt-5.6-luna` high for compression/recovery; resume
  only from persisted state.

## Shared-tree boundary

Do not touch pre-existing user material:
`.planning/2026-09-13-xonsh-integration/**`, `.planning/pnpm-migration-findings.md`,
`.planning/reconcile/**`, `.planning/windows-release-redist/**`,
`.planning/xonsh-installer/**`, `scripts/install.xsh`, `report/`,
`scripts/install-xsh.test.xsh`.


## Validation registration

- W2a found shared per-skill registration in `packages/coding-agent/test/builtin-skills.test.ts`.
- Added one scoped assertion for bundled `zsh` discovery, Python kind, and import name.
- Parent diff review found only the intended 9-line assertion.
- Focused Vitest gate passed: `23/23` tests.
- `git diff --check` passed. Full repository check stayed deferred because it writes across dirty user-owned paths.

## Operational findings

- Facade code is small, but its integration surface includes environment-based shell selection and upstream process lifecycle behavior. Review must include that upstream boundary, not only facade lines.
- The whole-directory symlink makes the fork package the source of truth for the personal skill path. Do not treat those paths as independent copies.
- 100% statement and branch coverage confirms exercised test paths only. It does not prove real zsh process-group, cancellation, bounded-buffer, orphan-journal, or failure behavior.
- A quota or rate-limit failure is a persisted state boundary, not evidence that work is complete. Preserve planning state before compression or model recovery, then resume from that state.
- Dirty shared trees require an explicit protection boundary. Do not overwrite unrelated planning artifacts, reports, scripts, or user changes while validating this skill.
- For this tiny facade, coordination and process overhead can exceed implementation overhead. Keep delegation narrow, assign one owner per scope, and require only evidence that changes the decision.

Co-authored review: gpt-5.6-luna (high).
