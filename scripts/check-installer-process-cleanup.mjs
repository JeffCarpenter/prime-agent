import { spawn, spawnSync } from "node:child_process";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const installerSource = readFileSync("install.sh", "utf-8");
const mainCall = '\nmain "$@"';
const mainCallIndex = installerSource.lastIndexOf(mainCall);
const failures = [];

if (mainCallIndex === -1) {
	console.error('Installer process-cleanup check failed: could not find final main "$@" call.');
	process.exit(1);
}

const shellProbe = spawnSync("sh", ["-c", ":"], { encoding: "utf-8" });
if (shellProbe.error?.code === "ENOENT" && process.platform === "win32") {
	console.log("Installer process-cleanup check skipped: POSIX sh is not available on Windows.");
	process.exit(0);
}
if (shellProbe.error || shellProbe.status !== 0) {
	console.error(`Installer process-cleanup check failed: could not start POSIX sh.${formatSpawnFailure(shellProbe)}`);
	process.exit(1);
}

const tempDir = mkdtempSync(join(tmpdir(), "prime-agent-installer-cleanup-"));
const activeProcesses = new Set();

try {
	assertNormalSuccess();
	assertNormalFailure();
	assertNonAnimatedPath();
	assertOutputOnlyCleanupIsIdempotent();
	if (process.platform === "win32") {
		console.log("Installer process-cleanup signal cases skipped: portable POSIX signal delivery is unavailable on Windows.");
	} else {
		await assertInterruptedTreeCleanup("term-tree", "term", false);
		await assertInterruptedTreeCleanup("kill-tree", "ignore-term", true);
	}
} finally {
	for (const pid of activeProcesses) {
		killDetachedTree(pid);
	}
	rmSync(tempDir, { recursive: true, force: true });
}

if (failures.length > 0) {
	console.error(["Installer process-cleanup check failed:", ...failures.map((failure) => `- ${failure}`)].join("\n"));
	process.exit(1);
}

console.log("Installer process-cleanup check passed.");

function assertNormalSuccess() {
	const result = runSyncCase("normal-success", "success");
	check(result.status === 0, `normal-success: expected status 0${formatCaseFailure(result)}`);
	check(!result.stdout.includes("successful output"), "normal-success: animated command output was not kept quiet");
	assertOwnershipCleared(result, "normal-success");
}

function assertNormalFailure() {
	const result = runSyncCase("normal-failure", "failure");
	check(result.status === 23, `normal-failure: expected status 23${formatCaseFailure(result)}`);
	check(result.stderr.includes("expected failure output"), "normal-failure: captured failure output was not reported");
	assertOwnershipCleared(result, "normal-failure");
}

function assertNonAnimatedPath() {
	const result = runSyncCase("plain-success", "plain-success");
	check(result.status === 0, `plain-success: expected status 0${formatCaseFailure(result)}`);
	check(result.stdout.includes("successful output"), "plain-success: synchronous command output was not preserved");
	check(!existsSync(result.outputDir), "plain-success: synchronous path created an animation output directory");
	assertOwnershipCleared(result, "plain-success");
}

function assertOutputOnlyCleanupIsIdempotent() {
	const result = runSyncCase("output-only", "output-only");
	check(result.status === 0, `output-only: expected status 0${formatCaseFailure(result)}`);
	check(!existsSync(result.outputDir), "output-only: cleanup left a tracked output directory when no PID was set");
	assertOwnershipCleared(result, "output-only");
}

async function assertInterruptedTreeCleanup(label, helperMode, expectsEscalation) {
	const fixture = prepareCase(label);
	const unrelated = spawn("sh", ["-c", "while :; do sleep 1; done"], {
		detached: true,
		stdio: "ignore",
	});
	if (unrelated.pid === undefined) {
		failures.push(`${label}: unrelated control process did not start`);
		return;
	}
	activeProcesses.add(unrelated.pid);

	const child = spawn("sh", [fixture.harnessPath, helperMode], {
		detached: true,
		env: fixture.env,
		stdio: ["ignore", "pipe", "pipe"],
	});
	if (child.pid === undefined) {
		failures.push(`${label}: harness did not start`);
		return;
	}
	activeProcesses.add(child.pid);
	const stdout = [];
	const stderr = [];
	child.stdout.on("data", (chunk) => stdout.push(chunk));
	child.stderr.on("data", (chunk) => stderr.push(chunk));

	const ready = await waitUntil(
		() => readPid(fixture.rootPidPath) !== null && readPid(fixture.descendantPidPath) !== null,
		5_000,
	);
	if (!ready) {
		failures.push(`${label}: command tree did not report both PIDs before timeout`);
		killDetachedTree(child.pid);
		return;
	}
	const rootPid = readPid(fixture.rootPidPath);
	const descendantPid = readPid(fixture.descendantPidPath);
	if (rootPid === null || descendantPid === null) return;

	const startedAt = Date.now();
	child.kill("SIGTERM");
	const outcome = await waitForExit(child, 5_000);
	activeProcesses.delete(child.pid);
	const elapsedMs = Date.now() - startedAt;
	const result = {
		...fixture,
		status: outcome.code,
		signal: outcome.signal,
		stderr: Buffer.concat(stderr).toString("utf-8"),
		stdout: Buffer.concat(stdout).toString("utf-8"),
	};

	check(outcome.timedOut === false, `${label}: interrupted harness did not exit within five seconds`);
	check(outcome.code === 143, `${label}: expected preserved signal status 143${formatCaseFailure(result)}`);
	check(!processIsRunning(rootPid), `${label}: tracked command root ${rootPid} survived cleanup`);
	check(!processIsRunning(descendantPid), `${label}: tracked descendant ${descendantPid} survived cleanup`);
	check(!existsSync(fixture.outputDir), `${label}: animation output directory survived cleanup`);
	check(
		readFileIfPresent(fixture.reapLogPath).trimEnd().split("\n").includes("reaped"),
		`${label}: cleanup did not prove the tracked direct child was reaped before terminal restoration`,
	);
	check(processIsRunning(unrelated.pid), `${label}: cleanup terminated an unrelated control process`);
	if (expectsEscalation) {
		check(elapsedMs >= 350, `${label}: TERM-resistant tree exited before the bounded grace period (${elapsedMs}ms)`);
	}
	check(elapsedMs < 4_000, `${label}: cleanup exceeded its bounded termination window (${elapsedMs}ms)`);
}

function runSyncCase(label, mode) {
	const fixture = prepareCase(label);
	const result = spawnSync("sh", [fixture.harnessPath, mode], {
		detached: true,
		encoding: "utf-8",
		env: fixture.env,
		timeout: 5_000,
	});
	return { ...fixture, ...result };
}

function prepareCase(label) {
	const caseDir = join(tempDir, label);
	const outputDir = join(caseDir, "animation output");
	const rootPidPath = join(caseDir, "root.pid");
	const descendantPidPath = join(caseDir, "descendant.pid");
	const reapLogPath = join(caseDir, "reap.log");
	const helperPath = join(caseDir, "helper.sh");
	const harnessPath = join(caseDir, "harness.sh");
	mkdirSync(caseDir, { recursive: true });

	writeFileSync(
		helperPath,
		`#!/bin/sh
mode="$1"
printf '%s' "$$" > "$PRIME_AGENT_TEST_ROOT_PID"
case "$mode" in
	success|plain-success)
		printf 'successful output\\n'
		exit 0
		;;
	failure)
		printf 'expected failure output\\n' >&2
		exit 23
		;;
	term|ignore-term)
		if [ "$mode" = ignore-term ]; then
			trap '' TERM
			child_trap="trap '' TERM;"
		else
			child_trap=
		fi
		sh -c "$child_trap printf '%s' \\\"\\$\\$\\\" > \\\"$PRIME_AGENT_TEST_DESCENDANT_PID\\\"; while :; do sleep 1; done" &
		wait "$!"
		;;
esac
`,
		"utf-8",
	);
	chmodSync(helperPath, 0o755);

	const harnessSource = `${installerSource.slice(0, mainCallIndex)}

create_temp_dir() {
	mkdir -p "$PRIME_AGENT_TEST_OUTPUT_DIR"
	printf '%s' "$PRIME_AGENT_TEST_OUTPUT_DIR"
}

prime_agent_screen() {
	:
}

prime_agent_restore_terminal() {
	if [ -s "$PRIME_AGENT_TEST_ROOT_PID" ]; then
		root_pid=$(cat "$PRIME_AGENT_TEST_ROOT_PID")
		if kill -0 "$root_pid" 2>/dev/null; then
			printf 'alive\\n' >> "$PRIME_AGENT_TEST_REAP_LOG"
		else
			printf 'reaped\\n' >> "$PRIME_AGENT_TEST_REAP_LOG"
		fi
	fi
}

mode="$1"
if [ "$mode" = output-only ]; then
	mkdir -p "$PRIME_AGENT_TEST_OUTPUT_DIR"
	prime_agent_animation_command_pid=
	prime_agent_animation_output_dir="$PRIME_AGENT_TEST_OUTPUT_DIR"
	prime_agent_stop_animation_command
	prime_agent_stop_animation_command
	command_status=0
else
	prime_agent_screen_enabled=1
	if [ "$mode" = plain-success ]; then
		prime_agent_screen_enabled=0
	fi
	prime_agent_install_traps
	if prime_agent_run_quiet_with_animation_command title status detail pulse "$PRIME_AGENT_TEST_HELPER" "$mode"; then
		command_status=0
	else
		command_status=$?
	fi
	prime_agent_restore_terminal
fi
printf '__OWNERSHIP__ pid=%s dir=%s\\n' "\${prime_agent_animation_command_pid:-}" "\${prime_agent_animation_output_dir:-}"
exit "$command_status"
`;
	writeFileSync(harnessPath, harnessSource, "utf-8");
	chmodSync(harnessPath, 0o755);

	return {
		caseDir,
		descendantPidPath,
		env: {
			...process.env,
			PRIME_AGENT_TEST_DESCENDANT_PID: descendantPidPath,
			PRIME_AGENT_TEST_HELPER: helperPath,
			PRIME_AGENT_TEST_OUTPUT_DIR: outputDir,
			PRIME_AGENT_TEST_REAP_LOG: reapLogPath,
			PRIME_AGENT_TEST_ROOT_PID: rootPidPath,
		},
		harnessPath,
		outputDir,
		reapLogPath,
		rootPidPath,
	};
}

function assertOwnershipCleared(result, label) {
	check(result.stdout.includes("__OWNERSHIP__ pid= dir="), `${label}: active ownership globals were not cleared`);
	check(!existsSync(result.outputDir), `${label}: animation output directory remained after completion`);
}

function readPid(path) {
	if (!existsSync(path)) return null;
	const pid = Number(readFileSync(path, "utf-8"));
	return Number.isInteger(pid) && pid > 0 ? pid : null;
}

function readFileIfPresent(path) {
	return existsSync(path) ? readFileSync(path, "utf-8") : "";
}

function processIsRunning(pid) {
	const result = spawnSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf-8" });
	if (result.status !== 0) return false;
	const state = result.stdout.trim();
	return state.length > 0 && !state.includes("Z");
}

async function waitUntil(predicate, timeoutMs) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (predicate()) return true;
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
	return predicate();
}

function waitForExit(child, timeoutMs) {
	return new Promise((resolve) => {
		let settled = false;
		const timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			killDetachedTree(child.pid);
			resolve({ code: null, signal: null, timedOut: true });
		}, timeoutMs);
		child.once("close", (code, signal) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			resolve({ code, signal, timedOut: false });
		});
	});
}

function killDetachedTree(pid) {
	if (!Number.isInteger(pid) || pid <= 0) return;
	try {
		process.kill(-pid, "SIGKILL");
	} catch {
		try {
			process.kill(pid, "SIGKILL");
		} catch {
			// Already exited.
		}
	}
}

function check(condition, message) {
	if (!condition) failures.push(message);
}

function formatCaseFailure(result) {
	return `\nstatus: ${result.status ?? "unknown"}\nstdout:\n${result.stdout ?? ""}\nstderr:\n${result.stderr ?? ""}`;
}

function formatSpawnFailure(result) {
	const details = [];
	if (result.error) details.push(result.error.message);
	if (result.stderr) details.push(result.stderr.trimEnd());
	if (result.stdout) details.push(result.stdout.trimEnd());
	return details.length > 0 ? `\n${details.join("\n")}` : "";
}
