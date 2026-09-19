# Review: `prime-agent-runtime/src/rlm/repl.py`

## Scope

Reviewed the complete 1,248-line file, its working-tree diff, protocol documentation, declared runtime dependencies, the direct TypeScript spawn/shutdown paths, and relevant REPL tests. The working-tree diff changes only the optional-Xonsh `ImportError` handler at line 47. Findings 2 and 3 are broader defects found during the requested full-file audit.

mcpls was used for Pyright diagnostics, document symbols, hover/signature/type information for `XonshSession.load` and `Execer.parse`, references to the Xonsh globals and compile/execute functions, and incoming/outgoing call hierarchy for `_compile_cell`, `_handle_execute`, `_snapshot_state`, `_serve`, and `main`. Pyright reports no diagnostics; the defects below are dependency-contract, mutation, and lifecycle errors that static type analysis does not detect.

## Findings

### 1. P1 — Raising the optional Xonsh import prevents every runtime mode from starting

**Location:** `prime-agent-runtime/src/rlm/repl.py:40-47`

`xonsh` is not a declared dependency of `prime-agent-runtime`: `prime-agent-runtime/pyproject.toml:6-12` declares only `mcp` and `tyro`, with `dill` in the dev group. The lock confirms the same at `prime-agent-runtime/uv.lock:369-389`. The changed `except ImportError: raise` therefore makes the documented `python -m rlm.repl` entry point fail during module import in a valid package environment. It fails before `_setup_fds()`, before `main()`, and before the protocol `ready` event, including for callers that only need Python mode.

This also contradicts the local contract at line 46 ("xonsh is an optional kernel extra") and bypasses the existing mode-local failure at `repl.py:511-515`, which correctly raises only when a caller actually requests `mode: "xonsh"`. The managed coding-agent bootstrap happens to install Xonsh separately at `packages/coding-agent/src/core/kernel/bootstrap.ts:21-35`, but standalone runtime installs and the runtime's canonical `.venv` do not.

**Reproduction:**

```text
$ prime-agent-runtime/.venv/bin/python -c 'import rlm.repl; print("ok")'
ModuleNotFoundError: No module named 'xonsh'
```

The host spawns this exact module at `packages/coding-agent/src/core/kernel/repl-manager.ts:315-334`; a pre-ready exit is rejected at `repl-manager.ts:690-708` as `Kernel exited before ready`.

**Required fix:** Keep the non-raising fallback and let `_compile_xonsh_cell()` reject Xonsh mode, or declare Xonsh as a hard runtime dependency and remove all optional-extra claims. Add coverage proving startup and Python execution without Xonsh if optional support is retained.

### 2. P1 — Oversize pruning can delete a new value that was never measured or saved

**Location:** `prime-agent-runtime/src/rlm/repl.py:702-721,798-800,832-833`

The snapshot loop remembers only the *name* of an oversized binding. Later, `pruned` checks only whether that name still exists, and commit calls `ns.pop(name, None)`. If a user thread or a re-entrant serializer replaces the binding after the original value is classified as oversized, the commit deletes the replacement even though it may be small, valid, and absent from the snapshot.

This is not outside the stated concurrency model: `repl.py:705-708` explicitly anticipates background-thread namespace mutation. The destructive mode is used automatically after compaction through `packages/coding-agent/src/core/agent-session.ts:7520-7523` and `packages/coding-agent/src/core/kernel/repl-manager.ts:1484-1503`.

**Deterministic reproduction:** An object's `__reduce__` replaced `ns["x"]` with the small string `"replacement-that-should-survive"` while `dill.dump` serialized a 1 MiB reduction under a 256-byte per-variable cap. `_snapshot_state(..., prune_oversized=True)` returned:

```text
{'saved': [], 'skipped': [{'name': 'x', 'reason': 'exceeds per-variable snapshot size cap'}], 'pruned': ['x'], 'bytes': 5}
{}
```

The empty second line is the namespace after commit: the replacement was deleted.

**Required fix:** Retain the exact captured binding with each oversize decision and, at minimum, prune only if the namespace still contains that binding. Full safety for in-place mutation requires size revalidation or an explicit synchronization/version scheme. Add a coordinated replacement regression, preferably covering both a user thread and re-entrant serialization.

### 3. P1 — Shutdown sends success before it can guarantee process termination

**Location:** `prime-agent-runtime/src/rlm/repl.py:1015-1028,1236-1244`

The shutdown branch closes MCP and tracked `rlm.bash` handles, sends `done(status="ok")`, and returns from `_serve`. `main()` then calls `_loop.close()` immediately. It neither cancels/awaits other asyncio tasks nor shuts down the default executor. A detached `asyncio.to_thread(...)` task therefore leaves a non-daemon executor worker alive after the successful shutdown reply, and CPython waits for that worker during interpreter exit.

**Reproduction:** A subprocess executed:

```python
import asyncio, time
asyncio.create_task(asyncio.to_thread(time.sleep, 10))
await asyncio.sleep(0)
```

It then received a protocol shutdown. The runtime emitted `{"event":"done","id":"s","status":"ok"}`, but `proc.poll()` was still `None` 500 ms later. The host explicitly waits for both the reply and process exit at `packages/coding-agent/src/core/kernel/repl-manager.ts:1419-1425`; after its deadline it records graceful-shutdown failure and force-cleans the child at lines 1427-1437.

Pending pure-async tasks are also discarded by `_loop.close()` without running their cancellation cleanup. This violates `repl.md`'s shutdown contract that shutdown "stops the loop, and exits 0" and turns normal teardown into a forced kill for valid detached work.

**Required fix:** Define and implement bounded runtime teardown: cancel and gather non-serve tasks, finalize async generators, shut down the default executor within the protocol deadline, and use a deliberate hard-exit boundary when user threads cannot cooperate. Do not report successful shutdown until the runtime has reached the point where process exit is guaranteed. Add regressions for a pending async task with `finally` cleanup and a long `asyncio.to_thread` call.

## Validation performed

- mcpls/Pyright diagnostics: no diagnostics.
- mcpls references and call hierarchy confirmed the Xonsh fallback is consumed only by `_compile_xonsh_cell`, `_serve` returns directly to `main`, and snapshot pruning reaches `dict.pop` without binding revalidation.
- Reproduced the no-Xonsh import failure in `prime-agent-runtime/.venv`.
- Reproduced deletion of a replacement binding with a bounded direct `_snapshot_state` probe.
- Reproduced successful shutdown acknowledgement with the runtime process still alive.
- No project files were changed except this requested review document.
