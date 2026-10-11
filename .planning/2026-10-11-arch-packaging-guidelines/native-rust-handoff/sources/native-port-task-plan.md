# Task Plan: Rebase onto upstream/v0.10.0 via Native Rust Reconciliation Plan

## Goal
Reconcile and rebase xonsh REPL support onto upstream v0.10.0 in isolated branch `feat/native-rust-xonsh` following `.planning/native-rust-port-reconciliation-plan.yaml`.

## Next Step
Phase 3: Implement `crates/pa-core/src/tools/xonsh.rs`, update kernel management in `crates/pa-core/src/kernel/`, add syntax preview support, and verify via `cargo test -p pa-core`.

## Current Phase
Phase 3: Rust Core Tool & Kernel Integration

## Phases

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
- [ ] Implement `crates/pa-core/src/tools/xonsh.rs` (template: `crates/pa-core/src/tools/ipython.rs`) and register in `crates/pa-core/src/tools/mod.rs`
- [ ] Update `crates/pa-core/src/kernel/` to provision and manage xonsh beside ipython
- [ ] Add xonsh language tagging and code preview in `crates/pa-core/src/tools/code_preview.rs`
- [ ] Run verification: `cargo test -p pa-core`
- **Status:** in_progress

### Phase 4: TUI & Skill Integration
- [ ] Relocate `packages/coding-agent/skills/zsh` to root `skills/zsh`
- [ ] Update tool execution card rendering in `crates/pa-tui/src/chat/`
- [ ] Run verification: `cargo test -p pa-tui`
- **Status:** pending

### Phase 5: Packaging & Quality Gate Verification
- [ ] Update `pkgbuild/PKGBUILD` for native Rust binary
- [ ] Align `scripts/install.xsh` with native layout
- [ ] Run full merge gates: `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, `cargo build --release --workspace`
- **Status:** pending

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use isolated worktree `.worktrees/feat-native-rust-xonsh` | Keeps main worktree and active `xonsh-rust` branch unpolluted during the v0.10.0 native port |
| Rebase/port via `.planning/native-rust-port-reconciliation-plan.yaml` | Upstream v0.10.0 transitioned from TypeScript (`packages/`) to Rust (`crates/`), so reconciliation follows the native port architecture |
| Verified Phase 2 with full 144-test pytest suite | Ensures backward compatibility with existing python REPL sidecar and new xonsh execution mode |

## Errors Encountered
| Error | Resolution |
|-------|------------|
