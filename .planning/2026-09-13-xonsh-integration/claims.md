# Extracted Claims About `prime-agent`

This document compiles the explicit and implicit claims made about the `prime-agent` codebase across the `.planning/2026-09-13-xonsh-integration/` documentation, extracted by independent Flash Agents.

## 1. From `task_plan.md`

### Explicit Claims About `prime-agent`
1. **Target System for Xonsh Integration**: `prime-agent` is the target software application/codebase for a requested xonsh integration.
2. **Unconfirmed Integration Scope**: The scope of the xonsh integration in `prime-agent` is currently unconfirmed and must be confirmed prior to definition and implementation.
3. **Existence of Repository Touchpoints**: The `prime-agent` codebase contains specific "repository touchpoints" that govern or accommodate shell/command integration.
4. **Unconfirmed Integration Behavior**: The required behavior of the integration across `prime-agent`'s repository touchpoints is not yet finalized or confirmed.
5. **Presence of Other Concurrent Repository Tasks**: The repository has other distinct ongoing tasks that require isolating this work via a dedicated plan directory (`2026-09-13-xonsh-integration`).

### Implicit Claims About `prime-agent`
1. **Lack of Native/Complete Xonsh Integration**: `prime-agent` currently does not have a completed, fully defined, or native xonsh integration.
2. **Extensibility for Shell/Execution Environments**: `prime-agent` has an architecture capable of being extended to integrate alternative shells or runtime execution environments such as xonsh.
3. **Modular Touchpoint Architecture**: `prime-agent` has modular extension points, tool mechanisms, or kernel/execution pathways where a shell integration can interface with the core agent.
4. **Structural Expansion**: Integrating xonsh into `prime-agent` may necessitate adding or modifying project structure, modules, or directories.
5. **Verifiability and Testability**: `prime-agent` supports test execution and verification workflows against which new integrations must be tested and validated.

---

## 2. From `progress.md`

### Repository Identity, Structure, & Planning
- **Explicit Claims:**
  - The codebase/repository is identified as `PrimeIntellect-ai/prime-agent`.
  - The repository contains the package directory `packages/coding-agent`.
  - The repository contains documentation and diagram files: `doc/tooling-system.txt` and `doc/tooling-system.puml`.
  - The repository contains an active planning session directory `.planning/2026-09-13-xonsh-integration/`.
  - RLM documentation files exist within the repository/workspace.
- **Implicit Claims:**
  - `prime-agent` is structured as a monorepo containing at least `packages/coding-agent`.
  - System architecture models (component and sequence diagrams) are maintained under `doc/`.

### Tool Subsystem Architecture & Lifecycle
- **Explicit Claims:**
  - Tools in `prime-agent` are implemented in TypeScript.
  - There is a directory located at `packages/coding-agent/src/core/tools`.
  - Tool definition, registration, wrapping, and execution flows exist in the codebase.
  - Specific identifiers/constructs in the tool architecture include `ToolDefinition`, `registerTool`, and `customTools`.
  - Tools are wrapped via a dedicated wrapping layer / wrapper modules.
  - Tool execution connects into agent-loop paths.
- **Implicit Claims:**
  - Tool specifications conform to a typing interface (specifically `ToolDefinition`).
  - Tool registration is performed via a dedicated registration mechanism (`registerTool`).
  - The codebase supports custom or user-defined tools via `customTools`.
  - The tool lifecycle operates across defined stages: definition → registration in a registry → wrapping → execution via the agent loop.

### Extension Subsystem
- **Explicit Claims:**
  - There is a directory/subsystem at `packages/coding-agent/src/core/extensions`.
  - `packages/coding-agent/src/core/extensions` handles tool-related responsibilities alongside other non-tool extension responsibilities.
  - There is a distinct module-by-module separation of responsibilities within the extension system.
- **Implicit Claims:**
  - `prime-agent` has an extension/plugin system that integrates with, registers, or augments tools, while also handling broader responsibilities.

### Kernel & Execution Subsystem
- **Explicit Claims:**
  - There is a directory/subsystem at `packages/coding-agent/src/core/kernel`.
  - `packages/coding-agent/src/core/kernel` connects to tools, extensions, `AgentSession`, and RLM architecture.
  - The system supports or integrates an `ipython` execution environment/kernel.
  - A kernel transport mechanism exists as a distinct layer in the tooling architecture.
  - `prime-agent` does **NOT** use ZMQ (ZeroMQ) for its kernel transport.
- **Implicit Claims:**
  - Python execution can be handled via a stateful IPython kernel rather than purely one-off shell processes.
  - Kernel communication uses a non-ZMQ transport (e.g., stdio pipes, IPC, or websockets).

### RLM, AgentSession, Child Sessions, & Host Requests
- **Explicit Claims:**
  - The core architecture contains an `AgentSession` component.
  - `prime-agent` incorporates an RLM (Recursive Language Model / Reasoning Language Model) architecture.
  - RLM connects `AgentTool`, `ipython`, `kernel`, `Python skill`, `rlm(...)`, `host-request`, and `child-session`.
  - The tooling system handles host requests (`host-request`) and child sessions (`child-session`).
- **Implicit Claims:**
  - `prime-agent` supports hierarchical or nested agent execution (spawning child sessions from a parent session).
  - There is an `AgentTool` enabling tool-driven agent invocation or sub-agent execution.
  - A `Python skill` is integrated into the system that interacts with the kernel and RLM workflows.
  - An `rlm(...)` interface or function exists to invoke recursive reasoning or child agent sessions.
  - A host-request protocol exists allowing running kernels or child sessions to issue callbacks/requests back to the host agent session.

---

## 3. From `findings.md`

### Explicit Claims
1. **Monorepo Structure & Key Packages:**
   - The codebase contains at least `packages/coding-agent` and `packages/agent`.
   - `packages/agent/src/agent-loop.ts` is the agent loop entry point for tool invocation.
   - Core tooling, kernel management, and extension logic reside under `packages/coding-agent/src/core/`.
2. **`packages/coding-agent/src/core/kernel/` Module Inventory:**
   - Contains: `boot-gate.ts`, `bootstrap-cli.ts`, `bootstrap.ts`, `index.ts`, `repl-manager.ts`, `shared.ts`, and `state-snapshot.ts`.
3. **`packages/coding-agent/src/core/tools/` Module Inventory:**
   - Contains: `acp-mcp.ts`, `bash.ts`, `code-preview.ts`, `edit-diff.ts`, `edit.ts`, `file-mutation-queue.ts`, `index.ts`, `ipython-cell-code.ts`, `ipython.ts`, `output-accumulator.ts`, `path-utils.ts`, `render-utils.ts`, `tool-definition-wrapper.ts`, and `truncate.ts`.
4. **`packages/coding-agent/src/core/extensions/` Module Inventory:**
   - Contains: `bundled-modules.ts`, `index.ts`, `loader.ts`, `runner.ts`, `types.ts`, and `wrapper.ts`.
5. **Tool Definition Contract:**
   - Tools are defined using a `ToolDefinition` interface with `name`, `label`, `description`, TypeBox `parameters`, and an `execute` method.
6. **Active Built-In Tools:**
   - `tools/index.ts` currently configures `createAllToolDefinitions()` to return **only** the `ipython` definition, despite the directory containing factories/helpers for `bash`, `edit`, `acp-mcp`, etc.
7. **Process & Communication Protocol:**
   - The Python kernel process is spawned by `ReplKernelManager` as `python -m rlm.repl`.
   - Communication between the TypeScript host and the Python process is handled via child-process stdio pipes using newline-delimited JSON (JSON-lines protocol).
8. **Absence of ZMQ / Jupyter Protocols (Disproved DeepWiki Hypothesis):**
   - There is no dependency on or implementation of `zmq`, `execute_request`, `jupyter`, `ipykernel`, or `KernelGateway` in the relevant codebase.
9. **`ipython` as the Single AgentTool Boundary:**
   - `prime-agent` routes model capabilities primarily through the single `ipython` tool rather than registering individual `AgentTool`s for every action.
10. **TypeScript Host Re-entry via `host_request`:**
   - Python code calling `await rlm(...)` sends a `host_request("rlm.run", ...)` JSON event over the stdio pipe.
11. **Child Admission & Execution Model:**
   - `runRlmChild()` validates parameters, registers the child run, detaches child startup, and immediately returns an `RLMSpawnHandle` back across the stdio bridge via `host_reply`.
12. **Child Environment Inheritance:**
   - Child `AgentSession`s inherit their parent's tooling environment. Each child session provisions its own `ipython` kernel.
13. **Depth & Recursion Policy:**
   - Recursion depth is tracked and constrained by environment variables/settings: `RLM_DEPTH` and `RLM_MAX_DEPTH`.
14. **Security & Sandbox Model:**
   - The Python kernel runs with standard worker OS permissions and executes arbitrary model-generated Python and shell commands. The process boundary exists for protocol separation and lifecycle management, **not** as a security sandbox.

### Implicit Claims
1. **Host Execution Environment:**
   - `prime-agent` runs on Node.js in TypeScript and uses `jiti` for runtime loading and transpilation of extension code.
2. **Schema & Validation Library:**
   - TypeBox is the standard schema and validation library across `prime-agent`.
3. **Evolutionary Architecture / Dormant Tools:**
   - The presence of various `.ts` tool files while `createAllToolDefinitions()` only returns `ipython` implies an architectural migration from discrete tools to an RLM Python REPL model, leaving standalone tool definitions dormant.
4. **Collision Resolution Policy for Extensions:**
   - "First-registration-wins" collision resolution policy where subsequent attempts to register a tool with an existing name are ignored or shadowed.
5. **Reliance on Stdio IPC over Network Sockets:**
   - `prime-agent` prioritizes simple local IPC without port management, network binding, or external daemon dependencies.

---

## 4. From `rlm-runtime.md`

### Architectural & Execution Model Claims
- **Explicit Claims:**
  - **Dual-Layer Runtime**: Prime Agent pairs each agent session with a persistent Python REPL kernel and a native recursive sub-agent interface.
  - **Role Separation**: The Python `rlm` package functions purely as a model-facing shim. The TypeScript host owns child execution, persistence, usage accounting, and lifecycle management.
  - **Process Boundary**: The Python REPL kernel runs as an external child process (`python -m rlm.repl`) communicating with the TypeScript host via newline-delimited JSON over stdio.
  - **Execution Serialization**: Calls to `ReplKernelManager.execute()` are serialized.
  - **Asynchronous Sub-Agent Concurrency**: RLM child agents can execute concurrently because each delegation utilizes an independent host request, child runtime, and `AgentSession`.
  - **Non-Blocking Delegation**: A delegation call (`await rlm(...)`) returns over the stdio bridge immediately upon task admission with a child handle (`RLMSpawnHandle`).
- **Implicit Claims:**
  - Prime Agent's core agent loop, tool orchestration, and LLM communication are built in TypeScript/Node.js, while Python is used as a managed evaluation/execution tool for the model.

### Codebase Structure & Component Ownership Claims
- **Explicit Claims:**
  - `src/core/kernel/repl-manager.ts`: Owns the runtime child process, stdio protocol, execution serialization, host-request dispatch.
  - `src/core/tools/ipython.ts`: Implements the agent tool wrapper, lazy kernel provisioning, namespace bootstrapping.
  - `src/core/agent-session.ts`: Implements RLM policy, `runRlmChild()`, registry maintenance, usage attribution.
  - `src/core/rlm-runtime.ts`: Handles typed request/spawn-handle validation for `rlm.run`.
  - `prime-agent-runtime/src/rlm/`: Contains the Python shim, handle types, callable `rlm` object.

### Kernel Lifecycle & Environment Resolution Claims
- **Explicit Claims:**
  - **Python Interpreter Resolution Order**: `PRIME_AGENT_KERNEL_PYTHON` env var -> `~/.prime/agent/kernel-venv/bin/python` via `uv` -> XDG data location fallback.
  - **Managed Environment Stack**: Managed environment uses Python 3.11, `prime-agent-runtime`, `dill`, and default Python packages.

### Python API (`prime-agent-runtime`) Claims
- **Explicit Claims:**
  - `prime-agent-runtime` exports `rlm`, `run()`, `find_models()`, `list_subagents()`, `delete_subagent()`, `host_request()`, `RLMSpawnHandle`, `RLMModel`, `RLMSubagent`.
  - **Strict Option & Model Validation**: Unknown options fail rather than being silently ignored. Model discovery is strictly bounded to active, non-expired credentials.

### Sub-Agent Registry & Persistence Claims
- **Explicit Claims:**
  - The TypeScript parent maintains the authoritative direct-child registry.
  - **Inline vs. Daemon Children**: Daemon-backed children can be retained as independently addressable session workers. Inline children run in-process but have no active-session ID.

### Usage, Cost & Context Window Attribution Claims
- **Explicit Claims:**
  - Prime Agent asynchronously attributes child assistant token usage and monetary cost back to the specific parent assistant turn that launched it.

### Continual Harness State & `/refine` Claims
- **Explicit Claims:**
  - **Harness Role**: `rlm.harness` is a persistent state ledger for prompt notes, memories, reusable skill descriptions, sub-agent specifications, and refinement events.

### Filesystem Layout & Session Storage Claims
- **Explicit Claims:**
  - **Persistent Root Session Layout**: Defined under `~/.prime/agent/sessions/` and `~/.prime/agent/session-artifacts/`.

---

## 5. From `rlm.md`

### Core Architecture & Runtime Model
- **Explicit Claims**:
  - **Recursive Language Model (RLM) runtime**: Prime Agent is built around a recursive language model (RLM) runtime where the model operates inside a persistent Python control environment and composes capabilities as code.
  - **Host bridge for authoritative state**: Capabilities whose authoritative state belongs outside the kernel (`goal`, `agent_message`, `rlm_heartbeat`, `compact`) call `rlm.host_request(...)`.

### Tooling & Execution Model
- **Explicit Claims**:
  - **Single built-in model tool (`ipython`)**: The default RLM runtime exposes exactly one built-in model tool: `ipython`.
  - **State persistence across turns and compaction**: Python state survives across tool calls and context compaction.
  - **Directory and environment persistence**: `os.chdir(...)` and `os.environ[...]` changes persist in the kernel and apply to subsequent `bash()` calls.
- **Implicit Claims**:
  - Compaction algorithms in Prime Agent only compress the LLM conversation transcript, explicitly leaving Python kernel memory and namespaces intact.

### Shell & Process Group Execution (`bash()`)
- **Explicit Claims**:
  - **Synchronous execution via `await bash(...)`**: Project commands are executed through `await bash("...")`, returning an object containing `.output`.
  - **Asynchronous handles for background commands**: Calling `bash(...)` without `await` returns a live handle exposing `.pid`, allowing long commands to run in the background.
  - **Separate process per command**: Each `bash()` invocation runs in its own process, inheriting the kernel's persistent directory and environment.
  - **Process group tracking and Shell completion messages**: When an unawaited handle's process group finishes, Prime Agent sends a Shell message containing its PID and foreground exit code.

### Subagent Delegation & Multi-Agent Model (`rlm()`)
- **Explicit Claims**:
  - **Preloaded `rlm` callable**: The callable `rlm` object is preloaded in the Python kernel.
  - **Non-blocking task admission**: Calling `await rlm("...", name="...")` returns immediately after task admission with a child handle; it never waits for or returns the child's answer.
  - **Result communication through messages or files**: Results arrive only through explicit `agent_message` replies or files, never as an `rlm()` return value.
  - **Bi-directional follow-ups**: The parent can follow up with a retained child using `await agent_message.send(...)`.

### Skills System
- **Explicit Claims**:
  - **Agent Skills specification support**: Prime Agent supports the standard Agent Skills markdown format (`SKILL.md`).
  - **Python-backed skills extension**: Prime Agent extends the Agent Skills format with Python-backed skills containing Python packages.
  - **Direct callable invocation**: Python-backed skills are directly callable as typed async functions in the kernel.

### Long-Running Operations & State Durability
- **Explicit Claims**:
  - **Multi-turn and post-disconnect operation**: The RLM programming model is designed for work that takes many turns or continues after the terminal UI closes.
  - **Daemon-backed workers**: Daemon workers keep active sessions executing after clients detach.
  - **Autonomous mode**: Provides bounded continuations and optional quality gates.

### Security, Permissions, and Trust Model
- **Explicit Claims**:
  - **No built-in sandbox**: The Python kernel is a durable control environment, not a security sandbox.
  - **External sandbox requirement**: Users must review third-party Python skills and use an external sandbox or restricted environment for untrusted repositories and instructions.
