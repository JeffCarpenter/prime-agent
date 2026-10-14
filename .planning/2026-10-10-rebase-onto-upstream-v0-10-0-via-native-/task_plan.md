# Task Plan: Rebase onto upstream/v0.10.0 via Native Rust Reconciliation Plan

## Goal
Reconcile required fork behavior with native Rust v0.10.0, then verify integration and native Arch packaging.

This file is a derived planning-with-files view, not a second source of current state. Read [scratchpad.yaml](../2026-10-11-native-rust-handoff/native-rust-handoff/scratchpad.yaml) for current facts, decisions, constraints, and next actions. Its structure is defined by [scratchpad.schema.yaml](../2026-10-11-native-rust-handoff/native-rust-handoff/scratchpad.schema.yaml). Findings and progress retain evidence and history.

## Next Step
Read `next[0]` in the canonical `scratchpad.yaml`. That entry owns the action and completion condition; do not maintain another next-action field here.

### Scope decisions and approvals
User has not read the planning documents; explain unresolved choices in chat rather than treating plan contents as approval. Current open choices include historical capability scope and native installer UX. Previously recorded approvals: retire ghost TypeScript stack; realign PKGBUILD to Rust binary/runtime with offline catalogs after integration; prune redundant planning scripts; keep authoritative version `0.10.0`. Source-only six-change and seven-example ledgers are not runtime parity. The first full pa-tui failure remains an open release gate; its repeat was stopped at the user's direction.

### Housekeeping / Working Tree TODOs
- [x] **Handoff Reconcile (documentation complete):** The current packet is `.planning/2026-10-11-native-rust-handoff/native-rust-handoff/`; its YAML-only data and `open-handoff.xsh` were committed in `aa5106784`. The five handoff reader tests passed; Git tracks the files. This closes handoff-file cleanup, not native release, Arch packaging, or CLI verification.
- [ ] **TODO (Ghost Worktree Cleanup):** Prune or reconcile orphaned worktree `.worktrees/rebase-2a16de906` (detached HEAD at `2a16de906`: "restore continuous background trace uploads (#3415)"), unreferenced by current active plan.
- [ ] **TODO (Script Pruning):** Prune redundant `.planning/bin/*.xsh` scripts (`show-*.xsh`) and `phase-status.awk` approved for retirement ("that's what git is for"), tracked at commit `36e03b519`.

## Current Phase
Phase 0 in progress: recover the full pre-port scope and establish native parity/baseline before further integration. Phases 1–2 are historically completed on the existing native line; Phase 3 has code and passing focused bootstrap checks, but runtime selection evidence and integration remain open. Phase 4 has passing focused TUI tests; skill review, integration, and the full-suite failure remain open. Phase 5 packaging is approved but not started. Necessary scoped source, test, packaging, and tooling repairs are authorized by the user; no system installation or overwrite of protected work.

## Phases

### Phase 0: Pre-port history, scope & baseline (prerequisite to further integration)
- [x] Verify the fork point: upstream `v0.9.8@7d442aafa` is the sole parent of Rust-port `39bc99a91`; `xonsh-repl` descends from v0.9.8 and its pre-xonsh prefix ends at `06bdcf1cb`. Five of its six changes match the re-rooted `xonsh-rust` line by `git range-diff`; the first pnpm change needs semantic review.
- [x] Inventory the release-branch replay and separate older fork line in `pre-port-lineage.json`: v0.9.5→v0.9.6→v0.9.8 repeats six pre-xonsh changes; re-rooted TS commit differs in the first pnpm patch; `origin/main` diverges earlier with 322 commits (63 Jeff-authored candidates), not automatically part of the six. Record graph/range-diff/blame; native/upstream *behavioral* absorption remains step 2, not a conclusion from patch IDs.
- [ ] Compare the resulting capability ledger against upstream Rust v0.10.0 and native `2da0c33ed`; mark each capability already upstream, native-equivalent, missing, intentionally retired, or unknown, with test/owner evidence and acceptance criteria. Source-level six-commit ledger now at `pre-port-capability-ledger.json` (pnpm retired; Windows native implementation present but unrun; dotenv and xonsh installer requirements open); separate `origin/main` candidates and runtime acceptance remain open.
- [ ] Isolated `pa-tui` full-suite exit captured (101; 1,391 library pass, four catalog integration failures), HEADs and all twelve protected hashes rechecked; clean-upstream and native catalog-only controls both passed 4/4 (exit 0). Investigate the saved failure and compare controlled runs before classifying it. Do not repeat the unchanged full TUI suite.
- [ ] Choose an isolated integration sequence: reconcile missing pre-xonsh capabilities before replaying/revalidating the two native xonsh commits and dirty TUI/skill inputs. Scoped source/test fixes needed for this reconciliation are authorized by the request; stop for genuinely new scope, destructive operations, or installation.
- **Status:** in_progress

## Immediate sequence (user steps 2–4; planned, not executed)

2. **Capability parity:** from `pre-port-lineage.json`, inspect the six pre-xonsh behaviors and triage the distinct `origin/main` pool without assuming all 322 commits are owned or required. For each candidate record original source, upstream Rust v0.10.0/native equivalent, present/missing/replaced/retired/unknown, and the test or decision needed. Output: `pre-port-capability-ledger.json`; no source edits in this step.
3. **Baseline and preservation:** twelve protected file hashes and both worktree HEADs checked (`phase0-baseline-20261011.json`); fresh isolated `pa-tui` exit 101 captured in `validation-run.json`; clean-upstream and native catalog-only targets each exit 0 (4/4 pass); full-suite failure explanation pending; compare failing `pa-core` and formatting gates with upstream control. Record commands/exits/logs and distinguish shared, native-only, and flaky failures. Output: an evidence-indexed baseline; no overwrite of the main TS recipe or dirty TUI/skill inputs.
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
- [x] **Bootstrap dependency (tested, not merged):** Shared default table in `crates/pa-core/src/kernel/bootstrap/mod.rs` now includes `xonsh`, supplying install args and readiness imports. Focused unit and real cold kernel/REPL venv→sidecar tests each pass 1/1 on stable Rust/Cargo 1.99.0. Evidence: `bootstrap-root-acceptance.json`. Not committed or merged. The outer Rust tests pass; inner unittest selection, execution evidence, and installed-package verification remain open.
- [x] Land xonsh language tagging and code preview in commit `2da0c33ed` (implementation present; behavior not yet verified here)
- [ ] Run verification: `cargo test -p pa-core` and record command, exit, and log
- **Status:** in_progress

### Phase 4: TUI & Skill Integration
- [ ] Review and preserve the untracked `skills/zsh/` migration; do not mistake presence for validated integration
- [x] Review the five protected TUI inputs and add focused tests in the validation copy: three new and 15 existing tests pass; original files are unchanged. Evidence: `tui-xonsh-root-review.json`.
- [ ] Integrate the reviewed TUI changes after feature scope is settled. Preview selection and highlighting changes are deferred, not approved requirements.
- [ ] Run verification: `cargo test -p pa-tui` and record command, exit, and log. Attempt on isolated dirty-input copy recorded in `validation-run.json`: exit 101 (1,391 library pass; four catalog integration fail); not accepted as passing.
- **Status:** in_progress (focused TUI tests pass; skill review, integration, and full-suite failure remain open)

### Phase 5: Packaging & Quality Gate Verification (Approved by User)
- [ ] Reconfigure `pkgbuild/PKGBUILD` for native Rust: package release binary (`cargo build --release -p pa-cli`) alongside Python sidecar runtime and skills, replacing obsolete pnpm/Node packaging flow (approved by user)
- [ ] Reconcile the installer task with the native tree: `scripts/install.xsh` is absent; decide from the pre-port capability ledger whether a native installer is still required, and test any scoped replacement rather than copying the Node-era script
- [ ] Provide static offline fallback/generator for catalog assets (`models.bundled.json`, `mcp-services.bundled.json`) so clean chroot/makepkg builds succeed offline
- [ ] Standardize authoritative workspace version on `0.10.0` across Cargo, runtime metadata, and packaging recipes per upstream authority
- [ ] Run native gates with captured exits/logs: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo build --release --workspace`, and sidecar `pytest`
- [ ] Build/check the native Arch package and verify its files, dependencies, `prime-agent --version`, and CLI startup; record source revision, dirty-input hashes, package path, and exits
- **Status:** approved_pending_prerequisites (PKGBUILD realignment and native packaging authorized; Phase 0 capability parity, baseline, and isolated integration must be evidenced before Phase 5 execution; release/package/CLI remain unverified)

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| Native full-suite repeat log redirection used a root-relative `.planning/...` path after switching cwd to isolated worktree; Bash exit 1 before Cargo | 2026-10-12 launch 1 | Preserve failure in repeat status; relaunch with absolute log path |
| Inspection-only `rlm.list_subagents()` attempted nonexistent `.name` attribute | 2026-10-12 | Use returned object fields only after introspection; no task artifact affected |
| Focused sidecar xonsh test in fresh uv project env failed: expected stdout `value`, got empty (exit 1) | 2026-10-12; command omitted xonsh package | Check sidecar event/error and rerun with explicit xonsh dependency, then repair native bootstrap only if evidence confirms dependency omission |
| Sidecar xonsh test with installed xonsh aborted in xonsh pytest plugin during startup (`prompt_toolkit` absent), exit 3 | 2026-10-12 targeted retry 2 | Disable unrelated pytest plugin autoload and rerun same xonsh test; keep xonsh installed in test environment |
| Local harness memory create returned already-exists after auto-refinement created `native-xonsh-reconciliation-current-state` | 2026-10-12 | Reuse existing local memory; no duplicate write |
| Prior unit GREEN runner no longer exists; log ends during compilation with no result | Resume 20261014T025608Z | Mark interrupted; restart named unit test with `--lib`, capture fresh log and exit |
| Focused unit restart exit 101 before tests: rust-lld undefined hidden symbols linking pa-core lib test | 20261014T025608Z | Assigned Sol to diagnose build artifacts/toolchain before any code change; no test assertion result |
| User started background `rustup +stable update` during verification | Current resume | Treat toolchain as changing; retain completed live result as pre-update evidence and defer fresh compile until update finishes |
| Interim jq read of final verifier result exit 2: result file not published yet | Post-update unit completion | Use existing unit log for interim evidence; wait for worker final artifact rather than reread a missing result |
| prime-agent send --steer rejected despite live help advertising flag | Two independent worker deliveries | Retry documented basic positional send without optional flags; do not claim delivery before receipt |
| Compaction scheduling cell had unmatched closing parenthesis; nothing executed | Preparation | Split instructions into a variable and schedule with a simple call |
