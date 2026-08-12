import { describe, expect, it } from "vitest";
import { resolveGateInvocation } from "../src/core/autonomous.js";
import {
	getUvInstallCommand,
	kernelVenvPythonPath,
	windowsExecutableCandidates,
} from "../src/core/kernel/bootstrap.js";
import { isSamePath, resolveHomeDirectory } from "../src/core/package-manager.js";
import { daemonSocketEndpoint, isWindowsPipePath } from "../src/modes/daemon/daemon-socket.js";
import { quoteWindowsShellArg } from "../src/utils/child-process.js";
import { isWslBashLauncher } from "../src/utils/shell.js";

describe("Windows platform parity", () => {
	it("maps filesystem daemon identities to stable named pipes", () => {
		const first = daemonSocketEndpoint("C:\\Users\\Ada\\agent.sock", "win32");
		const same = daemonSocketEndpoint("c:\\users\\ada\\AGENT.sock", "win32");
		expect(first).toBe(same);
		expect(first).toMatch(/^\\\\\.\\pipe\\prime-agent-[0-9a-f]{32}$/);
		expect(daemonSocketEndpoint("/tmp/agent.sock", "linux")).toBe("/tmp/agent.sock");
	});

	it("preserves explicit Windows pipe endpoints", () => {
		const pipe = "\\\\.\\pipe\\prime-agent-test";
		expect(isWindowsPipePath(pipe)).toBe(true);
		expect(daemonSocketEndpoint(pipe, "win32")).toBe(pipe);
	});

	it("uses PATHEXT order and native PowerShell uv installation", () => {
		expect(windowsExecutableCandidates("uv", ".EXE;.CMD;.BAT")).toEqual(["uv", "uv.exe", "uv.cmd", "uv.bat"]);
		expect(getUvInstallCommand("win32")).toEqual({
			command: "powershell.exe",
			args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "irm https://astral.sh/uv/install.ps1 | iex"],
		});
		expect(kernelVenvPythonPath("C:\\venv", "win32")).toContain("Scripts");
	});

	it("quotes cmd shim arguments containing shell metacharacters", () => {
		expect(quoteWindowsShellArg("plain")).toBe("plain");
		expect(quoteWindowsShellArg("Ada Lovelace")).toBe('"Ada Lovelace"');
		expect(quoteWindowsShellArg("a&b")).toBe('"a&b"');
	});

	it("runs autonomous gates through the resolved bash", () => {
		expect(
			resolveGateInvocation("pnpm run check", "win32", () => ({
				shell: "C:\\Program Files\\Git\\bin\\bash.exe",
				args: ["-c"],
			})),
		).toEqual({
			command: "C:\\Program Files\\Git\\bin\\bash.exe",
			args: ["-c", "pnpm run check"],
			shell: false,
		});
	});

	it("prefers the native Windows home and compares paths case-insensitively", () => {
		expect(resolveHomeDirectory("win32", "/c/Users/Ada", "C:\\Users\\Ada")).toBe("C:\\Users\\Ada");
		expect(isSamePath("C:\\Users\\Ada", "c:\\users\\ada", "win32")).toBe(true);
		expect(isSamePath("/Users/Ada", "/users/ada", "darwin")).toBe(false);
	});

	it("recognizes only the exact System32 WSL bash launcher", () => {
		expect(isWslBashLauncher("C:\\Windows\\System32\\bash.exe")).toBe(true);
		expect(isWslBashLauncher("C:\\Windows\\System32\\Git\\bash.exe")).toBe(false);
	});
});
