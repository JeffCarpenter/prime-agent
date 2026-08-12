import { execFileSync } from "node:child_process";
import { describe, expect, test } from "vitest";
import { markCodingAgentProcess } from "../src/cli/process-marker.js";

describe("markCodingAgentProcess", () => {
	test("keeps the Pi marker and adds a Prime Agent marker for inherited subprocesses", () => {
		const env: NodeJS.ProcessEnv = {};

		markCodingAgentProcess(env);

		expect(env.PI_CODING_AGENT).toBe("true");
		expect(env.PRIME_AGENT).toBe("true");
	});

	test("passes both markers to an ordinary child process", () => {
		const env: NodeJS.ProcessEnv = {};
		markCodingAgentProcess(env);

		const output = execFileSync(
			process.execPath,
			["--eval", 'process.stdout.write([process.env.PI_CODING_AGENT, process.env.PRIME_AGENT].join("|"));'],
			{ encoding: "utf8", env },
		);

		expect(output).toBe("true|true");
	});
});
