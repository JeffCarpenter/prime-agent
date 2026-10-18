# Plan: LLVM Coverage Triage & Causal Analysis

## 1. Objective & Scope
Monitor the single running workspace test suite:
```bash
cargo llvm-cov --tests --release --all-features --bins --json --summary-only --output-path report/cargo-llvm-cov.json --workspace nextest || cat $REPORT | drivel describe
```
Should tests fail:
1. Ingest `drivel`'s inferred schema description of `report/cargo-llvm-cov.json`.
2. Construct targeted `jq` queries to pinpoint execution drop-offs and coverage frontiers.
3. Rigorously trace from proximal assertion/timeout failures through distal environment/concurrency causes.

---

## 2. Process Monitoring State
- **Superfluous Process Cleared**: Superfluous duplicate test suite was terminated; single active runner (`PID 93427`) retained.
- **Asynchronous Monitor**: Background task [`monitor_cov.sh`](file:///home/jeff/.gemini/antigravity-cli/brain/51e368b8-a8f0-43bf-a33b-8234e13b1b4d/scratch/monitor_cov.sh) (`task-184`) blocks on process completion rather than polling in a busy loop, reacting upon exit.

---

## 3. Hypotheses, Proof, and Falsification

| Hypothesis | Mechanism | Proof Criteria | Falsification Criteria |
| :--- | :--- | :--- | :--- |
| **H1: `pa-tui` Catalog Tests** | Mock server connection drop or idle timeout under concurrency + coverage. | Backtrace shows `ConnectionReset`, `UnexpectedEof`, or `hyper::IncompleteMessage`; mock request entered but response unwritten in coverage. | All 4 catalog tests report `PASS`; or fail on explicit schema/attribute mismatch rather than socket error. |
| **H2: `pa-tui` Headless Barrier** | Coverage profiling latency trips tight wall-clock render deadlines. | Assertion failure explicitly reports `elapsed > deadline`; frame rendering logic itself has full coverage without panic. | All render barrier tests report `PASS`; or test synchronization inspects logical event loop ticks rather than wall-clock time. |
| **H3: `pa-core` Golden Fixtures** | Baked target paths from earlier worktree builds or timezone offsets. | `assert_eq!` diff shows foreign `.worktrees/...` path or 7h/8h offset; binary inspection reveals embedded strings. | All golden snapshot tests report `PASS`; or dynamic manifest path resolution is confirmed. |
| **H0: Suite Success** | Single runner elimination of port/lock contention yields green exit. | `cargo-nextest` exits 0 with 0 failures; `cargo-llvm-cov` produces report without entering `||` shell branch. | Any crate test failure resulting in non-zero exit code. |

---

## 4. Triage & Execution Protocol

### Step 1: Completion Verification
- Verify runner termination and exit code.
- Confirm creation and size of `report/cargo-llvm-cov.json`.

### Step 2: Schema Discovery via `drivel`
- Run `drivel describe` (both human-readable and `--json-schema`) to inspect report topology without loading massive JSON payloads into memory.
- Identify top-level summary keys and file entry structures (`.data[0].totals`, `.data[0].files`).

### Step 3: Targeted `jq` Exploration
- **Summary Totals**: Extract workspace-wide line, function, and branch coverage.
- **Failing Module Execution Frontier**: For any failed crate, query line-by-line hit counts to locate the exact transition point where `count > 0` becomes `count == 0`.
- **Zero-Coverage Components**: Identify whether critical mock or teardown handlers were bypassed entirely.

### Step 4: Causal Tracing
- **Proximal Cause**: The immediate failing line, assertion, unwrapped error, or unhandled signal.
- **Intermediate Cause**: State mutation, buffer starvation, or port/socket state that triggered the proximal condition.
- **Distal Root Cause**: Concurrency model, CPU instrumentation overhead, target cache artifact, or harness environment discrepancy.
