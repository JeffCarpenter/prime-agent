import { ProcessTerminal, setKeybindings, TUI } from "@earendil-works/pi-tui";
import { KeybindingsManager } from "../../src/core/keybindings.js";
import { LoginDialogComponent } from "../../src/modes/interactive/components/login-dialog.js";
import { initTheme } from "../../src/modes/interactive/theme/theme.js";

initTheme("dark");
setKeybindings(new KeybindingsManager());
process.env.SSH_CONNECTION = "client server";

const tui = new TUI(new ProcessTerminal());
const originalStart = tui.start.bind(tui);
let starts = 0;
tui.start = () => {
	originalStart();
	starts += 1;
	if (starts === 2) {
		setTimeout(() => {
			process.stdout.write("TUI_RESUMED\r\n");
		}, 50);
		setTimeout(() => {
			tui.stop();
			process.exit(0);
		}, 200);
	}
};

process.on("SIGINT", () => {
	process.stdout.write("PROCESS_EXITED_ON_SIGINT\r\n");
	process.exit(23);
});

tui.start();
const dialog = new LoginDialogComponent(tui, "anthropic", () => {}, "Anthropic");
tui.addChild(dialog);
dialog.showAuth("https://example.com/oauth?client_id=e2e");

setTimeout(() => {
	process.stdout.write("E2E_TIMEOUT\r\n");
	tui.stop();
	process.exit(24);
}, 5_000).unref();
