import { describe, expect, it } from "vitest";
import {
	isIpythonToolResult,
	isToolCallEventType,
	isXonshToolResult,
	type ToolCallEvent,
	type ToolResultEvent,
} from "../src/core/extensions/index.js";

const toolCall = {
	type: "tool_call" as const,
	toolCallId: "call-xonsh",
	toolName: "xonsh" as const,
	input: { code: "echo hi" },
} satisfies ToolCallEvent;

const xonshResult = {
	type: "tool_result" as const,
	toolCallId: "call-xonsh",
	toolName: "xonsh" as const,
	input: { code: "echo hi" },
	content: [],
	isError: false,
	details: undefined,
} satisfies ToolResultEvent;

const ipythonResult = { ...xonshResult, toolName: "ipython" as const } satisfies ToolResultEvent;

describe("Xonsh extension event types", () => {
	it("narrows Xonsh tool calls and results", () => {
		if (!isToolCallEventType("xonsh", toolCall)) throw new Error("expected Xonsh call");
		expect(toolCall.input.code).toBe("echo hi");
		expect(isXonshToolResult(xonshResult)).toBe(true);
	});

	it("retains the IPython result guard", () => {
		expect(isIpythonToolResult(ipythonResult)).toBe(true);
		expect(isXonshToolResult(ipythonResult)).toBe(false);
	});
});
