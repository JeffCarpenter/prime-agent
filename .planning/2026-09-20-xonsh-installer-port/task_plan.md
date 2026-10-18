# Task Plan: install.sh -> scripts/install.xsh Port

## Goal
Port all relevant `install.sh` behavior into tracked `scripts/install.xsh` in idiomatic Xonsh 0.24.2. `install.sh` stays unchanged and release-facing. `scripts/install-xsh.test.xsh` stays untracked during development.

## Current Phase
Parity audit

## Phases
- [x] Execution model: native Xonsh pipelines (`!()`, `![]`, `@()`), `p""` paths; `Popen` only for supervision (cancel/timeout/quiet/cwd).
- [x] Native subsystems: platform detection, managed root/lock/staging, archive safety, atomic activation + journal, recovery, rollback, extraction, pruning, public-link ownership, PATH configuration.
- [x] `install_native()` orchestration incl. Node-only auto fallback and binary rejection.
- [x] Node-path regressions: unconfigured base URL rejection; standalone Node lookup via managed PATH (task 1).
- [x] Parity matrix artifact: `.planning/2026-09-20-xonsh-installer-port/parity-matrix.md` maps all 114 definitions present in `install.sh` (the earlier 115 count was stale).
- [x] `npm run check` passed with status snapshots before/after; no files changed by the check.
- [x] Final review: matrix covers every function; focused offline tests pass; unrelated pre-existing untracked files were left untouched. No commit created.

## Next Step
Phase 2 parity audit is complete. Remaining work, if requested, is any follow-up parity gap identified by review; no gap was left unmapped in the current function matrix.

## Status Distinctions
- Implemented: native + Node backends complete, including managed-PATH command lookup.
- Tested: 20/20 focused offline tests green; `xonsh check` clean.
- Tracked: `scripts/install.xsh` is clean in the current worktree. `scripts/install-xsh.test.xsh` is untracked by design; no commit was created.
- Released: no; `install.sh` remains the sole release installer, unchanged.
