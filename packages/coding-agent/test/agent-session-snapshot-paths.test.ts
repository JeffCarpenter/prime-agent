import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./suite/harness.js";

describe("AgentSession REPL snapshot paths", () => {
	const harnesses: Harness[] = [];

	afterEach(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	it("gives active IPython and Xonsh provisioners separate artifact paths", async () => {
		const harness = await createHarness({ persistSession: true });
		harnesses.push(harness);

		harness.session.setActiveToolsByName(["ipython", "xonsh"]);
		expect(harness.session.getActiveToolNames()).toEqual(["ipython", "xonsh"]);

		const internals = harness.session as unknown as {
			_ipythonKernelProvisioner: object;
			_xonshKernelProvisioner: object;
		};
		const ipythonOptions = Reflect.get(internals._ipythonKernelProvisioner, "options") as { snapshotDir?: string };
		const xonshOptions = Reflect.get(internals._xonshKernelProvisioner, "options") as { snapshotDir?: string };
		const artifactDir = harness.sessionManager.getSessionArtifactDir();
		if (artifactDir === undefined) {
			throw new Error("Expected a persisted session to have an artifact directory");
		}
		const xonshArtifactDir = join(artifactDir, "xonsh");
		const ipythonSnapshotDir = ipythonOptions.snapshotDir;
		if (ipythonSnapshotDir === undefined) {
			throw new Error("Expected the IPython provisioner to have a snapshot directory");
		}
		const xonshSnapshotDir = xonshOptions.snapshotDir;
		if (xonshSnapshotDir === undefined) {
			throw new Error("Expected the Xonsh provisioner to have a snapshot directory");
		}

		expect(ipythonSnapshotDir).toBe(artifactDir);
		expect(join(ipythonSnapshotDir, "kernel-stderr.log")).toBe(join(artifactDir, "kernel-stderr.log"));
		expect(xonshSnapshotDir).toBe(xonshArtifactDir);
		expect(join(xonshSnapshotDir, "kernel-stderr.log")).toBe(join(xonshArtifactDir, "kernel-stderr.log"));
		expect(xonshOptions.snapshotDir).not.toBe(ipythonOptions.snapshotDir);
		expect(existsSync(xonshArtifactDir)).toBe(true);
	});
});
