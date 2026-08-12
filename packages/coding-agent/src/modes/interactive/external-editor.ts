import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { createPrivateTempFile, readPrivateFile } from "../../utils/private-files.js";

type ExternalEditorTui = {
	terminal: { drainInput: (maxMs?: number, idleMs?: number) => Promise<void> };
	start: () => void;
	stop: () => void;
	requestRender: (force?: boolean) => void;
};

export async function runExternalEditor(options: {
	tui: ExternalEditorTui;
	command: string;
	content: string;
	onTuiRestart?: () => void;
}): Promise<string | undefined> {
	const temp = createPrivateTempFile("prime-agent-editor-", ".md", options.content);
	let tuiStopped = false;

	try {
		await options.tui.terminal.drainInput(1000);
		options.tui.stop();
		tuiStopped = true;

		const [editor, ...editorArgs] = options.command.split(" ");
		const result = spawnSync(editor, [...editorArgs, temp.path], {
			stdio: "inherit",
			shell: process.platform === "win32",
		});
		if (result.error) {
			throw result.error;
		}
		return result.status === 0 ? readPrivateFile(temp.path, "utf-8").replace(/\n$/, "") : undefined;
	} finally {
		rmSync(temp.directory, { recursive: true, force: true });
		if (tuiStopped) {
			options.tui.start();
			options.onTuiRestart?.();
			options.tui.requestRender(true);
		}
	}
}
