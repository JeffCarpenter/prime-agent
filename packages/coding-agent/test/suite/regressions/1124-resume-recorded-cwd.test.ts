import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ENV_AGENT_DIR } from "../../../src/config.js";
import { SessionManager } from "../../../src/core/session-manager.js";
import { DaemonClient } from "../../../src/modes/daemon/daemon-client.js";
import type { SessionSummary } from "../../../src/modes/daemon/daemon-session-list.js";
import { isProcessAlive, signalProcessGroupOrProcess } from "../../../src/utils/child-process.js";
import { createHarness, type Harness } from "../harness.js";

const cliPath = resolve(__dirname, "../../../src/cli.ts");
const tsxPath = resolve(__dirname, "../../../../../node_modules/tsx/dist/cli.mjs");

describe("#1124 resumed session cwd", () => {
	let harness: Harness | undefined;
	let supervisor: ChildProcess | undefined;
	let client: DaemonClient | undefined;
	let socketPath: string | undefined;
	const workerPids = new Set<number>();
	let supervisorStderr = "";

	afterEach(async () => {
		const cleanupErrors: string[] = [];
		if (client) {
			try {
				await client.request({ type: "shutdown" }, 10_000);
			} catch {
				// The supervisor may already be gone after a failed assertion.
			}
			client.close();
			client = undefined;
		}
		if (supervisor && !(await waitForExit(supervisor, 10_000))) {
			supervisor.kill("SIGTERM");
			if (!(await waitForExit(supervisor, 5000))) {
				supervisor.kill("SIGKILL");
				if (!(await waitForExit(supervisor, 5000))) {
					cleanupErrors.push(`Supervisor ${supervisor.pid ?? "unknown"} did not exit`);
				}
			}
		}
		supervisor = undefined;
		for (const workerPid of workerPids) {
			if (!(await waitForProcessGone(workerPid, 10_000))) {
				try {
					signalProcessGroupOrProcess(workerPid, "SIGTERM");
				} catch {
					// The worker may have exited between the liveness check and signal.
				}
			}
			if (!(await waitForProcessGone(workerPid, 2000))) {
				try {
					signalProcessGroupOrProcess(workerPid, "SIGKILL");
				} catch {
					// The worker may have exited between the liveness check and signal.
				}
			}
			if (!(await waitForProcessGone(workerPid, 5000))) {
				cleanupErrors.push(`Worker ${workerPid} did not exit`);
			}
		}
		workerPids.clear();
		if (socketPath && !(await waitForSocketGone(socketPath, 5000))) {
			cleanupErrors.push(`Daemon socket remained reachable: ${socketPath}`);
		}
		socketPath = undefined;
		harness?.cleanup();
		harness = undefined;
		supervisorStderr = "";
		if (cleanupErrors.length > 0) {
			throw new Error(cleanupErrors.join("\n"));
		}
	});

	it("preserves saved, explicit, and new-session cwd semantics", async () => {
		harness = await createHarness({ persistSession: true });
		harness.sessionManager.flushNow();
		const sessionPath = harness.sessionManager.materializeSessionFile();
		const savedCwd = harness.tempDir;
		const daemonCwd = join(harness.tempDir, "daemon-launch");
		const explicitSavedCwd = join(harness.tempDir, "explicit-saved");
		const explicitOverrideCwd = join(harness.tempDir, "explicit-override");
		const agentDir = join(harness.tempDir, "agent");
		const testSocketPath = join(tmpdir(), `prime-1124-${process.pid}-${randomUUID().slice(0, 8)}.sock`);
		socketPath = testSocketPath;
		mkdirSync(daemonCwd, { recursive: true });
		mkdirSync(explicitSavedCwd, { recursive: true });
		mkdirSync(explicitOverrideCwd, { recursive: true });
		const explicitSessionPath = SessionManager.create(
			explicitSavedCwd,
			join(harness.tempDir, "explicit-sessions"),
		).materializeSessionFile();

		supervisor = spawn(
			process.execPath,
			[tsxPath, cliPath, "--mode", "daemon", "--daemon-socket", testSocketPath, "--offline"],
			{
				cwd: daemonCwd,
				env: {
					...process.env,
					[ENV_AGENT_DIR]: agentDir,
					PI_OFFLINE: "1",
					TSX_TSCONFIG_PATH: resolve(__dirname, "../../../../../tsconfig.json"),
				},
				stdio: ["ignore", "ignore", "pipe"],
			},
		);
		supervisor.stderr?.on("data", (chunk: Buffer) => {
			supervisorStderr += chunk.toString("utf8");
		});

		client = await connectEventually(testSocketPath, supervisor);
		const created = await client.request({
			type: "create",
			sessionPath,
			config: { agentDir, noTools: true, noExtensions: true },
		});
		if (!created.success) {
			throw new Error(created.error);
		}

		const summary = created.data as SessionSummary;
		expect(summary.cwd).toBe(savedCwd);
		expect(summary.cwd).not.toBe(daemonCwd);
		trackWorker(summary);

		const explicitlyOverridden = await client.request({
			type: "create",
			sessionPath: explicitSessionPath,
			config: {
				cwd: explicitOverrideCwd,
				agentDir,
				noTools: true,
				noExtensions: true,
			},
		});
		if (!explicitlyOverridden.success) {
			throw new Error(explicitlyOverridden.error);
		}
		const explicitSummary = explicitlyOverridden.data as SessionSummary;
		expect(explicitSummary.cwd).toBe(explicitOverrideCwd);
		expect(explicitSummary.cwd).not.toBe(explicitSavedCwd);
		trackWorker(explicitSummary);

		const createdNew = await client.request({
			type: "create",
			config: { agentDir, noTools: true, noExtensions: true },
		});
		if (!createdNew.success) {
			throw new Error(createdNew.error);
		}
		const newSummary = createdNew.data as SessionSummary;
		expect(newSummary.cwd).toBe(daemonCwd);
		trackWorker(newSummary);
	}, 60_000);

	function trackWorker(summary: SessionSummary): void {
		if (!summary.workerPid) {
			throw new Error("Session worker did not expose its pid");
		}
		workerPids.add(summary.workerPid);
	}

	async function connectEventually(socketPath: string, child: ChildProcess): Promise<DaemonClient> {
		const deadline = Date.now() + 15_000;
		let lastError: unknown;
		while (Date.now() < deadline) {
			if (child.exitCode !== null || child.signalCode !== null) {
				throw new Error(
					`Supervisor exited before becoming ready (code ${child.exitCode}, signal ${child.signalCode})\n${supervisorStderr}`,
				);
			}
			const candidate = new DaemonClient(socketPath);
			try {
				await candidate.connect(250);
				await candidate.waitForHello(1000);
				return candidate;
			} catch (error) {
				lastError = error;
				candidate.close();
				await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
			}
		}
		throw new Error(`Timed out waiting for supervisor: ${String(lastError)}\n${supervisorStderr}`);
	}

	async function waitForExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
		if (child.exitCode !== null || child.signalCode !== null) {
			return true;
		}
		return new Promise<boolean>((resolveExit) => {
			let settled = false;
			let timeout: ReturnType<typeof setTimeout>;
			const finish = (exited: boolean) => {
				if (settled) return;
				settled = true;
				clearTimeout(timeout);
				child.off("exit", onExit);
				resolveExit(exited);
			};
			const onExit = () => finish(true);
			timeout = setTimeout(() => finish(false), timeoutMs);
			child.once("exit", onExit);
		});
	}

	async function waitForProcessGone(pid: number, timeoutMs: number): Promise<boolean> {
		const deadline = Date.now() + timeoutMs;
		while (Date.now() < deadline) {
			if (!isProcessAlive(pid)) return true;
			await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
		}
		return !isProcessAlive(pid);
	}

	async function waitForSocketGone(path: string, timeoutMs: number): Promise<boolean> {
		const deadline = Date.now() + timeoutMs;
		while (Date.now() < deadline) {
			const probe = new DaemonClient(path);
			try {
				await probe.connect(100);
			} catch {
				probe.close();
				return true;
			}
			probe.close();
			await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
		}
		return false;
	}
});
