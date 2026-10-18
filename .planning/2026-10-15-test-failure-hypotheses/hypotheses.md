# Hypotheses: Workspace Test Failures (`v0.10.0` .. `xonsh-rust`)

## 1. Context & Scope

- **Active Bisect Boundary**:
  - `good`: `v0.10.0` (`763094e1b6a7c17450ee8399b06cda1853847ca5`)
  - `bad`: `xonsh-rust` (`b11bdea6a621ee75bfc624436104819c8420f921`)
- **Bisect Test Command**:
  ```bash
  cargo nextest run --workspace --lib --tests --fail-fast
  ```
- **Objective**: Formulate and record falsifiable causal hypotheses explaining failures observed across the workspace test suites during native Rust port validation and fork rebase.

---

## 2. Hypotheses Matrix

| ID | Category | Subsystem / Target Test | Mechanism | Proof Criteria | Falsification Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **H1** | Environment / Cfg | `pa-core`: `status_names_the_endpoint_and_the_installation_id` | Test unconditionally asserts `"Endpoint: nowhere (development build)"`, but implementation emits `ANALYTICS_ENDPOINT` when `cfg!(debug_assertions)` is false (e.g. under release or `-C opt-level=3`). | Binary compiled with `-C opt-level=3` fails assertion reporting `https://api.primeintellect.ai/...`; passing under unoptimized debug build. | Test passes under `-C opt-level=3` or fails on unrelated installation ID logic. |
| **H2** | Environment / Timezone | `pa-core`: `golden_bash_group_matches_ts` (`destructive-reset-clean`) | Fixture date strings in `bash.json` omit explicit timezone offset (`+0000`). Local timezone (PDT `-0700`) yields commit `32200ad`, diverging from expected UTC hash `e33214d`. | `TZ=UTC` reproduces `e33214d` (pass); `TZ=America/Los_Angeles` reproduces `32200ad` (fail). | Test produces `e33214d` regardless of runner `TZ`, or fails due to command syntax error rather than commit hash mismatch. |
| **H3** | Concurrency / IPC | `pa-tui`: Catalog integration suites (`agents_view_catalog_settle_carry.rs`) | Under full-workspace `nextest` concurrency, parallel tests spinning up mock HTTP/daemon sockets suffer port collisions or connection resets (`ECONNRESET`). | Fails during full-suite concurrent execution (`--workspace`), but consistently passes in isolation (`--test ... -- --test-threads=1`). | Test fails identically in single-threaded isolated execution with identical backtrace. |
| **H4** | Concurrency / Latency | `pa-core`: `concurrent_producers_drop_at_the_reserve_when_the_queue_is_full` | High compilation/test runner CPU load delays thread barrier synchronization, tripping strict queue burst/timing deadlines. | Test fails intermittently under saturated CPU load; passes deterministically when run alone. | Test deterministically fails under zero system load with unvarying queue state counts. |
| **H5** | Fork Divergence | `pa-core` / `pa-daemon`: REPL tool contract & xonsh dispatch | Integration of native xonsh REPL alongside or in place of `ipython`/`python_repl` breaks strict tool list assertions or shell prompt format checks. | Bisect isolates the first bad commit to a xonsh tool/REPL integration commit (e.g., `939bff958`, `82a0b052b`). | First bad commit is an upstream commit prior to xonsh fork additions, or failure reproduces on unmodified upstream. |
| **H6** | Cache Contamination | `pa-core`: Golden corpus runtime load | `golden_replay.rs` evaluates `concat!(env!("CARGO_MANIFEST_DIR"), "/tests/golden/corpus")` at compile time, causing binaries built in shared target directories to read foreign worktree fixtures. | Binary string inspection reveals paths pointing to adjacent `.worktrees/...` directories. | Binary path inspects current working tree manifest directory exclusively. |

---

## 3. Detailed Causal Hypotheses

### H1: Compile-Time `debug_assertions` Inversion in Telemetry Status
* **Location**: `crates/pa-core/src/session_engine/telemetry/status.rs:81-98, 240-255`
* **Underlying Mechanism**:
  The function `telemetry_endpoint()` resolves the analytics endpoint using:
  ```rust
  (!cfg!(debug_assertions)).then_some(pa_telemetry::ANALYTICS_ENDPOINT)
  ```
  The test asserts:
  ```rust
  assert!(after.contains("Endpoint: nowhere (development build)"));
  ```
  When tests run under environment profiles inheriting optimization flags (e.g., `RUSTFLAGS="-C opt-level=3"`), `debug_assertions` is disabled by the compiler. Consequently, `telemetry_endpoint()` returns `Some("https://api.primeintellect.ai/api/v1/agent-analytics/events")`, failing the string check.
* **Prior Evidence**: Verified in `.planning/2026-10-11-native-rust-handoff/native-rust-handoff/evidence/core-shared-cause-audit.md:5-9`.
* **Resolution**: Make the test assertion sensitive to `cfg!(debug_assertions)`, or ensure the test target explicitly specifies debug assertions enabled.

### H2: Missing Timezone Offset in Git Golden Corpus
* **Location**: `crates/pa-core/tests/golden/corpus/bash.json:211-228`
* **Underlying Mechanism**:
  Case `destructive-reset-clean` executes:
  ```bash
  GIT_AUTHOR_DATE='2005-04-07T22:13:13' GIT_COMMITTER_DATE='2005-04-07T22:13:13' git commit -qm init
  ```
  Because no timezone offset is supplied, Git uses the local host timezone.
  - In UTC (+0000), Unix timestamp is `1112911993` -> commit SHA prefix `e33214d`.
  - In PDT (-0700), Unix timestamp is `1112937193` -> commit SHA prefix `32200ad`.
  The test expects `HEAD is now at e33214d init\n`.
* **Prior Evidence**: Four-timezone reproduction documented in `core-shared-cause-audit.md:19-32` proved that appending ` +0000` to both date strings makes the test deterministic across all timezones.
* **Resolution**: Update the fixture date strings in `bash.json` to include `+0000`.

### H3: Mock Server & IPC Socket Contention under Parallel Execution
* **Location**: `crates/pa-tui/tests/agents_view_catalog_settle_carry.rs`
* **Underlying Mechanism**:
  `cargo-nextest` runs individual test binaries in parallel processes. Tests that instantiate mock servers or local Unix sockets on shared loopback interfaces or fixed filesystem socket paths encounter race conditions, port re-use delays, or ungraceful socket resets (`ConnectionReset`, `UnexpectedEof`).
* **Prior Evidence**: `failure-classification-audit.md:7-8` recorded full-suite exit 101 on `pa-tui` (4 failures, 0 passes in 55.79s), whereas running the identical test in isolation exited 0 with all passes.
* **Resolution**: Use dynamic ephemeral port binding / unique tempfile socket paths, or mark catalog integration tests for serial execution in nextest config (`[[profile.default.overrides]] threads-required = "num-cpus"` or single-threaded pool).

### H4: Thread Barrier Timing Skew in Request Timing Tests
* **Location**: `crates/pa-core/src/session_engine/request_timing/payload/tests.rs:563-635`
* **Underlying Mechanism**:
  `concurrent_producers_drop_at_the_reserve_when_the_queue_is_full` coordinates multiple producer threads against a bounded reservation queue. When the host machine is heavily loaded (such as during concurrent compilation and testing across the entire workspace), thread context switching latency can cause producer requests to miss the intended queue saturation window, tripping `no storm body may land`.
* **Prior Evidence**: Observed failing during full runs, but passing upon immediate isolated retry (`validation-run.json:42-49`, `native-pa-core-timing-retry.log`).
* **Resolution**: Replace tight wall-clock sleep loops with explicit atomic barrier / rendezvous channels.

### H5: Fork-Specific Shell and REPL Surface Contract Divergence
* **Location**: Workspace composition root and tool resolution (`crates/pa-core`, `crates/pa-cli`)
* **Underlying Mechanism**:
  Upstream commit `3e0893260` renamed `ipython` to `python_repl` and enforced a strict three-tool surface contract (`bash`, `edit`, `python_repl`). The `xonsh-rust` branch adds native xonsh support, shell environment forwarding, and custom session worker behaviors. If existing workspace unit/integration tests assert strictly against TS parity tool sets or standard bash invocations, fork-introduced variants may trigger unexpected assertion failures.
* **Verification**: `git bisect` will isolate whether the regression originated in upstream changes or on the `xonsh-rust` fork branch commits.

### H6: Cross-Worktree Target Cache Contamination
* **Location**: `crates/pa-core/src/tools/golden_replay.rs`
* **Underlying Mechanism**:
  `env!("CARGO_MANIFEST_DIR")` is embedded as a string literal at compile time. If multiple worktrees share a single `CARGO_TARGET_DIR` without package-level cleans, a test binary compiled for one worktree may execute inside another worktree while reading files from the first worktree's source path.
* **Prior Evidence**: Verified via read-only `mmap` inspection of test binaries in `core-shared-cause-audit.md:63-70`.

---

## 4. Bisection & Verification Protocol

1. **Bisection Execution**:
   - `git bisect run cargo nextest run --workspace --lib --tests --fail-fast`
   - Evaluates whether each midpoint revision exhibits green or red exit status.
2. **Post-Bisect Classification**:
   - Inspect the isolated commit identified by `git bisect`.
   - Match the failing test and failure output against the hypotheses above.
3. **Targeted Falsification**:
   - For H1: Check compile-time `cfg!(debug_assertions)` of the failing binary.
   - For H2: Re-run the failing test under `TZ=UTC`.
   - For H3: Re-run failing tests with `--test-threads=1`.
