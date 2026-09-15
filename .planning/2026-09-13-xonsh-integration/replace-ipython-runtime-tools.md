# Implementation Plan: Replacing IPython with Xonsh in Python Runtime and Agent Tools

> **Scope**: Focused strictly on **Python Runtime** (`prime-agent-runtime/`) and **Agent Tools Implementation** (`packages/coding-agent/src/core/tools/`).  
> **Goal**: Define exact code parts to read and modify to decouple from `ipython`, eliminate duplicated logic, and integrate `xonsh` as the primary REPL execution engine.

---

## 1. Executive Summary & Architecture Overview

In `prime-agent`, the REPL environment is **not** an external ZeroMQ-based `ipykernel` process. Instead, the runtime is a custom, in-process/stdio daemon implemented in `prime-agent-runtime/src/rlm/repl.py` (`python -m rlm.repl`) communicating with the TypeScript host (`ReplKernelManager`) via newline-delimited JSON over stdio pipes.

Historically, this REPL was designed to emulate IPython's interactive conventions (top-level `await`, `In`/`Out`/`get_ipython` variable conventions, and `%%bash` cell magics). An initial partial duplicate of the tool wrapper was previously added as `packages/coding-agent/src/core/tools/xonsh.ts`, but it duplicates ~716 lines of code from `ipython.ts` and still points to the standard Python AST-based `repl.py`.

To fully replace `ipython` with `xonsh` across the runtime and agent tools, we must:
1. **Python Runtime (`prime-agent-runtime/`)**:
   - Update state snapshot/restore filtering in `repl.py` to handle Xonsh-injected globals (`XSH`, `__xonsh__`) while maintaining backward-compatible skipping of legacy IPython globals.
   - Address cell compilation in `repl.py`: CPython's `ast.parse` fails on native Xonsh shell syntax (e.g. `ls -la`, `$VAR = "x"`, `!(cmd)`). The runtime needs Xonsh compilation support (via `xonsh.execer.Execer` or a dedicated Xonsh execution mode).
   - Update documentation (`repl.md`) and unit tests (`test_repl.py`).
2. **Agent Tools Implementation (`packages/coding-agent/src/core/tools/`)**:
   - Deduplicate the massive copy-paste between `ipython.ts` and `xonsh.ts` by extracting a common `ReplKernelProvisioner` or refactoring `XonshKernelProvisioner` as the primary provisioner.
   - Decouple `acp-mcp.ts` from `IpythonKernelProvisioner` so MCP tools execute over `XonshKernelProvisioner`.
   - Update `code-preview.ts` and `ipython-cell-code.ts` to support Xonsh syntax highlighting and previewing instead of relying solely on IPython `%%bash` magic detection.
   - Update `index.ts` to make `xonsh` the primary tool definition and alias or deprecate `ipython`.

---

## 2. Python Runtime (`prime-agent-runtime/`)

### 2.1 Code Parts to Read

| File | Exact Line Range | Core Concept / Construct | Rationale |
| :--- | :--- | :--- | :--- |
| [`prime-agent-runtime/src/rlm/repl.py`](file:///home/jeff/code/fork/prime-agent/prime-agent-runtime/src/rlm/repl.py#L39-L44) | Lines 39–44 | `_ALWAYS_SKIP`, `_RESTORE_SKIP` | Skip sets controlling which variables are excluded from `dill` state snapshots and restore payloads. |
| [`prime-agent-runtime/src/rlm/repl.py`](file:///home/jeff/code/fork/prime-agent/prime-agent-runtime/src/rlm/repl.py#L497-L520) | Lines 497–520 | `_compile_cell`, `_run_codes` | Compiles code with `ast.parse` and `ast.PyCF_ALLOW_TOP_LEVEL_AWAIT`. Pure Python AST does not accept Xonsh syntax. |
| [`prime-agent-runtime/src/rlm/repl.py`](file:///home/jeff/code/fork/prime-agent/prime-agent-runtime/src/rlm/repl.py#L629-L842) | Lines 629–842 | `_snapshot_state`, `_restore_state` | Traverses global namespace `ns`, applies filtering, serializes with `dill`, and atomic-writes snapshot & manifest. |
| [`prime-agent-runtime/src/rlm/repl.py`](file:///home/jeff/code/fork/prime-agent/prime-agent-runtime/src/rlm/repl.py#L920-L930) | Lines 920–930 | `_list_names` | Filters user-defined names returned to the host; references `_ALWAYS_SKIP`. |
| [`prime-agent-runtime/src/rlm/repl.py`](file:///home/jeff/code/fork/prime-agent/prime-agent-runtime/src/rlm/repl.py#L1155-L1188) | Lines 1155–1188 | `main()` | Module namespace initialization (`__main__`), event loop startup, request reader thread, and serve task. |
| [`prime-agent-runtime/src/rlm/repl.md`](file:///home/jeff/code/fork/prime-agent/prime-agent-runtime/src/rlm/repl.md#L141-L164) | Lines 141–164 | Snapshot/Restore Specification | Protocol spec documenting skipped variables (`In`, `Out`, `get_ipython`). |
| [`prime-agent-runtime/test/test_repl.py`](file:///home/jeff/code/fork/prime-agent/prime-agent-runtime/test/test_repl.py#L619-L638) | Lines 619–638 | `test_restore_skips_ipython_injected_names` | Unit test asserting that `_RESTORE_SKIP` drops `In`, `Out`, `get_ipython` on state restore. |

### 2.2 Code Parts to Modify

#### A. State Serialization Skip Sets (`prime-agent-runtime/src/rlm/repl.py`)
- **Current code**:
  ```python
  _ALWAYS_SKIP = {
      "rlm",
      "mcp",
      "bash",
      "asyncio",
      "In",
      "Out",
      "get_ipython",
      "exit",
      "quit",
      "open",
  }
  _RESTORE_SKIP = {"In", "Out", "get_ipython"}
  ```
- **Modifications required**:
  1. Add Xonsh-injected variables: `__xonsh__` starts with `_` so it is automatically excluded by `name.startswith("_")`, but non-underscore aliases/globals like `XSH`, `PROMPT`, `FORMATTER_DICT`, `DYNAMIC_SHELL_VARIABLES` should be added to `_ALWAYS_SKIP` and `_RESTORE_SKIP`.
  2. Keep `In`, `Out`, `get_ipython` in `_RESTORE_SKIP` for backward compatibility with existing session snapshots recorded under earlier IPython setups.
  3. Rename or comment the sets to be shell-agnostic (`_SHELL_INJECTED_NAMES`).

#### B. Cell Compilation and Execution (`prime-agent-runtime/src/rlm/repl.py`)
- **Current code**:
  ```python
  def _compile_cell(code: str, filename: str) -> tuple[list[types.CodeType], bool]:
      tree = ast.parse(code, filename)
      ...
      flags = ast.PyCF_ALLOW_TOP_LEVEL_AWAIT
      codes: list[types.CodeType] = []
      if tree.body:
          codes.append(compile(tree, filename, "exec", flags=flags, dont_inherit=True))
      if trailing is not None:
          codes.append(
              compile(trailing, filename, "eval", flags=flags, dont_inherit=True)
          )
      return codes, trailing is not None
  ```
- **Modifications required**:
  - `ast.parse` only parses valid Python 3 syntax. If a user or agent submits Xonsh code (e.g. `$MY_VAR = 123`, `!(git status)`, `ls -lh`, `@(expr)`), standard `ast.parse` will raise a `SyntaxError`.
  - **Strategy**:
    - Check if `xonsh` is available in `sys.modules` or can be imported (`import xonsh.execer`).
    - If in Xonsh mode or if Xonsh is installed, compile via `xonsh.execer.Execer` (or transpile the Xonsh source code into a Python AST/code object before evaluation).
    - Ensure top-level `await` continues to work with Xonsh code execution.
    - If pure Python AST fallback is desired, try `xonsh.execer.Execer.compile(...)` with fallback to standard `ast.parse`.

#### C. Documentation & Tests
- **`prime-agent-runtime/src/rlm/repl.md`**:
  - Update lines 145 and 159 to replace references to IPython with Xonsh and generic shell names.
- **`prime-agent-runtime/test/test_repl.py`**:
  - Update `test_restore_skips_ipython_injected_names` to test Xonsh names (`XSH`, etc.) alongside legacy IPython names.
  - Add test cases verifying that Xonsh-specific syntax or execution compiles and executes correctly without syntax errors.

---

## 3. Agent Tools Implementation (`packages/coding-agent/src/core/tools/`)

### 3.1 Code Parts to Read

| File | Exact Line Range | Core Concept / Construct | Rationale |
| :--- | :--- | :--- | :--- |
| [`packages/coding-agent/src/core/tools/ipython.ts`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/tools/ipython.ts#L148-L167) | Lines 148–167 | `ipythonSchema`, `KERNEL_RESTART_NOTICE` | Tool schema and notice tags (`<ipython_kernel_reset>`). |
| [`packages/coding-agent/src/core/tools/ipython.ts`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/tools/ipython.ts#L251-L302) | Lines 251–302 | `IpythonToolInput`, `IpythonToolDetails`, `IpythonToolOptions` | TypeScript types for tool inputs, results, and provisioner options. |
| [`packages/coding-agent/src/core/tools/ipython.ts`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/tools/ipython.ts#L311-L544) | Lines 311–544 | `IpythonKernelProvisioner` | Lifecycle manager: startup mutex, boot permits, snapshot restore, prewarm, kill, dispose. |
| [`packages/coding-agent/src/core/tools/ipython.ts`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/tools/ipython.ts#L565-L608) | Lines 565–608 | `executeWithBusyKernelChoice` | Interactive loop handling `KernelBusyAfterInterruptError`. |
| [`packages/coding-agent/src/core/tools/ipython.ts`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/tools/ipython.ts#L618-L711) | Lines 618–711 | `createIpythonToolDefinition`, `createIpythonTool` | Tool creation and execution handlers. |
| [`packages/coding-agent/src/core/tools/xonsh.ts`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/tools/xonsh.ts#L1-L716) | Lines 1–716 | Full module | Existing cloned file implementing `XonshKernelProvisioner`, `createXonshToolDefinition`, and `createXonshTool`. |
| [`packages/coding-agent/src/core/tools/acp-mcp.ts`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/tools/acp-mcp.ts#L1-L100) | Lines 4, 45–53 | `executeMcpCode`, `createAcpMcpToolDefinitions` | Imports `IpythonKernelProvisioner` and binds MCP execution to it. |
| [`packages/coding-agent/src/core/tools/code-preview.ts`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/tools/code-preview.ts#L1-L3,L532-L539) | Lines 1–3, 532–539 | `previewIpythonCode`, `parseIpythonBashCell` | UI preview generator for IPython cells and bash magic. |
| [`packages/coding-agent/src/core/tools/ipython-cell-code.ts`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/tools/ipython-cell-code.ts#L1-L13) | Lines 1–13 | `parseIpythonBashCell` | Regex parser matching `%%bash` cell magic. |
| [`packages/coding-agent/src/core/tools/index.ts`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/tools/index.ts#L23-L29,L41-L47,L54-L68) | Lines 23–29, 41–47, 54–68 | Tool exports, `ToolName`, `createAllToolDefinitions` | Central registry and export point for coding-agent tools. |

---

### 3.2 Code Parts to Modify, Decouple, or Deduplicate

#### A. Deduplication of `ipython.ts` and `xonsh.ts`
- **Issue**: `packages/coding-agent/src/core/tools/xonsh.ts` is currently a complete duplicate of `ipython.ts` (over 700 lines of identical code), with only superficial identifier renaming (`Ipython` -> `Xonsh`) and notice tags (`<ipython_kernel_reset>` -> `<xonsh_kernel_reset>`).
- **Determinations**:
  1. **Option 1 (Full Replacement / Deprecation of `ipython.ts`)**:
     - Make `xonsh.ts` the primary tool module.
     - In `ipython.ts`, re-export or alias all types and functions to `xonsh.ts`:
       ```ts
       export {
           type XonshToolInput as IpythonToolInput,
           type XonshToolDetails as IpythonToolDetails,
           type XonshToolOptions as IpythonToolOptions,
           XonshKernelProvisioner as IpythonKernelProvisioner,
           createXonshTool as createIpythonTool,
           createXonshToolDefinition as createIpythonToolDefinition,
       } from "./xonsh.js";
       ```
     - This immediately eliminates the maintenance overhead of twin 700-line files while ensuring any remaining external calls or tests referencing `ipython` continue to compile without disruption.
  2. **Option 2 (Extract Shared Base `ReplKernelProvisioner`)**:
     - If both tools must remain distinct runtime options during a migration period, extract shared provisioner logic (`ReplKernelProvisioner`, `executeWithBusyKernelChoice`, `imageBlocksFromAttachments`, `buildRlmBootstrapCode`) into a shared module (e.g. `packages/coding-agent/src/core/tools/repl-provisioner.ts` or directly in `../kernel/`).
     - Subclass or configure `XonshKernelProvisioner` and `IpythonKernelProvisioner` with only their distinct schema, tool label, and reset tags.

#### B. Decouple `acp-mcp.ts`
- **Current code**:
  ```ts
  import type { IpythonKernelProvisioner } from "./ipython.js";

  async function executeMcpCode(provisioner: IpythonKernelProvisioner, code: string, signal: AbortSignal | undefined)
  export function createAcpMcpToolDefinitions(
      servers: readonly AcpMcpServerConfig[],
      provisioner: IpythonKernelProvisioner,
  ): ToolDefinition[]
  ```
- **Modifications required**:
  - Replace `IpythonKernelProvisioner` with `XonshKernelProvisioner` (or an interface type `ReplKernelProvisionerLike { ensure(onProgress?: any, signal?: AbortSignal): Promise<KernelClient> }`).
  - Update `createAcpMcpToolDefinitions` to accept `XonshKernelProvisioner | IpythonKernelProvisioner`.
  - The generated MCP python snippets (`print(__import__("json").dumps(await mcp.list_tools(...)))`) run cleanly in Xonsh because valid Python statements are valid Xonsh syntax.

#### C. Decouple `code-preview.ts` & `ipython-cell-code.ts`
- **Current code in `code-preview.ts`**:
  ```ts
  export function previewIpythonCode(code: string): CodePreview {
      const trimmedCode = code.trimEnd();
      const bashCell = parseIpythonBashCell(trimmedCode);
      if (bashCell) {
          return previewBashCommand(bashCell.body);
      }
      return previewPythonCode(trimmedCode);
  }
  ```
- **Modifications required**:
  1. Add `previewXonshCode(code: string): CodePreview`:
     - Xonsh code combines shell commands and Python code. Lines beginning with standard shell commands (or Xonsh operators `!(cmd)`, `$[]`, `subproc`) should be detected and routed to `previewBashCommand()`, while Python expressions route to `previewPythonCode()`.
  2. Alias or keep `previewIpythonCode` pointing to `previewXonshCode` (or `previewPythonCode`).
  3. In `ipython-cell-code.ts`:
     - Deprecate or generalize to `cell-code.ts`. While IPython relied on `%%bash` cell magic to execute shell scripts, Xonsh executes shell statements directly. Retain `parseIpythonBashCell` as a compatibility helper for any prompts containing legacy `%%bash` blocks.

#### D. Tool Index Registration (`packages/coding-agent/src/core/tools/index.ts`)
- **Current code**:
  ```ts
  export type ToolName = "ipython" | "xonsh";

  export interface ToolsOptions {
      ipython?: IpythonToolOptions;
      xonsh?: XonshToolOptions;
  }

  export function createAllToolDefinitions(cwd: string, options?: ToolsOptions): Record<ToolName, ToolDef> {
      return {
          ipython: createIpythonToolDefinition(cwd, options?.ipython),
          xonsh: createXonshToolDefinition(cwd, options?.xonsh),
      };
  }
  ```
- **Modifications required**:
  1. Make `xonsh` the primary entry in `ToolName` and `createAllToolDefinitions`.
  2. Ensure `xonsh` is enabled by default.
  3. If phasing out `ipython`, map `ipython` to `createXonshToolDefinition` or keep it as a legacy alias.

---

## 4. Summary of Determinations: Read vs Modify Matrix

| Category | File | Action | Key Modifications |
| :--- | :--- | :---: | :--- |
| **Python Runtime** | `src/rlm/repl.py` | **Read & Modify** | - Add Xonsh globals (`XSH`, etc.) to `_ALWAYS_SKIP` / `_RESTORE_SKIP`.<br>- Enable Xonsh parsing/execution in `_compile_cell`.<br>- Keep legacy `In`/`Out`/`get_ipython` in `_RESTORE_SKIP` for compatibility. |
| **Python Runtime** | `src/rlm/repl.md` | **Read & Modify** | - Update protocol doc to reference Xonsh skip sets and execution behavior. |
| **Python Runtime** | `test/test_repl.py` | **Read & Modify** | - Add tests for Xonsh state skip sets and syntax execution. |
| **Agent Tools** | `core/tools/xonsh.ts` | **Read & Modify** | - Retain as the primary REPL tool module.<br>- Remove duplicate boilerplate by importing from a shared provisioner or establishing it as canonical. |
| **Agent Tools** | `core/tools/ipython.ts` | **Read & Modify** | - Decouple by turning into a thin alias/wrapper over `xonsh.ts` or extracting shared `ReplKernelProvisioner`. |
| **Agent Tools** | `core/tools/acp-mcp.ts` | **Read & Modify** | - Change import and parameter types from `IpythonKernelProvisioner` to `XonshKernelProvisioner` (or generic `ReplKernelProvisionerLike`). |
| **Agent Tools** | `core/tools/code-preview.ts` | **Read & Modify** | - Add `previewXonshCode` supporting Xonsh shell/python syntax.<br>- Re-export or alias `previewIpythonCode` to `previewXonshCode`. |
| **Agent Tools** | `core/tools/ipython-cell-code.ts` | **Read & Modify** | - Generalize or retain as compatibility parser for legacy `%%bash` blocks. |
| **Agent Tools** | `core/tools/index.ts` | **Read & Modify** | - Update `ToolName`, `ToolsOptions`, and `createAllToolDefinitions` to make `xonsh` canonical. |

---

## 5. Execution Plan & Migration Phases

### Phase 1: Python Runtime Updates (`prime-agent-runtime/`)
1. **Update `repl.py` skip lists**: Add `XSH` to `_ALWAYS_SKIP` and `_RESTORE_SKIP`. Ensure `_list_names` filters them out.
2. **Add Xonsh compilation support**: In `repl.py`, integrate Xonsh parsing via `xonsh.execer` if `xonsh` is installed/active, allowing native shell expressions (`$VAR`, `!(cmd)`) alongside top-level `await`.
3. **Verify Runtime**: Run `pytest test/test_repl.py` to ensure dill serialization and restore tests pass.

### Phase 2: Agent Tools Deduplication & Typing
1. **Decouple `acp-mcp.ts`**: Update type signature to accept `XonshKernelProvisioner | IpythonKernelProvisioner`.
2. **Deduplicate `ipython.ts` and `xonsh.ts`**:
   - Establish `xonsh.ts` as the canonical implementation.
   - Refactor `ipython.ts` to alias its exports to `xonsh.ts` (or extract common provisioner logic into a shared helper).
3. **Update `code-preview.ts`**: Implement `previewXonshCode` for UI previews of Xonsh code blocks.
4. **Update `index.ts`**: Ensure `xonsh` is the default tool created in `createAllToolDefinitions`.

### Phase 3: Tool Verification
1. Run coding-agent tool unit tests: `pnpm test packages/coding-agent/test/code-preview.test.ts`, `acp-kernel-features.test.ts`.
2. Verify that existing snapshot restore and kernel reset notices operate smoothly with `<xonsh_kernel_reset>`.
