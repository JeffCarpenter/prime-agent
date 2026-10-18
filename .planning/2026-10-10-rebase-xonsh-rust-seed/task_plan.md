# Task Plan: Rebase `xonsh-rust` onto `5ac9d0650~1`

## Goal

Rebase `xonsh-rust` onto `5ac9d0650~1` (`dc63427ad625b148bed0c922822278477a12989e`), inspect the graph and record divergences to JSON-LD, reconcile conflicts cleanly, and verify the resulting tree.

## Scope and Ancestry

- Target: `5ac9d0650~1` (`dc63427ad625b148bed0c922822278477a12989e` - root seed commit of Rust rewrite)
- Next Upstream Scaffolding Commit: `5ac9d0650` (`5ac9d06508c3597e961a10569a563d2c0a2c5834` - Cargo workspace scaffold)
- Source Branch: `xonsh-rust` (`e4ff354a184f22af3ba78ef0963018472f17af96`)
- Original Fork Base: `v0.9.8` (`7d442aafa985f9342134fac16c2ef41f03fb45c1`)
- Commits Replayed: 37 commits in `v0.9.8..xonsh-rust`
- Worktree Isolation: Rebase executed in `.worktrees/xonsh-rust-seed-rebase` to protect staged `pkgbuild/PKGBUILD` and untracked artifacts.

## Current Phase

Phase 5: Cleanup & Summary

## Phases

### Phase 1: Graph Inspection & Divergence Analysis (JSON-LD)
- [x] Inspect ancestry graph topology between `xonsh-rust`, `5ac9d0650~1`, `5ac9d0650`, `v0.9.8`, and upstream branches.
- [x] Catalog overlapping and divergent paths.
- [x] Record structured graph and divergence model to JSON-LD (`.planning/2026-10-10-rebase-xonsh-rust-seed/divergences.jsonld`).
- **Status:** complete

### Phase 2: Worktree Isolation & Rebase Initiation
- [x] Create isolated branch `xonsh-rust-seed-rebase` and worktree `.worktrees/xonsh-rust-seed-rebase`.
- [x] Initiate rebase of `v0.9.8..xonsh-rust` onto `5ac9d0650~1`.
- [x] Inspect rebase stops and conflict states.
- **Status:** complete

### Phase 3: Conflict Reconciliation
- [x] Systematically reconcile conflicts across commits (modify/delete due to disjoint root trees).
- [x] Retain seed documentation (`MISSION.md`, `README.md`, `WATCHDOG.md`).
- [x] Preserve fork features: xonsh REPL runtime, zsh skill, packaging (`PKGBUILD`, `install.xsh`), and TypeScript/Python core.
- **Status:** complete

### Phase 4: Validation & Quality Verification
- [x] Verify clean git status and commit log in rebased worktree.
- [x] Verify ancestry: `xonsh-rust-seed-rebase~37` matches `5ac9d0650~1` (`dc63427ad`).
- [x] Document rebased tip commit (`dcede5618`).
- **Status:** complete

### Phase 5: Cleanup & Summary
- [x] Clean up temporary automation scripts.
- [x] Document final divergence resolution and verification in planning docs.
- **Status:** complete

## Next Step

Present summary to user with rebased branch tip and divergence insights.
