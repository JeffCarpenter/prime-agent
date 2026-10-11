# Task Plan: Rebase onto upstream/v0.10.0 via Native Rust Reconciliation Plan

## Goal
First reconcile the fork's pre-xonsh behavior across upstream releases with the Rust v0.10.0 product; then complete the native xonsh port in isolation. Criteria: `.planning/native-rust-port-reconciliation-plan.yaml`; current authority and evidence: `native-status.yaml`, `findings.md`. Existing `feat/native-rust-xonsh` and dirty inputs remain protected references until the earlier fork work is accounted for.

## Next Step
Use `pre-port-lineage.json` to build a source-cited capability ledger for the six release-replay changes and the separate `origin/main` candidate pool; compare each proposed carry-forward behavior with upstream Rust v0.10.0 and native `2da0c33ed` before choosing repairs. Do not start packaging yet.

## Current Phase
Phase 0 in progress: recover the full pre-port scope and establish native parity/baseline before further integration. Phases 1–2 are historically completed on the existing native line; Phase 3 has landed code but open acceptance, Phase 4 is dirty/unverified, and Phase 5 is pending. Necessary scoped source and test repairs are part of the requested rebase/reconciliation; no system installation or overwrite of protected work.

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
- [ ] Reconcile the planned "manage xonsh beside ipython" requirement with the committed execution-mode wiring in `kernel/manager/`, `kernel/protocol.rs`, and `session_engine/runtime_wiring.rs`; do not assume separate-kernel provisioning is complete
- [x] Land xonsh language tagging and code preview in commit `2da0c33ed` (implementation present; behavior not yet verified here)
- [ ] Run verification: `cargo test -p pa-core` and record command, exit, and log
- **Status:** in_progress

### Phase 4: TUI & Skill Integration
- [ ] Review and preserve the untracked `skills/zsh/` migration; do not mistake presence for validated integration
- [ ] Review and preserve five modified `crates/pa-tui/` files, then complete xonsh card rendering against the agreed acceptance criteria
- [ ] Run verification: `cargo test -p pa-tui` and record command, exit, and log
- **Status:** pending (work in progress exists, uncommitted and unverified)

### Phase 5: Packaging & Quality Gate Verification
- [ ] Design a native Rust Arch recipe in an isolated workspace; never replace the main checkout's modified TS `pkgbuild/PKGBUILD`, `.SRCINFO`, or old packages
- [ ] Reconcile the installer task with the native tree: `scripts/install.xsh` is absent; decide from the pre-port capability ledger whether a native installer is still required, and test any scoped replacement rather than copying the Node-era script
- [ ] Generate and validate production catalog assets (`models.bundled.json`, `mcp-services.bundled.json`) from a real catalog source; the offline `--fixture` is synthetic and cannot prove a production package
- [ ] Run native gates with captured exits/logs: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo build --release --workspace`
- [ ] Build/check the isolated Arch package and verify its files, dependencies, `prime-agent --version`, and CLI startup; record source revision, dirty-input hashes, package path, and exits
- **Status:** pending (no native PKGBUILD, release build, or package verified)
