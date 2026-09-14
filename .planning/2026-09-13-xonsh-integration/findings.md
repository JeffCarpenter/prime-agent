# Findings & Decisions

## Requirements
- User requested a new plan named `xonsh-integration`.
- Current work is research into how `prime-agent` tools are defined and registered in TypeScript.

## Research Findings

### DeepWiki: initial repository overview
Source: DeepWiki query for `PrimeIntellect-ai/prime-agent` on 2026-09-13.

- Tool definitions use a `ToolDefinition` interface with `name`, `label`, `description`, TypeBox `parameters`, and an `execute` method.
- `defineTool()` preserves parameter inference for standalone or SDK `customTools` definitions.
- Extensions register tools through `ExtensionAPI.registerTool()` / `pi.registerTool()`.
- SDK callers can provide tools through the `customTools` option when creating an `AgentSession`.
- Built-in tool factories include `createIpythonToolDefinition()`, `createBashToolDefinition()`, and `createEditToolDefinition()`.
- Extension loading is described as: discovery/loading -> registration -> `ExtensionRunner` binding -> `AgentSession._refreshToolRegistry()` -> `wrapRegisteredTools()` -> agent-loop invocation.
- DeepWiki identified these files as primary touchpoints:
  - `packages/coding-agent/src/core/extensions/types.ts`
  - `packages/coding-agent/src/core/extensions/loader.ts`
  - `packages/coding-agent/src/core/extensions/runner.ts`
  - `packages/coding-agent/src/core/agent-session.ts`
  - `packages/coding-agent/src/core/extensions/wrapper.ts`
  - `packages/agent/src/agent-loop.ts`

These findings are an orientation only and must be checked against the local source before implementation decisions.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Keep Phase 1 active during the initial research pass | The DeepWiki summary identifies likely files, but local source verification is still needed. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|

## Resources
- `.planning/2026-09-13-xonsh-integration/`
- DeepWiki search: https://deepwiki.com/search/how-are-tools-defined-and-regi_05e789b5-abdd-4be8-97fa-4caa85d4df6a


### DeepWiki: `packages/coding-agent/src/core/extensions`
Source: DeepWiki query on 2026-09-13.

DeepWiki describes five main modules in this directory:

- `index.ts`: package entry point; re-exports extension runtime, discovery/loading, runner, and related APIs.
- `loader.ts`: discovers and loads extension modules (using `jiti`) and constructs the `ExtensionAPI` passed to extension factories. This is directly involved in registration because it exposes `registerTool`.
- `runner.ts`: manages loaded-extension lifecycle, event emission, execution context, and collection of registered tools. It also handles non-tool registrations such as commands, shortcuts, and flags.
- `types.ts`: shared extension-system contracts, including `ExtensionAPI`, `ExtensionContext`, `ToolDefinition`, events, commands, shortcuts, and UI types. It defines tool shape but does not itself perform registration.
- `wrapper.ts`: adapts registered extension tools into the core agent's `AgentTool` shape and injects `ExtensionContext` at execution time. It is directly involved in tool invocation but not initial registration.

Tool-specific flow described by DeepWiki:
1. `loader.ts` discovers and executes an extension factory.
2. The factory calls `pi.registerTool(toolDefinition)`.
3. The definition is stored in the extension's tool map and a refresh is requested.
4. `runner.ts` exposes registered tools.
5. `wrapper.ts` converts them into `AgentTool` objects.
6. The agent invokes the wrapped tool, which calls the original definition's `execute` method with extension context.

Non-tool extension concerns include event subscriptions/emission, slash commands, keyboard shortcuts, UI interactions, lifecycle/session navigation, persistent state, messages/renderers, and extension discovery. DeepWiki's response was truncated while discussing resources, so those details require local source verification.

This remains an orientation and is not yet treated as source-verified.


### DeepWiki: `packages/coding-agent/src/core/tools`
Source: DeepWiki query on 2026-09-13.

DeepWiki gave the following directory-level account, with important uncertainty about completeness:

- `ipython.ts`: defines the built-in `ipython` tool factory, `createIpythonToolDefinition`, including its `ToolDefinition` metadata, parameters, and execution through an `IpythonKernelProvisioner`.
- `tool-definition-wrapper.ts`: described as adapting `ToolDefinition` objects for runtime execution and extension context, with exports `wrapToolDefinition` and `wrapToolDefinitions`. DeepWiki connects this to extension registration and `AgentSession._refreshToolRegistry`.
- DeepWiki did not provide verified details for other files. It speculated that `bash.ts` and `edit.ts` may exist based on references elsewhere, but explicitly marked those details as unavailable. Do not treat those files as present until checked locally.

The reported broader flow is:
1. Built-in factories, SDK `customTools`, and extension `registerTool` calls produce tool definitions.
2. `AgentSession` gathers them during initialization and `_refreshToolRegistry`.
3. Definitions are converted to executable `AgentTool` entries in `_toolRegistry`.
4. The agent invokes the matching `AgentTool.execute`, which returns an `AgentToolResult` for UI/result handling.

Caution: this response may conflate `packages/coding-agent/src/core/tools/tool-definition-wrapper.ts` with the previously identified `packages/coding-agent/src/core/extensions/wrapper.ts`. Local file listing and source inspection are required before relying on the wrapper names or exact registration path.

DeepWiki search: https://deepwiki.com/search/analyze-packagescodingagentsrc_eac247e8-b34a-49a9-8fe7-9ea81646db2e


### Connections between the tooling system and RLM/RLM runtime
Sources: `rlm.md` and `rlm-runtime.md` in the active planning directory, inspected on 2026-09-13.

#### 1. `ipython` is the primary AgentTool-to-RLM boundary
- The RLM model exposes one built-in model tool, `ipython`, rather than a separate AgentTool for every capability.
- `packages/coding-agent/src/core/tools/ipython.ts` is described as the AgentTool wrapper. It lazily provisions the Python kernel, bootstraps the namespace, executes code, and shapes output.
- Therefore the outer tool pipeline is: model tool call -> `ToolDefinition`/`AgentTool` for `ipython` -> `ReplKernelManager` -> Python runtime.

#### 2. RLM capabilities are mostly Python-level capabilities, not registered AgentTools
- File inspection, editing, shell commands, skills, delegation, and state manipulation start as Python code in the persistent kernel.
- `bash()` is a Python-facing helper invoked from that kernel. It is not described as a separate built-in `ToolDefinition` in this model.
- Python-backed skills are imported callables. Their metadata may enter the prompt, but their execution happens inside the kernel rather than by adding one model tool per skill.
- Extensions can still register ordinary custom AgentTools; the RLM design intentionally does not require that every capability become a separate model-facing tool.

#### 3. RLM recursion re-enters the TypeScript host through a typed bridge
- Python `rlm(...)` calls produce a `host_request` event over the kernel's JSON-lines stdio protocol.
- `ReplKernelManager` dispatches `rlm.run` to the parent `AgentSession`.
- `AgentSession` applies depth/model policy, admits a child, updates the authoritative registry, and returns an admission handle to the Python call.
- This means `rlm(...)` is not direct Python recursion and is not a normal registered AgentTool. It is a Python API backed by a host request handled by TypeScript agent-session machinery.

#### 4. `AgentSession` is shared ownership between tools and RLM policy
- The session owns the AgentTool registry and also owns RLM child creation, registry, usage attribution, cancellation, and goal handlers.
- Child sessions reuse provider hooks, resource loader, model registry, tools, transport, retry settings, and thinking configuration.
- Consequently, a child RLM agent receives the same class of tool environment as its parent and can use its own `ipython` kernel and inherited custom/extension tools.

#### 5. Nested execution has two distinct result paths
- The outer `ipython` call returns execution output through the normal AgentTool result path.
- A Python `rlm(...)` call returns only an admission handle through the host-request reply. The child's eventual answer arrives later as an ordinary `agent_message` or through a file, not as the original tool result.
- Usage attribution and lifecycle updates are also host-side asynchronous state transitions, not Python return values.

#### 6. The host boundary keeps authoritative tool-adjacent state in TypeScript
- Provider execution, credentials, child lifecycle, session persistence, usage accounting, cancellation, and policy remain in the TypeScript host.
- The Python process is a durable model-facing control environment, not the agent loop or provider client.
- `rlm-runtime` therefore complements the tool system: the tool launches and communicates with the runtime, while the runtime asks the host for operations whose state must remain authoritative.

#### 7. Trust and isolation are layered, not sandboxing
- The Python kernel has worker OS permissions and can run model-generated Python and shell commands.
- The process boundary isolates the stdio protocol and lifecycle, but is explicitly not a security sandbox.
- AgentTools, extensions, Python skills, and the RLM runtime are all trusted-code surfaces; untrusted code requires an external sandbox.

#### 8. Persistence links kernel state and tool/session lifecycle
- Kernel namespace snapshots and session artifacts allow the Python-side control state to outlive a turn or client attachment.
- Child registries, session artifacts, and daemon-backed children are owned by the TypeScript host, so persistent RLM state remains connected to normal session/tool lifecycle rather than living only in Python memory.

Conceptual nesting:

```text
LLM
  -> AgentTool: ipython
    -> ReplKernelManager / Python runtime
      -> Python skill or rlm(...)
        -> host_request over stdio
          -> parent AgentSession
            -> child AgentSession / host-owned state
```

The documents establish this architecture conceptually. They do not by themselves verify the exact current TypeScript symbols or registration implementation, which still needs local source inspection.


### Research surprises and cautions

- `ipython` is the primary model-facing tool gateway. Many capabilities that might otherwise be separate AgentTools are composed as Python code inside the persistent kernel.
- RLM recursion is not local Python recursion. `rlm(...)` crosses from Python back into TypeScript through a typed `host_request` protocol, where the host admits a normal child `AgentSession`.
- `AgentSession` is a broad coordination boundary. It owns the ordinary tool registry as well as RLM policy, child lifecycle, persistence, cancellation, usage attribution, and related host handlers.
- RLM children inherit the parent tooling environment and configuration, rather than being generic isolated workers.
- The kernel is persistent but not a security sandbox. It runs Python and shell commands with worker OS permissions; the process boundary primarily separates protocol and lifecycle concerns.
- DeepWiki produced useful architecture orientation but also showed uncertainty: it may have conflated the extension wrapper with a tools wrapper and speculated about files that were not verified. Its claims require local source confirmation.

These observations are research notes, not implementation decisions.


### DeepWiki: `packages/coding-agent/src/core/kernel`
Source: fresh DeepWiki query on 2026-09-13; the query restated the previously mapped tool, extension, AgentSession, RLM, and runtime concepts because DeepWiki sessions have no prior context.

DeepWiki identified these kernel modules:

- `repl-manager.ts`: `ReplKernelManager`; manages the Python subprocess, JSON-lines stdio protocol, execution, interrupts, shutdown, host-request dispatch, and output/result handling. Reported related exports include `KernelBusyAfterInterruptError`, `HostRequestHandlers`, `ExecuteResult`, and kernel output types.
- `bootstrap.ts`: reported as managing the kernel Python environment and runtime/skill installation, with `ensureKernelPython` as a likely export. DeepWiki marked this as referenced rather than directly verified.
- `state-snapshot.ts`: reported as handling persistent Python namespace snapshots and restore, with path helpers and `SnapshotResult`/`RestoreResult` types. DeepWiki marked this as referenced rather than directly verified.

Reported architecture connections:

- `core/tools/ipython.ts` is the AgentTool-facing boundary. Its `createIpythonToolDefinition` provisions or obtains the kernel and delegates Python execution to the kernel manager, then shapes kernel output as an `AgentToolResult`.
- `core/kernel/repl-manager.ts` is not a tool definition or extension registration module. It is the process/protocol/execution layer used by the `ipython` tool.
- `AgentSession` supplies host-request handlers and RLM policy, including depth environment such as `RLM_DEPTH` and `RLM_MAX_DEPTH`, while the kernel manager dispatches Python `host_request` events to those handlers.
- `prime-agent-runtime` provides the Python `rlm` shim and skills. The runtime communicates with the TypeScript manager through newline-delimited JSON over stdio.

Important source-verification cautions:

- The RLM documents describe the runtime as `python -m rlm.repl` over JSON-lines stdio. DeepWiki additionally claimed a ZMQ `execute_request` path and an `AgentWorker` step for normal `ipython` calls; those claims conflict with the supplied RLM architecture and should not be accepted without local source evidence.
- DeepWiki also described `core/tools/tool-definition-wrapper.ts` in the extension path, but prior research already flagged possible wrapper conflation.
- The exact module list and symbols require local directory/source inspection before implementation decisions.

DeepWiki search: https://deepwiki.com/search/start-from-first-principles-an_dd04d3b0-faaf-4a56-b2ad-61e52207e7b9


### Current consolidated research snapshot

The current working model, pending source verification, is:

```text
LLM
  -> AgentTool: ipython (`core/tools/ipython.ts`)
    -> kernel manager (`core/kernel/repl-manager.ts`)
      -> persistent Python runtime over JSON-lines stdio
        -> Python skills / `rlm(...)`
          -> typed `host_request`
            -> parent `AgentSession`
              -> host-owned RLM policy, child sessions, and lifecycle
```

Boundaries identified so far:

- `core/tools`: defines AgentTool-facing built-ins and formats their results.
- `core/extensions`: defines extension contracts, discovers extensions, registers tools and other extension features, collects registrations, and wraps extension tools for runtime use.
- `core/kernel`: should own Python process lifecycle, execution transport, host-request dispatch, and kernel state persistence; it should not define ordinary tools or extension registration.
- `core/agent-session.ts`: connects the tool registry to kernel/RLM host policy and owns child-session behavior.
- `prime-agent-runtime`: provides the Python-side `rlm` callable, handle types, skills, and REPL protocol participant.

Confidence notes:

- The RLM documents are the strongest source for the JSON-lines host bridge, `ipython` boundary, child inheritance, and TypeScript ownership of policy/state.
- DeepWiki is useful for candidate file/symbol discovery but has repeatedly produced unverified or conflicting details, especially around wrapper-module identity and a claimed ZMQ execution path.
- Exact files, exports, and call paths must be checked against the local TypeScript and Python source before implementation decisions.


### Local-source audit: kernel/tooling/RLM verifier
Source: direct child static audit of the local checkout, completed 2026-09-13. No source files were changed.

The audit verified the following current modules and boundaries:

- `packages/coding-agent/src/core/kernel/` contains `boot-gate.ts`, `bootstrap-cli.ts`, `bootstrap.ts`, `index.ts`, `repl-manager.ts`, `shared.ts`, and `state-snapshot.ts`.
- `repl-manager.ts` exports `ReplKernelManager` and owns the child Python process, JSON-lines stdio, execution, interrupts, shutdown, output parsing, and host-request dispatch.
- `bootstrap.ts` owns runtime/environment provisioning, including `ensureKernelPython`; `state-snapshot.ts` owns snapshot/restore path and result types; `boot-gate.ts` owns boot concurrency; `shared.ts` owns protocol constants, output parsers, errors, and shared types.
- `packages/coding-agent/src/core/tools/` contains `acp-mcp.ts`, `bash.ts`, `code-preview.ts`, `edit-diff.ts`, `edit.ts`, `file-mutation-queue.ts`, `index.ts`, `ipython-cell-code.ts`, `ipython.ts`, `output-accumulator.ts`, `path-utils.ts`, `render-utils.ts`, `tool-definition-wrapper.ts`, and `truncate.ts`.
- `tools/index.ts` currently makes `createAllToolDefinitions()` return only the `ipython` definition, while the directory also contains factories/helpers for bash, edit, ACP/MCP, previews, file mutation, output handling, rendering, and truncation.
- `tools/tool-definition-wrapper.ts` is the generic definition-to-`AgentTool` adapter. `extensions/wrapper.ts` is separate and supplies extension context through `ExtensionRunner.createContext()`.
- `packages/coding-agent/src/core/extensions/` contains `bundled-modules.ts`, `index.ts`, `loader.ts`, `runner.ts`, `types.ts`, and `wrapper.ts`. `loader.ts` stores `registerTool` definitions and refreshes tools; `runner.ts` collects first registrations by name; `extensions/wrapper.ts` adapts them with extension context.
- `AgentSession._buildRuntime()` constructs `IpythonKernelProvisioner` with `_createKernelHostHandlers()` and creates the built-in definitions. `_refreshToolRegistry()` merges base, custom, and registered definitions, wraps them, and selects active tools for the agent state.

Verified normal model-to-`ipython` path:

1. `AgentSession._buildRuntime()` constructs the provisioner and `createAllToolDefinitions()`.
2. `_refreshToolRegistry()` merges and wraps definitions.
3. The agent core selects the named tool from current context, validates arguments, and invokes `tool.execute()`.
4. `createIpythonToolDefinition()` calls the provisioner and `KernelClient.execute()`.
5. `IpythonKernelProvisioner.startKernel()` creates `ReplKernelManager` and runs bootstrap code that defines `rlm`, `bash`, and `mcp` in Python.
6. `ReplKernelManager` starts `python -m rlm.repl`, writes JSON-lines execute requests, parses JSON-lines output, and returns an execution result.
7. The ipython tool shapes that result as an `AgentToolResult`.

Verified Python `await rlm(...)` path:

1. Python `rlm` calls `host_request("rlm.run", ...)`.
2. `rlm.repl` emits a `host_request` JSON event and awaits its matching reply.
3. `ReplKernelManager` dispatches the event to `HostRequestHandlers` and sends a `host_reply` JSON event.
4. `AgentSession._createKernelHostHandlers()` maps `rlm.run` to RLM child admission; `rlm-runtime.ts` validates prompt/options.
5. `runRlmChild()` validates depth/model/thinking/name, tracks a child run, detaches child startup, and returns only an `RLMSpawnHandle`.
6. The child later runs as an independent `AgentSession`; answers arrive through messages or files, not the admission response.

DeepWiki contradiction resolved:

- A literal local search found no `zmq`, `execute_request`, `jupyter`, `ipykernel`, or `KernelGateway` implementation/dependency in the relevant source. The runtime uses child-process pipes and newline-delimited JSON, so the claimed ZMQ path is rejected.

The audit report is retained in the parent-agent message log; this summary is the durable project finding.

### Verified Germane Claims for Xonsh Integration

#### 1. `ipython.ts`
- **Claim:** Lazily provisions the Python kernel, bootstraps the namespace, and shapes output to AgentToolResult.
- **Verification:** TRUE. `IpythonKernelProvisioner` handles this lazily. It uses `buildRlmBootstrapCode` to inject `rlm`, `bash`, and `mcp`. 
- **Xonsh impact:** We must mirror this in `xonsh.ts`, ensuring `buildXonshRlmBootstrapCode` injects into Xonsh's context (e.g. `__xonsh__.ctx`). The persistent execution mode must remain sequential.

#### 2. `repl-manager.ts`
- **Claim:** `ReplKernelManager` starts `python -m rlm.repl` and uses JSON-lines stdio protocol.
- **Verification:** TRUE. The invocation `spawnHidden(python, ["-m", "rlm.repl"], ...)` is strictly hardcoded.
- **Xonsh impact:** To support Xonsh, `repl-manager.ts` MUST be refactored to parameterize the command/args. Xonsh will also need to support the V3 JSON-lines protocol and swallow raw output properly.

#### 3. `bootstrap.ts`
- **Claim:** Owns runtime/environment provisioning, including `ensureKernelPython`.
- **Verification:** TRUE. It provisions a CPython 3.11 virtual environment via `uv` and validates it with strict `python -c` tests.
- **Xonsh impact:** Since Xonsh is a Python package, it can be hosted in this environment by adding `xonsh` to `DEFAULT_RLM_EXTRA_PACKAGES` and incrementing `BOOTSTRAP_SCHEMA`. Execution would then use `<python> -m xonsh` or `<venv>/bin/xonsh`.

#### 4. `agent-session.ts`
- **Claim:** Connects tool registry to host policy and owns child-session behavior.
- **Verification:** TRUE. It instantiates `IpythonKernelProvisioner` with kernel host handlers and aggregates tools into `_toolRegistry`.
- **Xonsh impact:** There is significant hardcoding of `ipython` references (e.g., `_ipythonKernelProvisioner`, default tool fallbacks, goal requirements requiring ipython). To support xonsh fully, `agent-session.ts` must be updated to recognize `xonsh` as a primary REPL tool alongside ipython.

#### 5. `loader.ts` & `runner.ts` (Extensions)
- **Claim:** Discovers/loads extensions and manages their lifecycle, collecting registered tools.
- **Verification:** TRUE. `loader.ts` uses `jiti` to discover extensions and exposes `registerTool`. `runner.ts` manages their lifecycle and context.
- **Xonsh impact:** Minimal. Xonsh is being integrated as a built-in core tool, so it bypasses `loader.ts`. However, `runner.ts` still supplies the runtime execution context (`ExtensionContext`) to built-in tools.

#### 6. `extensions/wrapper.ts` & `tool-definition-wrapper.ts`
- **Claim:** Adapts definitions into AgentTool shape and injects ExtensionContext.
- **Verification:** TRUE. `tool-definition-wrapper.ts` handles the generic `ToolDefinition` -> `AgentTool` translation. `extensions/wrapper.ts` wraps built-in and extension tools alike to dynamically inject `ExtensionContext` from `runner.ts`.
- **Xonsh impact:** `xonsh.ts` correctly utilizes this by calling `wrapToolDefinition(createXonshToolDefinition(cwd, options))`, which automatically grants it access to `ctx.ui` for UI status messages and prompts.
