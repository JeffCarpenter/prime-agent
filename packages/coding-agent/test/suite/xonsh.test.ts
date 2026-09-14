import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { Value } from "typebox/value";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext } from "../../src/core/extensions/types.js";
import { type ExecuteResult, KernelBusyAfterInterruptError, type KernelClient } from "../../src/core/kernel/index.js";
import {
	buildRlmBootstrapCode,
	buildXonshRlmBootstrapCode,
	createXonshTool,
	createXonshToolDefinition,
	imageBlocksFromAttachments,
	XonshKernelProvisioner,
	xonshSchema,
} from "../../src/core/tools/xonsh.js";
import { createHarness, getAssistantTexts, getMessageText, type Harness } from "./harness.js";

function okExecuteResult(overrides: Partial<ExecuteResult> = {}): ExecuteResult {
	return {
		stdout: "ok\n",
		stderr: "",
		status: "ok",
		durationMs: 10,
		...overrides,
	};
}

function createMockProvisioner(executeMock = vi.fn<KernelClient["execute"]>().mockResolvedValue(okExecuteResult())) {
	const manager = {
		execute: executeMock,
		isRunning: true,
		isDefunct: false,
		shutdown: vi.fn(async () => {}),
		kill: vi.fn(async () => {}),
		listNamespaceNames: vi.fn(async () => ["var_a", "var_b"]),
		pruneOversizedVariables: vi.fn(async () => ({ pruned: ["oversized_var"] })),
	} as unknown as KernelClient;

	const ensure = vi.fn(async (_onProgress?: unknown, signal?: AbortSignal) => {
		if (signal?.aborted) {
			throw new Error("Xonsh execution aborted");
		}
		return manager;
	});
	const kill = vi.fn(async () => {});
	const dispose = vi.fn(async () => {});
	const prewarm = vi.fn(() => {});

	const provisioner = {
		ensure,
		kill,
		dispose,
		prewarm,
		get hasRunningKernel() {
			return manager.isRunning;
		},
		get manager() {
			return manager;
		},
		listNamespaceNames: vi.fn(async () => ["var_a", "var_b"]),
		pruneOversizedVariables: vi.fn(async () => ["oversized_var"]),
	} as unknown as XonshKernelProvisioner;

	return { provisioner, manager, execute: executeMock, ensure, kill, dispose };
}

function createBusyContext(selectResult: string) {
	const setWorkingMessage = vi.fn();
	const select = vi.fn(async () => selectResult);
	const ctx = {
		hasUI: true,
		ui: {
			select,
			setWorkingMessage,
		},
	} as unknown as ExtensionContext;
	return { ctx, select, setWorkingMessage };
}

describe("xonsh tool", () => {
	const harnesses: Harness[] = [];

	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	describe("metadata and schema", () => {
		it("validates parameters according to xonshSchema", () => {
			expect(Value.Check(xonshSchema, { code: "echo 'hello'" })).toBe(true);
			expect(Value.Check(xonshSchema, {})).toBe(false);
			expect(Value.Check(xonshSchema, { code: 123 })).toBe(false);
		});

		it("exposes expected ToolDefinition properties", () => {
			const toolDef = createXonshToolDefinition("/tmp");
			expect(toolDef.name).toBe("xonsh");
			expect(toolDef.label).toBe("xonsh");
			expect(toolDef.executionMode).toBe("sequential");
			expect(toolDef.description).toContain("persistent Xonsh REPL");
			expect(toolDef.promptSnippet).toContain("xonsh - persistent Xonsh REPL");
			expect(toolDef.parameters).toBe(xonshSchema);
		});

		it("wraps into an AgentTool via createXonshTool", () => {
			const tool = createXonshTool("/tmp");
			expect(tool.name).toBe("xonsh");
			expect(tool.label).toBe("xonsh");
			expect(tool.description).toContain("persistent Xonsh REPL");
			expect(typeof tool.execute).toBe("function");
		});

		it("builds bootstrap code including NO_COLOR, rlm runtime stub, and skills", () => {
			const code = buildXonshRlmBootstrapCode([
				{
					name: "custom-skill",
					importName: "custom_skill",
					packagePath: "/tmp/custom-skill",
					pyprojectPath: "/tmp/custom-skill/pyproject.toml",
				},
			]);
			expect(code).toContain('_prime_agent_os.environ["NO_COLOR"] = "1"');
			expect(code).toContain("_PrimeAgentMissingRlm");
			expect(code).toContain("custom_skill");
			expect(buildXonshRlmBootstrapCode).toBe(buildRlmBootstrapCode);
		});
	});

	describe("AgentSession integration with faux provider", () => {
		it("executes xonsh tool call successfully within a prompt turn", async () => {
			const { provisioner, execute } = createMockProvisioner();
			execute.mockResolvedValueOnce(
				okExecuteResult({
					stdout: "42\n",
					durationMs: 15,
				}),
			);

			const harness = await createHarness({
				tools: [createXonshTool("/tmp", { provisioner })],
			});
			harnesses.push(harness);

			harness.setResponses([
				fauxAssistantMessage([fauxToolCall("xonsh", { code: "x = 42; echo @(x)" }, { id: "call-xonsh-1" })], {
					stopReason: "toolUse",
				}),
				fauxAssistantMessage("The xonsh output was 42."),
			]);

			await harness.session.prompt("run xonsh calculation");

			expect(execute).toHaveBeenCalledTimes(1);
			expect(execute).toHaveBeenCalledWith("x = 42; echo @(x)", expect.objectContaining({}));

			const startEvents = harness.eventsOfType("tool_execution_start");
			expect(startEvents).toHaveLength(1);
			expect(startEvents[0]?.toolName).toBe("xonsh");
			expect(startEvents[0]?.args).toEqual({ code: "x = 42; echo @(x)" });

			const endEvents = harness.eventsOfType("tool_execution_end");
			expect(endEvents).toHaveLength(1);
			expect(endEvents[0]?.toolName).toBe("xonsh");
			expect(endEvents[0]?.result).toMatchObject({
				content: [{ type: "text", text: "42\n" }],
				details: {
					status: "ok",
					stdout: "42\n",
				},
				isError: false,
			});

			expect(getAssistantTexts(harness)).toContain("The xonsh output was 42.");
		});

		it("handles xonsh execution errors and marks result as error in session", async () => {
			const { provisioner, execute } = createMockProvisioner();
			execute.mockResolvedValueOnce({
				stdout: "",
				stderr: "NameError: name 'foo' is not defined\n",
				status: "error",
				error: {
					ename: "NameError",
					evalue: "name 'foo' is not defined",
					traceback: ["Traceback (most recent call last):", "NameError: name 'foo' is not defined"],
				},
				durationMs: 5,
			});

			const harness = await createHarness({
				tools: [createXonshTool("/tmp", { provisioner })],
			});
			harnesses.push(harness);

			harness.setResponses([
				fauxAssistantMessage([fauxToolCall("xonsh", { code: "foo" }, { id: "call-err-1" })], {
					stopReason: "toolUse",
				}),
				(ctx) => {
					const lastMsg = ctx.messages.at(-1);
					const text = getMessageText(lastMsg);
					return fauxAssistantMessage(`Observed error: ${text.includes("NameError") ? "yes" : "no"}`);
				},
			]);

			await harness.session.prompt("evaluate foo");

			const endEvents = harness.eventsOfType("tool_execution_end");
			expect(endEvents).toHaveLength(1);
			expect(endEvents[0]?.result).toMatchObject({
				isError: true,
				details: {
					status: "error",
					errorEname: "NameError",
				},
			});

			expect(getAssistantTexts(harness)).toContain("Observed error: yes");
		});

		it("forwards image attachments through session tool results", async () => {
			const base64Data =
				"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
			const { provisioner, execute } = createMockProvisioner();
			execute.mockResolvedValueOnce(
				okExecuteResult({
					stdout: "generated image\n",
					attachments: [{ mimeType: "image/png", data: base64Data, path: "/tmp/plot.png" }],
				}),
			);

			const harness = await createHarness({
				tools: [createXonshTool("/tmp", { provisioner })],
			});
			harnesses.push(harness);

			harness.setResponses([
				fauxAssistantMessage([fauxToolCall("xonsh", { code: "plot_data()" }, { id: "call-img-1" })], {
					stopReason: "toolUse",
				}),
				fauxAssistantMessage("Plot rendered successfully."),
			]);

			await harness.session.prompt("plot data");

			const endEvents = harness.eventsOfType("tool_execution_end");
			expect(endEvents).toHaveLength(1);
			const result = endEvents[0]?.result;
			expect(result?.content).toEqual([
				{ type: "text", text: "generated image\n" },
				{ type: "image", data: base64Data, mimeType: "image/png" },
			]);
			expect(result?.details).toMatchObject({
				status: "ok",
				attachments: [{ mimeType: "image/png", data: base64Data, path: "/tmp/plot.png" }],
			});
		});

		it("formats unattributed background output into session tool result", async () => {
			const { provisioner, execute } = createMockProvisioner();
			execute.mockResolvedValueOnce(
				okExecuteResult({
					stdout: "job finished",
					backgroundOutput: "thread pool background notice",
				}),
			);

			const harness = await createHarness({
				tools: [createXonshTool("/tmp", { provisioner })],
			});
			harnesses.push(harness);

			harness.setResponses([
				fauxAssistantMessage([fauxToolCall("xonsh", { code: "wait_bg()" }, { id: "call-bg-1" })], {
					stopReason: "toolUse",
				}),
				fauxAssistantMessage("Acknowledged."),
			]);

			await harness.session.prompt("run wait_bg");

			const endEvents = harness.eventsOfType("tool_execution_end");
			expect(endEvents).toHaveLength(1);
			const text = (endEvents[0]?.result?.content?.[0] as { text: string })?.text ?? "";
			expect(text).toContain("job finished");
			expect(text).toContain("[background output (unattributed)]\nthread pool background notice");
			expect(endEvents[0]?.result?.details).toMatchObject({
				backgroundOutput: "thread pool background notice",
			});
		});
	});

	describe("tool definition execution formatting and streaming", () => {
		it("concatenates stdout, stderr, and result correctly", async () => {
			const { provisioner, execute } = createMockProvisioner();
			execute.mockResolvedValueOnce(
				okExecuteResult({
					stdout: "stdout-line",
					stderr: "stderr-line",
					result: "42",
				}),
			);

			const toolDef = createXonshToolDefinition("/tmp", { provisioner });
			const result = await toolDef.execute("id-1", { code: "expr" }, undefined, undefined, {} as ExtensionContext);

			expect(result.content).toEqual([{ type: "text", text: "stdout-line\nstderr-line\n42" }]);
			expect(result.details).toMatchObject({
				stdout: "stdout-line",
				stderr: "stderr-line",
				result: "42",
				status: "ok",
			});
			expect((result as any).isError).toBe(false);
		});

		it("streams execution chunks via onUpdate callback", async () => {
			const { provisioner, execute } = createMockProvisioner();
			execute.mockImplementationOnce(async (_code, options) => {
				options?.onStream?.("chunk-1\n", "stdout");
				options?.onStream?.("chunk-2\n", "stdout");
				return okExecuteResult({ stdout: "chunk-1\nchunk-2\n" });
			});

			const onUpdate = vi.fn();
			const toolDef = createXonshToolDefinition("/tmp", { provisioner });
			const result = await toolDef.execute(
				"id-stream",
				{ code: "stream_test" },
				undefined,
				onUpdate,
				{} as ExtensionContext,
			);

			expect(result.details.status).toBe("ok");
			expect(onUpdate).toHaveBeenCalledWith({
				content: [{ type: "text", text: "chunk-1\n" }],
				details: { status: "ok" },
			});
			expect(onUpdate).toHaveBeenCalledWith({
				content: [{ type: "text", text: "chunk-2\n" }],
				details: { status: "ok" },
			});
		});

		it("reports startup progress to onUpdate and working message", async () => {
			const { manager } = createMockProvisioner();
			const ensure = vi.fn(async (onProgress?: (msg: string) => void) => {
				onProgress?.("Starting Xonsh kernel...");
				return manager;
			});
			const provisioner = { ensure } as unknown as XonshKernelProvisioner;

			const setWorkingMessage = vi.fn();
			const ctx = {
				hasUI: true,
				ui: { setWorkingMessage },
			} as unknown as ExtensionContext;
			const onUpdate = vi.fn();

			const toolDef = createXonshToolDefinition("/tmp", { provisioner });
			await toolDef.execute("id-progress", { code: "ready" }, undefined, onUpdate, ctx);

			expect(onUpdate).toHaveBeenCalledWith({
				content: [{ type: "text", text: "Starting Xonsh kernel..." }],
				details: { status: "starting" },
			});
			expect(setWorkingMessage).toHaveBeenCalledWith("Starting Xonsh kernel...");
			expect(setWorkingMessage).toHaveBeenLastCalledWith(undefined);
		});

		it("handles busy kernel by waiting when user selects 'Wait and preserve state'", async () => {
			const execute = vi
				.fn<KernelClient["execute"]>()
				.mockRejectedValueOnce(new KernelBusyAfterInterruptError())
				.mockResolvedValueOnce(okExecuteResult({ stdout: "resumed ok" }));

			const manager = { execute } as unknown as KernelClient;
			const ensure = vi.fn(async () => manager);
			const kill = vi.fn(async () => {});
			const provisioner = { ensure, kill } as unknown as XonshKernelProvisioner;

			const { ctx, select, setWorkingMessage } = createBusyContext("Wait and preserve state");
			const toolDef = createXonshToolDefinition("/tmp", { provisioner });

			const result = await toolDef.execute("id-busy-wait", { code: "x = 1" }, undefined, undefined, ctx);

			expect(result.details.status).toBe("ok");
			expect(result.details.kernelRestarted).toBe(false);
			expect(ensure).toHaveBeenCalledTimes(2);
			expect(kill).not.toHaveBeenCalled();
			expect(select).toHaveBeenCalledWith(
				expect.stringContaining("Interrupted Xonsh cell is still running"),
				["Wait and preserve state", "Kill kernel and restart"],
				{ signal: undefined },
			);
			expect(setWorkingMessage).toHaveBeenCalledWith("Waiting for Xonsh kernel...");
			expect(setWorkingMessage).toHaveBeenLastCalledWith(undefined);
		});

		it("handles busy kernel by killing and restarting when user selects 'Kill kernel and restart'", async () => {
			const busyManager = {
				execute: vi.fn<KernelClient["execute"]>().mockRejectedValueOnce(new KernelBusyAfterInterruptError()),
			} as unknown as KernelClient;
			const freshManager = {
				execute: vi.fn<KernelClient["execute"]>().mockResolvedValueOnce(okExecuteResult({ stdout: "fresh ok" })),
			} as unknown as KernelClient;

			const ensure = vi.fn(async () => {
				return ensure.mock.calls.length === 1 ? busyManager : freshManager;
			});
			const kill = vi.fn(async () => {});
			const provisioner = { ensure, kill } as unknown as XonshKernelProvisioner;

			const { ctx, setWorkingMessage } = createBusyContext("Kill kernel and restart");
			const toolDef = createXonshToolDefinition("/tmp", { provisioner });

			const result = await toolDef.execute("id-busy-kill", { code: "x = 1" }, undefined, undefined, ctx);
			const text = (result.content[0] as { text: string }).text;

			expect(result.details.status).toBe("ok");
			expect(result.details.kernelRestarted).toBe(true);
			expect(text).toContain("<xonsh_kernel_reset>");
			expect(text).toContain("The Xonsh kernel was restarted");
			expect(text).toContain("fresh ok");
			expect(ensure).toHaveBeenCalledTimes(2);
			expect(kill).toHaveBeenCalledTimes(1);
			expect(freshManager.execute).toHaveBeenCalledWith("x = 1", expect.objectContaining({ signal: undefined }));
			expect(setWorkingMessage).toHaveBeenCalledWith("Restarting Xonsh kernel...");
			expect(setWorkingMessage).toHaveBeenLastCalledWith(undefined);
		});

		it("rethrows KernelBusyAfterInterruptError when UI is not available", async () => {
			const execute = vi.fn<KernelClient["execute"]>().mockRejectedValue(new KernelBusyAfterInterruptError());
			const manager = { execute } as unknown as KernelClient;
			const provisioner = { ensure: vi.fn(async () => manager), kill: vi.fn() } as unknown as XonshKernelProvisioner;

			const toolDef = createXonshToolDefinition("/tmp", { provisioner });
			const noUiContext = { hasUI: false } as ExtensionContext;

			await expect(
				toolDef.execute("id-no-ui", { code: "x = 1" }, undefined, undefined, noUiContext),
			).rejects.toThrow(KernelBusyAfterInterruptError);
		});

		it("rejects immediately when aborted signal is passed", async () => {
			const { provisioner } = createMockProvisioner();
			const toolDef = createXonshToolDefinition("/tmp", { provisioner });

			const controller = new AbortController();
			controller.abort();

			await expect(
				toolDef.execute("id-abort", { code: "sleep 10" }, controller.signal, undefined, {} as ExtensionContext),
			).rejects.toThrow("Xonsh execution aborted");
		});

		it("rejects immediately when aborted signal is passed to real provisioner", async () => {
			const realProvisioner = new XonshKernelProvisioner("/tmp");
			const controller = new AbortController();
			controller.abort();

			await expect(realProvisioner.ensure(undefined, controller.signal)).rejects.toThrow("Xonsh execution aborted");
		});

		it("forwards late sent agent messages to onLateSentAgentMessage option", async () => {
			const onLateSentAgentMessage = vi.fn();
			const lateMsg = { id: "msg-late-1", role: "assistant" as const, content: "late text" };

			const { provisioner, execute } = createMockProvisioner();
			execute.mockImplementationOnce(async (_code, opts) => {
				opts?.onLateSentAgentMessage?.(lateMsg as any);
				return okExecuteResult();
			});

			const toolDef = createXonshToolDefinition("/tmp", { provisioner, onLateSentAgentMessage });
			await toolDef.execute("tool-call-late", { code: "send_msg()" }, undefined, undefined, {} as ExtensionContext);

			expect(onLateSentAgentMessage).toHaveBeenCalledWith("tool-call-late", lateMsg);
		});
	});

	describe("imageBlocksFromAttachments helper", () => {
		it("converts image attachments to image content blocks and filters non-image types", () => {
			const attachments = [
				{ mimeType: "image/png", data: "png-base64" },
				{ mimeType: "text/plain", data: "plain-text" },
				{ mimeType: "image/jpeg", data: "jpeg-base64" },
				{ mimeType: "application/json", data: "{}" },
			];

			const blocks = imageBlocksFromAttachments(attachments);
			expect(blocks).toEqual([
				{ type: "image", mimeType: "image/png", data: "png-base64" },
				{ type: "image", mimeType: "image/jpeg", data: "jpeg-base64" },
			]);
		});

		it("returns empty array for empty or undefined attachments", () => {
			expect(imageBlocksFromAttachments(undefined)).toEqual([]);
			expect(imageBlocksFromAttachments([])).toEqual([]);
		});
	});

	describe("XonshKernelProvisioner lifecycle", () => {
		it("initializes without a running kernel and exposes methods", async () => {
			const provisioner = new XonshKernelProvisioner("/tmp");
			expect(provisioner.hasRunningKernel).toBe(false);
			expect(provisioner.manager).toBeUndefined();
			expect(provisioner.lastRestore).toBeUndefined();

			expect(await provisioner.listNamespaceNames()).toBeNull();
			expect(await provisioner.pruneOversizedVariables()).toBeNull();

			await expect(provisioner.dispose()).resolves.toBeUndefined();
			await expect(provisioner.kill()).resolves.toBeUndefined();
		});

		it("delegates namespace inspection and variable pruning to started manager", async () => {
			const { provisioner } = createMockProvisioner();

			const names = await provisioner.listNamespaceNames();
			expect(names).toEqual(["var_a", "var_b"]);

			const pruned = await provisioner.pruneOversizedVariables();
			expect(pruned).toEqual(["oversized_var"]);
		});
	});
});
