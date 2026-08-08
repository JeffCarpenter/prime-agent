import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const tmuxAvailable = spawnSync("tmux", ["-V"], { stdio: "ignore" }).status === 0;
const pythonAvailable = spawnSync("python3", ["--version"], { stdio: "ignore" }).status === 0;

function capturePane(session: string): string {
	return execFileSync("tmux", ["capture-pane", "-t", session, "-p"], { encoding: "utf8" });
}

async function waitForPane(session: string, text: string): Promise<string> {
	const deadline = Date.now() + 5_000;
	let output = "";
	while (Date.now() < deadline) {
		output = capturePane(session);
		if (output.includes(text)) return output;
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
	throw new Error(`Timed out waiting for ${JSON.stringify(text)} in pane:\n${output}`);
}

describe("remote authentication scrollback", () => {
	it.skipIf(!pythonAvailable)("returns to the TUI on Ctrl+C in a direct PTY", () => {
		const result = spawnSync("python3", ["test/fixtures/login-dialog-pty-driver.py", process.cwd()], {
			cwd: process.cwd(),
			encoding: "utf8",
			timeout: 10_000,
		});
		const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

		expect(output).toContain("TUI_RESUMED");
		expect(output).not.toContain("PROCESS_EXITED_ON_SIGINT");
		expect(result.status).toBe(0);
	});

	it.skipIf(!tmuxAvailable)(
		"returns to the TUI on Ctrl+C without delivering SIGINT to the process",
		async () => {
			const session = `prime-auth-e2e-${process.pid}-${Date.now()}`;
			try {
				execFileSync("tmux", [
					"new-session",
					"-d",
					"-s",
					session,
					"-x",
					"100",
					"-y",
					"30",
					"pnpm exec tsx test/fixtures/login-dialog-scrollback-e2e.ts",
				]);
				execFileSync("tmux", ["set-option", "-t", session, "remain-on-exit", "on"]);
				await waitForPane(session, "Press Ctrl+C to return to Prime Agent.");

				execFileSync("tmux", ["send-keys", "-t", session, "C-c"]);
				const output = await waitForPane(session, "TUI_RESUMED");

				expect(output).not.toContain("PROCESS_EXITED_ON_SIGINT");
			} finally {
				spawnSync("tmux", ["kill-session", "-t", session], { stdio: "ignore" });
			}
		},
		10_000,
	);
});
