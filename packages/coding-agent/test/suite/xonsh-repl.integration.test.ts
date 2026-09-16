import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fauxAssistantMessage, fauxToolCall, registerFauxProvider } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { AuthStorage } from "../../src/core/auth-storage.js";
import { createExtensionRuntime } from "../../src/core/extensions/index.js";
import type { ExtensionContext, ToolDefinition } from "../../src/core/extensions/types.js";
import { ModelRegistry } from "../../src/core/model-registry.js";
import type { ResourceLoader } from "../../src/core/resource-loader.js";
import { createAgentSession } from "../../src/core/sdk.js";
import { SessionManager } from "../../src/core/session-manager.js";
import { SettingsManager } from "../../src/core/settings-manager.js";
import { createXonshToolDefinition, XonshKernelProvisioner } from "../../src/core/tools/xonsh.js";

const noUiContext = {} as ExtensionContext;
const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
const runtimeSource = resolve(packageRoot, "../../prime-agent-runtime/src");

describe("real Xonsh REPL integration", () => {
	it("executes native Xonsh cells through the real JSON-lines kernel and recovers after an error", async () => {
		const provisioner = new XonshKernelProvisioner(packageRoot, {
			env: { PYTHONPATH: runtimeSource },
		});
		const tool = createXonshToolDefinition(packageRoot, { provisioner });
		let manager: NonNullable<XonshKernelProvisioner["manager"]> | undefined;

		try {
			const nativeResult = await tool.execute(
				"native-cell",
				{
					code: [
						"import sys",
						'$XONSH_REPL_NATIVE_SENTINEL = "native-env"',
						"persisted_numbers = [19, 23]",
						`captured_process = $(@(sys.executable) -c "import sys; sys.stdout.write('capture-exact')")`,
						"await asyncio.sleep(0)",
						'print(f"python-exact:{sum(persisted_numbers)}")',
						'print(f"capture-exact:{captured_process}")',
						`$[@(sys.executable) -c "import sys; sys.stdout.write('visible-exact')"]`,
						'("result-exact", $XONSH_REPL_NATIVE_SENTINEL)',
					].join("\n"),
				},
				undefined,
				undefined,
				noUiContext,
			);

			manager = provisioner.manager;
			if (!manager) {
				throw new Error("Xonsh provisioner did not retain its started manager");
			}
			expect(manager.isRunning).toBe(true);
			expect(manager.isDefunct).toBe(false);

			expect(nativeResult).toMatchObject({ isError: false });
			expect(nativeResult.details).toMatchObject({
				status: "ok",
				stdout: "python-exact:42\ncapture-exact:capture-exact\n",
				result: "('result-exact', 'native-env')",
				backgroundOutput: "visible-exact",
			});
			expect(nativeResult.content).toEqual([
				{
					type: "text",
					text: [
						"python-exact:42",
						"capture-exact:capture-exact",
						"",
						"('result-exact', 'native-env')",
						"[background output (unattributed)]",
						"visible-exact",
					].join("\n"),
				},
			]);

			const persistedResult = await tool.execute(
				"persistent-cell",
				{
					code: [
						"persisted_numbers.append(1)",
						'print(f"persisted-exact:{sum(persisted_numbers)}")',
						"($XONSH_REPL_NATIVE_SENTINEL, captured_process, len(persisted_numbers))",
					].join("\n"),
				},
				undefined,
				undefined,
				noUiContext,
			);

			expect(persistedResult).toMatchObject({ isError: false });
			expect(persistedResult.details).toMatchObject({
				status: "ok",
				stdout: "persisted-exact:43\n",
				result: "('native-env', 'capture-exact', 3)",
			});

			const errorResult = await tool.execute(
				"error-cell",
				{ code: 'raise RuntimeError("error-exact")' },
				undefined,
				undefined,
				noUiContext,
			);

			expect(errorResult).toMatchObject({ isError: true });
			expect(errorResult.details).toMatchObject({
				status: "error",
				errorEname: "RuntimeError",
				error: {
					ename: "RuntimeError",
					evalue: "error-exact",
				},
			});

			const recoveredResult = await tool.execute(
				"recovery-cell",
				{
					code: [
						'recovered = ("recovered-exact", sum(persisted_numbers), $XONSH_REPL_NATIVE_SENTINEL)',
						"recovered",
					].join("\n"),
				},
				undefined,
				undefined,
				noUiContext,
			);

			expect(recoveredResult).toMatchObject({
				content: [{ type: "text", text: "('recovered-exact', 43, 'native-env')" }],
				details: {
					status: "ok",
					stdout: "",
					result: "('recovered-exact', 43, 'native-env')",
				},
				isError: false,
			});
		} finally {
			await provisioner.dispose({ snapshot: false });
		}

		if (!manager) {
			throw new Error("Xonsh manager was not retained before disposal");
		}
		expect(manager.isRunning).toBe(false);
		expect(manager.isDefunct).toBe(true);
	}, 60_000);

	it("executes real Xonsh cells in an AgentSession configured like the full-control SDK example", async () => {
		const tempAgentDir = join(tmpdir(), `pi-full-control-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(tempAgentDir, { recursive: true });

		const provisioner = new XonshKernelProvisioner(packageRoot, {
			env: { PYTHONPATH: runtimeSource },
		});
		const xonshTool = createXonshToolDefinition(packageRoot, { provisioner });

		const faux = registerFauxProvider();
		faux.setResponses([
			fauxAssistantMessage(
				[
					fauxToolCall(
						"xonsh",
						{
							code: [
								"import sys",
								'$XONSH_REPL_FULL_CONTROL = "full-control-native"',
								"persisted_vals = [20, 22]",
								`captured = $(@(sys.executable) -c "import sys; sys.stdout.write('proc-output')")`,
								'print(f"full-control-stdout:{sum(persisted_vals)}")',
								"($XONSH_REPL_FULL_CONTROL, captured, sum(persisted_vals))",
							].join("\n"),
						},
						{ id: "call-full-control-1" },
					),
				],
				{ stopReason: "toolUse" },
			),
			fauxAssistantMessage("Native xonsh computed 42 in full-control session."),
		]);

		const model = faux.getModel();
		const authStorage = AuthStorage.create(join(tempAgentDir, "auth.json"));
		authStorage.setRuntimeApiKey(model.provider, "faux-key");
		const modelRegistry = ModelRegistry.inMemory(authStorage);
		modelRegistry.registerProvider(model.provider, {
			baseUrl: model.baseUrl,
			apiKey: "faux-key",
			api: faux.api,
			models: faux.models.map((m) => ({
				id: m.id,
				name: m.name,
				api: m.api,
				reasoning: m.reasoning,
				input: m.input,
				cost: m.cost,
				contextWindow: m.contextWindow,
				maxTokens: m.maxTokens,
				baseUrl: m.baseUrl,
			})),
		});

		const settingsManager = SettingsManager.inMemory({
			compaction: { enabled: false },
			retry: { enabled: true, maxRetries: 2 },
		});

		const cwd = packageRoot;

		const resourceLoader: ResourceLoader = {
			getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
			getSkills: () => ({ skills: [], diagnostics: [] }),
			getPrompts: () => ({ prompts: [], diagnostics: [] }),
			getThemes: () => ({ themes: [], diagnostics: [] }),
			getAgentsFiles: () => ({ agentsFiles: [] }),
			getSystemPrompt: () => "You are a minimal assistant.\nAvailable: xonsh. Be concise.",
			getAppendSystemPrompt: () => [],
			extendResources: () => {},
			reload: async () => {},
		};

		const textDeltas: string[] = [];

		try {
			const { session } = await createAgentSession({
				cwd,
				agentDir: tempAgentDir,
				model,
				thinkingLevel: "off",
				authStorage,
				modelRegistry,
				resourceLoader,
				tools: ["xonsh"],
				customTools: [xonshTool as unknown as ToolDefinition],
				sessionManager: SessionManager.inMemory(cwd),
				settingsManager,
			});

			session.subscribe((event) => {
				if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
					textDeltas.push(event.assistantMessageEvent.delta);
				}
			});

			await session.prompt("Run native xonsh calculation");

			const manager = provisioner.manager;
			if (!manager) {
				throw new Error("Xonsh provisioner did not retain its started manager");
			}
			expect(manager.isRunning).toBe(true);
			expect(manager.isDefunct).toBe(false);

			const toolResultMessages = session.messages.filter((m) => m.role === "toolResult");
			expect(toolResultMessages).toHaveLength(1);
			const toolResult = toolResultMessages[0];
			expect(toolResult).toMatchObject({
				role: "toolResult",
				toolName: "xonsh",
				isError: false,
			});
			expect(toolResult?.details).toMatchObject({
				status: "ok",
				stdout: "full-control-stdout:42\n",
				result: "('full-control-native', 'proc-output', 42)",
			});

			const joinedDeltas = textDeltas.join("");
			expect(joinedDeltas).toContain("Native xonsh computed 42 in full-control session.");
		} finally {
			await provisioner.dispose({ snapshot: false });
			rmSync(tempAgentDir, { recursive: true, force: true });
		}
	}, 60_000);
});
