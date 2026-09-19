# Teamwork Project Prompt — Draft

> Status: Step 4 — Drafting Requirements
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: [none — teamwork routes from the description]

Integrate `xonsh` fully into the runtime alongside `ipython` by executing the targeted file-replacement plans documented in the active planning directory.

**Important Execution Directives:**
- You must exclusively use **Flash agents** for any workers you spawn.
- You must strictly use the **`planning-with-files`** skill to track progress, findings, and task plans on disk.
- You must act as the Coordinator and strictly follow the **Hierarchical Delegation** rules embedded below.

## Hierarchical Delegation

One coordinator decomposes and schedules. Workers do work and never spawn workers. Every worker draws from one bounded pool:

```
active_workers <= pool_size   # default pool_size = 5
```

This skill exists to keep that invariant true under splitting, retries, and concurrency — not just to describe a nice-sounding pipeline.

### Roles

- **Coordinator**: owns decomposition, scheduling, scope-conflict detection, acceptance, and final checks. Never does the work itself once a tranche is dispatched. The orchestrator (coordinator) will do 95% of its work via delegation to the worker pool.
- **Workers**: receive one tranche, do the work, report back. A worker MUST NOT have access to a delegation/spawn tool (Agent/Task). If the runtime's available subagent types all include spawn access, add an explicit forbidding clause to the worker's dispatch (see Worker Dispatch) and check for violations before accepting (see Enforcement).

### Tranche

```
id      unique, stable across retries and splits
scope   owned paths/actions — the only things this tranche may write
goal    concrete deliverable
deps    tranche ids that must be DONE first
accept  checks that prove the goal was met
```

A tranche returns exactly one of:

| Result | Meaning | Coordinator action |
|---|---|---|
| `DONE` | Goal met, accept checks pass | Verify independently, mark accepted, free its pool slot |
| `SPLIT` | Too large/unclear for one worker | Replace with child tranches (own scope/deps/accept), enqueue children, free the slot |
| `BLOCKED` | Cannot proceed as scoped | Re-plan (adjust scope/deps) or fail the tranche; free the slot |

### Scheduler

```
while work remains:
    ready = tranches with all deps DONE and not yet dispatched/in-flight
    batch = pick from ready up to (pool_size - active_workers),
            excluding any tranche whose scope conflicts with an in-flight tranche
    dispatch batch (active_workers += len(batch))
    on each result:
        active_workers -= 1
        DONE    -> verify against accept checks, then accept
        SPLIT   -> enqueue children in place of the parent
        BLOCKED -> re-plan (re-enqueue with adjusted scope/deps) or fail
run final repository checks once the queue is empty
```

Retries re-enter the same queue and consume the same pool — never launch a retry outside `pool_size`.

#### Conflict rule (serialization)

Two tranches may run in the same batch only if:

1. Neither depends on the other (already enforced by `deps`), **and**
2. Their `scope`s cannot produce conflicting writes (disjoint paths/files, or read-only vs. a disjoint writer).

If you cannot prove disjoint scope — same file, overlapping globs, shared generated artifact, ambiguous ownership — treat it as a conflict. **When unsure, run serially.** Do not use dependency absence as a stand-in for scope-safety; those are two separate checks and both must pass.

### Worker Dispatch

Every tranche handed to a worker states, in order:

```text
Goal:        the tranche's goal
Scope:       exact owned paths/actions — nothing outside this may be written
Context:     only what upstream deps produced that this tranche actually needs
Accept:      the tranche's accept checks, verbatim
Constraints: you do NOT have a delegation tool; do not spawn workers of your own —
             if you find out-of-scope work is required, STOP and report it, don't do it
Report:      what changed (files/actions) and what you verified (command + result)
```

Keep `Context` to what's load-bearing. A worker that needs the whole conversation history to do a bounded tranche means the tranche is under-specified — split it or add a `deps` output instead of forwarding everything.

### Enforcement (Minimum Acceptance)

Each of these is a concrete check, not a vibe:

**1. Worker limit never exceeded.**
Track `active_workers` as an explicit counter the coordinator updates before and after every dispatch. A batch's size is bounded by `pool_size - active_workers` computed *at dispatch time*, including any in-flight retries. Never launch a batch by eyeballing "seems fine" — compute the number.

**2. Conflicting work is serialized.**
Apply the Conflict rule above before adding anything to a batch. If two ready tranches conflict, dispatch one, hold the other for the next round — do not dispatch both because they happened to become ready together.

**3. Workers cannot recursively fan out.**
Prefer a subagent type with no Agent/Task tool in its toolset. Where that isn't available, the dispatch's `Constraints` line explicitly forbids delegation, and the coordinator checks the worker's returned transcript/report for any spawn attempt before accepting `DONE` — a worker that tried to delegate is treated as `BLOCKED`, not `DONE`, regardless of whether its stated goal was met.

**4. Out-of-scope writes are rejected.**
Before accepting a `DONE`, diff the worker's actual changed files against its declared `scope` (e.g. `git diff --name-only <base>..<worker-branch>` or the equivalent for the runtime). Anything outside scope is rejected — use `scripts/check_scope.py` to automate this comparison. A tranche with rejected writes goes back to `BLOCKED`: either the coordinator re-scopes it correctly and retries, or the out-of-scope work becomes its own tranche.

**5. Final combined checks pass.**
Only after the whole queue has drained (no `SPLIT` left un-enqueued, no `BLOCKED` left unresolved) run the repository's real checks (build/test/lint) once, across the combined result. Accepting individual tranches is not a substitute for this — cross-tranche interactions only show up here.

### Common Mistakes

| Rationalization | Correction |
|---|---|
| "Pool has room, dispatch is quick, no need to track the count." | Track it anyway — this is exactly how the limit gets exceeded under retries/splits. |
| "These two tranches don't depend on each other, so they're safe together." | No-dependency and disjoint-scope are different checks. Verify scope too. |
| "The worker said it's done, that's good enough." | `DONE` from the worker is a claim; verify against `accept` and diff its scope before treating it as accepted. |
| "This subagent type is convenient even though it can spawn its own agents." | Then the dispatch must forbid it explicitly and the report must be checked for violations. |
| "SPLIT just means try again with the same tranche." | `SPLIT` replaces the tranche with smaller, independently-scoped children — it's a decomposition, not a retry. |

### Red Flags

- Dispatching a batch without first computing `pool_size - active_workers`
- Two in-flight tranches touching the same file/path
- A worker's report mentions calling another agent, or does work outside its stated scope
- Marking the top-level task done without a final, whole-repo check pass

Working directory: ~/teamwork_projects/xonsh_integration
Integrity mode: development

## Requirements

### R1. Execute the Parity Replacement Plans
Systematically implement the precise code modifications defined in the three replacement plan documents:
1. `.planning/2026-09-13-xonsh-integration/replace-ipython-core-cli.md`
2. `.planning/2026-09-13-xonsh-integration/replace-ipython-runtime-tools.md`
3. `.planning/2026-09-13-xonsh-integration/replace-ipython-ui-ext.md`

These documents outline exactly which files from the original 954 grep matches actually require modifications for full `xonsh` parity (including `prime-agent-runtime/src/rlm/repl.py`). Do not process the raw grep results.

### R2. Handle AST Constraints
When executing the modifications for `prime-agent-runtime/src/rlm/repl.py`, ensure that execution through Xonsh bypasses CPython's native `ast.parse` constraints appropriately (e.g., by routing through `xonsh.execer.Execer`), preventing crashes from shell-syntax code blocks.

## Acceptance Criteria

### Integration Verification
- [ ] `npm run check` passes with no errors across the repository.
- [ ] The runtime successfully spins up a Xonsh kernel session without crashing on shell-syntax inputs.
- [ ] `packages/coding-agent/test/suite/xonsh.test.ts` passes.

---
*Next: when approved → delegate via invoke_subagent (see Delegation Protocol)*
