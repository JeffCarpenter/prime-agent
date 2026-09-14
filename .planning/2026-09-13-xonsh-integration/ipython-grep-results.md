# IPython Reference Inventory

> Inventory of all hardcoded references to `ipython` (case-insensitive) across the repository, generated to support replacing IPython kernel integration with Xonsh.

## Summary Statistics

- **Total repository matches**: 954 occurrences across 123 files
- **Codebase matches (excluding planning)**: 907 occurrences across 118 files
- **Planning notes matches (`.planning/`)**: 47 occurrences across 5 files
- **Search command**: `fd -t f -H -E .git --exec-batch rg -Fi -n ipython` (equivalent to `git grep -i -n ipython`)

### Category Breakdown

| Category | Files | Matches | Description |
| :--- | :---: | :---: | :--- |
| Python Runtime (`prime-agent-runtime/`) | 3 | 7 | Kernel REPL loop, state serialization, skip sets (`_ALWAYS_SKIP`), and REPL docs. |
| Agent Tools Implementation (`packages/coding-agent/src/core/tools/`) | 5 | 40 | Tool definitions, `IpythonKernelProvisioner`, cell execution wrappers, and preview helpers. |
| Extensions API & Types (`packages/coding-agent/src/core/extensions/`) | 2 | 16 | Type definitions for tool calls, tool results, and extension event guards. |
| Agent Core & Session (`packages/coding-agent/src/core/`) | 10 | 123 | System prompts, session services, goal tracking, skill injection, and compaction logic. |
| Modes & Interactive UI (`packages/coding-agent/src/modes/`) | 14 | 100 | ACP protocol events, TUI components (`IPythonCellComponent`), state restore banners, and theme styles. |
| CLI & Public Entrypoints (`src/cli/`, `src/index.ts`, `src/main.ts`) | 3 | 10 | CLI argument validation, built-in tool registries, and package exports. |
| Test Suite (`packages/coding-agent/test/`) | 57 | 454 | Unit, integration, and regression tests verifying IPython execution, UI, and lifecycle. |
| Examples (`packages/coding-agent/examples/`) | 10 | 26 | SDK examples and extension demos configuring or mocking the IPython tool. |
| Documentation (`docs/`, `doc/`, `README.md`) | 12 | 129 | Architecture docs, user guides, tool system specifications, and SDK manuals. |
| Scripts & Installers | 2 | 2 | Installation scripts referencing IPython or environment setup. |
| Planning & Migration Docs | 5 | 47 | Prior analysis, claims, findings, and tasks recorded in `.planning/`. |

---

## Python Runtime (`prime-agent-runtime/`) (3 files, 7 matches)

### [prime-agent-runtime/src/rlm/repl.md](file:///home/jeff/code/fork/prime-agent/prime-agent-runtime/src/rlm/repl.md) (2 matches)

```text
Line  145: `{rlm, mcp, bash, asyncio, In, Out, get_ipython, exit, quit, open}` are always
Line  159: Names `In`, `Out`, and `get_ipython` in a payload are never restored. `dill` is imported lazily; when unavailable, snapshot and restore
```

### [prime-agent-runtime/src/rlm/repl.py](file:///home/jeff/code/fork/prime-agent/prime-agent-runtime/src/rlm/repl.py) (3 matches)

```text
Line   40: _ALWAYS_SKIP = {"rlm", "mcp", "bash", "asyncio", "In", "Out", "get_ipython", "exit", "quit", "open"}
Line   41: # IPython-injected names that may appear in a snapshot payload; never restored.
Line   42: _RESTORE_SKIP = {"In", "Out", "get_ipython"}
```

### [prime-agent-runtime/test/test_repl.py](file:///home/jeff/code/fork/prime-agent/prime-agent-runtime/test/test_repl.py) (2 matches)

```text
Line  619:     def test_restore_skips_ipython_injected_names(self):
Line  628:                 "get_ipython": dill.dumps(None),
```

## Agent Tools Implementation (`packages/coding-agent/src/core/tools/`) (5 files, 40 matches)

### [packages/coding-agent/src/core/tools/acp-mcp.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/tools/acp-mcp.ts) (3 matches)

```text
Line    4: import type { IpythonKernelProvisioner } from "./ipython.js";
Line   45: async function executeMcpCode(provisioner: IpythonKernelProvisioner, code: string, signal: AbortSignal | undefined) {
Line   52: 	provisioner: IpythonKernelProvisioner,
```

### [packages/coding-agent/src/core/tools/code-preview.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/tools/code-preview.ts) (3 matches)

```text
Line    1: import { parseIpythonBashCell } from "./ipython-cell-code.js";
Line  532: export function previewIpythonCode(code: string): CodePreview {
Line  534: 	const bashCell = parseIpythonBashCell(trimmedCode);
```

### [packages/coding-agent/src/core/tools/index.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/tools/index.ts) (11 matches)

```text
Line   23: 	createIpythonTool,
Line   24: 	createIpythonToolDefinition,
Line   25: 	IpythonKernelProvisioner,
Line   26: 	type IpythonToolDetails,
Line   27: 	type IpythonToolInput,
Line   28: 	type IpythonToolOptions,
Line   29: } from "./ipython.js";
Line   51: import { createIpythonToolDefinition, type IpythonToolOptions } from "./ipython.js";
Line   56: export type ToolName = "ipython" | "xonsh";
Line   59: 	ipython?: IpythonToolOptions;
Line   65: 		ipython: createIpythonToolDefinition(cwd, options?.ipython),
```

### [packages/coding-agent/src/core/tools/ipython-cell-code.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/tools/ipython-cell-code.ts) (2 matches)

```text
Line    3: export interface ParsedIpythonBashCell {
Line    7: export function parseIpythonBashCell(code: string): ParsedIpythonBashCell | undefined {
```

### [packages/coding-agent/src/core/tools/ipython.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/tools/ipython.ts) (21 matches)

```text
Line  148: const ipythonSchema = Type.Object({
Line  163: 	"<ipython_kernel_reset>",
Line  165: 	"</ipython_kernel_reset>",
Line  251: export type IpythonToolInput = Static<typeof ipythonSchema>;
Line  253: export interface IpythonToolDetails {
Line  277: export interface IpythonToolOptions {
Line  301: 	provisioner?: IpythonKernelProvisioner;
Line  311: export class IpythonKernelProvisioner {
Line  323: 		private readonly options?: Omit<IpythonToolOptions, "provisioner">,
Line  566: 	provisioner: IpythonKernelProvisioner,
Line  618: export function createIpythonToolDefinition(
Line  620: 	options?: IpythonToolOptions,
Line  621: ): ToolDefinition<typeof ipythonSchema, IpythonToolDetails> {
Line  622: 	const provisioner = options?.provisioner ?? new IpythonKernelProvisioner(cwd, options);
Line  625: 		name: "ipython",
Line  626: 		label: "ipython",
Line  629: 		promptSnippet: "ipython - persistent Python REPL for code, state, and bash() orchestration",
Line  630: 		// The kernel is single-threaded — pi must not run two ipython calls in parallel within a batch.
Line  632: 		parameters: ipythonSchema,
Line  708: export function createIpythonTool(cwd: string, options?: IpythonToolOptions): AgentTool<typeof ipythonSchema> {
Line  709: 	return wrapToolDefinition(createIpythonToolDefinition(cwd, options));
```

## Extensions API & Types (`packages/coding-agent/src/core/extensions/`) (2 files, 16 matches)

### [packages/coding-agent/src/core/extensions/index.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/extensions/index.ts) (3 matches)

```text
Line   78: 	IpythonToolCallEvent,
Line   79: 	IpythonToolResultEvent,
Line  145: 	isIpythonToolResult,
```

### [packages/coding-agent/src/core/extensions/types.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/extensions/types.ts) (13 matches)

```text
Line   69: 	IpythonToolDetails,
Line   70: 	IpythonToolInput,
Line  782: export interface IpythonToolCallEvent extends ToolCallEventBase {
Line  783: 	toolName: "ipython";
Line  784: 	input: IpythonToolInput;
Line  798: export type ToolCallEvent = BashToolCallEvent | EditToolCallEvent | IpythonToolCallEvent | CustomToolCallEvent;
Line  818: export interface IpythonToolResultEvent extends ToolResultEventBase {
Line  819: 	toolName: "ipython";
Line  820: 	details: IpythonToolDetails | undefined;
Line  832: 	| IpythonToolResultEvent
Line  841: export function isIpythonToolResult(e: ToolResultEvent): e is IpythonToolResultEvent {
Line  842: 	return e.toolName === "ipython";
Line  867: export function isToolCallEventType(toolName: "ipython", event: ToolCallEvent): event is IpythonToolCallEvent;
```

## Agent Core & Session (`packages/coding-agent/src/core/`) (10 files, 123 matches)

### [packages/coding-agent/src/core/agent-session-services.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/agent-session-services.ts) (2 matches)

```text
Line   70: 	prewarmIpythonKernel?: boolean;
Line  266: 		prewarmIpythonKernel: options.prewarmIpythonKernel,
```

### [packages/coding-agent/src/core/agent-session.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/agent-session.ts) (85 matches)

```text
Line  186: 	IPYTHON_STATE_RESTORED_CUSTOM_TYPE,
Line  304: import { IpythonKernelProvisioner } from "./tools/ipython.js";
Line  352: 			type: "ipython_sent_agent_message";
Line  486: 	prewarmIpythonKernel?: boolean;
Line  789: const IPYTHON_SENT_AGENT_MESSAGE_CUSTOM_ENTRY = "ipython_sent_agent_message";
Line  791: interface PersistedIpythonSentAgentMessage {
Line  800: function parsePersistedIpythonSentAgentMessage(value: unknown): PersistedIpythonSentAgentMessage | undefined {
Line  837: 		(message.toolName !== "ipython" && message.toolName !== "xonsh") ||
Line 1191: 	private _lateIpythonSentAgentMessages = new Map<string, KernelSentAgentMessage[]>();
Line 1236: 	private _ipythonKernelProvisioner?: IpythonKernelProvisioner;
Line 1239: 	private _ipythonKernelSnapshotDir?: string;
Line 1241: 	private _ipythonRuntimeBuilt = false;
Line 1242: 	private readonly _prewarmIpythonKernel: boolean;
Line 1356: 		this._prewarmIpythonKernel = (config.prewarmIpythonKernel ?? false) && this._rlmDepth === 0;
Line 1395: 		this._restoreLateIpythonSentAgentMessages();
Line 1434: 	private _getReplProvisioner(activeNames?: string[]): IpythonKernelProvisioner | XonshKernelProvisioner | undefined {
Line 1439: 		if (names.includes("ipython") && this._ipythonKernelProvisioner) {
Line 1440: 			return this._ipythonKernelProvisioner;
Line 1445: 		if (this._ipythonKernelProvisioner?.hasRunningKernel) {
Line 1446: 			return this._ipythonKernelProvisioner;
Line 1448: 		if (this._initialActiveToolNames?.includes("xonsh") && !this._initialActiveToolNames.includes("ipython")) {
Line 1449: 			return this._xonshKernelProvisioner ?? this._ipythonKernelProvisioner;
Line 1451: 		if (this._allowedToolNames?.has("xonsh") && !this._allowedToolNames.has("ipython")) {
Line 1452: 			return this._xonshKernelProvisioner ?? this._ipythonKernelProvisioner;
Line 1454: 		return this._ipythonKernelProvisioner ?? this._xonshKernelProvisioner;
Line 1457: 	private get _primaryReplProvisioner(): IpythonKernelProvisioner | XonshKernelProvisioner | undefined {
Line 1468: 			throw new Error("ACP MCP servers require a primary REPL tool (ipython or xonsh)");
Line 1664: 	private _restoreLateIpythonSentAgentMessages(): void {
Line 1665: 		this._lateIpythonSentAgentMessages.clear();
Line 1667: 			if (entry.type !== "custom" || entry.customType !== IPYTHON_SENT_AGENT_MESSAGE_CUSTOM_ENTRY) {
Line 1670: 			const persisted = parsePersistedIpythonSentAgentMessage(entry.data);
Line 1672: 				this._rememberLateIpythonSentAgentMessage(persisted.toolCallId, persisted.message);
Line 1677: 	private _rememberLateIpythonSentAgentMessage(toolCallId: string, message: KernelSentAgentMessage): boolean {
Line 1678: 		const messages = this._lateIpythonSentAgentMessages.get(toolCallId) ?? [];
Line 1682: 			this._lateIpythonSentAgentMessages.set(toolCallId, messages);
Line 1692: 	private _applyLateIpythonSentAgentMessages(message: AgentMessage): void {
Line 1693: 		if (message.role !== "toolResult" || message.toolName !== "ipython") {
Line 1696: 		for (const sentMessage of this._lateIpythonSentAgentMessages.get(message.toolCallId) ?? []) {
Line 1701: 	private _recordLateIpythonSentAgentMessage(toolCallId: string, message: KernelSentAgentMessage): void {
Line 1703: 			if (this._disposed || !this._rememberLateIpythonSentAgentMessage(toolCallId, message)) {
Line 1706: 			this.sessionManager.appendCustomEntry(IPYTHON_SENT_AGENT_MESSAGE_CUSTOM_ENTRY, { toolCallId, message });
Line 1707: 			this._emit({ type: "ipython_sent_agent_message", toolCallId, message });
Line 2194: 	 * model needs is ipython. Force-activate it (including into a live
Line 2201: 		const ipythonTool = this._toolRegistry.get("ipython");
Line 2202: 		if (!ipythonTool) {
Line 2203: 			throw new Error("Goals require the ipython tool, which is not available in this session.");
Line 2206: 		if (!activeToolNames.has("ipython")) {
Line 2207: 			activeToolNames.add("ipython");
Line 2212: 			if (!contextTools.some((tool) => tool.name === "ipython")) {
Line 2213: 				contextTools.push(ipythonTool);
Line 2314: 		// before that turn's ipython cell runs. goal.complete() only arrives later
Line 3424: 		// runs at message_end, before the completing ipython cell executes, so a
Line 3703: 			this._applyLateIpythonSentAgentMessages(event.message);
Line 4217: 			await this._ipythonKernelProvisioner?.dispose({ snapshot: kernelSnapshot });
Line 4393: 			this._applyLateIpythonSentAgentMessages(message);
Line 6659: 			this._ipythonKernelProvisioner?.manager?.hasBackgroundWork === true ||
Line 7480: 		const provisioner = this._ipythonKernelProvisioner;
Line 7504: 			"<ipython_state>",
Line 7506: 			"</ipython_state>",
Line 7510: 			customType: "ipython_state",
Line 7528: 	private _onIpythonStateRestored(result: RestoreResult): void {
Line 7529: 		const lines = ["<ipython_state_restored>"];
Line 7544: 		lines.push("</ipython_state_restored>");
Line 7547: 				customType: IPYTHON_STATE_RESTORED_CUSTOM_TYPE,
Line 7789: 		this._restoreLateIpythonSentAgentMessages();
Line 9343: 			const previousDispose = this._ipythonKernelProvisioner?.dispose();
Line 9344: 			this._ipythonKernelSnapshotDir = this.sessionManager.getSessionArtifactDir();
Line 9348: 			const notifyRestore = !this._ipythonRuntimeBuilt;
Line 9349: 			this._ipythonKernelProvisioner = new IpythonKernelProvisioner(this._cwd, {
Line 9356: 				snapshotDir: this._ipythonKernelSnapshotDir,
Line 9358: 				onRestore: notifyRestore ? (result) => this._onIpythonStateRestored(result) : undefined,
Line 9361: 				ipython: {
Line 9362: 					provisioner: this._ipythonKernelProvisioner,
Line 9366: 						this._recordLateIpythonSentAgentMessage(toolCallId, message),
Line 9403: 		if (acpServers.length > 0 && !this._ipythonKernelProvisioner) {
Line 9406: 		const acpMcpTools = this._ipythonKernelProvisioner
Line 9407: 			? createAcpMcpToolDefinitions(acpServers, this._ipythonKernelProvisioner)
Line 9414: 		const defaultActiveToolNames = this._baseToolsOverride ? Object.keys(this._baseToolsOverride) : ["ipython"];
Line 9417: 			// An active goal needs ipython so the model can reach the goal skill.
Line 9418: 			baseActiveToolNames.push("ipython");
Line 9430: 			!!this._ipythonKernelSnapshotDir && existsSync(snapshotPathIn(this._ipythonKernelSnapshotDir));
Line 9431: 		if ((this._prewarmIpythonKernel || hasSnapshot) && this.getActiveToolNames().includes("ipython")) {
Line 9432: 			this._ipythonKernelProvisioner?.prewarm();
Line 9436: 		this._ipythonRuntimeBuilt = true;
Line 12069: 			this._restoreLateIpythonSentAgentMessages();
```

### [packages/coding-agent/src/core/export-html/vendor/highlight.min.js](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/export-html/vendor/highlight.min.js) (1 matches)

```text
Line  907: name:"Python",aliases:["py","gyp","ipython"],unicodeRegex:!0,keywords:i,
```

### [packages/coding-agent/src/core/goals.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/goals.ts) (1 matches)

```text
Line  227: Before marking the goal complete, audit the current state against every requirement in the objective. Do not rely on intent, partial progress, memory of earlier work, or a plausible final answer as proof of completion. If the objective is achieved, run \`await goal.complete()\` in ipython so usage accounting is preserved.
```

### [packages/coding-agent/src/core/messages.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/messages.ts) (2 matches)

```text
Line   31: export const IPYTHON_STATE_RESTORED_CUSTOM_TYPE = "ipython_state_restored";
Line  214: export interface IpythonStateRestoredDetails {
```

### [packages/coding-agent/src/core/prompts/rlm.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/prompts/rlm.ts) (10 matches)

```text
Line   31: 	"The `ipython` tool is a persistent Python REPL — the agent's long-lived control environment for reasoning, context management, state, tool orchestration, and recursive subcalls. Top-level `await` works directly. Use it to keep intermediate variables, inspect and transform outputs, and write small helper functions. Compaction removes individual variables whose serialized form exceeds 16 MiB; keep large source data on disk and reload it when needed.",
Line   63: 	const hasIpython = options.activeTools === undefined || options.activeTools.includes("ipython");
Line   70: 	if (hasAgentMessage && hasIpython) {
Line   86: 	const hasIpython = options.activeTools === undefined ? true : activeTools.includes("ipython");
Line   87: 	const canRunShellSkills = hasIpython || activeTools.includes("bash");
Line  116: 		if (hasIpython) {
Line  129: 		if (hasIpython && installedSkills.includes("edit")) {
Line  149: 	if (depth === 0 && hasIpython) {
Line  156: 	if (allowRecursion && hasIpython) {
Line  183: 	if (hasIpython) {
```

### [packages/coding-agent/src/core/refinement/refinement.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/refinement/refinement.ts) (5 matches)

```text
Line  421: 		includeIpythonExamples?: boolean;
Line  429: 	const includeIpythonExamples = options.includeIpythonExamples ?? true;
Line  430: 	const includeRefineExamples = options.includeRefineExamples ?? includeIpythonExamples;
Line  443: 		includeIpythonExamples
Line  460: 		if (kind === "subagent" && entries.length > 0 && includeIpythonExamples) {
```

### [packages/coding-agent/src/core/sdk.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/sdk.ts) (7 matches)

```text
Line   21: import { createBashTool, createEditTool, createIpythonTool, withFileMutationQueue } from "./tools/index.js";
Line   45: 	 * - "builtin": disable the default built-in tool (ipython)
Line   52: 	 * When omitted, pi enables the default built-in tool (ipython)
Line  104: export { createBashTool, createEditTool, createIpythonTool, withFileMutationQueue };
Line  139:  *   tools: ["ipython"],
Line  238: 		options.initialActiveToolNames ?? (options.tools ? [...options.tools] : options.noTools ? [] : ["ipython"]);
Line  374: 		prewarmIpythonKernel: options.prewarmIpythonKernel,
```

### [packages/coding-agent/src/core/skills.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/skills.ts) (1 matches)

```text
Line  452: 		"Use ipython to inspect a skill's file when the task matches its description.",
```

### [packages/coding-agent/src/core/system-prompt.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/system-prompt.ts) (9 matches)

```text
Line   67: 	const tools = selectedTools ?? ["ipython"];
Line   68: 	const hasIpython = tools.includes("ipython");
Line   73: 	const genericMcpSection = hasIpython ? formatGenericMcpGuidance(options.genericMcpServers) : "";
Line   89: 			!selectedTools || selectedTools.includes("ipython") || selectedTools.includes("bash");
Line  109: 			prompt += `\n\n${formatHarnessStateForPrompt(harnessState, { includeIpythonExamples: hasIpython, includeShellExamples: hasBash, includeRefineExamples: hasIpython && hasRefineSkill })}`;
Line  127: 		activeTools: tools.filter((name) => name === "ipython" || name === "bash" || name === "edit"),
Line  136: 	if ((allowRecursion ?? true) && hasIpython) {
Line  148: 		prompt += `\n\n${formatHarnessStateForPrompt(harnessState, { includeIpythonExamples: hasIpython, includeShellExamples: hasBash, includeRefineExamples: hasIpython && hasRefineSkill })}`;
Line  170: 	const hasFileAccess = tools.includes("ipython") || tools.includes("bash");
```

## Modes & Interactive UI (`packages/coding-agent/src/modes/`) (14 files, 100 matches)

### [packages/coding-agent/src/modes/acp/acp-events.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/modes/acp/acp-events.ts) (12 matches)

```text
Line    3: import type { PrimeAgentIpythonMeta, PrimeAgentSessionMeta } from "./acp-meta.js";
Line   23: export const IPYTHON_TOOL_NAME = "ipython";
Line   27: 		case IPYTHON_TOOL_NAME:
Line   68: function ipythonCellSource(args: unknown): string | undefined {
Line   96:  * The ipython tool reports media and diffs under `details` (images additionally
Line  100: function ipythonRichOutput(result: unknown): PrimeAgentIpythonMeta | undefined {
Line  105: 	const meta: PrimeAgentIpythonMeta = {};
Line  159: 			const cell = event.toolName === IPYTHON_TOOL_NAME ? ipythonCellSource(event.args) : undefined;
Line  164: 					title: event.toolName === IPYTHON_TOOL_NAME ? "Python cell" : event.toolName,
Line  174: 			const rich = event.toolName === IPYTHON_TOOL_NAME ? ipythonRichOutput(event.result) : undefined;
Line  181: 					...(rich ? { _meta: primeAgentMeta({ ipython: rich }) } : {}),
Line  298: 		case "ipython_sent_agent_message":
```

### [packages/coding-agent/src/modes/acp/acp-meta.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/modes/acp/acp-meta.ts) (5 matches)

```text
Line   35: export interface PrimeAgentIpythonAttachmentMeta {
Line   41: export interface PrimeAgentIpythonMeta {
Line   42: 	/** Media the cell loaded into context, as reported by the ipython tool. */
Line   43: 	attachments?: PrimeAgentIpythonAttachmentMeta[];
Line  126: 	ipython?: PrimeAgentIpythonMeta;
```

### [packages/coding-agent/src/modes/agent-connection/types.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/modes/agent-connection/types.ts) (1 matches)

```text
Line  575: 	| { type: "ipython_sent_agent_message"; toolCallId: string; message: KernelSentAgentMessage }
```

### [packages/coding-agent/src/modes/interactive/components/conversation-components.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/modes/interactive/components/conversation-components.ts) (2 matches)

```text
Line   22: import { IPythonCellComponent } from "./ipython-cell.js";
Line   55: 		component instanceof IPythonCellComponent ||
```

### [packages/coding-agent/src/modes/interactive/components/edit-summary.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/modes/interactive/components/edit-summary.ts) (3 matches)

```text
Line    7: import type { IpythonToolDetails } from "../../../core/tools/ipython.js";
Line   48: 	if (toolName === "ipython") {
Line   49: 		for (const display of (result.details as IpythonToolDetails | undefined)?.diffs ?? []) {
```

### [packages/coding-agent/src/modes/interactive/components/index.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/modes/interactive/components/index.ts) (5 matches)

```text
Line   29: 	getIpythonCodeFromArgs,
Line   30: 	IPythonCellComponent,
Line   31: 	type IPythonCellContentBlock,
Line   32: 	type IPythonCellState,
Line   33: } from "./ipython-cell.js";
```

### [packages/coding-agent/src/modes/interactive/components/injected-prompt-message.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/modes/interactive/components/injected-prompt-message.ts) (7 matches)

```text
Line   19: 	IPYTHON_STATE_RESTORED_CUSTOM_TYPE,
Line   20: 	type IpythonStateRestoredDetails,
Line   34: 	| IpythonStateRestoredDetails
Line   45: 			message.customType === IPYTHON_STATE_RESTORED_CUSTOM_TYPE ||
Line  120: 		if (this.expanded && this.message.customType !== IPYTHON_STATE_RESTORED_CUSTOM_TYPE) {
Line  143: 		if (this.message.customType === IPYTHON_STATE_RESTORED_CUSTOM_TYPE) {
Line  144: 			const details = this.message.details as IpythonStateRestoredDetails | undefined;
```

### [packages/coding-agent/src/modes/interactive/components/ipython-cell.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/modes/interactive/components/ipython-cell.ts) (31 matches)

```text
Line    9: import { previewIpythonCode } from "../../../core/tools/code-preview.js";
Line   11: import { parseIpythonBashCell } from "../../../core/tools/ipython-cell-code.js";
Line   20: export interface IPythonCellContentBlock {
Line   27: export interface IPythonCellState {
Line   29: 	content?: readonly IPythonCellContentBlock[];
Line   63: interface IpythonDetails {
Line   73: 	error?: IpythonErrorDetails;
Line   76: interface IpythonErrorDetails {
Line  130: export function getIpythonCodeFromArgs(args: unknown): string {
Line  138: function readDetails(details: unknown): IpythonDetails {
Line  262: function readErrorDetails(value: unknown): IpythonErrorDetails | undefined {
Line  289: function isImageBlock(block: IPythonCellContentBlock): boolean {
Line  293: function textFromBlocks(blocks: readonly IPythonCellContentBlock[] | undefined): string {
Line  324: function formatIpythonErrorSummary(error: IpythonErrorDetails): string {
Line  336: export class IPythonCellComponent implements Component {
Line  338: 	private state: IPythonCellState;
Line  341: 	constructor(state: IPythonCellState) {
Line  345: 	update(state: IPythonCellState): void {
Line  391: 	private collapsedLine(details: IpythonDetails): string {
Line  393: 		const isBashCell = parseIpythonBashCell(code) !== undefined;
Line  394: 		const preview = previewIpythonCode(code);
Line  426: 	private marker(details: IpythonDetails): string {
Line  443: 	private lineCounts(details: IpythonDetails): string | undefined {
Line  444: 		const bashCell = parseIpythonBashCell(this.state.code);
Line  469: 	private statusKind(details: IpythonDetails): "error" | "aborted" | "running" | "queued" | "done" {
Line  488: 	private hasResult(details: IpythonDetails): boolean {
Line  510: 		const isBashCell = parseIpythonBashCell(code) !== undefined;
Line  517: 				isBashCell || MAGIC_LINE_PATTERN.test(rawLine) || parseIpythonBashCell(rawLine) !== undefined
Line  527: 		if (isBashCell || MAGIC_LINE_PATTERN.test(line) || parseIpythonBashCell(line) !== undefined) {
Line  535: 	private renderOutput(lines: string[], width: number, details: IpythonDetails, hasCode: boolean): void {
Line  628: 				details.error.traceback.join("\n") || formatIpythonErrorSummary(details.error),
```

### [packages/coding-agent/src/modes/interactive/components/tool-execution.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/modes/interactive/components/tool-execution.ts) (13 matches)

```text
Line   12: import { getIpythonCodeFromArgs, IPythonCellComponent } from "./ipython-cell.js";
Line   52: 	if (toolName === "ipython") {
Line   53: 		return createAllToolDefinitions(cwd).ipython;
Line   74: 	private ipythonCellComponent?: IPythonCellComponent;
Line  162: 		if (this.shouldUseIpythonRenderer()) {
Line  174: 	private shouldUseIpythonRenderer(): boolean {
Line  175: 		return this.toolName === "ipython" && !this.toolDefinition?.renderCall && !this.toolDefinition?.renderResult;
Line  350: 			if (this.shouldUseIpythonRenderer()) {
Line  352: 					code: getIpythonCodeFromArgs(this.args),
Line  366: 				if (!this.ipythonCellComponent) {
Line  367: 					this.ipythonCellComponent = new IPythonCellComponent(state);
Line  369: 					this.ipythonCellComponent.update(state);
Line  371: 				this.selfRenderContainer.addChild(this.ipythonCellComponent);
```

### [packages/coding-agent/src/modes/interactive/components/tool-panel.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/modes/interactive/components/tool-panel.ts) (1 matches)

```text
Line   27:  * width; lines that still overflow are truncated, matching ipython cell
```

### [packages/coding-agent/src/modes/interactive/components/tree-selector.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/modes/interactive/components/tree-selector.ts) (2 matches)

```text
Line  879: 			case "ipython": {
Line  885: 				return `[ipython: ${code}${rawCode.length > 50 ? "..." : ""}]`;
```

### [packages/coding-agent/src/modes/interactive/feature-hints.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/modes/interactive/feature-hints.ts) (1 matches)

```text
Line   78: 		id: "persistent-ipython",
```

### [packages/coding-agent/src/modes/interactive/interactive-mode.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/modes/interactive/interactive-mode.ts) (16 matches)

```text
Line 1025: 	private ipythonToolComponents = new Map<string, ToolExecutionComponent>();
Line 1026: 	private lateIpythonSentAgentMessages = new Map<string, KernelSentAgentMessage[]>();
Line 2936: 		this.ipythonToolComponents.clear();
Line 2937: 		this.lateIpythonSentAgentMessages.clear();
Line 3032: 	private registerIpythonToolComponent(toolName: string, toolCallId: string, component: ToolExecutionComponent): void {
Line 3033: 		if (toolName !== "ipython") {
Line 3036: 		this.ipythonToolComponents.set(toolCallId, component);
Line 3037: 		for (const lateMessage of this.lateIpythonSentAgentMessages.get(toolCallId) ?? []) {
Line 3089: 			this.registerIpythonToolComponent(latestToolCall.name, latestToolCall.id, component);
Line 5674: 			case "ipython_sent_agent_message": {
Line 5675: 				const messages = this.lateIpythonSentAgentMessages.get(event.toolCallId) ?? [];
Line 5678: 					this.lateIpythonSentAgentMessages.set(event.toolCallId, messages);
Line 5680: 				this.ipythonToolComponents.get(event.toolCallId)?.appendSentAgentMessage(event.message);
Line 6541: 		this.ipythonToolComponents.clear();
Line 6542: 		this.lateIpythonSentAgentMessages.clear();
Line 6612: 						this.registerIpythonToolComponent(content.name, content.id, component);
```

### [packages/coding-agent/src/modes/interactive/theme/theme-schema.json](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/modes/interactive/theme/theme-schema.json) (1 matches)

```text
Line  185: 					"description": "Tool panel background (ipython cells and tool executions)"
```

## CLI & Public Entrypoints (`src/cli/`, `src/index.ts`, `src/main.ts`) (3 files, 10 matches)

### [packages/coding-agent/src/cli/args.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/cli/args.ts) (1 matches)

```text
Line   64: const BUILTIN_TOOL_NAMES = ["ipython"];
```

### [packages/coding-agent/src/index.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/index.ts) (8 matches)

```text
Line   89: 	IpythonToolCallEvent,
Line  136: 	isIpythonToolResult,
Line  186: 	createIpythonTool,
Line  255: 	createIpythonToolDefinition,
Line  264: 	IpythonKernelProvisioner,
Line  265: 	type IpythonToolDetails,
Line  266: 	type IpythonToolInput,
Line  267: 	type IpythonToolOptions,
```

### [packages/coding-agent/src/main.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/main.ts) (1 matches)

```text
Line  788: 			prewarmIpythonKernel: true,
```

## Test Suite (`packages/coding-agent/test/`) (57 files, 454 matches)

### [packages/coding-agent/test/acp-events.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/acp-events.test.ts) (10 matches)

```text
Line   76: 	it("treats IPython as an execute tool call carrying its cell source", () => {
Line   77: 		expect(acpToolKind("ipython")).toBe("execute");
Line   81: 			toolName: "ipython",
Line   96: 	it("carries rich IPython output from the fields the tool actually reports", () => {
Line  100: 			toolName: "ipython",
Line  119: 				ipython: {
Line  127: 	it("omits IPython rich metadata when the cell produced none", () => {
Line  131: 			toolName: "ipython",
Line  142: 			toolName: "ipython",
Line  251: 			type: "ipython_sent_agent_message",
```

### [packages/coding-agent/test/acp-kernel-features.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/acp-kernel-features.test.ts) (9 matches)

```text
Line    8: import { IpythonKernelProvisioner } from "../src/core/tools/ipython.js";
Line   34: /** Wrap kernel output the way the ipython tool result reaches the event stream. */
Line   39: 		toolName: "ipython",
Line   47: 	let provisioner: IpythonKernelProvisioner | undefined;
Line   67: 		provisioner = new IpythonKernelProvisioner(tempDir, { pythonSkills: [AGENT_MESSAGE_SKILL] });
Line   90: 		provisioner = new IpythonKernelProvisioner(tempDir, {
Line  164: 		provisioner = new IpythonKernelProvisioner(tempDir, {
Line  217: 		provisioner = new IpythonKernelProvisioner(tempDir, {
Line  267: 			type: "ipython_sent_agent_message",
```

### [packages/coding-agent/test/agent-activity.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/agent-activity.test.ts) (6 matches)

```text
Line  105: 		tracker.handleEvent({ type: "tool_execution_start", toolCallId: "t1", toolName: "ipython", args: {} });
Line  111: 			toolName: "ipython",
Line  125: 		tracker.handleEvent({ type: "tool_execution_start", toolCallId: "t1", toolName: "ipython", args: {} });
Line  126: 		tracker.handleEvent({ type: "tool_execution_start", toolCallId: "t2", toolName: "ipython", args: {} });
Line  130: 			toolName: "ipython",
Line  138: 			toolName: "ipython",
```

### [packages/coding-agent/test/agent-connection-daemon.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/agent-connection-daemon.test.ts) (3 matches)

```text
Line  636: 		activeToolNames: ["ipython"],
Line 2212: 			activeToolNames: ["ipython"],
Line 2236: 					activeToolNames: ["ipython"],
```

### [packages/coding-agent/test/agent-connection-in-process.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/agent-connection-in-process.test.ts) (2 matches)

```text
Line  108: 		getActiveToolNames: () => ["ipython"],
Line  318: 					activeToolNames: ["ipython"],
```

### [packages/coding-agent/test/agent-session-concurrent.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/agent-session-concurrent.test.ts) (1 matches)

```text
Line  194: 		Reflect.set(session, "_ipythonKernelProvisioner", { dispose });
```

### [packages/coding-agent/test/agent-session-config.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/agent-session-config.test.ts) (4 matches)

```text
Line   14: 			tools: ["ipython"],
Line   42: 			tools: ["ipython"],
Line  104: 			tools: ["ipython"],
Line  118: 			tools: ["ipython"],
```

### [packages/coding-agent/test/agent-session-dynamic-tools.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/agent-session-dynamic-tools.test.ts) (3 matches)

```text
Line   72: 		const ipythonTool = allTools.find((tool) => tool.name === "ipython");
Line   81: 		expect(ipythonTool?.sourceInfo).toMatchObject({
Line   82: 			path: "<builtin:ipython>",
```

### [packages/coding-agent/test/agent-session-recursion.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/agent-session-recursion.test.ts) (4 matches)

```text
Line  291: 		const parentAssistant = assistantMessage("running ipython", usage(0, 0));
Line  575: 		restoredAnswer.content.push({ type: "toolCall", id: "tool-1", name: "ipython", arguments: {} });
Line 2502: 		const parentAssistant = assistantMessage("running ipython", usage(0, 0));
Line 2696: 			const parentAssistant = assistantMessage("running ipython", usage(2, 1));
```

### [packages/coding-agent/test/agent-session-services.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/agent-session-services.test.ts) (3 matches)

```text
Line  197: 			const originalProvisioner = Reflect.get(session, "_ipythonKernelProvisioner");
Line  199: 			Reflect.set(session, "_ipythonKernelProvisioner", { manager: { isRunning: true, execute } });
Line  201: 			Reflect.set(session, "_ipythonKernelProvisioner", originalProvisioner);
```

### [packages/coding-agent/test/args.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/args.test.ts) (9 matches)

```text
Line  481: 			const result = parseArgs(["--tools", "ipython,dynamic_tool"]);
Line  482: 			expect(result.tools).toEqual(["ipython", "dynamic_tool"]);
Line  486: 			const result = parseArgs(["-t", "ipython,dynamic_tool"]);
Line  487: 			expect(result.tools).toEqual(["ipython", "dynamic_tool"]);
Line  491: 			const result = parseArgs(["--no-tools", "--tools", "ipython,dynamic_tool"]);
Line  493: 			expect(result.tools).toEqual(["ipython", "dynamic_tool"]);
Line  497: 			const result = parseArgs(["--no-builtin-tools", "--tools", "ipython,dynamic_tool"]);
Line  499: 			expect(result.tools).toEqual(["ipython", "dynamic_tool"]);
Line  507: 				message: "Unknown built-in tool(s): read. Available built-in tools: ipython",
```

### [packages/coding-agent/test/assistant-message.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/assistant-message.test.ts) (2 matches)

```text
Line   63: 				{ type: "toolCall", id: "tool-1", name: "ipython", arguments: { code: "open('file.txt').read()" } },
Line   78: 				{ type: "toolCall" as const, id: "tool-1", name: "ipython", arguments: { code: "while True: pass" } },
```

### [packages/coding-agent/test/code-preview.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/code-preview.test.ts) (17 matches)

```text
Line    2: import { previewBashCommand, previewIpythonCode, previewPythonCode } from "../src/core/tools/code-preview.js";
Line   29: 	it("unwraps bash cells in ipython", () => {
Line   37: 		expect(previewIpythonCode(code)).toEqual({ language: "python", text: "data.keys()" });
Line   42: p = Path("packages/coding-agent/src/modes/interactive/components/ipython-cell.ts")
Line  129: 		expect(previewIpythonCode("r = await bash('git status --porcelain')")).toEqual({
Line  134: 		const longPreview = previewIpythonCode(`result = await bash("${longCommand}", timeout=120)`);
Line  140: 		expect(previewIpythonCode(scorer)).toEqual({ language: "bash", text: "git diff --stat" });
Line  142: 			previewIpythonCode(`r = await bash('curl -H "Authorization: Bearer sec-abc123" https://api.example.com')`)
Line  152: 		expect(previewIpythonCode(tripleBody)).toEqual({ language: "bash", text: "git add packages/foo.ts" });
Line  153: 		expect(previewIpythonCode("r = await bash('printf \"a\\nb\"\\ngit add -A')")).toEqual({
Line  157: 		expect(previewIpythonCode("r = await bash('echo can\\'t stop')")).toEqual({
Line  161: 		expect(previewIpythonCode('r = await bash("grep -n \\")\\" src.c")')).toEqual({
Line  165: 		expect(previewIpythonCode("r = await bash('''echo it\\'''')")).toEqual({ language: "bash", text: "echo it'" });
Line  166: 		expect(previewIpythonCode("r = await bash(r'grep \\'x\\' f')")).toEqual({
Line  181: 			expect(previewIpythonCode(code).language).toBe("python");
Line  186: 		expect(previewIpythonCode('doc = """\nbash("git status")\n"""')).toEqual({
Line  190: 		expect(previewIpythonCode(`doc = """usage"""\nr = await bash('git status')`)).toEqual({
```

### [packages/coding-agent/test/compaction-extensions.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/compaction-extensions.test.ts) (2 matches)

```text
Line   24: import { createIpythonTool } from "../src/index.js";
Line   95: 				tools: [createIpythonTool(process.cwd())],
```

### [packages/coding-agent/test/compaction-serialization.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/compaction-serialization.test.ts) (2 matches)

```text
Line   12: 				toolName: "ipython",
Line   33: 				toolName: "ipython",
```

### [packages/coding-agent/test/compaction.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/compaction.test.ts) (1 matches)

```text
Line  331: 			toolName: "ipython",
```

### [packages/coding-agent/test/daemon-session-list.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/daemon-session-list.test.ts) (1 matches)

```text
Line  562: 			activity: { kind: "executing" as const, toolName: "ipython" },
```

### [packages/coding-agent/test/edit-summary.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/edit-summary.test.ts) (8 matches)

```text
Line   56: 				"ipython",
Line   72: 	test("coalesces direct and IPython edits by file", () => {
Line   75: 			{ type: "toolCall", id: "two", name: "ipython", arguments: {} },
Line   83: 				result("two", "ipython", { diffs: [{ path: "a.ts", oldStr: "new", newStr: "newer" }] }),
Line   94: 			{ type: "toolCall", id: "two", name: "ipython", arguments: {} },
Line  102: 				result("two", "ipython", { diffs: [{ path: absolutePath, oldStr: "new", newStr: "newer" }] }),
Line  120: 				{ type: "toolCall", id: "one", name: "ipython", arguments: {} },
Line  128: 					result("one", "ipython", { diffs: [{ path: realpathSync(file), oldStr: "old", newStr: "new" }] }),
```

### [packages/coding-agent/test/interactive-mode-prompt-stash.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/interactive-mode-prompt-stash.test.ts) (6 matches)

```text
Line   78: 	ipythonToolComponents: Map<string, unknown>;
Line   79: 	lateIpythonSentAgentMessages: Map<string, unknown>;
Line  654: 			ipythonToolComponents: new Map(),
Line  655: 			lateIpythonSentAgentMessages: new Map(),
Line  689: 			ipythonToolComponents: new Map(),
Line  690: 			lateIpythonSentAgentMessages: new Map(),
```

### [packages/coding-agent/test/interactive-mode-status.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/interactive-mode-status.test.ts) (26 matches)

```text
Line  116: 		activeToolNames: ["ipython"],
Line  210: 	ipythonToolComponents: Map<string, unknown>;
Line  211: 	lateIpythonSentAgentMessages: Map<string, unknown[]>;
Line  258: 		ipythonToolComponents: new Map<string, unknown>(),
Line  259: 		lateIpythonSentAgentMessages: new Map<string, unknown[]>(),
Line  325: 			const ipythonToolComponents = new Map([["stale-tool", {}]]);
Line  326: 			const lateIpythonSentAgentMessages = new Map([["stale-tool", []]]);
Line  329: 				ipythonToolComponents,
Line  330: 				lateIpythonSentAgentMessages,
Line  369: 			expect(ipythonToolComponents.size).toBe(0);
Line  370: 			expect(lateIpythonSentAgentMessages.size).toBe(0);
Line  383: 				ipythonToolComponents: new Map(),
Line  384: 				lateIpythonSentAgentMessages: new Map(),
Line  746: 				{ ...toolCallMessage("tool-1", "ipython"), timestamp: 200 },
Line  775: 		["a streaming snapshot without a starter", true, [{ ...toolCallMessage("tool-1", "ipython"), timestamp: 200 }]],
Line 1413: 			ipythonToolComponents: new Map(),
Line 1414: 			lateIpythonSentAgentMessages: new Map(),
Line 2058: 			ipythonToolComponents: new Map(),
Line 2059: 			lateIpythonSentAgentMessages: new Map(),
Line 2076: 					name: "ipython",
Line 4573: 		const ipythonChild = { setExpanded: vi.fn(), setAgentMessagesExpanded: vi.fn(), setEditDiffsExpanded: vi.fn() };
Line 4583: 		const fakeThis = createExpansionFakeThis([toolChild, ipythonChild, messageChild]);
Line 4591: 		expect(ipythonChild.setExpanded).toHaveBeenCalledWith(false);
Line 4592: 		expect(ipythonChild.setAgentMessagesExpanded).toHaveBeenCalledWith(true);
Line 4598: 		expect(ipythonChild.setExpanded).toHaveBeenCalledWith(true);
Line 4599: 		expect(ipythonChild.setAgentMessagesExpanded).toHaveBeenLastCalledWith(true);
```

### [packages/coding-agent/test/ipython-attachments.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/ipython-attachments.test.ts) (1 matches)

```text
Line    3: import { imageBlocksFromAttachments } from "../src/core/tools/ipython.js";
```

### [packages/coding-agent/test/ipython-bootstrap.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/ipython-bootstrap.test.ts) (1 matches)

```text
Line    7: import { buildRlmBootstrapCode } from "../src/core/tools/ipython.js";
```

### [packages/coding-agent/test/ipython-cell-background-output.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/ipython-cell-background-output.test.ts) (4 matches)

```text
Line    2: import { IPythonCellComponent } from "../src/modes/interactive/components/ipython-cell.js";
Line    9: function renderCell(state: ConstructorParameters<typeof IPythonCellComponent>[0]): string {
Line   10: 	return stripAnsi(new IPythonCellComponent(state).render(80).join("\n"));
Line   17: describe("IPythonCellComponent background output rendering", () => {
```

### [packages/coding-agent/test/ipython-cell-diff.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/ipython-cell-diff.test.ts) (14 matches)

```text
Line    7: import { IPythonCellComponent } from "../src/modes/interactive/components/ipython-cell.js";
Line   35: function renderCell(state: ConstructorParameters<typeof IPythonCellComponent>[0]): string {
Line   36: 	return stripAnsi(new IPythonCellComponent(state).render(80).join("\n"));
Line   39: describe("IPythonCellComponent diff rendering", () => {
Line  100: 		const lines = new IPythonCellComponent({
Line  175: 		const root = mkdtempSync(join(tmpdir(), "ipython-cell-diff-symlink-"));
Line  203: 		const lines = new IPythonCellComponent({
Line  222: 		const lines = new IPythonCellComponent({
Line  237: 		const lines = new IPythonCellComponent({
Line  259: 		const lines = new IPythonCellComponent({
Line  278: 			new IPythonCellComponent({
Line  396: 		const collapsed = new IPythonCellComponent({ ...state, expanded: false }).render(80);
Line  397: 		const expanded = new IPythonCellComponent({ ...state, expanded: true }).render(80);
Line  427: 			const lines = new IPythonCellComponent({
```

### [packages/coding-agent/test/ipython-cell-wrap.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/ipython-cell-wrap.test.ts) (8 matches)

```text
Line    3: import { IPythonCellComponent } from "../src/modes/interactive/components/ipython-cell.js";
Line    6: type CellState = ConstructorParameters<typeof IPythonCellComponent>[0];
Line   50: describe("IPythonCellComponent wrapping", () => {
Line   57: 			const lines = new IPythonCellComponent(WRAPPING_STATE).render(width);
Line   65: 			const lines = new IPythonCellComponent(WRAPPING_STATE).render(width);
Line   74: 		const resized = new IPythonCellComponent(WRAPPING_STATE);
Line   79: 		const fresh = new IPythonCellComponent(WRAPPING_STATE).render(34);
Line   84: 		const lines = new IPythonCellComponent(WRAPPING_STATE).render(100);
```

### [packages/coding-agent/test/ipython-provisioner.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/ipython-provisioner.test.ts) (27 matches)

```text
Line   14: import { createIpythonToolDefinition, IpythonKernelProvisioner } from "../src/core/tools/ipython.js";
Line  119: describe("IpythonKernelProvisioner", () => {
Line  136: 		const provisioner = new IpythonKernelProvisioner(tempDir, { python, snapshotDir });
Line  150: 		const provisioner = new IpythonKernelProvisioner(tempDir, { python });
Line  160: 		const provisioner = new IpythonKernelProvisioner(tempDir, { python });
Line  169: 		const provisioner = new IpythonKernelProvisioner(tempDir, { python });
Line  183: 		const provisioner = new IpythonKernelProvisioner(tempDir, { python });
Line  194: 		const provisioner = new IpythonKernelProvisioner(tempDir, { python });
Line  210: 		const provisioner = new IpythonKernelProvisioner(tempDir, { python, snapshotDir });
Line  222: 		const provisioner = new IpythonKernelProvisioner(tempDir, { python });
Line  236: 		const provisioner = new IpythonKernelProvisioner(tempDir, { python, readyGate: gate });
Line  251: 		const provisioner = new IpythonKernelProvisioner(tempDir, { python, readyGate: gate });
Line  270: 		const provisioner = new IpythonKernelProvisioner(tempDir, { python, readyGate: gate });
Line  282: 		const provisioner = new IpythonKernelProvisioner(tempDir, {});
Line  288: 		const provisioner = new IpythonKernelProvisioner(tempDir, {});
Line  309: 	function primeKernelMemo(provisioner: IpythonKernelProvisioner, manager: KernelClient) {
Line  318: 		const provisioner = new IpythonKernelProvisioner(tempDir, { python });
Line  327: 		const provisioner = new IpythonKernelProvisioner(tempDir, {});
Line  337: 		const provisioner = new IpythonKernelProvisioner(tempDir, {});
Line  366: 		const provisioner = { ensure, kill } as unknown as IpythonKernelProvisioner;
Line  367: 		const tool = createIpythonToolDefinition(tempDir, { provisioner });
Line  383: 		const provisioner = { ensure, kill } as unknown as IpythonKernelProvisioner;
Line  386: 		const tool = createIpythonToolDefinition(tempDir, { provisioner });
Line  416: 		const provisioner = { ensure, kill } as unknown as IpythonKernelProvisioner;
Line  419: 		const tool = createIpythonToolDefinition(tempDir, { provisioner });
Line  426: 		expect(text).toContain("<ipython_kernel_reset>");
Line  438: 		const provisioner = new IpythonKernelProvisioner(tempDir, { snapshotDir });
```

### [packages/coding-agent/test/kernel-agent-message-skill.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/kernel-agent-message-skill.test.ts) (8 matches)

```text
Line    8: import { IpythonKernelProvisioner } from "../src/core/tools/ipython.js";
Line   30: 	let provisioner: IpythonKernelProvisioner | undefined;
Line   45: 		provisioner = new IpythonKernelProvisioner(tempDir, {
Line  118: 		provisioner = new IpythonKernelProvisioner(tempDir, {
Line  163: 		provisioner = new IpythonKernelProvisioner(tempDir, {
Line  184: 		provisioner = new IpythonKernelProvisioner(tempDir, {
Line  207: 		provisioner = new IpythonKernelProvisioner(tempDir, {
Line  228: 		provisioner = new IpythonKernelProvisioner(tempDir, {
```

### [packages/coding-agent/test/kernel-agent-observe-skill.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/kernel-agent-observe-skill.test.ts) (4 matches)

```text
Line    7: import { IpythonKernelProvisioner } from "../src/core/tools/ipython.js";
Line   21: 	let provisioner: IpythonKernelProvisioner | undefined;
Line   36: 		provisioner = new IpythonKernelProvisioner(tempDir, {
Line   94: 		provisioner = new IpythonKernelProvisioner(tempDir, {
```

### [packages/coding-agent/test/kernel-attach-image-skill.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/kernel-attach-image-skill.test.ts) (11 matches)

```text
Line    7: import { IpythonKernelProvisioner, imageBlocksFromAttachments } from "../src/core/tools/ipython.js";
Line   23: 	let provisioner: IpythonKernelProvisioner | undefined;
Line   40: 		provisioner = new IpythonKernelProvisioner(tempDir, {
Line   63: 		provisioner = new IpythonKernelProvisioner(tempDir, {
Line   88: 		provisioner = new IpythonKernelProvisioner(tempDir, {
Line  113: 		provisioner = new IpythonKernelProvisioner(tempDir, {
Line  140: 		provisioner = new IpythonKernelProvisioner(tempDir, {
Line  178: 		provisioner = new IpythonKernelProvisioner(tempDir, {
Line  215: 		provisioner = new IpythonKernelProvisioner(tempDir, {
Line  242: 		provisioner = new IpythonKernelProvisioner(tempDir, {
Line  263: 		provisioner = new IpythonKernelProvisioner(tempDir, { pythonSkills: [] });
```

### [packages/coding-agent/test/kernel-goal-skill.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/kernel-goal-skill.test.ts) (5 matches)

```text
Line    7: import { IpythonKernelProvisioner } from "../src/core/tools/ipython.js";
Line   21: 	let provisioner: IpythonKernelProvisioner | undefined;
Line   36: 		provisioner = new IpythonKernelProvisioner(tempDir, {
Line   86: 		provisioner = new IpythonKernelProvisioner(tempDir, {
Line  128: 		provisioner = new IpythonKernelProvisioner(tempDir, {
```

### [packages/coding-agent/test/kernel-rlm-heartbeat-skill.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/kernel-rlm-heartbeat-skill.test.ts) (5 matches)

```text
Line    7: import { IpythonKernelProvisioner } from "../src/core/tools/ipython.js";
Line   21: 	let provisioner: IpythonKernelProvisioner | undefined;
Line   36: 		provisioner = new IpythonKernelProvisioner(tempDir, {
Line  132: 		provisioner = new IpythonKernelProvisioner(tempDir, {
Line  152: 		provisioner = new IpythonKernelProvisioner(tempDir, {
```

### [packages/coding-agent/test/main-interactive-routing.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/main-interactive-routing.test.ts) (2 matches)

```text
Line  362: 				tools: ["ipython"],
Line  375: 			tools: ["ipython"],
```

### [packages/coding-agent/test/marquee-components.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/marquee-components.test.ts) (31 matches)

```text
Line    8: import { IPythonCellComponent, type IPythonCellState } from "../src/modes/interactive/components/ipython-cell.js";
Line   75: 	test("renders ipython cells with shell magic and collapsed traceback", async () => {
Line   76: 		const state: IPythonCellState = {
Line   91: 		const component = new IPythonCellComponent(state);
Line  100: 		expect(collapsed).not.toContain("ipython");
Line  115: 	test("renders structured ipython bash errors with traceback details collapsed", async () => {
Line  119: 			"----> 1 get_ipython().run_cell_magic('bash', '', 'cat /tmp/missing-file\\n')",
Line  122: 		const state: IPythonCellState = {
Line  146: 		const component = new IPythonCellComponent(state);
Line  154: 		expect(collapsed).not.toContain("get_ipython().run_cell_magic");
Line  159: 		expect(expanded).toContain("get_ipython().run_cell_magic");
Line  163: 	test("keeps ipython stack frame locations out of collapsed traceback previews", () => {
Line  164: 		const state: IPythonCellState = {
Line  182: 		const component = new IPythonCellComponent(state);
Line  191: 	test("caches ipython cell renders until state, width, or invalidation changes", () => {
Line  192: 		const state: IPythonCellState = {
Line  199: 		const component = new IPythonCellComponent(state);
Line  217: 	test("collapses long ipython input until tool expansion is enabled", () => {
Line  219: 		const state: IPythonCellState = {
Line  227: 		const component = new IPythonCellComponent(state);
Line  241: 	test("shows one expand hint when ipython input and output are both collapsed", () => {
Line  244: 		const component = new IPythonCellComponent({
Line  258: 	test("reflows cached ipython cells when terminal width changes", () => {
Line  259: 		const state: IPythonCellState = {
Line  272: 		const component = new IPythonCellComponent(state);
Line  289: 	test("invalidates ipython cell cache when expanded state changes", () => {
Line  290: 		const state: IPythonCellState = {
Line  304: 		const component = new IPythonCellComponent(state);
Line  403: 	test("routes built-in ipython tool rows through the cell renderer", () => {
Line  405: 			"ipython",
Line  426: 		expect(collapsed).not.toContain("ipython");
```

### [packages/coding-agent/test/repl-kernel-state-roundtrip.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/repl-kernel-state-roundtrip.test.ts) (10 matches)

```text
Line   95: 	it("restores a snapshot artifact containing IPython-injected blobs, skipping those names", async () => {
Line   96: 		// Synthesize the artifact shape an IPython-kernel snapshot writes: a dict of
Line   97: 		// dill blobs including In/Out/get_ipython entries.
Line   98: 		const ipythonArtifactDir = mkdtempSync(join(tmpdir(), "prime-agent-repl-ipython-artifact-"));
Line   99: 		const ipythonArtifactPath = join(ipythonArtifactDir, "kernel-state.dill");
Line  108: 			"    'get_ipython': dill.dumps(None),",
Line  110: 			`with open(${JSON.stringify(ipythonArtifactPath)}, "wb") as fh:`,
Line  118: 			cwd: ipythonArtifactDir,
Line  119: 			snapshot: { path: ipythonArtifactPath, manifestPath: join(ipythonArtifactDir, "kernel-state.json") },
Line  129: 			rmSync(ipythonArtifactDir, { recursive: true, force: true });
```

### [packages/coding-agent/test/sdk-session-manager.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/sdk-session-manager.test.ts) (4 matches)

```text
Line   77: 			tools: ["ipython"],
Line   83: 		const ipythonTool = session.agent.state.tools.find((tool) => tool.name === "ipython");
Line   84: 		expect(ipythonTool).toBeTruthy();
Line   85: 		const result = await ipythonTool!.execute("test", { code: "import os\nprint(os.getcwd())" });
```

### [packages/coding-agent/test/skills.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/skills.test.ts) (1 matches)

```text
Line  373: 			expect(introText).toContain("Use ipython to inspect a skill's file");
```

### [packages/coding-agent/test/suite/acp-features.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/suite/acp-features.test.ts) (7 matches)

```text
Line   87:  * Stand-in for the real IPython tool: the suite harness has no kernel, and this
Line   91: const ipythonTool = {
Line   92: 	name: "ipython",
Line  147: 	it("streams IPython execution as an execute tool call with its cell source", async () => {
Line  148: 		const harness = await createHarness({ tools: [ipythonTool as never] });
Line  150: 			fauxAssistantMessage([fauxToolCall("ipython", { code: "x = 41 + 1\nprint(x)" })], { stopReason: "toolUse" }),
Line  164: 		expect(cell, "IPython must surface as an ACP execute tool call").toBeDefined();
```

### [packages/coding-agent/test/suite/agent-session-compaction-continuation.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/suite/agent-session-compaction-continuation.test.ts) (9 matches)

```text
Line   58: /** Faux ipython tool that services goal.* host requests like the real kernel bridge. */
Line   59: function createFauxIpythonTool(sessionRef: { current?: AgentSession }) {
Line   61: 		name: "ipython",
Line   62: 		label: "ipython",
Line  278: 			tools: [createFauxIpythonTool(sessionRef)],
Line  303: 			fauxAssistantMessage(fauxToolCall("ipython", { code: "goal.complete" }), { stopReason: "toolUse" }),
Line  325: 			tools: [createFauxIpythonTool(sessionRef)],
Line  349: 			tools: [createFauxIpythonTool(sessionRef)],
Line  384: 			tools: [createFauxIpythonTool(sessionRef)],
```

### [packages/coding-agent/test/suite/agent-session-compaction.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/suite/agent-session-compaction.test.ts) (5 matches)

```text
Line  106: 		const internals = harness.session as unknown as { _ipythonKernelProvisioner?: unknown };
Line  107: 		const previousProvisioner = internals._ipythonKernelProvisioner;
Line  108: 		internals._ipythonKernelProvisioner = {
Line  117: 			internals._ipythonKernelProvisioner = previousProvisioner;
Line  129: 				customType: "ipython_state",
```

### [packages/coding-agent/test/suite/agent-session-goal.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/suite/agent-session-goal.test.ts) (29 matches)

```text
Line   62:  * Stand-in for the real ipython tool. Goal calls reach the host over the
Line   63:  * kernel comm bridge while an ipython cell executes; this stub mirrors that
Line   69: function createFauxIpythonTool(sessionRef: { current?: AgentSession }): AgentTool {
Line   71: 		name: "ipython",
Line   72: 		label: "ipython",
Line  158: 		const harness = await createHarness({ tools: [createFauxIpythonTool(sessionRef), ...extraTools] });
Line  164: 	it("keeps continuing until the model completes the goal through ipython", async () => {
Line  169: 			fauxAssistantMessage(fauxToolCall("ipython", COMPLETE_GOAL_CELL), { stopReason: "toolUse" }),
Line  195: 				fauxAssistantMessage(fauxToolCall("ipython", COMPLETE_GOAL_CELL), { stopReason: "toolUse" }),
Line  218: 				fauxAssistantMessage(fauxToolCall("ipython", COMPLETE_GOAL_CELL), { stopReason: "toolUse" }),
Line  319: 	it("activates ipython when a slash goal starts from an inactive tool set", async () => {
Line  323: 			fauxAssistantMessage(fauxToolCall("ipython", COMPLETE_GOAL_CELL), { stopReason: "toolUse" }),
Line  329: 		expect(harness.session.getActiveToolNames()).toEqual(["ipython"]);
Line  336: 	it("adds ipython to the live continuation context when inactive at run start", async () => {
Line  342: 			fauxAssistantMessage(fauxToolCall("ipython", COMPLETE_GOAL_CELL), { stopReason: "toolUse" }),
Line  349: 		expect(harness.session.getActiveToolNames()).toEqual(["ipython"]);
Line  358: 		expect(harness.session.getActiveToolNames()).toEqual(["ipython"]);
Line  366: 	it("keeps ipython active on active-goal runtime rebuild", async () => {
Line  372: 		expect(harness.session.getActiveToolNames()).toEqual(["ipython"]);
Line  396: 			fauxAssistantMessage(fauxToolCall("ipython", COMPLETE_GOAL_CELL), { stopReason: "toolUse" }),
Line  411: 	it("lets the model create a persistent goal through ipython", async () => {
Line  415: 				fauxToolCall("ipython", { code: 'goal.create {"objective": "write a benchmark note"}' }),
Line  421: 			fauxAssistantMessage(fauxToolCall("ipython", COMPLETE_GOAL_CELL), { stopReason: "toolUse" }),
Line  448: 			fauxAssistantMessage(fauxToolCall("ipython", COMPLETE_GOAL_CELL), { stopReason: "toolUse" }),
Line  487: 			fauxAssistantMessage(fauxToolCall("ipython", COMPLETE_GOAL_CELL), { stopReason: "toolUse" }),
Line  567: 			fauxAssistantMessage(fauxToolCall("ipython", COMPLETE_GOAL_CELL), { stopReason: "toolUse" }),
Line  582: 			fauxAssistantMessage(fauxToolCall("ipython", COMPLETE_GOAL_CELL), { stopReason: "toolUse" }),
Line  675: 				fauxAssistantMessage(fauxToolCall("ipython", COMPLETE_GOAL_CELL), { stopReason: "toolUse" }),
Line  849: 			fauxAssistantMessage(fauxToolCall("ipython", COMPLETE_GOAL_CELL), { stopReason: "toolUse" }),
```

### [packages/coding-agent/test/suite/agent-session-serialized-refine.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/suite/agent-session-serialized-refine.test.ts) (1 matches)

```text
Line 2095: 		const toolUseAssistant = fauxAssistantMessage([fauxToolCall("ipython", { code: "await refine.run()" })], {
```

### [packages/coding-agent/test/suite/regressions/2002-acp-mcp-native-tools.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/suite/regressions/2002-acp-mcp-native-tools.test.ts) (3 matches)

```text
Line    6: import type { IpythonKernelProvisioner } from "../../../src/core/tools/ipython.js";
Line   14: 		provisioner: { ensure } as unknown as IpythonKernelProvisioner,
Line   72: 		} as unknown as IpythonKernelProvisioner);
```

### [packages/coding-agent/test/suite/regressions/2053-background-bash-passivation.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/suite/regressions/2053-background-bash-passivation.test.ts) (4 matches)

```text
Line   14: import { IpythonKernelProvisioner } from "../../../src/core/tools/ipython.js";
Line   22: 	_ipythonKernelProvisioner?: IpythonKernelProvisioner;
Line   77: 		const provisioner = new IpythonKernelProvisioner(harness.tempDir);
Line   79: 		internals._ipythonKernelProvisioner = provisioner;
```

### [packages/coding-agent/test/suite/regressions/2835-tools-allowlist-filters-extension-tools.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/suite/regressions/2835-tools-allowlist-filters-extension-tools.test.ts) (4 matches)

```text
Line   69: 		const session = await createSession(["ipython", "dynamic_tool"]);
Line   76: 		).toEqual(["dynamic_tool", "ipython"]);
Line   77: 		expect(session.getActiveToolNames().sort()).toEqual(["dynamic_tool", "ipython"]);
Line   78: 		expect(session.systemPrompt).not.toContain("- ipython:");
```

### [packages/coding-agent/test/suite/regressions/3592-no-builtin-tools-keeps-extension-tools.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/suite/regressions/3592-no-builtin-tools-keeps-extension-tools.test.ts) (3 matches)

```text
Line   81: 		).toEqual(["extension_tool", "ipython"]);
Line   84: 		expect(session.systemPrompt).not.toContain("- ipython:");
Line  117: 		expect(session.systemPrompt).not.toContain("- ipython:");
```

### [packages/coding-agent/test/suite/regressions/4167-thinking-toggle-pending-tool-render.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/suite/regressions/4167-thinking-toggle-pending-tool-render.test.ts) (4 matches)

```text
Line   35: 	ipythonToolComponents: Map<string, ToolExecutionComponent>;
Line   36: 	lateIpythonSentAgentMessages: Map<string, unknown[]>;
Line   74: 		ipythonToolComponents: new Map(),
Line   75: 		lateIpythonSentAgentMessages: new Map(),
```

### [packages/coding-agent/test/suite/regressions/4428-remove-legacy-pi-mono-tools.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/suite/regressions/4428-remove-legacy-pi-mono-tools.test.ts) (10 matches)

```text
Line   30: 	it("registers only ipython as a built-in tool", () => {
Line   31: 		expect(Object.keys(createAllToolDefinitions(process.cwd()))).toEqual(["ipython"]);
Line   35: 		const result = parseArgs(["--tools", "bash,edit,ipython"]);
Line   37: 		expect(result.tools).toEqual(["bash", "edit", "ipython"]);
Line  133: 			tools: ["ipython"],
Line  137: 			expect(session.getActiveToolNames()).toEqual(["ipython"]);
Line  138: 			const ipythonTool = session.agent.state.tools.find((tool) => tool.name === "ipython");
Line  139: 			expect(ipythonTool).toBeTruthy();
Line  142: 			const rejected = await ipythonTool!.execute("tool-0", { code: "%%bash\necho body" });
Line  151: 			const result = await ipythonTool!.execute("tool-1", {
```

### [packages/coding-agent/test/suite/regressions/4529-leading-newline-bash-cell.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/suite/regressions/4529-leading-newline-bash-cell.test.ts) (11 matches)

```text
Line    7: import { parseIpythonBashCell } from "../../../src/core/tools/ipython-cell-code.js";
Line   12: const ipythonTool: AgentTool = {
Line   13: 	name: "ipython",
Line   14: 	label: "ipython",
Line   15: 	description: "Execute a test IPython cell",
Line   36: 		expect(parseIpythonBashCell(" \r\n\t\r\n  %%bash --noprofile\r\necho ok")).toEqual({ body: "echo ok" });
Line   37: 		expect(parseIpythonBashCell("\nprint('python')")).toBeUndefined();
Line   42: 		harness = await createHarness({ tools: [ipythonTool] });
Line   44: 			fauxAssistantMessage(fauxToolCall("ipython", { code }), { stopReason: "toolUse" }),
Line   51: 		expect(start).toMatchObject({ toolName: "ipython", args: { code } });
Line   53: 			throw new Error("Expected an IPython tool call");
```

### [packages/coding-agent/test/suite/regressions/4530-ipython-state-restore-message.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/suite/regressions/4530-ipython-state-restore-message.test.ts) (13 matches)

```text
Line    8: 	IPYTHON_STATE_RESTORED_CUSTOM_TYPE,
Line    9: 	type IpythonStateRestoredDetails,
Line   19: 	_onIpythonStateRestored(result: RestoreResult): void;
Line   30: describe("ENG-4530 IPython state restore message", () => {
Line   82: 		(harness.session as unknown as StateRestoreHost)._onIpythonStateRestored({
Line  100: 			customType: IPYTHON_STATE_RESTORED_CUSTOM_TYPE,
Line  112: 				message.role === "custom" && message.customType === IPYTHON_STATE_RESTORED_CUSTOM_TYPE,
Line  115: 			throw new Error("Expected an injected IPython restore message");
Line  123: 		expect(render(component)).not.toContain("ipython_state_restored");
Line  132: 				customType: IPYTHON_STATE_RESTORED_CUSTOM_TYPE,
Line  158: 			expect.objectContaining({ customType: IPYTHON_STATE_RESTORED_CUSTOM_TYPE }),
Line  163: 		const message: CustomMessage<IpythonStateRestoredDetails> = {
Line  165: 			customType: IPYTHON_STATE_RESTORED_CUSTOM_TYPE,
```

### [packages/coding-agent/test/suite/regressions/4531-agent-message-ui.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/suite/regressions/4531-agent-message-ui.test.ts) (26 matches)

```text
Line   23: import { IPythonCellComponent } from "../../../src/modes/interactive/components/ipython-cell.js";
Line   55: 	_recordLateIpythonSentAgentMessage: (toolCallId: string, message: KernelSentAgentMessage) => void;
Line   57: 	_lateIpythonSentAgentMessages: Map<string, KernelSentAgentMessage[]>;
Line   58: 	_restoreLateIpythonSentAgentMessages: () => void;
Line  175: 			toolCallId: "ipython_4531",
Line  176: 			toolName: "ipython",
Line  183: 			fauxAssistantMessage(fauxToolCall("ipython", { code: "background_send" }), { stopReason: "toolUse" }),
Line  201: 		host._recordLateIpythonSentAgentMessage(toolResult.toolCallId, lateMessage);
Line  209: 				.some((entry) => entry.type === "custom" && entry.customType === "ipython_sent_agent_message"),
Line  211: 		expect(events).toContain("ipython_sent_agent_message");
Line  222: 		host._restoreLateIpythonSentAgentMessages();
Line  226: 		host._lateIpythonSentAgentMessages = new Map();
Line  227: 		host._restoreLateIpythonSentAgentMessages();
Line  230: 		host._lateIpythonSentAgentMessages.set("ipython_other_branch", [
Line  238: 		host._restoreLateIpythonSentAgentMessages();
Line  239: 		expect(host._lateIpythonSentAgentMessages.has("ipython_other_branch")).toBe(false);
Line  349: 		const toolCall = fauxAssistantMessage(fauxToolCall("ipython", { code: "print('ready')" }), {
Line  359: 		expect(isCompactAgentMessageNeighbor(new IPythonCellComponent({ code: "print('direct')" }))).toBe(true);
Line  403: 		addMessage(fauxAssistantMessage(fauxToolCall("ipython", { code: "print('live')" }), { stopReason: "toolUse" }));
Line  407: 			[fauxAssistantMessage(fauxToolCall("ipython", { code: "print('ready')" }), { stopReason: "toolUse" })],
Line  505: 		const component = new IPythonCellComponent({
Line  550: 		const component = new IPythonCellComponent({
Line  581: 		const component = new IPythonCellComponent({
Line  611: 		const component = new IPythonCellComponent({
Line  662: 			new IPythonCellComponent({ ...baseState, expanded: false, agentMessagesExpanded: true })
Line  671: 			new IPythonCellComponent({ ...baseState, expanded: true, agentMessagesExpanded: false })
```

### [packages/coding-agent/test/suite/regressions/4583-latest-tool-expand-hint.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/suite/regressions/4583-latest-tool-expand-hint.test.ts) (8 matches)

```text
Line   12: const ipythonTool: AgentTool = {
Line   13: 	name: "ipython",
Line   14: 	label: "ipython",
Line   15: 	description: "Execute a test IPython cell",
Line   36: 		harness = await createHarness({ tools: [ipythonTool] });
Line   40: 					fauxToolCall("ipython", { code: "1 + 1" }, { id: "tool-4583-a" }),
Line   41: 					fauxToolCall("ipython", { code: "2 + 2" }, { id: "tool-4583-b" }),
Line   45: 			fauxAssistantMessage(fauxToolCall("ipython", { code: "3 + 3" }, { id: "tool-4583-c" }), {
```

### [packages/coding-agent/test/suite/serialized-refine-config-integration.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/suite/serialized-refine-config-integration.test.ts) (3 matches)

```text
Line   23: 	_ipythonKernelProvisioner?: unknown;
Line  152: 		const initialProvisioner = internals._ipythonKernelProvisioner;
Line  164: 		expect(internals._ipythonKernelProvisioner).not.toBe(initialProvisioner);
```

### [packages/coding-agent/test/system-prompt.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/system-prompt.test.ts) (37 matches)

```text
Line    6: import { createIpythonToolDefinition } from "../src/core/tools/ipython.js";
Line   39: 	test("defaults omitted activeTools to ipython guidance", () => {
Line   56: 			activeTools: ["ipython"],
Line   66: 	test("only documents ipython shell prefixes when ipython is active", () => {
Line   77: 	test("keeps shell skill command guidance when ipython is inactive", () => {
Line   97: 			activeTools: ["ipython"],
Line  106: 			selectedTools: ["ipython"],
Line  118: 			activeTools: ["ipython"],
Line  128: 	test("does not prescribe kernel-only child replies without ipython", () => {
Line  145: 			activeTools: ["ipython"],
Line  151: 			activeTools: ["ipython"],
Line  162: 	test("documents the bash() orchestration contract when ipython is active", () => {
Line  166: 			activeTools: ["ipython"],
Line  174: 	test("documents preferring Python for reading and searching files when ipython is active", () => {
Line  178: 			activeTools: ["ipython"],
Line  191: 			activeTools: ["ipython"],
Line  202: 			activeTools: ["ipython"],
Line  211: 	test("adds generic MCP guidance to default and custom IPython prompts", () => {
Line  215: 				selectedTools: ["ipython"],
Line  327: 			selectedTools: ["ipython"],
Line  398: 			selectedTools: ["ipython"],
Line  413: 			selectedTools: ["ipython"],
Line  437: 	test("omits ipython-only subagent guidance when ipython is inactive", () => {
Line  557: 			selectedTools: ["ipython"],
Line  568: 		expect(prompt).not.toContain("# IPython Kernel Guidance");
Line  580: 			selectedTools: ["ipython"],
Line  593: 	test("gates custom-prompt child reply doctrine on IPython and agent messaging", () => {
Line  604: 		expect(build(["ipython"], [])).toContain("You are a child agent spawned by your parent agent");
Line  605: 		expect(build(["ipython"], [])).not.toContain("agent_message.send");
Line  611: 			selectedTools: ["ipython"],
Line  626: 			selectedTools: ["ipython"],
Line  638: 			selectedTools: ["ipython"],
Line  651: 	test("Python skills are configured for IPython and included in skill metadata", () => {
Line  653: 			selectedTools: ["ipython"],
Line  667: 			selectedTools: ["ipython", "dynamic_tool"],
Line  679: describe("createIpythonToolDefinition", () => {
Line  681: 		const tool = createIpythonToolDefinition("/repo");
```

### [packages/coding-agent/test/tool-execution-component.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/tool-execution-component.test.ts) (15 matches)

```text
Line  156: 		"keeps one visible IPython image row without emitting terminal graphics for %s capability",
Line  161: 					"ipython",
Line  162: 					`tool-ipython-image-${protocol}`,
Line  189: 	test("uses the compact fallback for a live IPython image in fullscreen", async () => {
Line  197: 				"ipython",
Line  198: 				"tool-ipython-image-fullscreen",
Line  828: 	test("does not add built-in edit stats to custom IPython renderers", () => {
Line  830: 			"ipython",
Line  831: 			"custom-ipython",
Line  835: 				...createBaseToolDefinition("ipython"),
Line  836: 				renderCall: () => new Text("custom ipython", 0, 0),
Line  848: 		expect(rendered).toContain("custom ipython");
Line  852: 	test("globally expands built-in IPython source associated with diffs", () => {
Line  854: 			"ipython",
Line  855: 			"tool-ipython-edit",
```

### [packages/coding-agent/test/tree-selector.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/tree-selector.test.ts) (1 matches)

```text
Line   71: 				{ type: "toolCall", id: `tc-${id}`, name: "ipython", arguments: { code: "open('test.ts').read()" } },
```

### [packages/coding-agent/test/utilities.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/utilities.ts) (2 matches)

```text
Line   21: import { createIpythonTool } from "../src/index.js";
Line  246: 			tools: [createIpythonTool(process.cwd())],
```

### [packages/coding-agent/test/working-icon-animation.test.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/test/working-icon-animation.test.ts) (4 matches)

```text
Line    2: import { IPythonCellComponent } from "../src/modes/interactive/components/ipython-cell.js";
Line   24: describe("IPythonCellComponent running marker", () => {
Line   30: 		const running = new IPythonCellComponent({ code: "print(1)", executionStarted: true, isPartial: true });
Line   39: 		const done = new IPythonCellComponent({
```

## Examples (`packages/coding-agent/examples/`) (10 files, 26 matches)

### [packages/coding-agent/examples/extensions/claude-rules.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/examples/extensions/claude-rules.ts) (2 matches)

```text
Line    5:  * in the system prompt. The agent can then use ipython to load
Line   82: When working on tasks related to these rules, use ipython to load the relevant rule files for guidance.
```

### [packages/coding-agent/examples/extensions/plan-mode/index.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/examples/extensions/plan-mode/index.ts) (2 matches)

```text
Line   23: const NORMAL_MODE_TOOLS = ["ipython", "bash", "edit"];
Line  169: - You CANNOT use: ipython or edit (file modifications are disabled)
```

### [packages/coding-agent/examples/extensions/preset.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/examples/extensions/preset.ts) (3 matches)

```text
Line   26:  *     "tools": ["ipython", "bash", "edit"],
Line  278: 				pi.setActiveTools(["ipython"]);
Line  331: 				pi.setActiveTools(["ipython"]);
```

### [packages/coding-agent/examples/extensions/prompt-customizer.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/examples/extensions/prompt-customizer.ts) (2 matches)

```text
Line   27: 	if (hasTool("ipython")) {
Line   29: 			"• Use the `ipython` tool for Python execution, file access, data inspection, and shell subprocesses.",
```

### [packages/coding-agent/examples/extensions/subagent/README.md](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/examples/extensions/subagent/README.md) (3 matches)

```text
Line   63: **Project-local agents** (`.prime/agent/agents/*.md`) are repo-controlled prompts that can instruct the model to run IPython, shell commands, and other tools.
Line   85: Use a chain: first have scout find the ipython tool, then have planner suggest improvements
Line  123: - `ipython code` for ipython
```

### [packages/coding-agent/examples/extensions/subagent/index.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/examples/extensions/subagent/index.ts) (2 matches)

```text
Line   75: 		case "ipython": {
Line   79: 				themeFg("muted", "ipython ") +
```

### [packages/coding-agent/examples/extensions/truncated-tool.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/examples/extensions/truncated-tool.ts) (1 matches)

```text
Line  181: 						text += `\n${theme.fg("muted", "... (use ipython to see full output)")}`;
```

### [packages/coding-agent/examples/sdk/05-tools.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/examples/sdk/05-tools.ts) (6 matches)

```text
Line   17: 	tools: ["ipython"],
Line   20: console.log("IPython session created");
Line   24: 	tools: ["ipython"],
Line   27: console.log("Explicit IPython session created");
Line   33: 	tools: ["ipython"],
Line   41: 	tools: ["ipython"],
```

### [packages/coding-agent/examples/sdk/12-full-control.ts](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/examples/sdk/12-full-control.ts) (2 matches)

```text
Line   47: Available: ipython. Be concise.`,
Line   61: 	tools: ["ipython"],
```

### [packages/coding-agent/examples/sdk/README.md](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/examples/sdk/README.md) (3 matches)

```text
Line   68: const { session } = await createAgentSession({ tools: ["ipython"], authStorage, modelRegistry });
Line   96:   tools: ["ipython"],
Line  121: | `tools` | `["ipython"]` | Built-in tools |
```

## Documentation (`docs/`, `doc/`, `README.md`) (12 files, 129 matches)

### [doc/tooling-system.puml](file:///home/jeff/code/fork/prime-agent/doc/tooling-system.puml) (20 matches)

```text
Line   33:     component "ipython tool\ncore/tools/ipython.ts" as ipython
Line   34:     component "IpythonKernelProvisioner" as provisioner
Line   73: session --> ipython : createAllToolDefinitions()
Line   74: ipython --> provisioner : execute Python source
Line  117: @startuml tooling-system-ipython-rlm
Line  129: participant "ipython AgentTool\ncore/tools/ipython.ts" as ipython
Line  130: participant "IpythonKernelProvisioner" as provisioner
Line  138: == Normal ipython call ==
Line  139: model -> loop : tool call: ipython(code)
Line  141: session -> ipython : AgentTool.execute(...)
Line  142: ipython -> provisioner : executeWithBusyKernelChoice(code)
Line  146: manager --> ipython : ExecuteResult
Line  147: ipython --> session : AgentToolResult
Line  151: == RLM delegation nested inside ipython ==
Line  152: model -> loop : ipython(await rlm(prompt))
Line  153: loop -> session : resolve ipython
Line  154: session -> ipython : execute Python cell
Line  155: ipython -> provisioner : submit cell
Line  167: manager --> ipython : ExecuteResult
Line  168: ipython --> loop : handle in AgentToolResult
```

### [doc/tooling-system.txt](file:///home/jeff/code/fork/prime-agent/doc/tooling-system.txt) (25 matches)

```text
Line   36:                          |  Python in an ipython call   |
Line   63: |                                           | ipython is the RLM bridge   |
Line   66: |                              | core/tools/ipython.ts    |               |
Line   67: |                              | createIpythonTool...     |               |
Line  120: `ipython` definition.  The tools directory still contains factories and helpers
Line  129:   | e.g. ipython.ts             |
Line  243: For ordinary non-ipython tools, execution can end at the tool's own
Line  244: implementation.  For ipython, execution continues into the kernel path below.
Line  247: 4. NORMAL IPYTHON EXECUTION
Line  252:     | calls AgentTool "ipython" with Python source
Line  255:   | createIpythonToolDefinition()            |
Line  257:   | ipython.ts                               |
Line  263:   | IpythonKernelProvisioner                 |
Line  291:   | ipython tool execute()                   |
Line  303: 5. RLM DELEGATION INSIDE IPYTHON
Line  306: A call to await rlm(...) is nested inside the ipython execution path.  It is
Line  312:        | ipython code: await rlm("review the API")
Line  315:   | ipython AgentTool           |
Line  357:   | ipython result to parent    |
Line  385:               | child can use ipython/RLM      |
Line  465:   core/tools/ipython.ts                            ipython AgentTool definition,
Line  503:     * the ipython boundary exposed to the parent model.
Line  520:   first ipython use
Line  569:     file-mutation-queue.ts, index.ts, ipython-cell-code.ts, ipython.ts,
Line  602:     rejected: local source/dependencies contain no ZMQ, Jupyter, IPython
```

### [packages/coding-agent/CHANGELOG.md](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/CHANGELOG.md) (54 matches)

```text
Line   81: - Fixed background (unattributed) kernel output missing from the expanded IPython cell view: it is now surfaced in the tool details and rendered under a "background output (unattributed)" label after stdout/stderr/result.
Line   85: - Addressed REPL host-swap review findings: reworded stale IPython-specific busy/restart messages for the default kernel and stopped `restart()` from resurrecting a concurrently killed REPL kernel.
Line  120: - Removed unused host-request capability helpers and the `kernelManagerRef` option from `IpythonToolOptions`.
Line  158: - Collapsed ipython cells that call the bash skill with a literal command now preview as `bash · <command>` instead of the python wrapper.
Line  186: - Fixed first IPython calls after an upgrade failing with a raw "Operation was not possible or timed out": kernel startup now tolerates cold venv boots (30s budget; crashes still fail fast via the exit handler), and zmq socket-teardown rejections surface as actionable retriable kernel errors.
Line  198: - Fixed IPython kernels and forkserver processes outliving their owner after a hard crash: kernels now arm ipykernel's parent-death poller via JPY_PARENT_PID, the forkserver watches its parent pid, and both pids are registered in the orphan process journal for supervisor recovery.
Line  199: - Fixed a pid-reuse race for forked IPython kernels: signaling and liveness now go through the forkserver (the kernels' parent) instead of raw pid operations from Node, and the orphan journal's inactive record is only written on a confirmed kill outcome.
Line  214: - Fixed large IPython variables repeatedly slowing later turns by excluding them from persistent snapshots and removing them when context is compacted.
Line  254: - Changed sent agent messages in the IPython cell UI to show only the message text with a `╰─` gutter when expanded, matching received messages, and hid the raw `agent_message.send` receipt dictionary.
Line  305: - Added `--mode acp`: Prime Agent now runs as an [Agent Client Protocol](https://agentclientprotocol.com) agent over NDJSON on stdio, driving an `AgentConnection` in-process. IPython surfaces as an ACP `execute` tool call carrying its cell source, and capabilities ACP has no native concept for (subagents, autonomous gate state, rich IPython output, compaction, goals, heartbeats, continual-harness refinement) travel in a namespaced `ai.primeintellect.prime-agent` `_meta` envelope that vanilla ACP clients ignore. Documented in `docs/acp.md`.
Line  376: - Changed collapsed edit and IPython calls to show compact per-file line-change summaries while retaining full expanded diffs.
Line  386: - Fixed IPython tracebacks emitting ANSI color codes.
Line  401: - Changed the IPython cell queued marker from `▸` to `◇` to match the subagent and context-tree status icons.
Line  405: - Added agent-callable `refine` skill so the model can schedule continual harness refinement from IPython via `await refine.run()` without blocking the current turn ([#504](https://github.com/PrimeIntellect-ai/prime-agent/pull/504) by [@sethkarten](https://github.com/sethkarten)).
Line  455: - Changed edit tool calls to always show full diffs while keeping IPython source collapsed until Ctrl+O expands it.
Line  457: - Changed IPython kernels to set `NO_COLOR=1`, preventing ANSI color escapes from inflating `%%bash` output.
Line  462: - Fixed IPython edit diffs replacing syntax highlighting with a single foreground color ([ENG-4616](https://linear.app/primeintellect/issue/ENG-4616/syntax-highlighting-is-overridden-in-diff-view)).
Line  494: - Fixed IPython state restore notices rendering as full user messages when prompts were queued or restored ([ENG-4530](https://linear.app/primeintellect/issue/ENG-4530/collapse-ipython-state-restore-messages-in-chat-tui)).
Line  505: - Fixed IPython Bash cells with leading blank lines being labeled and previewed as Python ([ENG-4529](https://linear.app/primeintellect/issue/ENG-4529/leading-newline-before-percentpercentbash-names-tool-call-as-python)).
Line  529: - Fixed Ctrl+C canceling the active turn, bash command, and IPython kernel execution deterministically, with a compact recovery prompt and model-visible reset notice when an interrupted IPython cell keeps running ([ENG-4490](https://linear.app/primeintellect/issue/ENG-4490)).
Line  544: - Removed the legacy pi-mono `bash` and `edit` built-in tools; use IPython `%%bash` cells and the Python `edit` skill instead.
Line  560: - Fixed parallel subagent guidance failing on first use by pre-importing `asyncio` in the IPython kernel bootstrap ([#315](https://github.com/PrimeIntellect-ai/prime-agent/pull/315)).
Line  568: - Fixed IPython and bash tool calls failing for the rest of a run after a session was rebuilt, by rebinding built-in tools to the live runtime at call time ([#299](https://github.com/PrimeIntellect-ai/prime-agent/issues/299)).
Line  570: - Fixed a large subagent fan-out spawning every IPython kernel at once and starving the machine, by bounding concurrent kernel boots (default `min(16, 2*cores)`, override with `PRIME_AGENT_MAX_CONCURRENT_KERNEL_BOOTS`) ([#294](https://github.com/PrimeIntellect-ai/prime-agent/issues/294)).
Line  580: - Changed the IPython kernel to stay alive across compaction: variables, imports, and helpers the agent defined are no longer wiped, and the model is instead told which names remain defined ([#267](https://github.com/PrimeIntellect-ai/prime-agent/issues/267)).
Line  584: - Changed `Ctrl+O` on IPython and bash cells to keep the same summary line in place and just attach the full code and output beneath it (aligned under the code gutter), instead of restructuring the block on expand ([#288](https://github.com/PrimeIntellect-ai/prime-agent/issues/288)).
Line  599: - Changed the collapsed bash and IPython tool previews to pick the most informative line via a shared heuristic, skipping low-signal setup lines and redacting long blobs and secret-looking values ([#248](https://github.com/PrimeIntellect-ai/prime-agent/issues/248)).
Line  618: - Added edit diffs to the collapsed IPython view, rendering file edits as a wrapped, full-width relative-path diff prefixed with the cell status marker.
Line  678: - Changed collapsed IPython tool calls in the TUI to render as a single-line summary instead of a multi-line block.
Line  695: - Fixed IPython kernel state being lost across session resume: kernel variables are now snapshotted under session-artifacts, restored on resume, deleted with the session, and dropped on compaction.
Line  703: - Added rich syntax-aware diff rendering for IPython file edits in the TUI: the `edit` Python skill emits structured edit results that the interactive view renders as a colored, full-width unified diff inside the cell.
Line  704: - Added a subagent spawn-program panel to Agents View: expand a subagent group and press `Ctrl+O` to toggle a panel showing the IPython cell that called `rlm.run` to spawn them.
Line  709: - Moved goals out of the harness tool surface into a bundled `goal` Python skill (`goal.get` / `goal.create` / `goal.complete`) backed by session state; the only built-in tool is now `ipython`, and the `rlm.run` comm channel is generalized into a typed host bridge.
Line  710: - Changed the RLM system prompt to prefer Python for reading and searching files, porting the IPython guidance from rlm-harness.
Line  728: - Changed the IPython control prompt to require `%%bash` as the first line of a shell cell to match the rlm-harness.
Line  788: - Changed the IPython system prompt section to use the upstream rlm-harness IPYTHON_CONTROL_PROMPT: IPython is framed as a persistent control environment, not the target project's runtime. Shell commands should use `%%bash` cells instead of `!cmd` escapes. The agent should not install dependencies into the IPython kernel but use the project's own environment instead.
Line  793: - Fixed confusing transcript formatting around thinking blocks and tool calls: ipython cells and default-shell tools (bash and extension tools) now share one panel style with a subtle neutral background instead of a status-colored box or a left rail, and tool status headers name the tool (`python · done · 7ms`, `bash · running`) so they no longer read as floating labels for the preceding thinking block. Themes gain a required `toolPanelBg` color for the panel background.
Line  802: - Fixed multi-line IPython, assistant, and child-agent errors to collapse internal tracebacks by default while preserving full details on expand.
Line  804: - Fixed the release installer to ask before bootstrapping the IPython kernel runtime during install, avoiding default first-run `uv` prompts inside the TUI.
Line  810: - Removed the interactive `!` / `!!` bash shortcuts; use IPython for shell commands.
Line  822: - Changed the IPython system prompt to the upstream rlm-harness `IPYTHON_CONTROL_PROMPT`: IPython is framed as a persistent control environment rather than the target project's runtime, shell commands use `%%bash` cells instead of `!cmd`, and project imports, tests, and dependency checks run through the project's own environment. Removed the `.venv` interpreter hint.
Line  829: - Fixed IPython kernel startup to avoid blocking the session, cancelling child RLM runs on session abort and reporting bootstrap progress through a start-options handler.
Line  850: - Fixed the release installer to ask before bootstrapping the IPython kernel runtime during install (defaulting to bootstrap when no terminal is detected) and to avoid stalling on an interactive `uv` prompt.
Line  857: - Added Python-backed skills that install into the persistent IPython kernel and are exposed alongside markdown skills.
Line  917: - Added a persistent `ipython` tool backed by a Jupyter kernel so Python variables and imports survive across tool calls.
Line  918: - Added the RLM harness system prompt and `prime-agent-runtime` bridge so IPython code can call `rlm.run` to spawn recursive child agent sessions.
Line  919: - Added automatic IPython runtime bootstrap with uv-managed Python, `ipykernel`, and `prime-agent-runtime`.
Line  929: - Changed the default active built-in tool set to `ipython`.
Line  930: - Changed compaction to restart the active IPython kernel so summarized sessions release in-memory Python state.
Line  932: - Changed completed IPython cell rendering to use width/version-aware caching, reducing TUI redraw lag in long sessions.
Line  933: - Changed collapsed IPython cells to show compact input and output previews with a single expansion hint.
Line  936: - Changed IPython prompt guidance to prefer `!cmd` and `%%bash` for shell commands.
Line  943: - Fixed IPython kernel startup to let `ipykernel` bind OS-assigned ports instead of randomly selecting fixed ports.
Line  961: - Initial Prime Agent release, forked from pi-mono: a persistent `ipython` tool backed by a Jupyter kernel as the default tool set, recursive RLM subagents via `rlm.run`, `/goal` for long-running objectives, an auto-bootstrapped uv-managed kernel runtime, Prime-branded TUI, and an R2-backed tarball release pipeline with a pi-style installer.
```

### [packages/coding-agent/README.md](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/README.md) (4 matches)

```text
Line   69: Then just talk to Prime Agent. By default, Prime Agent gives the model one tool: `ipython`. The model uses the persistent kernel to read files, run commands, edit code, and inspect data. Add capabilities via [skills](#skills), [prompt templates](#prompt-templates), [extensions](#extensions), or [Prime Agent packages](#prime-agent-packages).
Line  296: On-demand capability packages following the [Agent Skills standard](https://agentskills.io). At startup, Prime Agent gives the model each visible skill's name, type, description, and location. The full `SKILL.md` stays out of context until the model inspects it with `ipython` or you explicitly invoke `/skill:name`.
Line  583: Available built-in tools: `ipython`
Line  663: prime-agent --tools ipython -p "Review the code"
```

### [packages/coding-agent/docs/compaction.md](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/docs/compaction.md) (3 matches)

```text
Line  262: [Assistant tool calls]: ipython(code="open('foo.ts').read()"); edit(path="bar.ts", ...)
Line  268: Tool results are truncated to 2000 characters during serialization. Content beyond that limit is replaced with a marker indicating how many characters were truncated. This keeps summarization requests within reasonable token budgets, since tool results, especially from `ipython` and optional `bash`, are typically the largest contributors to context size.
Line  326:   // [Assistant tool calls]: ipython(code="open('...').read()"); bash(command="...")
```

### [packages/coding-agent/docs/extensions.md](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/docs/extensions.md) (7 matches)

```text
Line  728:   // event.toolName - "ipython", "bash", "edit", etc.
Line  742:   if (isToolCallEventType("ipython", event)) {
Line 1526: //   name: "ipython",
Line 1529: //   sourceInfo: { path: "<builtin:ipython>", source: "builtin", scope: "temporary", origin: "top-level" }
Line 1861: Extensions can override built-in tools (`ipython`, `bash`, `edit`) by registering a tool with the same name. Interactive mode displays a warning when this happens.
Line 1864: # Extension's ipython tool replaces built-in ipython
Line 1883: - [ipython.ts](https://github.com/PrimeIntellect-ai/prime-agent/blob/main/packages/coding-agent/src/core/tools/ipython.ts) - `IpythonToolDetails`
```

### [packages/coding-agent/docs/quickstart.md](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/docs/quickstart.md) (1 matches)

```text
Line   74: Prime Agent gives the model one built-in tool, `ipython`. The long-lived kernel is a control environment for reading and editing files, running project commands, inspecting data, retaining Python state, and invoking installed skills. The kernel runtime is bootstrapped automatically on first use; set `PRIME_AGENT_KERNEL_PYTHON` to use an existing Python environment with `prime-agent-runtime`.
```

### [packages/coding-agent/docs/rlm-runtime.md](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/docs/rlm-runtime.md) (1 matches)

```text
Line   67: | `src/core/tools/ipython.ts` | Agent tool wrapper, lazy kernel provisioning, namespace bootstrap, and output shaping. |
```

### [packages/coding-agent/docs/rlm.md](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/docs/rlm.md) (1 matches)

```text
Line   33: The default RLM runtime exposes one built-in model tool: `ipython`. Reading and editing files, running project commands, transforming results, invoking skills, and delegating work all begin from that persistent kernel instead of separate built-in tool calls.
```

### [packages/coding-agent/docs/sdk.md](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/docs/sdk.md) (9 matches)

```text
Line   65:   tools: ["ipython"],
Line  470: // Use the default built-in tool set: ipython
Line  472:   tools: ["ipython"],
Line  477:   tools: ["ipython"],
Line  487:   createIpythonToolDefinition,
Line  497:     createIpythonToolDefinition(cwd),
Line  929:   tools: ["ipython"],
Line 1109: createIpythonTool, createBashTool, createEditTool
Line 1110: createIpythonToolDefinition, createBashToolDefinition, createEditToolDefinition
```

### [packages/coding-agent/docs/skills.md](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/docs/skills.md) (1 matches)

```text
Line  134: 3. When a task matches, the agent uses `ipython` to load the full `SKILL.md` (models don't always do this; use prompting or `/skill:name` to force it)
```

### [packages/coding-agent/docs/usage.md](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/docs/usage.md) (3 matches)

```text
Line  236: Built-in tools: `ipython`.
Line  347: prime-agent --tools ipython -p "Review the code"
Line  372: Prime Agent keeps the model-facing tool surface small while making the Python REPL runtime powerful and composable. The built-in `ipython` tool provides durable state, project command execution, Python skills, MCP-backed integrations, and the native `rlm` delegation API without presenting each capability as a separate model tool.
```

## Scripts & Installers (2 files, 2 matches)

### [install.sh](file:///home/jeff/code/fork/prime-agent/install.sh) (1 matches)

```text
Line 1585: 		prime_agent_screen "Python setup skipped" "" "The runtime can be prepared on first ipython use." ""
```

### [scripts/install.xsh](file:///home/jeff/code/fork/prime-agent/scripts/install.xsh) (1 matches)

```text
Line  870:             self.screen_update("Python setup skipped", detail="The runtime can be prepared on first ipython use.") if self.screen.enabled else print("\nSkipping Python runtime setup.")
```

## Planning & Migration Docs (5 files, 47 matches)

### [.planning/2026-09-13-xonsh-integration/claims.md](file:///home/jeff/code/fork/prime-agent/.planning/2026-09-13-xonsh-integration/claims.md) (11 matches)

```text
Line   62:   - The system supports or integrates an `ipython` execution environment/kernel.
Line   66:   - Python execution can be handled via a stateful IPython kernel rather than purely one-off shell processes.
Line   73:   - RLM connects `AgentTool`, `ipython`, `kernel`, `Python skill`, `rlm(...)`, `host-request`, and `child-session`.
Line   94:    - Contains: `acp-mcp.ts`, `bash.ts`, `code-preview.ts`, `edit-diff.ts`, `edit.ts`, `file-mutation-queue.ts`, `index.ts`, `ipython-cell-code.ts`, `ipython.ts`, `output-accumulator.ts`, `path-utils.ts`, `render-utils.ts`, `tool-definition-wrapper.ts`, and `truncate.ts`.
Line  100:    - `tools/index.ts` currently configures `createAllToolDefinitions()` to return **only** the `ipython` definition, despite the directory containing factories/helpers for `bash`, `edit`, `acp-mcp`, etc.
Line  106: 9. **`ipython` as the Single AgentTool Boundary:**
Line  107:    - `prime-agent` routes model capabilities primarily through the single `ipython` tool rather than registering individual `AgentTool`s for every action.
Line  113:    - Child `AgentSession`s inherit their parent's tooling environment. Each child session provisions its own `ipython` kernel.
Line  125:    - The presence of various `.ts` tool files while `createAllToolDefinitions()` only returns `ipython` implies an architectural migration from discrete tools to an RLM Python REPL model, leaving standalone tool definitions dormant.
Line  149:   - `src/core/tools/ipython.ts`: Implements the agent tool wrapper, lazy kernel provisioning, namespace bootstrapping.
Line  192:   - **Single built-in model tool (`ipython`)**: The default RLM runtime exposes exactly one built-in model tool: `ipython`.
```

### [.planning/2026-09-13-xonsh-integration/findings.md](file:///home/jeff/code/fork/prime-agent/.planning/2026-09-13-xonsh-integration/findings.md) (26 matches)

```text
Line   16: - Built-in tool factories include `createIpythonToolDefinition()`, `createBashToolDefinition()`, and `createEditToolDefinition()`.
Line   71: - `ipython.ts`: defines the built-in `ipython` tool factory, `createIpythonToolDefinition`, including its `ToolDefinition` metadata, parameters, and execution through an `IpythonKernelProvisioner`.
Line   89: #### 1. `ipython` is the primary AgentTool-to-RLM boundary
Line   90: - The RLM model exposes one built-in model tool, `ipython`, rather than a separate AgentTool for every capability.
Line   91: - `packages/coding-agent/src/core/tools/ipython.ts` is described as the AgentTool wrapper. It lazily provisions the Python kernel, bootstraps the namespace, executes code, and shapes output.
Line   92: - Therefore the outer tool pipeline is: model tool call -> `ToolDefinition`/`AgentTool` for `ipython` -> `ReplKernelManager` -> Python runtime.
Line  109: - Consequently, a child RLM agent receives the same class of tool environment as its parent and can use its own `ipython` kernel and inherited custom/extension tools.
Line  112: - The outer `ipython` call returns execution output through the normal AgentTool result path.
Line  134:   -> AgentTool: ipython
Line  147: - `ipython` is the primary model-facing tool gateway. Many capabilities that might otherwise be separate AgentTools are composed as Python code inside the persistent kernel.
Line  168: - `core/tools/ipython.ts` is the AgentTool-facing boundary. Its `createIpythonToolDefinition` provisions or obtains the kernel and delegates Python execution to the kernel manager, then shapes kernel output as an `AgentToolResult`.
Line  169: - `core/kernel/repl-manager.ts` is not a tool definition or extension registration module. It is the process/protocol/execution layer used by the `ipython` tool.
Line  175: - The RLM documents describe the runtime as `python -m rlm.repl` over JSON-lines stdio. DeepWiki additionally claimed a ZMQ `execute_request` path and an `AgentWorker` step for normal `ipython` calls; those claims conflict with the supplied RLM architecture and should not be accepted without local source evidence.
Line  188:   -> AgentTool: ipython (`core/tools/ipython.ts`)
Line  207: - The RLM documents are the strongest source for the JSON-lines host bridge, `ipython` boundary, child inheritance, and TypeScript ownership of policy/state.
Line  220: - `packages/coding-agent/src/core/tools/` contains `acp-mcp.ts`, `bash.ts`, `code-preview.ts`, `edit-diff.ts`, `edit.ts`, `file-mutation-queue.ts`, `index.ts`, `ipython-cell-code.ts`, `ipython.ts`, `output-accumulator.ts`, `path-utils.ts`, `render-utils.ts`, `tool-definition-wrapper.ts`, and `truncate.ts`.
Line  221: - `tools/index.ts` currently makes `createAllToolDefinitions()` return only the `ipython` definition, while the directory also contains factories/helpers for bash, edit, ACP/MCP, previews, file mutation, output handling, rendering, and truncation.
Line  224: - `AgentSession._buildRuntime()` constructs `IpythonKernelProvisioner` with `_createKernelHostHandlers()` and creates the built-in definitions. `_refreshToolRegistry()` merges base, custom, and registered definitions, wraps them, and selects active tools for the agent state.
Line  226: Verified normal model-to-`ipython` path:
Line  231: 4. `createIpythonToolDefinition()` calls the provisioner and `KernelClient.execute()`.
Line  232: 5. `IpythonKernelProvisioner.startKernel()` creates `ReplKernelManager` and runs bootstrap code that defines `rlm`, `bash`, and `mcp` in Python.
Line  234: 7. The ipython tool shapes that result as an `AgentToolResult`.
Line  253: #### 1. `ipython.ts`
Line  255: - **Verification:** TRUE. `IpythonKernelProvisioner` handles this lazily. It uses `buildRlmBootstrapCode` to inject `rlm`, `bash`, and `mcp`. 
Line  270: - **Verification:** TRUE. It instantiates `IpythonKernelProvisioner` with kernel host handlers and aggregates tools into `_toolRegistry`.
Line  271: - **Xonsh impact:** There is significant hardcoding of `ipython` references (e.g., `_ipythonKernelProvisioner`, default tool fallbacks, goal requirements requiring ipython). To support xonsh fully, `agent-session.ts` must be updated to recognize `xonsh` as a primary REPL tool alongside ipython.
```

### [.planning/2026-09-13-xonsh-integration/handoff.md](file:///home/jeff/code/fork/prime-agent/.planning/2026-09-13-xonsh-integration/handoff.md) (5 matches)

```text
Line    9: Implement a `xonsh` tool integration alongside the existing `ipython` tool.
Line   20:    - Implement the `xonsh` tool in `packages/coding-agent/src/core/tools/xonsh.ts`. You should heavily reference how `ipython.ts` is implemented in that same directory.
Line   27: 3. `packages/coding-agent/src/core/tools/ipython.ts` - The reference implementation for our new tool.
Line   31: - The default model-facing tool in this codebase is currently `ipython`.
Line   33: - The `ipython` tool uses a persistent kernel process over stdio. A major part of Prong 1 will be determining if `xonsh` requires a similar persistent kernel integration (via `ReplKernelManager`), or if it will operate differently. Checking the germane claims will clarify this boundary.
```

### [.planning/2026-09-13-xonsh-integration/progress.md](file:///home/jeff/code/fork/prime-agent/.planning/2026-09-13-xonsh-integration/progress.md) (1 matches)

```text
Line   25: - Read both RLM documents and mapped the AgentTool, `ipython`, kernel, Python skill, `rlm(...)`, host-request, and child-session connections.
```

### [.planning/2026-09-13-xonsh-integration/task_plan.md](file:///home/jeff/code/fork/prime-agent/.planning/2026-09-13-xonsh-integration/task_plan.md) (4 matches)

```text
Line   21: - [x] Determine/guess which information/claims are germane to implementing a `xonsh` tool (alongside `ipython`)
Line   51: - [ ] `agent-session.ts` must be updated to recognize `xonsh` as a primary REPL tool alongside ipython
Line   53: - [ ] Grep for `ipython` across all files and write paths/line#s to a markdown document
Line   54: - [ ] Determine all code parts to read to fully replace `ipython` with `xonsh`
```
