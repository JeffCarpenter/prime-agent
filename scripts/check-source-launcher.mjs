import { spawnSync } from "node:child_process";
import {
	chmodSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readlinkSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const tempDir = mkdtempSync(join(tmpdir(), "prime-agent-source-launcher-"));

try {
	const sourceRoot = join(tempDir, "source checkout");
	const scriptsDir = join(sourceRoot, "scripts");
	const tsxDir = join(sourceRoot, "node_modules", ".bin");
	const callerDir = join(tempDir, "caller project");
	const binDir = join(tempDir, "bin directory");
	mkdirSync(scriptsDir, { recursive: true });
	mkdirSync(tsxDir, { recursive: true });
	mkdirSync(callerDir, { recursive: true });

	const launcherPath = join(sourceRoot, "prime-agent.sh");
	const installerPath = join(scriptsDir, "install-source.sh");
	const tsxPath = join(tsxDir, "tsx");
	const tsconfigPath = join(sourceRoot, "tsconfig.json");
	const smokeLogPath = join(tempDir, "smoke.log");
	copyFileSync(join(root, "prime-agent.sh"), launcherPath);
	copyFileSync(join(root, "scripts", "install-source.sh"), installerPath);
	writeFileSync(tsconfigPath, "{}\n");
	writeFileSync(
		tsxPath,
		[
			"#!/bin/sh",
			'if [ "$PWD" = / ]; then',
			'  printf "%s\\n" "$@" > "$PRIME_AGENT_SMOKE_LOG"',
			'  if [ "${PRIME_AGENT_FAIL_SMOKE:-}" = 1 ]; then exit 23; fi',
			"fi",
			"printf '__CWD__%s\\n' \"$PWD\"",
			"printf '__LAUNCHER__%s\\n' \"$PRIME_AGENT_LAUNCHER_PATH\"",
			'for arg in "$@"; do',
			"  printf '__ARG__%s\\n' \"$arg\"",
			"done",
			"",
		].join("\n"),
	);
	chmodSync(launcherPath, 0o755);
	chmodSync(installerPath, 0o755);
	chmodSync(tsxPath, 0o755);

	const installEnv = {
		...process.env,
		PATH: binDir + ":" + (process.env.PATH ?? ""),
		PRIME_AGENT_BIN_DIR: binDir,
		PRIME_AGENT_SMOKE_LOG: smokeLogPath,
	};
	const firstInstall = spawnSync(installerPath, [], { encoding: "utf8", env: installEnv });
	assertSuccess(firstInstall, "source installer");
	assert(
		readFileSync(smokeLogPath, "utf8") ===
			["--tsconfig", tsconfigPath, join(sourceRoot, "packages", "coding-agent", "src", "cli.ts"), "--version", ""].join(
				"\n",
			),
		"source installer did not validate the installed command from outside the checkout",
	);

	const commandPath = join(binDir, "prime-agent");
	assert(readlinkSync(commandPath) === launcherPath, "source installer created the wrong symlink target");

	const secondInstall = spawnSync(installerPath, [], { encoding: "utf8", env: installEnv });
	assertSuccess(secondInstall, "idempotent source installer");
	assert(secondInstall.stdout.includes("already linked"), "source installer did not report an existing correct link");

	const args = ["value with spaces", "", "--", "literal"];
	const invocation = spawnSync(commandPath, args, { cwd: callerDir, encoding: "utf8", env: installEnv });
	assertSuccess(invocation, "symlinked source launcher");
	const expectedLines = [
		"__CWD__" + callerDir,
		"__LAUNCHER__" + launcherPath,
		"__ARG__--tsconfig",
		"__ARG__" + tsconfigPath,
		"__ARG__" + join(sourceRoot, "packages", "coding-agent", "src", "cli.ts"),
		...args.map((arg) => "__ARG__" + arg),
		"",
	];
	assert(invocation.stdout === expectedLines.join("\n"), "unexpected launcher output:\n" + invocation.stdout);

	const conflictingBinDir = join(tempDir, "conflicting bin");
	mkdirSync(conflictingBinDir, { recursive: true });
	const conflictingTarget = join(conflictingBinDir, "prime-agent");
	writeFileSync(conflictingTarget, "preserve me\n");
	const conflict = spawnSync(installerPath, [conflictingBinDir], { encoding: "utf8", env: process.env });
	assert(conflict.status !== 0, "source installer replaced a conflicting command");

	const failedSmokeBinDir = join(tempDir, "failed smoke bin");
	const failedSmoke = spawnSync(installerPath, [failedSmokeBinDir], {
		encoding: "utf8",
		env: { ...installEnv, PRIME_AGENT_FAIL_SMOKE: "1" },
	});
	assert(failedSmoke.status !== 0, "source installer accepted a failing installed command");
	assert(
		!existsSync(join(failedSmokeBinDir, "prime-agent")),
		"source installer left behind a newly created command after validation failed",
	);

	const chainedBinDir = join(tempDir, "chained bin");
	mkdirSync(chainedBinDir, { recursive: true });
	const intermediateLink = join(chainedBinDir, "intermediate");
	const chainedCommand = join(chainedBinDir, "prime-agent");
	symlinkSync(launcherPath, intermediateLink);
	symlinkSync("intermediate", chainedCommand);
	const chainedInvocation = spawnSync(chainedCommand, ["chain"], {
		cwd: callerDir,
		encoding: "utf8",
		env: process.env,
	});
	assertSuccess(chainedInvocation, "chained relative symlink launcher");
	assert(
		chainedInvocation.stdout.includes("__LAUNCHER__" + launcherPath + "\n"),
		"launcher did not resolve a chained relative symlink",
	);

	chmodSync(tsxPath, 0o644);
	const missingDependenciesBinDir = join(tempDir, "missing dependencies bin");
	const missingDependencies = spawnSync(installerPath, [missingDependenciesBinDir], {
		encoding: "utf8",
		env: process.env,
	});
	assert(missingDependencies.status !== 0, "source installer accepted a checkout without executable tsx");
	assert(
		missingDependencies.stderr.includes("pnpm install"),
		"source installer did not explain how to install missing dependencies",
	);
} finally {
	rmSync(tempDir, { recursive: true, force: true });
}

console.log("Source launcher check passed.");

function assertSuccess(result, label) {
	assert(
		result.status === 0,
		label + " exited with " + (result.status ?? "unknown") + ":\n" + (result.stderr ?? "") + (result.stdout ?? ""),
	);
}

function assert(condition, message) {
	if (!condition) throw new Error(message);
}
