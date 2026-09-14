# Agent Handoff: Xonsh Integration

## Current Status
We have completed our initial discovery and architecture mapping (Phase 1). We have also extracted all explicit and implicit claims about the `prime-agent` codebase from our planning documents into `claims.md`. 

We are currently at the beginning of **Phase 2 (Planning & Structure)**.

## The Objective
Implement a `xonsh` tool integration alongside the existing `ipython` tool.

## The Two-Pronged Approach (Next Steps)
The next agent picking up this task should execute the following two-pronged strategy:

1. **Prong 1: Claim Germane-ness & Verification**
   - Read `claims.md`.
   - Determine which of the extracted claims are *germane* (relevant) to implementing the `xonsh` tool. 
   - Check and verify those germane claims against the actual codebase to ensure our implementation assumptions are sound.
   
2. **Prong 2: Implementation**
   - Implement the `xonsh` tool in `packages/coding-agent/src/core/tools/xonsh.ts`. You should heavily reference how `ipython.ts` is implemented in that same directory.
   - Register the newly created `xonsh` tool in `packages/coding-agent/src/core/tools/index.ts`.

## Context Files to Read First
To get fully up to speed without needing external context, please read:
1. `.planning/2026-09-13-xonsh-integration/task_plan.md` - The current plan and phase checklists.
2. `.planning/2026-09-13-xonsh-integration/claims.md` - The compiled architectural claims about how tools and the kernel operate in this repository.
3. `packages/coding-agent/src/core/tools/ipython.ts` - The reference implementation for our new tool.
4. `packages/coding-agent/src/core/tools/index.ts` - The registration point for the tool.

## Key Architectural Notes
- The default model-facing tool in this codebase is currently `ipython`.
- Tools are defined using a `ToolDefinition` interface and wrapped via `wrapToolDefinition`.
- The `ipython` tool uses a persistent kernel process over stdio. A major part of Prong 1 will be determining if `xonsh` requires a similar persistent kernel integration (via `ReplKernelManager`), or if it will operate differently. Checking the germane claims will clarify this boundary.
