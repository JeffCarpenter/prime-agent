# Xonsh Tool UI-Label Investigation

Date: 2026-09-16  
Status: Diagnosis confirmed; no implementation change made.

## Trigger

A call to the explicit `xonsh` tool executed this native Xonsh cell:

```xonsh
result = $(@lines printf 'alpha\nbeta\n')
print(type(result).__name__, result)
```

The cell returned:

```text
list ['alpha', 'beta']
```

The interactive UI summarized the same call as:

```text
✓ python · type(result).__name__, result · ↑ 2 ↓ 1 lines
```

The `python` label raised the question of whether Prime Agent had selected or executed the Python tool instead of Xonsh.

## Confirmed Execution Boundary

Tool selection and execution are explicit. They do not depend on source-language heuristics.

- The tool call name is `xonsh`.
- `packages/coding-agent/src/core/tools/xonsh.ts` sends the cell to the kernel with `mode: "xonsh"`.
- Tool execution events preserve `toolName: "xonsh"`.
- `ToolExecutionComponent` selects the shared REPL renderer using that explicit tool name.
- The returned kernel result is passed into the renderer details without changing the tool identity.

The incorrect `python` text is therefore presentation metadata only. It does not indicate Python dispatch or Python-mode execution.

## Renderer and Preview Path

The verified UI path is:

```text
ToolExecutionComponent
  -> shouldUseReplRenderer()
  -> getXonshCodeFromArgs()
  -> ReplCellComponent.collapsedLine()
  -> previewXonshCode()
  -> displayed language label
```

Relevant files:

- `packages/coding-agent/src/core/tools/code-preview.ts`
- `packages/coding-agent/src/modes/interactive/components/tool-execution.ts`
- `packages/coding-agent/src/modes/interactive/components/ipython-cell.ts`
- `packages/coding-agent/src/core/tools/xonsh.ts`
- `packages/coding-agent/src/core/kernel/repl-manager.ts`

`mcpls` TypeScript-LSP definition and reference queries confirmed these symbol links. TypeScript diagnostics for `code-preview.ts` were empty.

## Root Cause of the Observed Label

`previewXonshCode()` uses regular-expression heuristics to choose a preview language and description. Its subprocess pattern recognizes `$(`, `!(`, `@(`, and `$[` only when an operator starts the cell after optional whitespace.

The first line of the reproduction begins with a Python-shaped assignment:

```xonsh
result = $(@lines ...)
```

It therefore falls through to `previewPythonCode()`. The Python preview scorer prefers the second line and simplifies:

```python
print(type(result).__name__, result)
```

into:

```text
type(result).__name__, result
```

A direct TypeScript probe reproduced the exact result:

```text
{ language: "python", text: "type(result).__name__, result" }
```

A direct `ToolExecutionComponent` probe reproduced the complete collapsed summary, including two input lines and one output line.

## Validation

Focused existing tests remained green:

- `npx vitest run test/code-preview.test.ts`: 25/25 passed.
- `npx vitest run test/xonsh-cell.test.ts test/ipython-cell-preview.test.ts`: 8/8 passed.
- Focused native runtime tests for Xonsh syntax and top-level `await`: 2/2 passed.

A renderer discriminant probe showed:

- An actual Xonsh call containing `echo hello` renders `xonsh · bash`.
- The same text under an explicit `ipython` tool name renders `python`.

Replay metadata and the legacy IPython renderer were ruled out. The passing suites do not cover assignment-embedded Xonsh subprocess expressions.

## Secondary Classifier Findings

The investigation exposed broader limits in the preview heuristics:

- Valid Xonsh subprocess expressions can appear in assignments, collections, calls, conditionals, chained assignments, annotated assignments, and multiline expressions.
- Direct assignment forms using `$(`, `!(`, and `$[` currently fall through to Python previews.
- Some ordinary Python attribute assignments, such as `self.value = 1`, can be falsely classified as Xonsh by the generic shell-command heuristic.
- `xonshSubprocessBody()` can extract malformed preview text from a multiline cell because it treats the cell's final delimiter as the subprocess delimiter.
- `@(...)` is command-context argument expansion in Xonsh 0.24.2, not a valid standalone assignment right-hand side. Its inclusion in the cell-start subprocess preview pattern creates another false-positive boundary.

These observations show that expanding regular expressions cannot reliably reproduce the Xonsh grammar.

## Design Boundary

The UI should keep three concepts separate:

1. **Tool identity** comes from the explicit tool call and is authoritative.
2. **Syntax hints** may be inferred for secondary display or highlighting.
3. **Preview text** is a best-effort description of the cell.

The primary label should always preserve `xonsh`. If a secondary syntax hint remains useful, a clearer form would be:

```text
xonsh · python
xonsh · shell
```

A future change should first define this UI contract. It should not attempt to identify the primary tool by broadening source regexes. Any classifier changes should test language selection and preview extraction separately.

## Scope

This investigation changed no implementation or test files. It added documentation only. No fix, regression test, or changelog fragment is included.
