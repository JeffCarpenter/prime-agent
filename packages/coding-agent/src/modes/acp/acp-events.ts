import type { AssistantMessageEvent } from "@earendil-works/pi-ai";
import type { AgentConnectionSessionEvent } from "../agent-connection/types.js";
import type { PrimeAgentSessionMeta, PrimeAgentXonshMeta } from "./acp-meta.js";
import { primeAgentMeta } from "./acp-meta.js";

/**
 * Translate prime-agent session events into ACP `session/update` payloads.
 *
 * Kept as a pure function so the mapping is testable without a live ACP client
 * or a running agent. Returning an array lets one prime-agent event fan out to
 * several ACP updates (or none, for events ACP has no place for).
 */

export type AcpToolKind = "read" | "edit" | "delete" | "move" | "search" | "execute" | "think" | "fetch" | "other";
export type AcpToolStatus = "pending" | "in_progress" | "completed" | "failed";

export interface AcpSessionUpdate {
	sessionUpdate: string;
	[key: string]: unknown;
}

/** prime-agent's model-facing tools are persistent REPLs; bash is the secondary escape hatch. */
export const XONSH_TOOL_NAME = "xonsh";
/** @deprecated Xonsh is the primary REPL; retained for IPython sessions. */
export const IPYTHON_TOOL_NAME = "ipython";

function isReplTool(toolName: string): boolean {
	return toolName === XONSH_TOOL_NAME || toolName === IPYTHON_TOOL_NAME;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function acpToolKind(toolName: string): AcpToolKind {
	switch (toolName) {
		case XONSH_TOOL_NAME:
		case IPYTHON_TOOL_NAME:
		case "bash":
			return "execute";
		case "read":
			return "read";
		case "edit":
		case "write":
			return "edit";
		default:
			return "other";
	}
}

/** Decoded byte length of a base64 payload, without materializing it. */
function base64ByteLength(data: string): number {
	const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
	return Math.max(0, Math.floor((data.length * 3) / 4) - padding);
}

function textContent(text: string): { type: "text"; text: string } {
	return { type: "text", text };
}

/**
 * Map one streaming assistant event to an ACP chunk.
 *
 * The delta discriminator lives on the event itself (`text_delta` /
 * `thinking_delta`) and carries a plain string, so reasoning and visible answer
 * text are distinct ACP update kinds a client can render or hide separately.
 */
function assistantDeltaUpdates(event: AssistantMessageEvent, messageId: string): AcpSessionUpdate[] {
	if (event.type === "thinking_delta" && event.delta.length > 0) {
		return [{ sessionUpdate: "agent_thought_chunk", messageId, content: textContent(event.delta) }];
	}
	if (event.type === "text_delta" && event.delta.length > 0) {
		return [{ sessionUpdate: "agent_message_chunk", messageId, content: textContent(event.delta) }];
	}
	return [];
}

/** Extract REPL cell source so a client can show what is executing. */
function replCellSource(args: unknown): string | undefined {
	if (!isRecord(args)) return undefined;
	return typeof args.code === "string" ? args.code : undefined;
}

function toolResultText(result: unknown): string | undefined {
	if (typeof result === "string") return result;
	if (!isRecord(result)) return undefined;
	const output = result.output;
	if (typeof output === "string") return output;
	const content = result.content;
	if (Array.isArray(content)) {
		const parts = content
			.map((block) => {
				if (!isRecord(block) || block.type !== "text" || typeof block.text !== "string") return "";
				return block.text;
			})
			.filter(Boolean);
		if (parts.length > 0) return parts.join("\n");
	}
	return undefined;
}

/**
 * Rich kernel output that ACP has no content type for.
 *
 * REPL tools report media and diffs under `details` (images additionally ride
 * along as ACP image content blocks); mirror those exact fields rather than
 * inventing a MIME bundle the tools never produce.
 */
function replRichOutput(result: unknown): PrimeAgentXonshMeta | undefined {
	if (!isRecord(result)) return undefined;
	const details = result.details;
	if (!isRecord(details)) return undefined;
	const { attachments, diffs } = details;
	const meta: PrimeAgentXonshMeta = {};
	if (Array.isArray(attachments) && attachments.length > 0) {
		meta.attachments = attachments.map((attachment) => {
			// KernelAttachment exposes mimeType, base64 `data`, and an optional path.
			// Report the decoded size rather than a `bytes` field the kernel never
			// sends, and never inline the payload: ACP already carries images as
			// content blocks, so duplicating them here would bloat every update.
			const typed = isRecord(attachment) ? attachment : {};
			return {
				...(typeof typed.mimeType === "string" ? { mimeType: typed.mimeType } : {}),
				...(typeof typed.path === "string" ? { path: typed.path } : {}),
				...(typeof typed.data === "string" ? { bytes: base64ByteLength(typed.data) } : {}),
			};
		});
	}
	if (Array.isArray(diffs) && diffs.length > 0) meta.diffCount = diffs.length;
	return meta.attachments || meta.diffCount !== undefined ? meta : undefined;
}

/** Correlates streamed bash output and assistant chunks with their owning run or message. */
export interface AcpEventMappingState {
	activeBashRunId?: string;
	activeAssistantMessageId?: string;
	nextAssistantMessageSequence?: number;
}

function startAssistantMessage(state: AcpEventMappingState): string {
	const sequence = (state.nextAssistantMessageSequence ?? 0) + 1;
	state.nextAssistantMessageSequence = sequence;
	state.activeAssistantMessageId = `prime-agent-assistant-${sequence}`;
	return state.activeAssistantMessageId;
}

export function acpUpdatesForSessionEvent(
	event: AgentConnectionSessionEvent,
	state: AcpEventMappingState = {},
): AcpSessionUpdate[] {
	switch (event.type) {
		case "message_start":
			if (event.message.role === "assistant") startAssistantMessage(state);
			return [];

		case "message_update":
			if (event.message.role !== "assistant") return [];
			return assistantDeltaUpdates(
				event.assistantMessageEvent,
				state.activeAssistantMessageId ?? startAssistantMessage(state),
			);

		case "message_end":
			if (event.message.role === "assistant") state.activeAssistantMessageId = undefined;
			return [];

		case "tool_execution_start": {
			const cell = isReplTool(event.toolName) ? replCellSource(event.args) : undefined;
			const title =
				event.toolName === XONSH_TOOL_NAME
					? "Xonsh cell"
					: event.toolName === IPYTHON_TOOL_NAME
						? "Python cell"
						: event.toolName;
			return [
				{
					sessionUpdate: "tool_call",
					toolCallId: event.toolCallId,
					title,
					kind: acpToolKind(event.toolName),
					status: "in_progress" satisfies AcpToolStatus,
					rawInput: cell !== undefined ? { code: cell } : event.args,
				},
			];
		}

		case "tool_execution_end": {
			const text = toolResultText(event.result);
			const rich = isReplTool(event.toolName) ? replRichOutput(event.result) : undefined;
			return [
				{
					sessionUpdate: "tool_call_update",
					toolCallId: event.toolCallId,
					status: (event.isError ? "failed" : "completed") satisfies AcpToolStatus,
					...(text ? { content: [{ type: "content", content: textContent(text) }] } : {}),
					...(rich
						? { _meta: primeAgentMeta(event.toolName === XONSH_TOOL_NAME ? { xonsh: rich } : { ipython: rich }) }
						: {}),
				},
			];
		}

		// Bash runs outside the tool-call lifecycle, so it gets a synthetic tool
		// call keyed by run id to keep incremental output addressable.
		case "bash_start":
			state.activeBashRunId = event.runId;
			return [
				{
					sessionUpdate: "tool_call",
					toolCallId: bashToolCallId(event.runId),
					title: event.command,
					kind: "execute" satisfies AcpToolKind,
					status: "in_progress" satisfies AcpToolStatus,
					rawInput: { command: event.command },
				},
			];

		case "bash_output":
			return [
				{
					sessionUpdate: "tool_call_update",
					toolCallId: bashToolCallId(state.activeBashRunId),
					status: "in_progress" satisfies AcpToolStatus,
					content: [{ type: "content", content: textContent(event.chunk) }],
				},
			];

		case "bash_end":
			if (state.activeBashRunId === event.runId) state.activeBashRunId = undefined;
			return [
				{
					sessionUpdate: "tool_call_update",
					toolCallId: bashToolCallId(event.runId),
					status: (event.exitCode === 0 && !event.cancelled ? "completed" : "failed") satisfies AcpToolStatus,
				},
			];

		// Compaction, subagents, goals and recaps have no ACP equivalent: surface
		// them as namespaced metadata rather than distorting a standard update.
		case "compaction_end":
			return [
				{
					sessionUpdate: "session_info_update",
					_meta: primeAgentMeta({
						compaction: {
							tokensBefore: event.result?.tokensBefore,
							summary: event.result?.summary,
						},
					}),
				},
			];

		case "rlm_child_update":
			return [
				{
					sessionUpdate: "session_info_update",
					_meta: primeAgentMeta({
						subagents: [
							{
								id: event.child.id,
								sessionName: event.child.sessionName,
								status: event.child.status,
								model: event.child.model,
								tokenCount: event.child.tokenCount,
								error: event.child.error,
							},
						],
					}),
				},
			];

		// Goals, continual-harness refinement, and agent-to-agent messaging are
		// prime-agent concepts with no ACP counterpart. They are still part of a
		// turn's observable behavior, so they surface as namespaced metadata
		// instead of being dropped.
		case "goal_update":
			return [
				{
					sessionUpdate: "session_info_update",
					_meta: primeAgentMeta({
						goal: {
							status: event.goal.status,
							objective: event.goal.objective,
							tokenBudget: event.goal.tokenBudget,
							tokensUsed: event.goal.tokensUsed,
						},
					}),
				},
			];

		case "refine_complete":
			return [
				{
					sessionUpdate: "session_info_update",
					_meta: primeAgentMeta({
						refinement: {
							status: "complete",
							summary: event.result.summary,
							changes: event.result.appliedEdits
								?.filter((edit) => edit.applied)
								.map((edit) => `${edit.action} ${edit.kind}:${edit.id}`),
						},
					}),
				},
			];

		case "refine_failed":
			return [
				{
					sessionUpdate: "session_info_update",
					_meta: primeAgentMeta({ refinement: { status: "failed", error: event.error } }),
				},
			];

		case "xonsh_sent_agent_message":
		case "ipython_sent_agent_message":
			return [
				{
					sessionUpdate: "session_info_update",
					_meta: primeAgentMeta({
						agentMessage: {
							toolCallId: event.toolCallId,
							target: event.message.target.sessionName ?? event.message.target.sessionId,
							deliveryStatus: event.message.deliveryStatus,
						},
					}),
				},
			];

		default:
			return [];
	}
}

const BASH_TOOL_CALL_PREFIX = "prime-agent-bash";

export function bashToolCallId(runId: string | undefined): string {
	return runId ? `${BASH_TOOL_CALL_PREFIX}-${runId}` : BASH_TOOL_CALL_PREFIX;
}

export type { PrimeAgentSessionMeta };
