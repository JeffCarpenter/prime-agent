import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Text } from "@earendil-works/pi-tui";
import stripAnsi from "strip-ansi";
import { expect, it, vi } from "vitest";
import subagent from "../examples/extensions/subagent/index.js";
import { initTheme, theme } from "../src/modes/interactive/theme/theme.js";

const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };
child.stdout = new EventEmitter();
child.stderr = new EventEmitter();
vi.mock("node:child_process", () => ({ spawn: () => child }));

it("shows price unknown for a child with mixed known and unpriced responses", async () => {
	initTheme("dark");
	const cwd = mkdtempSync(join(tmpdir(), "subagent-cost-"));
	try {
		const agents = join(cwd, ".prime", "agent", "agents");
		mkdirSync(agents, { recursive: true });
		writeFileSync(join(agents, "local.md"), "---\nname: local\ndescription: local fixture\n---\n");
		const registerTool = vi.fn<ExtensionAPI["registerTool"]>();
		subagent({ registerTool } as unknown as ExtensionAPI);
		const tool = registerTool.mock.lastCall![0];
		const params = { agent: "local", task: "report", agentScope: "project", confirmProjectAgents: false };
		const run = tool.execute("call", params, undefined, undefined, { cwd, hasUI: false } as ExtensionContext);
		const amounts = { input: 1, output: 0, cacheRead: 0, cacheWrite: 0, total: 1 };
		for (const cost of [amounts, { status: "unknown", pricedSubtotal: amounts, unknownContributors: 1 }]) {
			const usage = { input: 5, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 6, cost };
			const message = { role: "assistant", content: [{ type: "text", text: "done" }], usage };
			child.stdout.emit("data", `${JSON.stringify({ type: "message_end", message })}\n`);
		}
		child.emit("close", 0);
		const result = await run;
		const view = tool.renderResult!(result, { expanded: false, isPartial: false }, theme, {} as never) as Text;
		const output = stripAnsi(view.render(100).join("\n"));
		expect(output).toContain("price unknown");
		expect(output).not.toContain("$1.0000");
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});
