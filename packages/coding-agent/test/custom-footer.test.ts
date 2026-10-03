import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import stripAnsi from "strip-ansi";
import { expect, it, vi } from "vitest";
import customFooter from "../examples/extensions/custom-footer.js";
import { initTheme, theme } from "../src/modes/interactive/theme/theme.js";

type FooterFactory = Exclude<Parameters<ExtensionCommandContext["ui"]["setFooter"]>[0], undefined>;

it("shows unknown cost rather than a dollar subtotal for mixed-price messages", async () => {
	initTheme("dark");
	const registerCommand = vi.fn<ExtensionAPI["registerCommand"]>();
	customFooter({ registerCommand } as unknown as ExtensionAPI);
	const amounts = { input: 1, output: 0, cacheRead: 0, cacheWrite: 0, total: 1 };
	const messages = [amounts, { status: "unknown", pricedSubtotal: amounts, unknownContributors: 1 }].map((cost) => ({
		type: "message",
		message: { role: "assistant", usage: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, totalTokens: 3, cost } },
	}));
	const setFooter = vi.fn<ExtensionCommandContext["ui"]["setFooter"]>();
	const ctx = {
		ui: { setFooter, notify() {} },
		sessionManager: { getBranch: () => messages },
	} as unknown as ExtensionCommandContext;
	await registerCommand.mock.lastCall![1].handler("", ctx);
	const footer = setFooter.mock.lastCall![0]!;
	const data = { onBranchChange: () => () => {}, getGitBranch: () => null } as unknown as Parameters<FooterFactory>[2];
	const view = footer({ requestRender() {} } as TUI, theme, data);
	const line = stripAnsi(view.render(80)[0]);
	expect(line).toContain("price unknown");
	expect(line).not.toContain("$1.000");
});
