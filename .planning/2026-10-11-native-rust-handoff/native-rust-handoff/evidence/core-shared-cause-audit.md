# Shared pa-core failures: bounded cause audit

**Scope and limits.** The native validation copy is `2da0c33edc52db1d767b08537f6db8b75778f1c6` (five dirty TUI source files); upstream baseline is `763094e1b6a7c17450ee8399b06cda1853847ca5` (clean); revisions and full suite outcomes are documented in adjacent `failure-classification-audit.md` and `.planning/2026-10-10-rebase-onto-upstream-v0-10-0-via-native-/validation-run.json:21-67`. Source paths below are relative to each corresponding worktree. This follow-up inspected exactly eight source/config/fixture files (`status.rs`, native/upstream `golden_replay.rs`, root `Cargo.toml`, `pa-telemetry/src/lib.rs`, `tests/golden/corpus/bash.json`, `.cargo/config.toml`, and `tools/bash.rs`); rust-analyzer symbol lookups anchored status and golden test locations. Four cheap shell commands only: one selective `jq` fixture query, one `git config --show-origin --get-regexp` for relevant Git settings, and `rustc --print cfg` at `-C opt-level=3` versus `-C opt-level=0`. No Cargo invocation, build, source modification or test rerun. Current environment inspection and pure in-memory hash modeling are not historical build/run telemetry.

## Endpoint assertion: conditional on compile-time debug assertions

* Native and upstream `crates/pa-core/src/session_engine/telemetry/status.rs` are byte-identical. Test `:240-255` calls `telemetry_status_text` and unconditionally asserts `Endpoint: nowhere (development build)` at `:254`. Actual implementation `:81-98`: `telemetry_endpoint()` is `(!cfg!(debug_assertions)).then_some(pa_telemetry::ANALYTICS_ENDPOINT)`; status falls back to `nowhere (development build)` only if that returns `None`. `crates/pa-telemetry/src/lib.rs:70` reexports the endpoint constant. Therefore the assertion must fail if **that compiled test binary** has `debug_assertions` unset, independently of installation-id creation or DO_NOT_TRACK. The native and upstream failure logs each show this exact failed assertion (`logs/pa-core-test-20261011.log:1445-1449`, `logs/upstream-pa-core-test-20261011.log:1243-1247` in prior planning evidence root).
* Exact inputs relevant to build: root `Cargo.toml:137-140` only sets `profile.release` and has no `debug-assertions` override in the inspected root manifest; `.cargo/config.toml:1-5` sets `DO_NOT_TRACK=1`, which selects telemetry delivery policy (`status.rs:63-78`), **not** the compiled endpoint. Current process has `RUSTFLAGS='-C opt-level=3 -C target-cpu=x86-64-v3'`; `rustc --print cfg -C opt-level=3` output omits `debug_assertions`, while `rustc --print cfg -C opt-level=0` includes it. Thus inherited optimized flags are a **specific testable explanation** for the shared failure, not a proven reconstruction of the October 11 Cargo invocation: those logs do not record historical `RUSTFLAGS` or the actual binary's cfg. Both trees sharing the test/implementation is a shared environmental-sensitivity finding, not a declaration of an upstream bug.
* **Minimum authorized confirmation later:** first record `RUSTFLAGS` and Cargo profile settings from the runner and inspect/record `cfg!(debug_assertions)` in that test binary. If tests are approved, run only `status_names_the_endpoint_and_the_installation_id` with `RUSTFLAGS` explicitly unset (isolated target dir if build artifact integrity matters), then with inherited optimized flags; expect first pass, second fail if the hypothesis is correct. If cfg remains set in the failing binary, reject the hypothesis and capture actual `after` text before changing code. **Minimal correction candidate:** make endpoint expectation conditional on the actual compile-time cfg, asserting the analytics endpoint under `not(debug_assertions)` and the development string under `debug_assertions`; alternatively explicitly require debug assertions in this test gate. Never disable telemetry safety merely to placate a test.

## Git golden: fixed local wall time, missing offset

* Corpus input `crates/pa-core/tests/golden/corpus/bash.json:211-228` (`jq '.cases[] | select(.name=="destructive-reset-clean") | {name,fixture,command,expected_text:.result.text,ok:.result.ok}'`): fresh `git init -q .`, `git config user.email t@t`, `git config user.name t`, write `original\n` to `tracked.txt`, stage, then `GIT_AUTHOR_DATE='2005-04-07T22:13:13' GIT_COMMITTER_DATE='2005-04-07T22:13:13' git commit -qm init`; run `git reset --hard`. Recorded text **hardcodes** `HEAD is now at e33214d init\n` (`bash.json:226`) despite date strings lacking a timezone. The corpus is byte-identical in both trees. `golden_replay.rs:26-30` loads this file; `:75-105` executes fixture commands via `/bin/bash -c` in fresh temp dir; `:185-261` calls `bash::execute_bash`, compares normalized output linewise and panics on difference. These exact fixture/test slices are identical in both trees even though entire `golden_replay.rs` differs elsewhere. `tools/bash.rs:243-268,331-365` executes the passed command without fixture-specific Git hash rewrite. Both logged failures read expected `e33214d`, actual `32200ad` (`logs/pa-core-test-20261011.log:1450-1459`, `logs/upstream-pa-core-test-20261011.log:1248-1257`).
* **Discriminating offline proof, without running Git or writing a repo:** Git blob of `original\n`; tree entry `100644 tracked.txt` plus that blob; commit body `tree <computed>\nauthor t <t@t> <unix-seconds> <offset>\ncommitter t <t@t> <unix-seconds> <offset>\n\ninit\n`. Hash each using `SHA1("<type> <byte-length>\0" + payload)`. Modeling local wall time `2005-04-07T22:13:13` at **+0000** gives Unix time `1112911993` and commit hash prefix **e33214d80b38**; at **-0700** gives `1112937193` and **32200ad01ad5**. These are the exact recorded expected/actual seven-character prefixes. Current machine timezone reports `PDT -0700`; `git config --show-origin --get-regexp '^(init\.defaultBranch|core\.repositoryFormatVersion|user\.email|user\.name|commit\.gpgSign|core\.hooksPath|core\.abbrev|extensions\.objectFormat)$'` showed global `user.email=pub@jeffc.ca`, `user.name=Jeff C`, overridden by fixture-local `t@t` (`bash.json:216-217`); no other selected overrides appeared. Thus timezone omission in corpus is a **mechanistically verified explanation of the exact differing hashes**, but the original test process timezone was not logged; a coincidental cause with matching prefix is logically possible.
* **Minimum fix/verification candidate after approval:** set `TZ=UTC` explicitly for the fixture commit process, or pin both `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE` with explicit `+0000`, preserving the captured TS expected hash. Run only `golden_bash_group_matches_ts` twice, under `TZ=UTC` and `TZ=America/Los_Angeles` at the runner, and confirm the pinned fixture yields the same `e33214d` (and catches other cases unaffected). If it does not, log fixture `git show -s --format=fuller HEAD` and relevant Git config before revising the hypothesis. No patch is made here.

**Boundary:** These are two shared failure *observations* with separate causal hypotheses; neither proves a port regression nor licenses treating upstream as defective. Catalog remains unresolved; no catalog retest is proposed.

## Approved four-cell Git fixture reproduction (2026-10-14; no Cargo)

Used one dedicated temporary parent `/tmp/prime-git-tz-audit-i0zlcy8h` and four isolated repositories (`utc-naive-valid`, `la-naive-valid`, `utc-explicit-valid`, `la-explicit-valid`). For each row, native xonsh `with __xonsh__.env.swap(TZ=<zone>, GIT_AUTHOR_DATE=<date>, GIT_COMMITTER_DATE=<date>):` scoped **the environment of Git itself**; Python wrote literal bytes `b'original\n'` to `<repo>/tracked.txt`. Then invoked these exact native xonsh command forms, replacing `<repo>` by the absolute row path: `git -C <repo> init -q`; `git -C <repo> config user.email t@t`; `git -C <repo> config user.name t`; `git -C <repo> add tracked.txt`; `git -C <repo> commit -qm init`; `git -C <repo> rev-parse HEAD`; `git -C <repo> show -s --format=%at,%ai,%ct,%ci HEAD`; `git -C <repo> reset --hard`. **All eight commands exited 0 in all four rows; stderr empty.** This reproduces corpus `bash.json:211-228` without `/bin/bash` orchestration and does not touch either project worktree. Git config commands and writes are confined to the temporary repo.

| Row / exact repo | Scoped `TZ`; scoped `GIT_AUTHOR_DATE` and `GIT_COMMITTER_DATE` (same value) | `rev-parse HEAD` (exit 0) | `git show` author and committer (exit 0; `%at,%ai,%ct,%ci`) | `reset --hard` stdout (exit 0) |
|---|---|---|---|---|
| `utc-naive` / `/tmp/prime-git-tz-audit-i0zlcy8h/utc-naive-valid` | `UTC`; `2005-04-07T22:13:13` | `e33214d80b38a36861f79ca5cca566884d8cadf9` | `1112911993,2005-04-07 22:13:13 +0000,1112911993,2005-04-07 22:13:13 +0000` | `HEAD is now at e33214d init` |
| `la-naive` / `/tmp/prime-git-tz-audit-i0zlcy8h/la-naive-valid` | `America/Los_Angeles`; `2005-04-07T22:13:13` | `32200ad01ad53cf77f271473c1a2a0c2d9e96bf5` | `1112937193,2005-04-07 22:13:13 -0700,1112937193,2005-04-07 22:13:13 -0700` | `HEAD is now at 32200ad init` |
| `utc-explicit` / `/tmp/prime-git-tz-audit-i0zlcy8h/utc-explicit-valid` | `UTC`; `2005-04-07T22:13:13 +0000` | `e33214d80b38a36861f79ca5cca566884d8cadf9` | `1112911993,2005-04-07 22:13:13 +0000,1112911993,2005-04-07 22:13:13 +0000` | `HEAD is now at e33214d init` |
| `la-explicit` / `/tmp/prime-git-tz-audit-i0zlcy8h/la-explicit-valid` | `America/Los_Angeles`; `2005-04-07T22:13:13 +0000` | `e33214d80b38a36861f79ca5cca566884d8cadf9` | `1112911993,2005-04-07 22:13:13 +0000,1112911993,2005-04-07 22:13:13 +0000` | `HEAD is now at e33214d init` |

**Result:** without an offset the UTC and Los Angeles commits differ exactly as the old shared failures did (`e33214d` versus `32200ad`). With explicit `+0000`, both TZ settings produce identical `e33214d80b38a36861f79ca5cca566884d8cadf9` and `HEAD is now at e33214d init`. The smallest fixture-only correction candidate is to append ` +0000` to both fixture date strings at `bash.json:220`; run the focused golden test only after separate permission to edit/build. This experiment does **not** establish the original process timezone, nor the actual Cargo test binary's compile-time cfg; `rustc --print cfg` alone is insufficient to prove that binary's cfg. Catalog remains unresolved.
Temporary repositories were removed after the commands and outputs above were recorded; replay the listed commands in a new private temporary directory if needed.

## Authorized isolated fixture patch and four-timezone probe (2026-10-14)

Only `/home/jeff/code/fork/prime-agent/.worktrees/native-rust-validation-20261011/crates/pa-core/tests/golden/corpus/bash.json:220` was edited. The `edit` skill replaced the unique `destructive-reset-clean` case slice; full before/after text differs by **one line only**, shown below. The expected `HEAD is now at e33214d init\n` at `bash.json:226` and all other fixtures are byte-for-byte unchanged. `jq -c '.cases[] | select(.name=="destructive-reset-clean") | {fixture,command,expected:.result.text}' <fixture>` exited 0 and confirmed both dates were explicit `+0000`, expected hash unchanged.

```diff
--- validation/bash.json.before
+++ validation/bash.json.after
@@ -217,7 +217,7 @@
         "git config user.name t",
         "echo original > tracked.txt",
         "git add tracked.txt",
-        "GIT_AUTHOR_DATE='2005-04-07T22:13:13' GIT_COMMITTER_DATE='2005-04-07T22:13:13' git commit -qm init"
+        "GIT_AUTHOR_DATE='2005-04-07T22:13:13 +0000' GIT_COMMITTER_DATE='2005-04-07T22:13:13 +0000' git commit -qm init"
       ],
       "command": "git reset --hard",
       "result": {
```

The probe extracted the new case using the `jq` command above, parsed the **two date strings from that case's actual `fixture[-1]`**, and created one private temporary repo per timezone under `/tmp/prime-git-pinned-audit-oeu8gg62`. For every row, native xonsh scoped `with __xonsh__.env.swap(TZ=<row TZ>, GIT_AUTHOR_DATE='2005-04-07T22:13:13 +0000', GIT_COMMITTER_DATE='2005-04-07T22:13:13 +0000'):` and performed the corpus sequence as native Git commands, without `/bin/bash` orchestration: `git -C <repo> init -q`, `git -C <repo> config user.email t@t`, `git -C <repo> config user.name t`, wrote `tracked.txt` as literal `b'original\n'`, `git -C <repo> add tracked.txt`, `git -C <repo> commit -qm init`, `git -C <repo> rev-parse HEAD`, `git -C <repo> show -s --format=%at,%ai,%ct,%ci HEAD`, and `git -C <repo> reset --hard > <repo>/reset-output-final.log` using native `![...]` redirection. All commands in all four rows exited **0**, with empty stderr. The redirection retained the exact newline that `!(...)` captured output otherwise trims.

| Scoped `TZ`; repo suffix | `git rev-parse HEAD` (exit 0) | `git show -s --format=%at,%ai,%ct,%ci HEAD` (exit 0) | Exact saved stdout bytes from `git reset --hard` (exit 0) |
|---|---|---|---|
| `UTC`; `UTC` | `e33214d80b38a36861f79ca5cca566884d8cadf9` | `1112911993,2005-04-07 22:13:13 +0000,1112911993,2005-04-07 22:13:13 +0000` | `b'HEAD is now at e33214d init\n'` |
| `America/Los_Angeles`; `America_Los_Angeles` | `e33214d80b38a36861f79ca5cca566884d8cadf9` | `1112911993,2005-04-07 22:13:13 +0000,1112911993,2005-04-07 22:13:13 +0000` | `b'HEAD is now at e33214d init\n'` |
| `Asia/Tokyo`; `Asia_Tokyo` | `e33214d80b38a36861f79ca5cca566884d8cadf9` | `1112911993,2005-04-07 22:13:13 +0000,1112911993,2005-04-07 22:13:13 +0000` | `b'HEAD is now at e33214d init\n'` |
| `Europe/Berlin`; `Europe_Berlin` | `e33214d80b38a36861f79ca5cca566884d8cadf9` | `1112911993,2005-04-07 22:13:13 +0000,1112911993,2005-04-07 22:13:13 +0000` | `b'HEAD is now at e33214d init\n'` |

All four saved stdout byte strings equal the unchanged fixture `result.text` encoded as UTF-8. This **isolated Git fixture** probe is green; no Cargo/focused golden test has run, and actual Cargo test-binary cfg remains unverified. The user-reported validation target is 21G; do not contend with its ongoing bootstrap owner or propose deleting build artifacts without root's explicit decision.
Temporary probe repos have been removed after their commands, exits, hashes and exact output bytes were recorded.

## Focused Cargo phase: shared-target path contamination (2026-10-14)

Root assigned single existing `CARGO_TARGET_DIR=/home/jeff/code/fork/prime-agent/.worktrees/native-rust-validation-target`. Invoked from cwd `/home/jeff/code/fork/prime-agent/.worktrees/native-rust-validation-20261011` (workspace root, manifest `crates/pa-core/Cargo.toml` names `pa-core`), `rustup run stable rustc --version --verbose` returned rustc **1.99.0** `(b940084d7 2026-09-28)` for host `x86_64-unknown-linux-gnu`. Current inherited `RUSTFLAGS='-C opt-level=3 -C target-cpu=x86-64-v3'`; every Cargo subprocess below explicitly scoped `CARGO_INCREMENTAL=0` and the one target path without changing global flags.

1. `TZ=UTC rustup run stable cargo test -p pa-core --lib tools::golden_replay::golden_bash_group_matches_ts -- --exact --nocapture` (with scoped flags/target above), PID **84168**, handle exit **0**, `core-golden-utc.log` reports **1 passed** and `/native-rust-validation-target/debug/deps/pa_core-4def2d04dc8b5e4f`; elapsed test 12.27s. **Not valid evidence the edited validation fixture was read.**
2. The same exact argv at `TZ=America/Los_Angeles`, PID **85465**, handle exit **101**, `core-golden-la.log` reports 1 failed: `destructive-reset-clean` actual `HEAD is now at 32200ad init`, expected `HEAD is now at e33214d init`, elapsed test 1.38s. Both logs report test compilation finished in 0.66s/0.09s respectively, reusing the same binary ID.

**Root cause proved cheaply:** `golden_replay.rs:26-30` builds `CORPUS_DIR = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/golden/corpus")` and reads `bash.json` **at test runtime**. Readonly `mmap` search of the executed 442891048-byte test binary found `/home/jeff/code/fork/prime-agent/.worktrees/native-rust-xonsh-bootstrap/crates/pa-core/tests/golden/corpus` at offset 3503449, and found no `/home/jeff/code/fork/prime-agent/.worktrees/native-rust-validation-20261011/crates/pa-core` string. The binary contains no fixture date string (consistent with runtime JSON load). The executed test binary was built from bootstrap, so the UTC pass and LA failure test **bootstrap's unpatched corpus**, not the patched validation worktree. This must not be reported as successful or failed validation of the new fixture. Native xonsh completion watcher confirmed LA exit 101; root notified. Stop before any clean/recompile; need a smallest approved cache-correctness path and correct-source binary path check before using remaining at most three focused Cargo commands. No product change, endpoint edit, cache deletion, broad suite, commit, or merge here.

## Package-scoped validation closure (2026-10-14; final)

**Cache identity and source.** Before revalidation, `pgrep -a -x cargo` and `pgrep -a -x rustc` both exited 1 (none active); first two old reused-binary probes were confirmed to have read bootstrap's wrong corpus, as noted above. In cwd `/home/jeff/code/fork/prime-agent/.worktrees/native-rust-validation-20261011`, with `CARGO_TARGET_DIR=/home/jeff/code/fork/prime-agent/.worktrees/native-rust-validation-target`, `CARGO_INCREMENTAL=0`, inherited `RUSTFLAGS='-C opt-level=3 -C target-cpu=x86-64-v3'` unchanged, `rustup run stable cargo clean --manifest-path /home/jeff/code/fork/prime-agent/.worktrees/native-rust-validation-20261011/Cargo.toml -p pa-core` exited **0** (PID 85817, `core-pa-clean.log`: `Removed 10372 files, 16.1GiB total`). Target measured via `du -sb`: **18,164,737,892** bytes before, **3,331,178,284** immediately after clean; dependencies kept. All subsequent Cargo tests used the same explicit manifest and the same target; no broad suite, other worktree, target copy, or other profile.

| Sequence; scoped `TZ` | Exact suffix of argv after `rustup run stable cargo test --manifest-path /home/jeff/code/fork/prime-agent/.worktrees/native-rust-validation-20261011/Cargo.toml` | Log | Exit / result |
|---|---|---|---|
| 1. UTC | `-p pa-core --lib tools::golden_replay::golden_bash_group_matches_ts -- --exact --nocapture` | `core-golden-utc-validation.log` | PID 85898, exit **0**, 1 passed; new binary `.../native-rust-validation-target/debug/deps/pa_core-4def2d04dc8b5e4f` |
| 2. America/Los_Angeles | same golden argv | `core-golden-la-validation.log` | PID 87100, exit **0**, 1 passed, same binary |
| 3. UTC | `-p pa-core --lib session_engine::telemetry::status::tests::status_names_the_endpoint_and_the_installation_id -- --exact --nocapture` | `core-endpoint-red.log` | exit **101**, 1 failed at original unconditional development-endpoint assertion (the native xonsh direct command raised `CalledProcessError` before binding its pipeline; exact process PID unavailable). Same binary |
| 4. UTC | same endpoint argv after **diagnostic message-only assertion edit** | `core-endpoint-diagnostic.log` | PID 87460, exit **101**, 1 failed with actual output and binary cfg below |
| 5. UTC | same endpoint argv after **cfg-sensitive assertion correction** | `core-endpoint-green.log` | PID 87659, exit **0**, 1 passed; same binary output path (recompiled after source edit) |

Every test subprocess explicitly used `TZ` scoped via native xonsh `__xonsh__.env.swap`, `CARGO_INCREMENTAL=0`, and the target above. The compiler was stable rustc **1.99.0** `(b940084d7 2026-09-28)`; no global flags were changed. After the first newly built run, read-only mmap of the **executed** 441873248-byte binary confirmed `/home/jeff/code/fork/prime-agent/.worktrees/native-rust-validation-20261011/crates/pa-core/tests/golden/corpus` at offset **3434230** and **no** bootstrap corpus path; fixture at that path has both dates pinned to `+0000`. This is actual correct-source verification, not inference from Cargo's `Fresh` or cwd.

**Endpoint diagnostic evidence.** `core-endpoint-diagnostic.log` prints `actual after: "Telemetry is off (forced off by DO_NOT_TRACK).\nEndpoint: https://api.primeintellect.ai/api/v1/agent-analytics/events\nInstallation id: <new id>", debug_assertions: false`. The environment-optimized test binary has `cfg!(debug_assertions)=false`; status reporting and telemetry DO_NOT_TRACK safety were not modified. The only status source edit is the **single test** expecting `"Endpoint: nowhere (development build)"` when its actual compile-time cfg is debug, otherwise expecting `pa_telemetry::ANALYTICS_ENDPOINT`. It retains the exact installation-id checks and now diagnoses actual text and cfg on failure.

**Complete source diff, only two authorized files:**

```diff
diff --git a/crates/pa-core/src/session_engine/telemetry/status.rs b/crates/pa-core/src/session_engine/telemetry/status.rs
index d99e07819..d7966d6ec 100644
--- a/crates/pa-core/src/session_engine/telemetry/status.rs
+++ b/crates/pa-core/src/session_engine/telemetry/status.rs
@@ -251,6 +251,15 @@ mod tests {
         let id = pa_telemetry::install_id(&agent_dir).unwrap();
         let after = telemetry_status_text(&settings, &agent_dir);
         assert!(after.contains(&format!("Installation id: {id}")));
-        assert!(after.contains("Endpoint: nowhere (development build)"));
+        let expected_endpoint = if cfg!(debug_assertions) {
+            "nowhere (development build)"
+        } else {
+            pa_telemetry::ANALYTICS_ENDPOINT
+        };
+        assert!(
+            after.contains(&format!("Endpoint: {expected_endpoint}")),
+            "actual after: {after:?}, debug_assertions: {}",
+            cfg!(debug_assertions)
+        );
     }
 }
diff --git a/crates/pa-core/tests/golden/corpus/bash.json b/crates/pa-core/tests/golden/corpus/bash.json
index 1d797a4f4..48cfa49e1 100644
--- a/crates/pa-core/tests/golden/corpus/bash.json
+++ b/crates/pa-core/tests/golden/corpus/bash.json
@@ -217,7 +217,7 @@
         "git config user.name t",
         "echo original > tracked.txt",
         "git add tracked.txt",
-        "GIT_AUTHOR_DATE='2005-04-07T22:13:13' GIT_COMMITTER_DATE='2005-04-07T22:13:13' git commit -qm init"
+        "GIT_AUTHOR_DATE='2005-04-07T22:13:13 +0000' GIT_COMMITTER_DATE='2005-04-07T22:13:13 +0000' git commit -qm init"
       ],
       "command": "git reset --hard",
       "result": {
```

At close, `du -sb /home/jeff/code/fork/prime-agent/.worktrees/native-rust-validation-target` = **3,771,658,833 bytes**. Preserve this **active shared dependency/test target** for the waiting catalog owner. No own temporary Git repos remain; all eight evidence logs are listed in the preceding sections and retained (total **13933 bytes**). The two old first-pass golden logs are historical evidence of wrong-tree binary reuse, not passing validation. No separately created cache or worktree remains to clean; root decides future deletion of old targets. This worker relinquishes exclusive target use after the final green exit, with **no Cargo still running**. Core-only closure is established; catalog/full suite and Arch packaging remain separate open tasks.
