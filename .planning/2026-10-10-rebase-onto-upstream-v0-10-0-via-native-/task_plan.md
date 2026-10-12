# Task Plan: Rebase onto upstream/v0.10.0 via Native Rust Reconciliation Plan

## Goal
First reconcile the fork's pre-xonsh behavior across upstream releases with the Rust v0.10.0 product; then complete the native xonsh port in isolation. Criteria: `.planning/native-rust-port-reconciliation-plan.yaml`; current authority and evidence: `native-status.yaml`, `findings.md`. Existing `feat/native-rust-xonsh` and dirty inputs remain protected references until the earlier fork work is accounted for.

## Next Step
Use `pre-port-lineage.json` to build a source-cited capability ledger for the six release-replay changes and the separate `origin/main` candidate pool; compare each proposed carry-forward behavior with upstream Rust v0.10.0 and native `2da0c33ed` before choosing repairs. User has explicitly approved:
1. Retiring the ghost TypeScript stack (upstream releases always enter fork).
2. PKGBUILD realignment to native Rust binary via `cargo build --release -p pa-cli` and offline catalog handling (Phase 5 p5-t1).
3. Pruning redundant `.planning/bin/*.xsh` scripts ("that's what git is for").
4. Pinning authoritative workspace version to upstream `0.10.0`.
Execute capability parity ledger first, then proceed with approved native packaging and cleanup.

### Housekeeping / Working Tree TODOs
- [x] **Handoff Reconcile (documentation complete):** The current packet is `.planning/2026-10-11-native-rust-handoff/native-rust-handoff/`; its YAML-only data and `open-handoff.xsh` were committed in `aa5106784`. The five handoff reader tests passed; Git tracks the files. This closes handoff-file cleanup, not native release, Arch packaging, or CLI verification.
- [ ] **TODO (Ghost Worktree Cleanup):** Prune or reconcile orphaned worktree `.worktrees/rebase-2a16de906` (detached HEAD at `2a16de906`: "restore continuous background trace uploads (#3415)"), unreferenced by current active plan.
- [ ] **TODO (Script Pruning):** Prune redundant `.planning/bin/*.xsh` scripts (`show-*.xsh`) and `phase-status.awk` approved for retirement ("that's what git is for"), tracked at commit `36e03b519`.

## Current Phase
Phase 0 in progress: recover the full pre-port scope and establish native parity/baseline before further integration. Phases 1–2 are historically completed on the existing native line; Phase 3 has landed code but open acceptance, Phase 4 is dirty/unverified, and Phase 5 packaging realignment is approved by user. Necessary scoped source, test, packaging, and tooling repairs are authorized by the user; no system installation or overwrite of protected work.

## Phases

### Phase 0: Pre-port history, scope & baseline (prerequisite to further integration)
- [x] Verify the fork point: upstream `v0.9.8@7d442aafa` is the sole parent of Rust-port `39bc99a91`; `xonsh-repl` descends from v0.9.8 and its pre-xonsh prefix ends at `06bdcf1cb`. Five of its six changes match the re-rooted `xonsh-rust` line by `git range-diff`; the first pnpm change needs semantic review.
- [x] Inventory the release-branch replay and separate older fork line in `pre-port-lineage.json`: v0.9.5→v0.9.6→v0.9.8 repeats six pre-xonsh changes; re-rooted TS commit differs in the first pnpm patch; `origin/main` diverges earlier with 322 commits (63 Jeff-authored candidates), not automatically part of the six. Record graph/range-diff/blame; native/upstream *behavioral* absorption remains step 2, not a conclusion from patch IDs.
- [ ] Compare the resulting capability ledger against upstream Rust v0.10.0 and native `2da0c33ed`; mark each capability already upstream, native-equivalent, missing, intentionally retired, or unknown, with test/owner evidence and acceptance criteria.
- [ ] Confirm the outstanding isolated `pa-tui` test exit, separate shared upstream `pa-core` failures from native-only or flaky failures, and recheck HEAD plus hashes for all twelve protected inputs before any copy/repair.
- [ ] Choose an isolated integration sequence: reconcile missing pre-xonsh capabilities before replaying/revalidating the two native xonsh commits and dirty TUI/skill inputs. Scoped source/test fixes needed for this reconciliation are authorized by the request; stop for genuinely new scope, destructive operations, or installation.
- **Status:** in_progress

## Immediate sequence (user steps 2–4; planned, not executed)

2. **Capability parity:** from `pre-port-lineage.json`, inspect the six pre-xonsh behaviors and triage the distinct `origin/main` pool without assuming all 322 commits are owned or required. For each candidate record original source, upstream Rust v0.10.0/native equivalent, present/missing/replaced/retired/unknown, and the test or decision needed. Output: `pre-port-capability-ledger.json`; no source edits in this step.
3. **Baseline and preservation:** verify the twelve protected file hashes and both worktree HEADs; obtain a fresh captured exit for isolated `pa-tui` if the prior log remains exit-less; compare failing `pa-core` and formatting gates with upstream control. Record commands/exits/logs and distinguish shared, native-only, and flaky failures. Output: an evidence-indexed baseline; no overwrite of the main TS recipe or dirty TUI/skill inputs.
4. **Isolated integration:** once parity and baselines establish scope, make necessary pre-xonsh native repairs on a new isolated line from v0.10.0 with tests first; then transplant/revalidate native xonsh commits `33489b01b` and `2da0c33ed`, and apply the hash-checked TUI/skill inputs without editing their original worktree. Verify the full tool→kernel→sidecar→TUI path. Arch packaging follows only after this integration is evidenced; no system installation.

### Phase 1: Worktree Isolation & Base Setup
- [x] Create isolated worktree `.worktrees/feat-native-rust-xonsh` on upstream `v0.10.0` (`763094e1b`) with branch `feat/native-rust-xonsh`
- [x] Verify upstream baseline compilation (`cargo check --workspace`)
- [x] Confirm main worktree status remains untouched
- **Status:** completed

### Phase 2: Runtime Sidecar Port
- [x] Extract xonsh execution and syntax handling patches from reference branch (`prime-agent-runtime/src/rlm/repl.py`, `prime-agent-runtime/src/rlm/repl.md`)
- [x] Port xonsh handlers into v0.10.0 runtime preserving factory FSM and Rust daemon hooks
- [x] Port test cases into `prime-agent-runtime/test/test_repl.py`
- [x] Run verification: `pytest prime-agent-runtime/test/test_repl.py` (144 passed)
- **Status:** completed

### Phase 3: Rust Core Tool & Kernel Integration
- [x] Land `crates/pa-core/src/tools/xonsh.rs` and module registration in commit `2da0c33ed` (implementation present; behavior not yet verified here)
- [ ] Reconcile upstream "dual-kernel" terminology with actual single-kernel architecture: upstream describes managing xonsh beside ipython, but execution-mode wiring in `kernel/manager/`, `kernel/protocol.rs`, and `session_engine/runtime_wiring.rs` operates as a single Python kernel daemon executing with `mode: Some("xonsh")`. Ensure manager and wiring reflect single-kernel mode-dispatching without dangling expectations of separate-kernel daemon provisioning.
- [ ] **CRITICAL FIX (Bootstrap Venv Dependency):** Update kernel bootstrap in `crates/pa-core/src/kernel/bootstrap/venv.rs` to include `xonsh` in default packages, update readiness probe in `crates/pa-core/src/kernel/bootstrap/venv/probe.rs`, and verify runtime sidecar does not raise `RuntimeError` on clean installations.
- [x] Land xonsh language tagging and code preview in commit `2da0c33ed` (implementation present; behavior not yet verified here)
- [ ] Run verification: `cargo test -p pa-core` and record command, exit, and log
- **Status:** in_progress

### Phase 4: TUI & Skill Integration
- [ ] Review and preserve the untracked `skills/zsh/` migration; do not mistake presence for validated integration
- [ ] Review and preserve five modified `crates/pa-tui/` files, then complete xonsh card rendering against the agreed acceptance criteria
- [ ] Run verification: `cargo test -p pa-tui` and record command, exit, and log
- **Status:** pending (work in progress exists, uncommitted and unverified)

### Phase 5: Packaging & Quality Gate Verification (Approved by User)
- [ ] Reconfigure `pkgbuild/PKGBUILD` for native Rust: package release binary (`cargo build --release -p pa-cli`) alongside Python sidecar runtime and skills, replacing obsolete pnpm/Node packaging flow (approved by user)
- [ ] Reconcile the installer task with the native tree: `scripts/install.xsh` is absent; decide from the pre-port capability ledger whether a native installer is still required, and test any scoped replacement rather than copying the Node-era script
- [ ] Provide static offline fallback/generator for catalog assets (`models.bundled.json`, `mcp-services.bundled.json`) so clean chroot/makepkg builds succeed offline
- [ ] Standardize authoritative workspace version on `0.10.0` across Cargo, runtime metadata, and packaging recipes per upstream authority
- [ ] Run native gates with captured exits/logs: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo build --release --workspace`, and sidecar `pytest`
- [ ] Build/check the native Arch package and verify its files, dependencies, `prime-agent --version`, and CLI startup; record source revision, dirty-input hashes, package path, and exits
- **Status:** approved_pending_prerequisites (PKGBUILD realignment and native packaging authorized; Phase 0 capability parity, baseline, and isolated integration must be evidenced before Phase 5 execution; release/package/CLI remain unverified)
