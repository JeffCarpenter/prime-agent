import stripAnsi from "strip-ansi";
import { beforeAll, describe, expect, it } from "vitest";
import {
	type CustomMessage,
	XONSH_STATE_RESTORED_CUSTOM_TYPE,
	type XonshStateRestoredDetails,
} from "../src/core/messages.js";
import {
	InjectedPromptMessageComponent,
	isInjectedPromptMessage,
} from "../src/modes/interactive/components/injected-prompt-message.js";
import { initTheme } from "../src/modes/interactive/theme/theme.js";

describe("Xonsh restore prompt", () => {
	beforeAll(() => initTheme("dark"));
	it("recognizes and renders Xonsh restore state", () => {
		const message: CustomMessage<XonshStateRestoredDetails> = {
			role: "custom",
			customType: XONSH_STATE_RESTORED_CUSTOM_TYPE,
			content: "restore",
			display: true,
			details: { restored: false },
			timestamp: Date.now(),
		};
		expect(isInjectedPromptMessage(message)).toBe(true);
		const component = new InjectedPromptMessageComponent(message);
		expect(stripAnsi(component.render(100).join("\n"))).toContain("Started fresh Xonsh kernel");
		component.setExpanded(true);
		expect(stripAnsi(component.render(100).join("\n"))).not.toContain("restore");

		const restored = new InjectedPromptMessageComponent({ ...message, details: { restored: true } });
		expect(stripAnsi(restored.render(100).join("\n"))).toContain("Restored Xonsh kernel state");
	});
});
