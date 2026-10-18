# Catalog closure: source diagnosis; lease pending

## Observed, not yet causal

- Historical native full command `cargo test -p pa-tui --locked` exited 101; catalog binary four named failures, duration 55.79 s (`.planning/2026-10-10-rebase-onto-upstream-v0-10-0-via-native-/logs/native-pa-tui-phase0-20261012-attempt2.log:1632-1684`). Two first-run assertions saw no saved request / default live row (:1644-1655); two second-run connects refused at independent per-test socket paths (:1659-1673).
- Historical matched catalog-only commands `cargo test -p pa-tui --locked --test agents_view_catalog_settle_carry` exited 0 on native and upstream, each four named passes (`.../logs/native-pa-tui-catalog-control-20261012.log:84-92`, `.../logs/upstream-pa-tui-control-20261012.log:216-224`). Distinct `CARGO_TARGET_DIR`s; source bytes match. Historical invocation environment/scheduling not fully recorded. Neither all-green run closes full invocation.
- Current test mock serves exactly **one** accepted socket (`crates/pa-tui/tests/agents_view_catalog_settle_carry.rs:59-63`), ending on EOF or 90 quiet windows with 100 ms read timeout and a 50 ms pause per timeout (:219-245). Second runs reuse link (`:374-386`, `:437-455`, `:511-526`), but `open_roster_link` reconnects when reused link's roster request fails (`crates/pa-tui/src/agents_view.rs:528-562`); mock does not accept that reconnect. Thus a dead link can yield observed refusal. The log does not tell *why* link died.
- Mock records catalog requests at test source :114-116. Fetch only starts after initial roster subscribe and first frame (`agents_view.rs:677-729`); first-run default row plus zero requests shows catalog request not processed, **not** whether client failed to arm it, mock timed out first, or a scheduling delay. Headless `WaitSettle` emits a marker then performs fixed-duration sleep (`agents_view/render.rs:898-901`), not a proof the catalog has settled. It is plausible that an input enters before catalog completion under load; unproven here. No timeout increase or acceptance relaxation justified.
- Daemon client reconnect follows a failed roster request (`agents_view.rs:552-561`), and writes commands through a separate async task (`crates/pa-tui/src/daemon_client.rs:327-337,604-634`). A process-level four-failure chronology with timestamped/mock-command trace is missing. Rust-analyzer document-symbol lookup on test succeeded; definition lookup on imported call returned empty, so local selective source used.

## Closure decision (documented limitation; no fix claimed)

Root declined further Cargo reruns: isolated upstream/native runs each passed all four named tests under separate targets, but another isolated pass would add little causal information. Root verified `agents_view_catalog_settle_carry.rs`, `agents_view.rs`, `agents_view/render.rs`, and `daemon_client.rs` match upstream v0.10.0, native HEAD, and working copy. The catalog test existed upstream; provenance is separately recorded in `catalog-origin.md`. Matching source and test provenance do **not** prove equal execution environment, exclude fork-specific regression, or establish the mock hypothesis as root cause.

**Status:** the historical full-run four failures remain unresolved; initial zero catalog requests / wrong selection and subsequent refused second-run connections are separate observations, not a proven single defect. Neither catalog-only green run is full-suite green. No source, helper, or product code was changed; no new Cargo command/test or cache was created. Under the canonical “fixed or explicitly documented” clause, root chose this explicit limitation and will proceed to integration/package. Reopen only with a reproducible exact named failure and mock-command/UI-readiness/input ordering trace, or equivalent new evidence.

## Artifact inventory

- This evidence file is this worker's sole created artifact; no worker-owned scratch logs/cache/worktrees exist. Retain as evidence, not cleanup. Existing shared target remains owned by root/other workers.

## Root personal review

Root traced the four assertions, mock lifetime, `run_agents_view_surface`, catalog spawn and headless step producer. `WaitSettle` emits a no-op marker then sleeps asynchronously; it is not a catalog readiness barrier. The saved request is spawned only after roster subscription, mode setup and first draw. The initial zero-request failure cannot be explained solely by the later refused reconnect; no causal trace was captured. Existing logs remain insufficient to attribute a fork regression or select a source repair.

Runner evidence correction: the three historical `.xsh` runners set `os.environ['CARGO_TARGET_DIR']` and copy that value into result metadata. Their actual Cargo output reports relative `target/debug/deps/...`, not the declared absolute shared/baseline target. Thus the recorded target configuration was not the executed one; the controls used per-worktree default targets. This matches the independently observed Xonsh environment-propagation pitfall and explains redundant build artifacts. It does not explain catalog assertion failures. Future Cargo commands must use explicit `--target-dir` plus `--manifest-path`, or verified Xonsh environment bindings.

No catalog source change or new test run was made during this review. Root owns any further diagnosis.

## Current disposition — explicit user correction

**The scoped catalog tests are passing: 4/4 on the native fork and 4/4 on upstream. The user ordered us to stop wasting time on them and finish the rebase.** No further catalog investigation, source changes, or reruns are scheduled. The earlier full-invocation failures remain historical evidence only; they are not an active blocker.
