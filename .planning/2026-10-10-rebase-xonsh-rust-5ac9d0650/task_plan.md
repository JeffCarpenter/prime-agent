# Task Plan: Rebase `xonsh-rust` onto `5ac9d0650`

## Goal

Rebase `xonsh-rust` onto `5ac9d0650` (`5ac9d06508c3597e961a10569a563d2c0a2c5834` - Cargo workspace scaffold commit), reconcile conflicts, record divergences to JSON-LD, and verify clean coexistence of the Rust workspace scaffold with the xonsh REPL fork assets.

## Scope and Ancestry

- Target Commit: `5ac9d0650` (`5ac9d06508c3597e961a10569a563d2c0a2c5834`)
  - Commit message: `chore: scaffold Cargo workspace, CI docs, Makefile, model-surface contract, lane prompts`
  - Scaffolds: `Cargo.toml`, `Cargo.lock`, `Makefile`, `ARCHITECTURE.md`, `crates/pa-*` (7 member crates), `docs/MODEL-SURFACE.md`, `docs/lane-prompts.json`, `docs/ci.yml.reference`
  - Modifies: `MISSION.md`, `WATCHDOG.md`, `.gitignore`
- Prior Rebased Base: `5ac9d0650~1` (`dc63427ad625b148bed0c922822278477a12989e` - seed commit)
- Source Branch: `xonsh-rust-seed-rebase` (`dcede5618` - 37 commits on `5ac9d0650~1`)
- Rebased Branch: `xonsh-rust-5ac-rebase`
- Worktree Isolation: `.worktrees/xonsh-rust-seed-rebase`

## Current Phase

Phase 5: Verification & Documentation Complete

## Phases

### Phase 1: Context & Lore Discovery
- [x] Read reconciliation planning lore in `.planning/native-rust-port-reconciliation-plan.yaml` and `.planning/scratchpad.yaml`.
- [x] Analyze commit `5ac9d0650` tree additions (`crates/`, `Cargo.toml`, `ARCHITECTURE.md`, contracts).
- [x] Identify conflict boundaries (primarily `.gitignore` add/add).
- **Status:** complete

### Phase 2: Worktree Rebase Execution
- [x] Create branch `xonsh-rust-5ac-rebase` in `.worktrees/xonsh-rust-seed-rebase`.
- [x] Run `git rebase 5ac9d0650`.
- **Status:** complete

### Phase 3: Conflict Reconciliation
- [x] Reconcile `.gitignore` conflict on commit `130b21d19` (preserve `/target` from `5ac9d0650` + node/python patterns).
- [x] Reconcile `.gitignore` conflict on commit `222db5ff9` (preserve `.planning/.active_plan` + `/target`).
- [x] Continue and complete rebase cleanly.
- **Status:** complete

### Phase 4: Ancestry & Tree Verification
- [x] Verify `HEAD~37` points to `5ac9d0650` (`5ac9d06508c3597e961a10569a563d2c0a2c5834`).
- [x] Verify all 19 Rust workspace files (`crates/pa-*`, `Cargo.toml`, `Makefile`, `ARCHITECTURE.md`) are present.
- [x] Verify all fork features (`prime-agent-runtime/src/rlm/repl.py`, `xonsh.ts`, `pkgbuild/PKGBUILD`, `install.xsh`) are present.
- **Status:** complete

### Phase 5: Documentation & Artifacts
- [x] Record structured JSON-LD graph in `.planning/2026-10-10-rebase-xonsh-rust-5ac9d0650/divergences.jsonld`.
- [x] Update `findings.md` and `progress.md`.
- [x] Update `.planning/.active_plan`.
- **Status:** complete
