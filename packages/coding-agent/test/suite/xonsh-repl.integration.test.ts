import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ExtensionContext } from "../../src/core/extensions/types.js";
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
});
