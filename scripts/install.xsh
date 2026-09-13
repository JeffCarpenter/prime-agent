#!/usr/bin/env xonsh
"""Install Prime Agent from a release archive.

This is the Xonsh-native counterpart to install.sh. It deliberately keeps all
external command arguments structured instead of building shell command text.
"""

from __future__ import annotations

import atexit
import contextlib
import os
import platform
import re
import shlex
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
from dataclasses import dataclass, field

try:
    from wcwidth import wcswidth
except ImportError:
    def wcswidth(text: str) -> int:
        return len(text)
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import IO, TextIO

MIN_NODE_VERSION = (20, 6, 0)
NODE_DIST_BASE = "https://nodejs.org/dist/latest-v22.x"
RUNTIME_INSTALL_ENV = {
    "PRIME_AGENT_BOOTSTRAP_TOOLS_ON_INSTALL": "1",
}


@dataclass
class Screen:
    enabled: bool = False
    frame: int = 0
    cols: int = 80
    rows: int = 24
    drawn: bool = False
    last_cols: int = 0
    last_rows: int = 0
    layout_ready: bool = False
    show_logo_layout: bool = False
    lab_width: int = 0
    render_lab_width: int = 0
    compact: bool = False
    title: str = ""
    detail: str = ""
    question: str = ""


@dataclass
class Installer:
    env: dict[str, str] = field(default_factory=lambda: dict(os.environ))
    screen: Screen = field(default_factory=Screen)
    original_path: str = field(default_factory=lambda: os.environ.get("PATH", ""))
    download_dir: Path | None = None
    bootstrap_kernel: bool = False
    _cleanup_registered: bool = False

    def __post_init__(self) -> None:
        # Keep these sentinels split so release publishing only rewrites the
        # configured values below.
        self.unconfigured_base_url = "__PRIME_AGENT_DOWNLOAD_BASE" + "_URL__"
        self.unconfigured_channel = "__PRIME_AGENT_DEFAULT_RELEASE_" + "CHANNEL__"
        self.base_url = self.env.get("PRIME_AGENT_DOWNLOAD_BASE_URL", self.unconfigured_base_url).rstrip("/")
        configured_channel = "__PRIME_AGENT_DEFAULT_RELEASE_" + "CHANNEL__"
        self.default_channel = "stable" if configured_channel == self.unconfigured_channel else configured_channel
        self.release_channel = self.env.get("PRIME_AGENT_RELEASE_CHANNEL", self.default_channel)
        self.package = self.env.get("PRIME_AGENT_PACKAGE", "prime-agent")
        self.command = self.env.get("PRIME_AGENT_CMD", "prime-agent")
        esc = "\x1b"
        self.reset = f"{esc}[0m"
        self.bold = f"{esc}[1m"
        self.hide_cursor = f"{esc}[?25l"
        self.show_cursor = f"{esc}[?25h"
        self.home_cursor = f"{esc}[H"
        self.clear_screen = f"{esc}[2J{esc}[H"
        self.clear_line = f"{esc}[K"
        self.sync_start = f"{esc}[?2026h"
        self.sync_end = f"{esc}[?2026l"
        self.color_text = f"{esc}[38;2;244;244;245m"
        self.color_muted = f"{esc}[38;2;161;161;170m"
        self.color_dim = f"{esc}[38;2;113;113;122m"
        self.color_primary = f"{esc}[38;2;127;91;213m"
        self.color_scan = f"{esc}[38;2;14;165;233m"
        self.color_warning = f"{esc}[38;2;245;158;11m"
        self._quiet_output = None

    def command_path(self, name: str, path: str | None = None) -> str | None:
        return shutil.which(name, path=path)

    def run(
        self,
        args: Sequence[object],
        *,
        check: bool = True,
        capture: bool = False,
        cwd: Path | None = None,
        env: dict[str, str] | None = None,
        stdin: IO[str] | int | None = None,
    ) -> subprocess.CompletedProcess[str]:
        result = subprocess.run(
            [str(arg) for arg in args],
            check=False,
            cwd=cwd,
            env={**self.env, **(env or {})},
            stdin=stdin,
            stdout=subprocess.PIPE if capture else self._quiet_output,
            stderr=subprocess.PIPE if capture else self._quiet_output,
            text=True,
        )
        if check and result.returncode:
            command = " ".join(shlex.quote(str(arg)) for arg in args)
            detail = (result.stderr or result.stdout or "").strip()
            raise RuntimeError(f"{command} failed with exit code {result.returncode}" + (f": {detail}" if detail else ""))
        return result

    def run_inherited(self, args: Sequence[object], **kwargs: object) -> None:
        self.run(args, **kwargs)

    def temp_dir(self) -> Path:
        try:
            return Path(tempfile.mkdtemp(prefix="prime-agent-install.", dir=self.env.get("TMPDIR") or None))
        except OSError as error:
            print(f"error: could not create a secure temporary directory: {error}", file=sys.stderr)
            raise SystemExit(1) from error

    def register_traps(self) -> None:
        if self._cleanup_registered:
            return
        atexit.register(self.cleanup)
        signal.signal(signal.SIGINT, lambda _signum, _frame: self.signal_cleanup(130))
        signal.signal(signal.SIGTERM, lambda _signum, _frame: self.signal_cleanup(143))
        self._cleanup_registered = True

    def cleanup(self) -> None:
        if self.download_dir and self.download_dir.exists():
            shutil.rmtree(self.download_dir, ignore_errors=True)
            self.download_dir = None
        self.restore_terminal()

    def signal_cleanup(self, status: int) -> None:
        self.restore_terminal()
        raise SystemExit(status)

    def restore_terminal(self) -> None:
        if not self.screen.enabled:
            return
        text = self.reset + self.show_cursor
        try:
            with open("/dev/tty", "w", encoding="utf-8") as tty:
                tty.write(text)
                tty.flush()
        except OSError:
            print(text, end="", file=sys.stderr, flush=True)

    def init_screen(self) -> None:
        if self.env.get("PRIME_AGENT_INSTALLER_PLAIN", "0") == "1":
            return
        if not sys.stdout.isatty() or self.env.get("TERM", "") == "dumb":
            return
        self.screen.enabled = True

    def terminal_size(self) -> tuple[int, int]:
        fd: int | None = None
        try:
            fd = os.open("/dev/tty", os.O_RDONLY)
            output = self.run(["stty", "size"], capture=True, check=False, stdin=fd).stdout
            rows, cols = (int(value) for value in output.split())
        except (OSError, ValueError):
            rows, cols = 24, 80
        finally:
            if fd is not None:
                os.close(fd)
        return max(cols, 1), max(rows, 1)

    def read_terminal_size(self) -> None:
        self.screen.cols, self.screen.rows = self.terminal_size()

    def write_screen(self, text: str) -> None:
        try:
            with open("/dev/tty", "w", encoding="utf-8") as tty:
                tty.write(text)
                tty.flush()
        except OSError:
            print(text, end="", file=sys.stderr, flush=True)

    def screen_update(self, first: str, display: str = "", detail: str = "", question: str = "") -> None:
        if not self.screen.enabled:
            return
        self.screen.title = display or first
        self.screen.detail = detail
        self.screen.question = question
        self.screen.frame += 1
        self.read_terminal_size()
        self.init_screen_layout()
        self.refresh_screen_layout_mode()
        resized = self.screen.cols != self.screen.last_cols or self.screen.rows != self.screen.last_rows
        prefix = self.reset + self.clear_screen + self.hide_cursor if not self.screen.drawn or resized else self.reset + self.home_cursor + self.hide_cursor
        self.screen.drawn = True
        self.screen.last_cols, self.screen.last_rows = self.screen.cols, self.screen.rows
        self.write_screen(self.sync_start + prefix + self.render_screen() + self.sync_end)

    def init_screen_layout(self) -> None:
        if self.screen.layout_ready:
            return
        self.screen.layout_ready = True
        self.screen.show_logo_layout = self.terminal_supports_logo()
        self.screen.lab_width = self.lab_width_for_cols(self.screen.cols) if self.screen.show_logo_layout else 0

    def refresh_screen_layout_mode(self) -> None:
        self.screen.compact = False
        self.screen.render_lab_width = 0
        if not self.screen.show_logo_layout:
            return
        if self.screen.rows < 17 or self.screen.cols - 1 < 32:
            self.screen.compact = True
            return
        self.screen.render_lab_width = min(self.screen.lab_width, self.screen.cols - 1)

    def terminal_supports_logo(self) -> bool:
        return self.screen.rows >= 22 and self.screen.cols >= 42

    @staticmethod
    def lab_width_for_cols(cols: int) -> int:
        width = min(cols - 6, 78)
        width = max(width, 42)
        width = min(width, max(cols - 1, 1))
        return max(width, 32)

    def show_logo(self) -> bool:
        return self.screen.show_logo_layout and not self.screen.compact and self.screen.render_lab_width >= 32

    def content_height(self) -> int:
        return 17 if self.show_logo() else 2

    def render_screen(self) -> str:
        height = self.content_height()
        top = max((self.screen.rows - height) // 2, 0)
        return "\n".join(self.content_line(y - top) for y in range(self.screen.rows))

    def content_line(self, index: int) -> str:
        if self.show_logo():
            if 0 <= index <= 13:
                return self.lab_line(index)
            if index == 14:
                return ""
            index -= 15
        if index < 0:
            return ""
        if index == 0:
            if self.screen.question:
                text = self.screen_primary_text()
                return self.centered_line(self.fit_ascii(text, max(self.screen.cols - 4, 1)), self.bold + self.color_text)
            return self.title_line(self.screen.title)
        if index == 1:
            if self.screen.question:
                return self.centered_line("Press Enter to continue; type n to cancel.", self.color_muted)
            if self.screen.detail:
                return self.centered_line(self.screen.detail, self.color_muted)
        return ""

    def screen_primary_text(self) -> str:
        question = self.screen.question
        if "[Y/n]" in question:
            return f"{self.screen.title} [Y/n] >"
        return f"{self.screen.title} {question}"

    def title_line(self, text: str) -> str:
        text = self.fit_ascii(text, max(self.screen.cols - 4, 1))
        if "Prime Agent" in text:
            return self.centered_line(self.style_prime_agent_title(text))
        return self.centered_line(text, self.bold + self.color_primary)

    def style_prime_agent_title(self, text: str) -> str:
        parts: list[str] = []
        while "Prime Agent" in text:
            before, text = text.split("Prime Agent", 1)
            parts.append(self.bold + self.color_primary + before)
            parts.append(self.bold + self.color_primary + "PRIME Agent" + self.reset)
        parts.append(self.bold + self.color_primary + text + self.reset)
        return "".join(parts)

    @staticmethod
    def fit_ascii(text: str, max_width: int) -> str:
        if len(text) <= max_width:
            return text
        return text[:max_width] if max_width <= 3 else text[: max_width - 3] + "..."

    def centered_line(self, text: str, style: str = "") -> str:
        # The shell installer measures the printable text with character length.
        width = max(wcswidth(re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", text)), 0)
        left = max((self.screen.cols - width) // 2, 0)
        return " " * left + (style + text + self.reset if style else text) + self.clear_line

    def lab_line(self, row: int) -> str:
        width = self.screen.render_lab_width
        logo = self.logo_line(row)
        if logo:
            start = (width - 32) // 2
            left = self.lab_background(row, 0, start)
            right = self.lab_background(row, start + 32, width)
            trace = left + self.color_text + logo + self.reset + right
        else:
            trace = self.lab_background(row, 0, width)
        return self.centered_line(trace)

    @staticmethod
    def logo_line(row: int) -> str:
        return {
            2: "                          ▄▄███▀",
            3: "    ▄▄▄▄▄              ▄█████▀",
            4: "    ██████▄         ▄██████▀",
            5: "   ▄███▀███▄     ▄███▀▄██▀",
            6: "   ███ ▄████▄▄▄████▀▄▄██",
            7: "  ▀██  ▀█████████▀▀▀▀▀▀",
            8: "  ▄██   ██████▀▀ ▄███",
            9: " █████    ▀█▄▄▄█████▀",
            10: "███████▄  ████████▀",
            11: "▀███▀▀    █████▀",
        }.get(row, "")

    def lab_background(self, row: int, start: int, end: int) -> str:
        active = ""
        parts: list[str] = []
        for x in range(start, end):
            char, style = self.lab_cell(x, row)
            if style != active:
                if active:
                    parts.append(self.reset)
                if style:
                    parts.append(style)
                active = style
            parts.append(char)
        if active:
            parts.append(self.reset)
        return "".join(parts)

    def lab_cell(self, x: int, y: int) -> tuple[str, str]:
        width, height, frame = self.screen.render_lab_width, 14, self.screen.frame
        char, style = " ", ""
        hash_value = (x * 37 + y * 53 + frame * 11 + x * y * 3) % 101
        if hash_value < 3:
            char, style = "·", self.color_dim
        center_x, center_y = width * 36 // 100, height * 54 // 100
        dx, dy = abs(x - center_x), abs(y - center_y)
        contour = dx + dy * 4 + x // 6 - frame
        if x < width * 82 // 100 and (contour % 24) == 12:
            char, style = ("╌" if (x + y) % 5 else "·"), self.color_dim
        horizon_y = height * 58 // 100
        if y == horizon_y and x % 2 == 0 and (x + frame) % 13 < 2:
            char, style = "─", self.color_primary if x > width * 60 // 100 else self.color_dim
        scan_start = width // 2
        if x >= scan_start:
            scan_offset = x - scan_start
            if scan_offset % 5 == 0:
                scan_index = scan_offset // 5
                scan_top = 1 + (scan_index + frame // 3) % 3
                scan_bottom = height - 2 - (scan_index * 2 + frame // 4) % 3
                if scan_top <= y <= scan_bottom and (y + scan_index + frame) % 6:
                    char, style = ("┃" if (scan_index + y) % 4 == 0 else "╎"), self.color_scan
        for trace_index, base in enumerate((height * 30 // 100, height * 49 // 100, height * 72 // 100)):
            wave = (x * 2 + frame + trace_index * 7) % 16
            if wave > 7:
                wave = 15 - wave
            if y == base + (wave - 3) // 2:
                if (x + frame + trace_index * 13) % 41 == 0:
                    char, style = "◆", self.color_warning
                elif (x + frame) % 12 == 0:
                    char, style = "•", self.color_primary
                else:
                    char, style = "·", self.color_primary
        return char, style

    def place_prompt_cursor(self) -> None:
        prompt = self.fit_ascii(self.screen_primary_text(), max(self.screen.cols - 4, 1))
        height = self.content_height()
        top = max((self.screen.rows - height) // 2, 0)
        prompt_index = 15 if self.show_logo() else 0
        row = top + prompt_index + 1
        col = min(max((self.screen.cols - len(prompt)) // 2 + len(prompt) + 2, 1), self.screen.cols)
        self.write_screen(f"{self.reset}{self.show_cursor}\x1b[{row};{col}H")

    def pulse(self) -> str:
        return (".", "..", "...", "")[self.screen.frame % 4]

    @staticmethod
    def animation_detail_count(details: str) -> int:
        return len(details.splitlines()) or 1

    @staticmethod
    def static_progress_title(status: str) -> str:
        return status if status.endswith("...") else status + "..."

    def animation_status(self, status: str, mode: str) -> str:
        return self.static_progress_title(status) if mode == "static" else status + self.pulse()

    def animation_detail(self, details: str, frame: int) -> str:
        lines = details.splitlines() or [details]
        return lines[min((max(frame, 1) - 1) // 24, len(lines) - 1)]

    def run_animation(
        self,
        title: str,
        status: str,
        details: str,
        action: Callable[[TextIO], None],
        *,
        mode: str = "pulse",
    ) -> bool:
        if not self.screen.enabled:
            print(status, file=sys.stderr)
            try:
                action(sys.stderr)
                return True
            except (OSError, RuntimeError, subprocess.SubprocessError) as error:
                print(str(error), file=sys.stderr)
                return False
        output_dir = self.temp_dir()
        output_file = output_dir / "output"
        error_holder: list[BaseException] = []

        def worker() -> None:
            try:
                with output_file.open("w", encoding="utf-8") as output, contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
                    self._quiet_output = output
                    try:
                        action(output)
                    finally:
                        self._quiet_output = None
            except BaseException as error:  # noqa: BLE001 - worker must report SystemExit and command failures.
                error_holder.append(error)

        thread = threading.Thread(target=worker)
        thread.start()
        frame = 0
        while thread.is_alive():
            frame += 1
            self.screen.frame = frame
            self.screen_update(title, self.animation_status(status, mode), self.animation_detail(details, frame))
            time.sleep(0.18)
        thread.join()
        success = not error_holder
        if not success and output_file.stat().st_size:
            self.restore_terminal()
            print(file=sys.stderr)
            print(output_file.read_text(encoding="utf-8"), end="", file=sys.stderr)
        shutil.rmtree(output_dir, ignore_errors=True)
        return success

    def prompt_yes_no(self, question: str, detail: str, input_prompt: str) -> int:
        def read_answer(prompt_input: TextIO) -> int:
            if self.screen.enabled:
                self.screen_update(question, detail=detail, question=input_prompt)
                self.place_prompt_cursor()
            else:
                print(detail)
                print(input_prompt, end=" ", file=prompt_input if prompt_input is not sys.stdin else sys.stderr, flush=True)
            answer = prompt_input.readline().strip().lower()
            return 1 if answer in {"n", "no"} else 0

        try:
            with open("/dev/tty", "r+", encoding="utf-8") as prompt_input:
                return read_answer(prompt_input)
        except OSError:
            return read_answer(sys.stdin) if sys.stdin.isatty() else 2

    def start_preflight_checks(self) -> tuple[Path, threading.Thread, list[int]]:
        directory = self.temp_dir()
        output_file = directory / "preflight"
        status: list[int] = []

        def worker() -> None:
            try:
                with output_file.open("w", encoding="utf-8") as output, contextlib.redirect_stdout(output):
                    status.append(self.run_preflight_checks())
            except (OSError, RuntimeError, subprocess.SubprocessError) as error:
                output_file.write_text(str(error) + "\n", encoding="utf-8")
                status.append(1)

        thread = threading.Thread(target=worker)
        thread.start()
        return directory, thread, status

    def finish_preflight_checks(self, directory: Path, thread: threading.Thread, status: list[int]) -> int:
        while thread.is_alive():
            if self.screen.enabled:
                self.screen_update("Checking Node.js and npm" + self.pulse())
                time.sleep(0.18)
            else:
                time.sleep(0.01)
        thread.join()
        result = status[0] if status else 1
        output_file = directory / "preflight"
        if self.screen.enabled:
            if result:
                lines = output_file.read_text(encoding="utf-8").splitlines() if output_file.exists() else []
                summary = lines[0] if lines else "Node.js and npm are required."
                self.screen_update("Node.js 20.6.0 or newer is required", detail=summary)
                time.sleep(0.4)
            elif output_file.stat().st_size:
                self.screen_update("Environment ready", detail=f"Existing {self.command} command found on PATH.")
                time.sleep(0.4)
        elif output_file.exists():
            print(output_file.read_text(encoding="utf-8"), end="")
        shutil.rmtree(directory, ignore_errors=True)
        return result

    def run_preflight_checks(self) -> int:
        status = 0
        if node := self.command_path("node"):
            version = self.run([node, "--version"], capture=True).stdout.strip()
            if not self.node_version_is_new_enough(version):
                print(f"error: Prime Agent requires Node.js 20.6.0 or newer. Found {version}.")
                status = 1
        else:
            print("error: Node.js 20.6.0 or newer is required to install Prime Agent.")
            status = 1
        if not self.command_path("npm"):
            print("error: npm is required to install Prime Agent.")
            status = 1
        if status:
            print()
        if path := self.command_path(self.command):
            print(f"\x1b[33mExisting {self.command} found at: {path}\x1b[0m")
            print()
        return status

    @staticmethod
    def system_name() -> str:
        return platform.system()

    @staticmethod
    def machine_name() -> str:
        return platform.machine()

    @staticmethod
    def effective_uid() -> int:
        return getattr(os, "geteuid", lambda: 0)()

    @staticmethod
    def node_version_is_new_enough(version: str) -> bool:
        match = re.match(r"^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?", version)
        if not match:
            return False
        major = int(match.group(1))
        minor = int(match.group(2) or 0)
        patch = int(match.group(3) or 0)
        return (major, minor, patch) >= MIN_NODE_VERSION

    def resolve_version(self, args: Sequence[str]) -> str:
        if args:
            selected = args[0]
            if selected in {"stable", "beta"}:
                channel = selected
            else:
                return self.normalize_version(selected)
        else:
            channel = self.release_channel
        if version := self.env.get("PRIME_AGENT_VERSION"):
            return self.normalize_version(version)
        if not self.command_path("curl"):
            print("error: curl is required to resolve the latest Prime Agent version.", file=sys.stderr)
            raise SystemExit(1)
        if channel not in {"stable", "beta"}:
            print(f"error: invalid Prime Agent release channel: {channel}", file=sys.stderr)
            raise SystemExit(1)
        directory = self.temp_dir()
        path = directory / channel
        try:
            if not self.run_animation("Resolving latest release", "Resolving latest release", f"Checking the {channel} release channel.", lambda output: self.run(["curl", "-fsSL", f"{self.base_url}/{channel}", "-o", path])):
                print(f"error: could not resolve latest Prime Agent version from {self.base_url}/{channel}", file=sys.stderr)
                raise SystemExit(1)
            version = path.read_text(encoding="utf-8").strip()
        finally:
            shutil.rmtree(directory, ignore_errors=True)
        if not version:
            print(f"error: could not resolve latest Prime Agent version from {self.base_url}/{channel}", file=sys.stderr)
            raise SystemExit(1)
        return self.normalize_version(version)

    @staticmethod
    def normalize_version(value: str) -> str:
        version = value.removeprefix("v")
        if not version:
            print("error: empty Prime Agent version.", file=sys.stderr)
            raise SystemExit(1)
        if not re.fullmatch(r"[0-9A-Za-z.-]+", version):
            print(f"error: invalid Prime Agent version: {value}", file=sys.stderr)
            raise SystemExit(1)
        return version

    def install_node_interactive(self) -> bool:
        method = self.detect_node_install_method()
        label = {"homebrew": "Homebrew", "apt": "apt", "apk": "apk", "standalone": "standalone Node.js"}.get(method, "standalone Node.js")
        if self.prompt_yes_no(f"Install Node.js and npm with {label}?", "Required before Prime Agent can be installed.", "Install? [Y/n]") == 0:
            self.install_node(method, label)
            return True
        print("No terminal detected; install Node.js 20.6.0 or newer and npm, then run this installer again." if not self.screen.enabled else "\nInstall Node.js 20.6.0 or newer and npm, then run this installer again.")
        return False

    def detect_node_install_method(self) -> str:
        system = self.system_name()
        if system == "Darwin":
            return "homebrew" if self.command_path("brew") else "standalone"
        if system == "Linux":
            if self.command_path("apt-cache") and self.command_path("apt-get") and self.apt_candidate_is_new_enough():
                return "apt"
            if self.command_path("apk") and self.apk_candidate_is_new_enough():
                return "apk"
        return "standalone"

    def apt_candidate_is_new_enough(self) -> bool:
        output = self.run(["apt-cache", "policy", "nodejs"], capture=True, check=False).stdout
        candidate = next((line.split(":", 1)[1].strip() for line in output.splitlines() if "Candidate:" in line), "")
        return candidate not in {"", "(none)"} and self.node_version_is_new_enough(candidate)

    def apk_candidate_is_new_enough(self) -> bool:
        output = self.run(["apk", "search", "-x", "nodejs"], capture=True, check=False).stdout
        candidate = next((line.split("-", 1)[1] for line in output.splitlines() if line.startswith("nodejs-")), "")
        return bool(candidate) and self.node_version_is_new_enough(candidate)

    def install_node(self, method: str, label: str) -> None:
        if not self.screen.enabled:
            print(f"\nInstalling Node.js and npm with {label}...\n")
            self.run_node_install_method(method)
        else:
            self.prepare_sudo(method)
            details = f"Using {label}.\nResolving Node.js packages.\nDownloading Node.js runtime.\nInstalling npm.\nPreparing Prime Agent setup."
            if not self.run_animation("Installing Node.js and npm", "Installing Node.js and npm", details, lambda _output: self.run_node_install_method(method), mode="static"):
                raise SystemExit(1)
        if method == "standalone":
            self.load_standalone_node()
            self.env["PRIME_AGENT_NODE_INSTALLED_STANDALONE"] = "1"
        self.screen_update("Node.js and npm installed", detail="Continuing Prime Agent setup.") if self.screen.enabled else print("\nNode.js and npm are installed.\n")

    def node_install_needs_sudo(self, method: str) -> bool:
        if self.effective_uid() == 0:
            return False
        if method in {"apt", "apk"}:
            return True
        return method == "standalone" and self.system_name() == "Linux" and not self.command_path("xz") and bool(self.command_path("apt-get") or self.command_path("apk"))

    def prepare_sudo(self, method: str) -> None:
        if self.node_install_needs_sudo(method):
            self.screen_update("Preparing Node.js install", detail="This may ask for your sudo password.")
            self.restore_terminal()
            print()
            self.run(["sudo", "-v"])

    def run_node_install_method(self, method: str) -> None:
        actions = {
            "homebrew": self.install_node_homebrew,
            "apt": self.install_node_apt,
            "apk": self.install_node_apk,
            "standalone": self.install_node_standalone,
        }
        actions[method]()

    def install_node_homebrew(self) -> None:
        self.run(["brew", "upgrade", "node"] if self.run(["brew", "list", "node"], check=False).returncode == 0 else ["brew", "install", "node"])

    def install_node_apt(self) -> None:
        self.print_sudo_note()
        self.run_with_sudo(["apt-get", "update"])
        self.run_with_sudo(["apt-get", "install", "-y", "nodejs", "npm"])

    def install_node_apk(self) -> None:
        self.print_sudo_note()
        self.run_with_sudo(["apk", "add", "--update-cache", "nodejs", "npm"])

    def install_node_standalone(self) -> None:
        platform = self.node_binary_platform()
        arch = self.node_binary_arch()
        if not platform or not arch:
            print(f"Unsupported operating system or CPU architecture for automatic Node.js install: {self.system_name()} {self.machine_name()}")
            raise RuntimeError("unsupported Node.js platform")
        base_dir = self.node_standalone_base_dir()
        temporary = self.temp_dir()
        try:
            base_dir.mkdir(parents=True, exist_ok=True)
            checksums = temporary / "SHASUMS256.txt"
            print(f"Resolving Node.js binary for {platform}-{arch}")
            self.run(["curl", "-fsSL", f"{NODE_DIST_BASE}/SHASUMS256.txt", "-o", checksums])
            suffix = f"-{platform}-{arch}.tar.xz"
            node_file = next((line.split()[1] for line in checksums.read_text(encoding="utf-8").splitlines() if len(line.split()) >= 2 and line.split()[1].startswith("node-v") and line.split()[1].endswith(suffix)), "")
            if not node_file or "/" in node_file or "\\" in node_file or ".." in node_file or not re.fullmatch(rf"node-v.+-{re.escape(platform)}-{re.escape(arch)}\.tar\.xz", node_file):
                raise RuntimeError(f"No safe Node.js binary is available for {platform}-{arch}.")
            archive = temporary / node_file
            print(f"Downloading Node.js {node_file.removesuffix('.tar.xz')}")
            self.run(["curl", "-fsSL", f"{NODE_DIST_BASE}/{node_file}", "-o", archive])
            self.verify_node_download(temporary, node_file)
            self.ensure_extract_tools(platform)
            node_dir = base_dir / node_file.removesuffix(".tar.xz")
            if node_dir.exists():
                shutil.rmtree(node_dir)
            print(f"Extracting Node.js to {node_dir}")
            self.run(["tar", "-xf", archive, "-C", base_dir])
            current = base_dir / "current"
            current.unlink(missing_ok=True)
            current.symlink_to(node_dir)
            print(f"Node.js installed at {node_dir}")
        finally:
            shutil.rmtree(temporary, ignore_errors=True)

    def verify_node_download(self, directory: Path, filename: str) -> None:
        selected = directory / "SHASUMS256.selected"
        lines = [line for line in (directory / "SHASUMS256.txt").read_text(encoding="utf-8").splitlines() if len(line.split()) >= 2 and line.split()[1] == filename]
        if not lines:
            raise RuntimeError(f"checksum for {filename} was not found")
        selected.write_text(lines[0] + "\n", encoding="utf-8")
        self.check_checksum(directory, selected)

    def ensure_extract_tools(self, platform: str) -> None:
        if platform == "linux" and not self.command_path("xz"):
            print("Installing xz-utils for Node.js archive extraction")
            self.print_sudo_note()
            if self.command_path("apt-get"):
                self.run_with_sudo(["apt-get", "update"])
                self.run_with_sudo(["apt-get", "install", "-y", "xz-utils"])
            elif self.command_path("apk"):
                self.run_with_sudo(["apk", "add", "--update-cache", "xz"])
            else:
                raise RuntimeError("xz is required to extract Node.js")

    def load_standalone_node(self) -> None:
        binary = self.node_standalone_base_dir() / "current" / "bin"
        self.env["PRIME_AGENT_STANDALONE_NODE_BIN"] = str(binary)
        self.env["PATH"] = f"{binary}{os.pathsep}{self.env.get('PATH', '')}"

    def node_standalone_base_dir(self) -> Path:
        data_home = self.env.get("XDG_DATA_HOME")
        return Path(data_home) / "prime-agent-node" if data_home else Path(self.env["HOME"]) / ".local/share/prime-agent-node"

    def node_binary_platform(self) -> str | None:
        return {"Darwin": "darwin", "Linux": "linux"}.get(self.system_name())

    def node_binary_arch(self) -> str | None:
        return {"x86_64": "x64", "amd64": "x64", "arm64": "arm64", "aarch64": "arm64", "armv7l": "armv7l", "ppc64le": "ppc64le", "s390x": "s390x"}.get(self.machine_name())

    def print_sudo_note(self) -> None:
        if self.effective_uid() != 0:
            print("This may ask for your sudo password.\n")

    def run_with_sudo(self, args: Sequence[object]) -> None:
        self.run(list(args) if self.effective_uid() == 0 else ["sudo", *args])

    def resolve_command_with_original_path(self) -> str | None:
        return self.command_path(self.command, self.original_path)

    def detect_shell_profile(self) -> Path | None:
        if profile := self.env.get("PRIME_AGENT_SHELL_PROFILE"):
            return Path(profile)
        home = self.env.get("HOME")
        if not home:
            return None
        shell = Path(self.env.get("SHELL", "")).name
        if shell == "zsh":
            return Path(self.env.get("ZDOTDIR", home)) / ".zshrc"
        if shell == "bash":
            return Path(home) / ".bashrc"
        for candidate in (Path(home) / ".zshrc", Path(home) / ".bashrc"):
            if candidate.is_file():
                return candidate
        return Path(home) / ".profile"

    def profile_has_node_path(self, profile: Path) -> bool:
        try:
            return str(self.env["PRIME_AGENT_STANDALONE_NODE_BIN"]) in profile.read_text(encoding="utf-8")
        except OSError:
            return False

    def standalone_node_path_line(self) -> str:
        return f'export PATH="{self.env["PRIME_AGENT_STANDALONE_NODE_BIN"]}:$PATH"'

    @staticmethod
    def shell_quote(path: Path) -> str:
        return shlex.quote(str(path))

    def source_profile_command(self, profile: Path) -> str:
        return f". {self.shell_quote(profile)} && {self.command}"

    def print_manual_path_instructions(self) -> None:
        print(f"Add this to your shell profile to use {self.command} from new shells:\n\n  {self.standalone_node_path_line()}\n\nThen restart your shell and run: {self.command}")

    def configure_standalone_node_path(self) -> None:
        resolved = self.resolve_command_with_original_path()
        if resolved and resolved.startswith(self.env["PRIME_AGENT_STANDALONE_NODE_BIN"] + os.sep):
            self.screen_update("Prime Agent installed", detail=f"Run it with: {self.command}") if self.screen.enabled else print(f"\nRun it with: {self.command}")
            return
        profile = self.detect_shell_profile()
        if profile is None:
            self.print_manual_path_instructions()
            return
        if self.profile_has_node_path(profile):
            print(f"{profile} already contains {self.env['PRIME_AGENT_STANDALONE_NODE_BIN']}.\nRestart your shell or run: {self.source_profile_command(profile)}")
            return
        if self.prompt_yes_no("Add standalone Node.js to your PATH?", f"Updates {profile} so future shells can run {self.command}.", "Update PATH? [Y/n]") != 0:
            self.print_manual_path_instructions()
            return
        profile.parent.mkdir(parents=True, exist_ok=True)
        with profile.open("a", encoding="utf-8") as output:
            output.write(f"\n# Prime Agent standalone Node.js\n{self.standalone_node_path_line()}\n")
        print(f"Added {self.env['PRIME_AGENT_STANDALONE_NODE_BIN']} to {profile}.\nRestart your shell or run: {self.source_profile_command(profile)}")

    def download_package(self, version: str, tarball_url: str, tarball_path: Path) -> None:
        if not self.command_path("curl"):
            print("error: curl is required to download Prime Agent.", file=sys.stderr)
            raise SystemExit(1)
        checksums = tarball_path.parent / "SHA256SUMS"
        checksums_url = f"{self.base_url}/releases/v{version}/SHA256SUMS"
        if not self.run_animation("Downloading checksums", "Downloading release checksums", f"Prime Agent v{version}", lambda _output: self.run(["curl", "-fsSL", checksums_url, "-o", checksums])):
            raise RuntimeError("could not download release checksums")
        if not self.run_animation("Downloading Prime Agent", f"Downloading Prime Agent v{version}", "Fetching the verified package.", lambda _output: self.run(["curl", "-fsSL", tarball_url, "-o", tarball_path])):
            raise RuntimeError("could not download Prime Agent")
        self.verify_package_checksum(checksums, tarball_path)

    def verify_package_checksum(self, checksums: Path, tarball: Path) -> None:
        name = tarball.name
        lines = [line for line in checksums.read_text(encoding="utf-8").splitlines() if len(line.split()) >= 2 and line.split()[1] == name]
        if not lines:
            print(f"error: checksum for {name} was not found in {checksums}", file=sys.stderr)
            raise SystemExit(1)
        selected = tarball.parent / "SHA256SUMS.selected"
        selected.write_text(lines[0] + "\n", encoding="utf-8")
        self.check_checksum(tarball.parent, selected, package=True)

    def check_checksum(self, directory: Path, selected: Path, *, package: bool = False) -> None:
        if checker := self.command_path("sha256sum"):
            label = "Prime Agent download" if package else "Node.js download"
            print(f"Verifying {label}")
            self.run([checker, "-c", selected.name], cwd=directory)
        elif checker := self.command_path("shasum"):
            print(f"Verifying {'Prime Agent' if package else 'Node.js'} download")
            self.run([checker, "-a", "256", "-c", selected.name], cwd=directory)
        else:
            raise RuntimeError("sha256sum or shasum is required to verify the download")

    def confirm_install(self, version: str, url: str) -> None:
        result = self.prompt_yes_no(f"Install Prime Agent v{version} globally with npm?", "Downloads the verified release and runs npm install -g.", "Install? [Y/n]")
        if result == 0:
            return
        if result == 2:
            print(f"This will download, verify, and install:\n\n  {url}\n\nNo terminal detected; continuing without confirmation.")
            return
        self.screen_update("Installation cancelled", detail="No changes were made.") if self.screen.enabled else print("\nInstallation cancelled.")
        raise SystemExit(0)

    def confirm_kernel_setup(self) -> None:
        setting = self.env.get("PRIME_AGENT_BOOTSTRAP_KERNEL_ON_INSTALL")
        if setting in {"0", "1"}:
            self.bootstrap_kernel = setting == "1"
            return
        result = self.prompt_yes_no("Prepare Python runtime now?", "Installs uv, Python 3.11, and the Prime Agent runtime.", "Prepare? [Y/n]")
        if result == 0 or result == 2:
            self.bootstrap_kernel = True
            if result == 2:
                print("No terminal detected; preparing the Python runtime during install.")
        else:
            self.bootstrap_kernel = False
            self.screen_update("Python setup skipped", detail="The runtime can be prepared on first ipython use.") if self.screen.enabled else print("\nSkipping Python runtime setup.")

    def npm_requires_remote_policy(self) -> bool:
        result = self.run(["npm", "--version"], capture=True, check=False)
        try:
            return int(result.stdout.strip().split(".", 1)[0]) >= 12
        except (ValueError, IndexError):
            return False

    def npm_install(self, tarball: Path, extra_env: dict[str, str]) -> None:
        args: list[object] = ["npm", "install", "-g", "--no-fund", "--no-audit", "--loglevel=error", "--progress=false"]
        if self.npm_requires_remote_policy():
            args.extend(["--allow-remote=all", f"--allow-scripts={tarball}"])
        args.append(tarball)
        self.run(args, env=extra_env)

    def install_package(self, tarball: Path) -> None:
        details = "Preparing global install.\nLinking command binaries.\nInstalling runtime packages.\nPreloading search tools.\n"
        if self.bootstrap_kernel:
            details += "Preparing Python kernel.\nFinalizing npm install."
            env = {**RUNTIME_INSTALL_ENV, "PRIME_AGENT_BOOTSTRAP_KERNEL_ON_INSTALL": "1", "PRIME_AGENT_INSTALL_UV": "1"}
        else:
            details += "Finalizing npm install."
            env = RUNTIME_INSTALL_ENV
        action = lambda _output: self.npm_install(tarball, env)
        if not self.run_animation("Installing Prime Agent", "Installing Prime Agent", details, action, mode="static"):
            raise SystemExit(1)

    def main(self, args: Sequence[str]) -> int:
        if self.base_url == self.unconfigured_base_url:
            print("error: installer download URL is not configured.\nSet PRIME_AGENT_DOWNLOAD_BASE_URL or use the installer published by the release workflow.", file=sys.stderr)
            return 1
        self.register_traps()
        self.init_screen()
        if self.screen.enabled:
            self.screen_update("Installing Prime Agent")
        else:
            print("\n\x1b[1m  Installing Prime Agent\x1b[0m\n\x1b[2m  npm global install\x1b[0m\n")
        directory, thread, status = self.start_preflight_checks()
        check_status = self.finish_preflight_checks(directory, thread, status)
        if check_status:
            if not self.install_node_interactive():
                return check_status
            directory, thread, status = self.start_preflight_checks()
            check_status = self.finish_preflight_checks(directory, thread, status)
            if check_status:
                return check_status
        version = self.resolve_version(args)
        tarball_name = f"{self.package}-{version}.tgz"
        tarball_url = f"{self.base_url}/releases/v{version}/{tarball_name}"
        self.confirm_install(version, tarball_url)
        self.confirm_kernel_setup()
        download_dir = self.temp_dir()
        self.download_dir = download_dir
        tarball_path = download_dir / tarball_name
        self.download_package(version, tarball_url, tarball_path)
        self.install_package(tarball_path)
        shutil.rmtree(download_dir, ignore_errors=True)
        self.download_dir = None
        if self.env.get("PRIME_AGENT_NODE_INSTALLED_STANDALONE", "0") == "1":
            self.screen_update("Prime Agent installed", detail="Checking your shell PATH.")
            self.configure_standalone_node_path()
        elif self.command_path(self.command):
            self.screen_update("Prime Agent installed", detail=f"Run it with: {self.command}") if self.screen.enabled else print(f"\nPrime Agent was installed successfully.\n\nRun it with: {self.command}")
        else:
            self.screen_update("Prime Agent installed", detail=f"PATH update needed for {self.command}.") if self.screen.enabled else print("\nPrime Agent was installed successfully.")
            print(f"The {self.command} command was installed, but it is not on your PATH yet.\nCheck npm's global bin directory with:\n\n  npm bin -g\n\nThen add that directory to your shell PATH.")
        return 0


def main(args: Sequence[str] | None = None) -> int:
    return Installer().main(sys.argv[1:] if args is None else args)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, ValueError, UnicodeError, subprocess.SubprocessError) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1) from error
