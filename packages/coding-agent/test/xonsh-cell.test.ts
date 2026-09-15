import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";
import {
	getXonshCodeFromArgs,
	XonshCellComponent,
	type XonshCellState,
} from "../src/modes/interactive/components/ipython-cell.js";
import { initTheme } from "../src/modes/interactive/theme/theme.js";

describe("XonshCellComponent", () => {
	initTheme("dark");
	it("extracts and previews native xonsh cell code", () => {
		expect(getXonshCodeFromArgs({ code: "echo hello" })).toBe("echo hello");
		const state: XonshCellState = { code: "echo hello", executionStarted: true, argsComplete: true };
		const rendered = stripAnsi(new XonshCellComponent(state).render(80).join("\n"));
		expect(rendered).toContain("xonsh · bash");
		expect(rendered).toContain("echo hello");
	});

	it("renders Python cells through the same component", () => {
		const rendered = stripAnsi(new XonshCellComponent({ code: "value = 1" }).render(80).join("\n"));
		expect(rendered).toContain("python");
	});

	it("renders Xonsh output and errors through the shared cell path", () => {
		const output = new XonshCellComponent({
			code: "echo hello",
			details: { status: "ok", stdout: "hello" },
			expanded: true,
		});
		expect(stripAnsi(output.render(80).join("\n"))).toContain("hello");

		const error = new XonshCellComponent({
			code: "raise RuntimeError('bad')",
			details: {
				status: "error",
				error: { ename: "RuntimeError", evalue: "bad", traceback: ["Traceback", "RuntimeError: bad"] },
			},
			isError: true,
			expanded: true,
		});
		expect(stripAnsi(error.render(80).join("\n"))).toContain("RuntimeError: bad");
	});

	it("keeps Xonsh dispatch when live state updates omit the dialect", () => {
		const component = new XonshCellComponent({ code: "echo before" });
		component.update({ code: "echo after" });
		expect(stripAnsi(component.render(80).join("\n"))).toContain("xonsh · bash");
	});
});
