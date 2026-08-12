import { spawnSync } from "node:child_process";
import {
	chmodSync,
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const installerSource = readFileSync("install.sh", "utf-8");
const mainCall = '\nmain "$@"';
const mainCallIndex = installerSource.lastIndexOf(mainCall);
const failures = [];

if (mainCallIndex === -1) {
	console.error('Installer owned-prefix check failed: could not find final main "$@" call.');
	process.exit(1);
}

const shellProbe = spawnSync("sh", ["-c", ":"], { encoding: "utf-8" });
if (shellProbe.error?.code === "ENOENT" && process.platform === "win32") {
	console.log("Installer owned-prefix check skipped: POSIX sh is not available on Windows.");
	process.exit(0);
}
if (shellProbe.error || shellProbe.status !== 0) {
	console.error(`Installer owned-prefix check failed: could not start POSIX sh.${formatSpawnFailure(shellProbe)}`);
	process.exit(1);
}

const tempDir = mkdtempSync(join(tmpdir(), "prime-agent-installer-prefix-"));

try {
	assertDefaultPrefixes();
	assertSuccessfulMigration();
	assertIdempotentUpdate();
	assertSamePrefixAlias();
	assertUnrelatedCommandIsPreserved();
	assertBrokenLegacyCommandIsRepaired();
	assertLegacyUninstallFailureIsActionable();
	assertInstallFailurePreservesLegacyCommand();
	assertLinkFailurePreservesLegacyCommand();
} finally {
	rmSync(tempDir, { recursive: true, force: true });
}

if (failures.length > 0) {
	console.error(["Installer owned-prefix check failed:", ...failures.map((failure) => `- ${failure}`)].join("\n"));
	process.exit(1);
}

console.log("Installer owned-prefix check passed.");

function assertDefaultPrefixes() {
	const homeDir = join(tempDir, "home with spaces");
	const xdgDir = join(tempDir, "xdg with spaces");
	mkdirSync(homeDir, { recursive: true });
	mkdirSync(xdgDir, { recursive: true });

	const homeCase = runHarness("home-prefix", { homeDir, mode: "prefix-only" });
	check(
		homeCase.stdout === join(homeDir, ".local", "share", "prime-agent", "npm"),
		`home-prefix: unexpected default owned prefix ${JSON.stringify(homeCase.stdout)}`,
	);

	const xdgCase = runHarness("xdg-prefix", { homeDir, mode: "prefix-only", xdgDir });
	check(
		xdgCase.stdout === join(xdgDir, "prime-agent", "npm"),
		`xdg-prefix: unexpected XDG owned prefix ${JSON.stringify(xdgCase.stdout)}`,
	);

	const customPrefix = join(tempDir, "custom owned prefix");
	const customCase = runHarness("custom-prefix", {
		customPrefix,
		homeDir,
		mode: "prefix-only",
		xdgDir,
	});
	check(
		customCase.stdout === customPrefix,
		`custom-prefix: expected override ${customPrefix}; got ${JSON.stringify(customCase.stdout)}`,
	);
}

function assertSuccessfulMigration() {
	const testCase = runHarness("successful-migration", {
		createLegacyPackage: true,
		createUnrelatedPackage: true,
		verifyGlobalUpdate: true,
	});
	check(testCase.status === 0, `successful-migration: expected success${formatCaseFailure(testCase)}`);
	assertInstallUsesOwnedPrefix(testCase);
	assertCommandPointsToOwnedPrefix(testCase);
	check(!existsSync(testCase.legacyPackageDir), "successful-migration: legacy package remained in the user npm tree");
	check(
		testCase.npmLog.some((line) => line.startsWith("uninstall -g --prefix ")),
		"successful-migration: expected an explicit legacy uninstall",
	);
	check(
		testCase.npmLog.some((line) => line === "update -g --dry-run --offline"),
		"successful-migration: expected an offline global update resolution check",
	);
	check(existsSync(testCase.unrelatedPackageDir), "successful-migration: unrelated global package was removed");
}

function assertIdempotentUpdate() {
	const first = runHarness("idempotent-update", { createLegacyPackage: true, keepCaseDir: true });
	check(first.status === 0, `idempotent-update first run: expected success${formatCaseFailure(first)}`);
	const second = runHarness("idempotent-update", { keepCaseDir: true, reuseCaseDir: true });
	check(second.status === 0, `idempotent-update second run: expected success${formatCaseFailure(second)}`);
	assertCommandPointsToOwnedPrefix(second);
	check(
		second.npmLog.filter((line) => line.startsWith("uninstall -g --prefix ")).length === 1,
		"idempotent-update: repeated install should not attempt a second legacy uninstall",
	);
}

function assertSamePrefixAlias() {
	const caseDir = join(tempDir, "same-prefix-alias");
	const userPrefix = join(caseDir, "user prefix");
	const aliasPrefix = join(caseDir, "owned alias");
	mkdirSync(userPrefix, { recursive: true });
	symlinkSync(userPrefix, aliasPrefix, "dir");
	const testCase = runHarness("same-prefix-alias", {
		ownedPrefix: aliasPrefix,
		reuseCaseDir: true,
		userPrefix,
	});
	check(testCase.status !== 0, "same-prefix-alias: expected aliasing global and owned prefixes to be rejected");
	check(
		testCase.stderr.includes("install prefix must differ from npm global prefix"),
		`same-prefix-alias: missing actionable rejection${formatCaseFailure(testCase)}`,
	);
	check(
		testCase.npmLog.every((line) => !line.startsWith("install -g") && !line.startsWith("uninstall -g")),
		"same-prefix-alias: aliasing prefixes must not install or uninstall a package",
	);
}

function assertUnrelatedCommandIsPreserved() {
	const unrelatedTarget = join(tempDir, "unrelated", "prime-agent");
	mkdirSync(dirname(unrelatedTarget), { recursive: true });
	writeFileSync(unrelatedTarget, "unrelated command\n", "utf-8");
	const testCase = runHarness("unrelated-command", { existingCommandTarget: unrelatedTarget });
	check(testCase.status !== 0, "unrelated-command: expected installer to refuse ownership takeover");
	check(
		testCase.stderr.includes("refusing to replace unrelated command"),
		`unrelated-command: missing actionable refusal${formatCaseFailure(testCase)}`,
	);
	check(
		lstatSync(testCase.userShim).isSymbolicLink() && realpathSync(testCase.userShim) === realpathSync(unrelatedTarget),
		"unrelated-command: existing command target changed",
	);
	check(
		testCase.npmLog.every((line) => !line.startsWith("uninstall -g --prefix ")),
		"unrelated-command: legacy uninstall ran before command ownership was established",
	);
}

function assertBrokenLegacyCommandIsRepaired() {
	const testCase = runHarness("broken-legacy-command", { createBrokenLegacyCommand: true });
	check(testCase.status === 0, `broken-legacy-command: expected repair${formatCaseFailure(testCase)}`);
	assertCommandPointsToOwnedPrefix(testCase);
}

function assertLegacyUninstallFailureIsActionable() {
	const testCase = runHarness("legacy-uninstall-failure", { createLegacyPackage: true, failUninstall: true });
	check(testCase.status !== 0, "legacy-uninstall-failure: expected the installer to report failure");
	check(
		testCase.stderr.includes("could not remove the legacy global package"),
		`legacy-uninstall-failure: missing actionable migration error${formatCaseFailure(testCase)}`,
	);
	assertCommandPointsToOwnedPrefix(testCase);
	check(existsSync(testCase.legacyPackageDir), "legacy-uninstall-failure: fake npm unexpectedly removed legacy package");
}

function assertInstallFailurePreservesLegacyCommand() {
	const testCase = runHarness("install-failure", { createLegacyPackage: true, failInstall: true });
	check(testCase.status !== 0, "install-failure: expected npm install failure");
	assertCommandPointsToLegacyPackage(testCase);
	check(existsSync(testCase.legacyPackageDir), "install-failure: legacy package was removed after failed install");
}

function assertLinkFailurePreservesLegacyCommand() {
	const testCase = runHarness("link-failure", { createLegacyPackage: true, failLink: true });
	check(testCase.status !== 0, "link-failure: expected prepared-link failure");
	check(
		testCase.stderr.includes("could not prepare Prime Agent command link"),
		`link-failure: missing actionable link error${formatCaseFailure(testCase)}`,
	);
	assertCommandPointsToLegacyPackage(testCase);
	check(existsSync(testCase.legacyPackageDir), "link-failure: legacy package was removed before link preparation succeeded");
}

function runHarness(label, options = {}) {
	const caseDir = join(tempDir, label);
	if (!options.reuseCaseDir) {
		rmSync(caseDir, { recursive: true, force: true });
	}
	mkdirSync(caseDir, { recursive: true });
	const harnessPath = join(caseDir, "harness.sh");
	const fakeBinDir = join(caseDir, "fake bin");
	const fakeNpmPath = join(fakeBinDir, "npm");
	const fakeLnPath = join(fakeBinDir, "ln");
	const userPrefix = options.userPrefix ?? join(caseDir, "user prefix");
	const ownedPrefix = options.ownedPrefix ?? join(caseDir, "owned prefix");
	const npmLog = join(caseDir, "npm.log");
	const tarballPath = join(caseDir, "prime agent-0.0.0.tgz");
	const userShim = join(userPrefix, "bin", "prime-agent");
	const ownedBin = join(ownedPrefix, "bin", "prime-agent");
	const legacyPackageDir = join(userPrefix, "lib", "node_modules", "prime-agent");
	const legacyBin = join(legacyPackageDir, "prime-agent.sh");
	const harnessAction =
		options.mode === "prefix-only"
			? "prime_agent_owned_npm_prefix"
			: `install_prime_agent_package "$PRIME_AGENT_TEST_TARBALL"${
					options.verifyGlobalUpdate ? "\nnpm update -g --dry-run --offline" : ""
				}`;
	const harnessSource = `${installerSource.slice(0, mainCallIndex)}

prime_agent_run_quiet_with_animation_steps() {
	shift 3
	"$@"
}

prime_agent_user_npm_prefix() {
	printf '%s' "$PRIME_AGENT_TEST_USER_PREFIX"
}

prime_agent_bootstrap_kernel_on_install=0
${harnessAction}
`;

	mkdirSync(fakeBinDir, { recursive: true });
	mkdirSync(join(userPrefix, "bin"), { recursive: true });
	mkdirSync(resolve(ownedPrefix), { recursive: true });
	writeFileSync(harnessPath, harnessSource, "utf-8");
	writeFileSync(tarballPath, "fake tarball", "utf-8");
	writeFakeNpm(fakeNpmPath);
	writeFakeLn(fakeLnPath);

	if (options.createLegacyPackage && !existsSync(legacyPackageDir)) {
		mkdirSync(legacyPackageDir, { recursive: true });
		writeFileSync(legacyBin, "#!/bin/sh\n", "utf-8");
		chmodSync(legacyBin, 0o755);
		if (!existsSync(userShim)) symlinkSync(legacyBin, userShim);
	}
	if (options.createBrokenLegacyCommand && !existsSync(userShim)) {
		symlinkSync(legacyBin, userShim);
	}
	const unrelatedPackageDir = join(userPrefix, "lib", "node_modules", "unrelated-package");
	if (options.createUnrelatedPackage) {
		mkdirSync(unrelatedPackageDir, { recursive: true });
		writeFileSync(join(unrelatedPackageDir, "package.json"), '{"name":"unrelated-package","version":"1.0.0"}\n');
	}
	if (options.existingCommandTarget && !existsSync(userShim)) {
		symlinkSync(options.existingCommandTarget, userShim);
	}

	const result = spawnSync("sh", [harnessPath], {
		detached: true,
		encoding: "utf-8",
		env: {
			...process.env,
			HOME: options.homeDir ?? join(caseDir, "home"),
			PATH: `${fakeBinDir}:${process.env.PATH ?? ""}`,
			PRIME_AGENT_INSTALL_PREFIX: options.customPrefix ?? (options.mode === "prefix-only" ? "" : ownedPrefix),
			PRIME_AGENT_TEST_FAIL_INSTALL: options.failInstall ? "1" : "0",
			PRIME_AGENT_TEST_FAIL_LINK: options.failLink ? "1" : "0",
			PRIME_AGENT_TEST_FAIL_UNINSTALL: options.failUninstall ? "1" : "0",
			PRIME_AGENT_TEST_NPM_LOG: npmLog,
			PRIME_AGENT_TEST_OWNED_PREFIX: ownedPrefix,
			PRIME_AGENT_TEST_USER_PREFIX: userPrefix,
			PRIME_AGENT_TEST_TARBALL: tarballPath,
			XDG_DATA_HOME: options.xdgDir ?? "",
		},
	});

	return {
		label,
		legacyBin,
		legacyPackageDir,
		npmLog: existsSync(npmLog) ? readFileSync(npmLog, "utf-8").trimEnd().split("\n").filter(Boolean) : [],
		ownedBin,
		ownedPrefix,
		status: result.status,
		stderr: result.stderr,
		stdout: result.stdout,
		userShim,
		unrelatedPackageDir,
	};
}

function writeFakeNpm(fakeNpmPath) {
	writeFileSync(
		fakeNpmPath,
		`#!/bin/sh
set -eu
printf '%s\\n' "$*" >> "$PRIME_AGENT_TEST_NPM_LOG"
if [ "\${1:-}" = prefix ] && [ "\${2:-}" = -g ]; then
	printf '%s\\n' "$PRIME_AGENT_TEST_USER_PREFIX"
	exit 0
fi
if [ "\${1:-}" = --version ]; then
	printf '12.0.0\\n'
	exit 0
fi
if [ "\${1:-}" = install ]; then
	if [ "$PRIME_AGENT_TEST_FAIL_INSTALL" = 1 ]; then
		printf 'simulated npm install failure\\n' >&2
		exit 17
	fi
	prefix=
	while [ "$#" -gt 0 ]; do
		if [ "$1" = --prefix ]; then
			shift
			prefix="\${1:-}"
		fi
		shift || true
	done
	if [ -z "$prefix" ]; then
		printf 'missing --prefix for npm install\\n' >&2
		exit 18
	fi
	mkdir -p "$prefix/bin" "$prefix/lib/node_modules/prime-agent"
	printf '#!/bin/sh\\n' > "$prefix/bin/prime-agent"
	chmod +x "$prefix/bin/prime-agent"
	exit 0
fi
if [ "\${1:-}" = uninstall ]; then
	if [ "$PRIME_AGENT_TEST_FAIL_UNINSTALL" = 1 ]; then
		printf 'simulated npm uninstall failure\\n' >&2
		exit 19
	fi
	rm -rf "$PRIME_AGENT_TEST_USER_PREFIX/lib/node_modules/prime-agent"
	exit 0
fi
if [ "\${1:-}" = update ]; then
	if [ -e "$PRIME_AGENT_TEST_USER_PREFIX/lib/node_modules/prime-agent" ]; then
		printf 'global update would resolve unpublished prime-agent package\\n' >&2
		exit 21
	fi
	if [ ! -e "$PRIME_AGENT_TEST_USER_PREFIX/lib/node_modules/unrelated-package" ]; then
		printf 'unrelated global package missing during update check\\n' >&2
		exit 22
	fi
	exit 0
fi
printf 'unexpected npm command: %s\\n' "$*" >&2
exit 23
`,
		"utf-8",
	);
	chmodSync(fakeNpmPath, 0o755);
}

function writeFakeLn(fakeLnPath) {
	writeFileSync(
		fakeLnPath,
		`#!/bin/sh
set -eu
if [ "$PRIME_AGENT_TEST_FAIL_LINK" = 1 ]; then
	printf 'simulated link failure\\n' >&2
	exit 21
fi
exec /bin/ln "$@"
`,
		"utf-8",
	);
	chmodSync(fakeLnPath, 0o755);
}

function assertInstallUsesOwnedPrefix(testCase) {
	check(
		testCase.npmLog.some((line) => line.includes(`install -g --prefix ${testCase.ownedPrefix}`)),
		`${testCase.label}: expected npm install to use ${testCase.ownedPrefix}; got ${testCase.npmLog.join(" | ")}`,
	);
}

function assertCommandPointsToOwnedPrefix(testCase) {
	check(existsSync(testCase.userShim), `${testCase.label}: expected ${testCase.userShim} to exist`);
	if (!existsSync(testCase.userShim)) return;
	check(lstatSync(testCase.userShim).isSymbolicLink(), `${testCase.label}: expected user command to be a symlink`);
	if (!lstatSync(testCase.userShim).isSymbolicLink()) return;
	check(
		realpathSync(testCase.userShim) === realpathSync(testCase.ownedBin),
		`${testCase.label}: user command does not point to the owned install`,
	);
}

function assertCommandPointsToLegacyPackage(testCase) {
	check(existsSync(testCase.userShim), `${testCase.label}: legacy command disappeared`);
	if (!existsSync(testCase.userShim)) return;
	check(
		lstatSync(testCase.userShim).isSymbolicLink() && realpathSync(testCase.userShim) === realpathSync(testCase.legacyBin),
		`${testCase.label}: legacy command target changed`,
	);
}

function check(condition, message) {
	if (!condition) failures.push(message);
}

function formatCaseFailure(testCase) {
	return `\nstatus: ${testCase.status ?? "unknown"}\nstdout:\n${testCase.stdout}\nstderr:\n${testCase.stderr}`;
}

function formatSpawnFailure(result) {
	const details = [];
	if (result.error) details.push(result.error.message);
	if (result.stderr) details.push(result.stderr.trimEnd());
	if (result.stdout) details.push(result.stdout.trimEnd());
	return details.length > 0 ? `\n${details.join("\n")}` : "";
}
