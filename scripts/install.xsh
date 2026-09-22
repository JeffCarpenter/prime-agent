#!/usr/bin/env xonsh
"""Install Prime Agent from a release archive.

This is the Xonsh-native counterpart to install.sh. It deliberately keeps all
external command arguments structured instead of building shell command text.
"""

from __future__ import annotations

import atexit
import contextlib
import hashlib
import json
import os
import platform
import re
import secrets
import shlex
import shutil
import string
import signal
import subprocess
import sys
import tarfile
import tempfile
import threading
import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
from typing import IO, TextIO

from xonsh.built_ins import XSH

try:
    from wcwidth import wcswidth
except ImportError:
    def wcswidth(text: str) -> int:
        return len(text)

MIN_NODE_VERSION = (20, 6, 0)
NODE_DIST_BASE = "https://nodejs.org/dist/latest-v22.x"
NATIVE_OWNER = "prime-agent-native-v1"
NATIVE_ASSETS = (
    "prime-agent",
    "package.json",
    "install.sh",
    "prime-agent-runtime/pyproject.toml",
    "prime-agent-runtime/src/rlm/repl.py",
    "theme/prime.json",
    "export-html/template.html",
    "photon_rs_bg.wasm",
)
NATIVE_PLATFORMS = (
    "linux-x64-musl-baseline",
    "linux-x64-musl",
    "linux-x64-baseline",
    "linux-arm64-musl",
    "darwin-arm64",
    "darwin-x64",
    "linux-arm64",
    "linux-x64",
)
NATIVE_VERSION_PATTERN = re.compile(r"^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$")
TTY_PATH = p"/dev/tty"
RUNTIME_INSTALL_ENV = {
    "PRIME_AGENT_BOOTSTRAP_TOOLS_ON_INSTALL": "1",
}


@dataclass(frozen=True)
class CommandResult:
    returncode: int
    stdout: str = ""
    stderr: str = ""

    def __bool__(self) -> bool:
        return self.returncode == 0


@dataclass(frozen=True)
class NativeTarget:
    target: str
    name: str
    digest: str
    platform: str
    version: str
    directory: Path


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
    native_root: Path | None = None
    native_stage: Path | None = None
    native_lock: Path | None = None
    native_public_bin: Path | None = None
    native_root_adopted: bool = False
    native_recovered: bool = False
    native_activation_target: str = ""
    native_activation_previous: str = ""
    allow_insecure_http: bool = False
    _cleanup_registered: bool = False
    _quiet_output: TextIO | None = field(default=None, init=False, repr=False)
    _active_process: subprocess.Popen[str] | None = field(default=None, init=False, repr=False)
    _process_lock: threading.Lock = field(default_factory=threading.Lock, init=False, repr=False)

    def __post_init__(self) -> None:
        # Release publishing rewrites only the unsplit configured literals.
        self.unconfigured_base_url = "__PRIME_AGENT_DOWNLOAD_BASE" + "_URL__"
        self.unconfigured_channel = "__PRIME_AGENT_DEFAULT_RELEASE_" + "CHANNEL__"
        configured_base_url = "__PRIME_AGENT_DOWNLOAD_BASE_URL__"
        configured_channel = "__PRIME_AGENT_DEFAULT_RELEASE_CHANNEL__"
        self.base_url = (self.env.get("PRIME_AGENT_DOWNLOAD_BASE_URL") or configured_base_url).rstrip("/")
        self.default_channel = "stable" if configured_channel == self.unconfigured_channel else configured_channel
        self.release_channel = self.env.get("PRIME_AGENT_RELEASE_CHANNEL") or self.default_channel
        self.package = self.env.get("PRIME_AGENT_PACKAGE", "prime-agent")
        self.command = self.env.get("PRIME_AGENT_CMD", "prime-agent")
        sysroot = self.env.get("PRIME_AGENT_NATIVE_SYSROOT_FOR_TESTS", "")
        self.native_sysroot = Path(sysroot) if sysroot else Path("/")
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

    def command_path(self, name: str, path: str | None = None) -> str | None:
        return shutil.which(name, path=path if path is not None else self.env.get("PATH", ""))

    def validate_install_method(self) -> str:
        method = self.env.get("PRIME_AGENT_INSTALL_METHOD", "auto")
        if method not in {"auto", "binary", "node"}:
            print("error: PRIME_AGENT_INSTALL_METHOD must be auto, binary or node.", file=sys.stderr)
            raise SystemExit(1)
        return method

    @staticmethod
    def is_loopback_test_base_url(url: str) -> bool:
        return re.fullmatch(r"http://127\.0\.0\.1:[0-9]+", url) is not None

    def validate_download_base_url(self) -> None:
        if self.base_url.startswith("https://"):
            self.allow_insecure_http = False
            return
        if self.base_url.startswith("http://"):
            if self.env.get("PRIME_AGENT_ALLOW_INSECURE_HTTP_FOR_TESTS", "0") == "1" and self.is_loopback_test_base_url(self.base_url):
                self.allow_insecure_http = True
                return
            print("error: Prime Agent downloads require an HTTPS base URL.", file=sys.stderr)
            print("Local loopback test feeds require PRIME_AGENT_ALLOW_INSECURE_HTTP_FOR_TESTS=1.", file=sys.stderr)
            raise SystemExit(1)
        print("error: Prime Agent download base URL must use HTTPS.", file=sys.stderr)
        raise SystemExit(1)

    def curl_download(self, args: Sequence[object]) -> CommandResult:
        protocols = "=http,https" if self.allow_insecure_http else "=https"
        return self.run(["curl", "--proto", protocols, "--proto-redir", "=https", *args])

    def emit(self, text: str = "", *, error: bool = False) -> None:
        output = self._quiet_output or (sys.stderr if error else sys.stdout)
        print(text, file=output, flush=True)

    def _run_supervised(
        self,
        argv: list[str],
        *,
        capture: bool,
        cwd: Path | None,
        env: dict[str, str],
    ) -> CommandResult:
        stdout: int | TextIO = subprocess.PIPE if capture else self._quiet_output or sys.stdout
        stderr: int | TextIO = subprocess.PIPE if capture else self._quiet_output or sys.stderr
        process = subprocess.Popen(
            argv,
            cwd=cwd,
            env=env,
            stdout=stdout,
            stderr=stderr,
            text=True,
            start_new_session=True,
        )
        with self._process_lock:
            self._active_process = process
        try:
            output, errors = process.communicate()
        finally:
            with self._process_lock:
                if self._active_process is process:
                    self._active_process = None
        return CommandResult(process.returncode, output or "", errors or "")

    def run(
        self,
        args: Sequence[object],
        *,
        check: bool = True,
        capture: bool = False,
        cwd: Path | None = None,
        env: dict[str, str] | None = None,
    ) -> CommandResult:
        argv = [str(arg) for arg in args]
        runtime_env = {**self.env, **(env or {})}
        if self._quiet_output is not None or cwd is not None:
            result = self._run_supervised(argv, capture=capture, cwd=cwd, env=runtime_env)
        else:
            with XSH.env.swap(runtime_env):
                if capture:
                    pipeline = !(@(argv))
                else:
                    pipeline = ![@unthread @(argv)]
            result = CommandResult(
                pipeline.returncode,
                (pipeline.out or "") if capture else "",
                (pipeline.err or "") if capture else "",
            )
        if check and not result:
            command = " ".join(shlex.quote(arg) for arg in argv)
            detail = (result.stderr or result.stdout).strip()
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
        signal.signal(signal.SIGHUP, lambda _signum, _frame: self.signal_cleanup(129))
        self._cleanup_registered = True

    def terminate_active_process(self) -> None:
        with self._process_lock:
            process = self._active_process
        if process is None or process.poll() is not None:
            return
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except (OSError, ProcessLookupError):
            process.kill()
        with contextlib.suppress(OSError, subprocess.SubprocessError):
            process.wait()

    def cleanup(self) -> None:
        self.terminate_active_process()
        if self.download_dir and self.download_dir.exists():
            shutil.rmtree(self.download_dir, ignore_errors=True)
            self.download_dir = None
        self.native_cleanup()
        self.restore_terminal()

    def signal_cleanup(self, status: int) -> None:
        self.terminate_active_process()
        self.restore_terminal()
        raise SystemExit(status)

    def restore_terminal(self) -> None:
        if not self.screen.enabled:
            return
        text = self.reset + self.show_cursor
        try:
            with open(TTY_PATH, "w", encoding="utf-8") as tty:
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
            fd = os.open(TTY_PATH, os.O_RDONLY)
            size = os.get_terminal_size(fd)
            cols, rows = size.columns, size.lines
        except OSError:
            size = shutil.get_terminal_size((80, 24))
            cols, rows = size.columns, size.lines
        finally:
            if fd is not None:
                os.close(fd)
        return max(cols, 1), max(rows, 1)

    def read_terminal_size(self) -> None:
        self.screen.cols, self.screen.rows = self.terminal_size()

    def write_screen(self, text: str) -> None:
        try:
            with open(TTY_PATH, "w", encoding="utf-8") as tty:
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
            with open(TTY_PATH, "r+", encoding="utf-8") as prompt_input:
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

    def native_glibc(self) -> bool:
        if not self.command_path("getconf"):
            return False
        result = self.run(["getconf", "GNU_LIBC_VERSION"], capture=True, check=False)
        match = re.fullmatch(r"glibc (\d+)\.(\d+)\s*", result.stdout)
        return result.returncode == 0 and match is not None and (int(match.group(1)), int(match.group(2))) >= (2, 17)

    def native_musl(self) -> bool:
        if any((self.native_sysroot / "lib").glob("ld-musl-*.so.1")):
            return True
        if not self.command_path("ldd"):
            return False
        result = self.run(["ldd"], capture=True, check=False)
        return "musl" in result.stdout or "musl" in result.stderr

    def native_avx2(self) -> bool:
        cpuinfo = self.native_sysroot / "proc/cpuinfo"
        try:
            lines = cpuinfo.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            return False
        for line in lines:
            key, separator, values = line.partition(":")
            if separator and key.strip() == "flags" and "avx2" in values.split():
                return True
        return False

    def macos_version(self) -> str | None:
        if not self.command_path("sw_vers"):
            return None
        result = self.run(["sw_vers", "-productVersion"], capture=True, check=False)
        return result.stdout.strip() if result.returncode == 0 else None

    def native_platform(self) -> str | None:
        system = self.system_name()
        libc_suffix = ""
        if system == "Darwin":
            version = self.macos_version()
            if version is None:
                return None
            major = version.split(".", 1)[0]
            if not major.isdigit() or int(major) < 13:
                return None
            native_os = "darwin"
        elif system == "Linux":
            native_os = "linux"
            if self.native_glibc():
                libc_suffix = ""
            elif self.native_musl():
                libc_suffix = "-musl"
            else:
                return None
        else:
            return None

        machine = self.machine_name()
        if machine in {"arm64", "aarch64"}:
            return f"{native_os}-arm64{libc_suffix}"
        if machine not in {"x86_64", "amd64"}:
            return None
        baseline = "-baseline" if native_os == "linux" and not self.native_avx2() else ""
        return f"{native_os}-x64{libc_suffix}{baseline}"

    def native_prepare_root(self) -> None:
        home = self.env.get("HOME")
        if not home:
            raise SystemExit("error: HOME is required for a native installation.")
        data_home = self.env.get("XDG_DATA_HOME") or str(Path(home) / p".local/share")
        configured_root = self.env.get("PRIME_AGENT_INSTALL_DIR") or str(Path(data_home) / p"prime-agent")
        root = Path(configured_root)
        if not root.is_absolute():
            raise SystemExit("error: install directory must be absolute.")
        if root.is_symlink():
            raise SystemExit("error: managed installation root must not be a symlink.")
        root.mkdir(parents=True, exist_ok=True)
        root = root.resolve()
        marker = root / p".managed"
        releases = root / p"releases"
        binary_dir = root / p"bin"
        if marker.is_symlink() or releases.is_symlink() or binary_dir.is_symlink():
            raise SystemExit("error: managed installation directories must not be symlinks.")
        if marker.exists():
            if marker.read_text(encoding="utf-8").strip() != NATIVE_OWNER:
                raise SystemExit(f"error: unrecognized installation owner in {root}.")
        elif any(root.iterdir()):
            raise SystemExit(f"error: refusing to take ownership of nonempty directory {root}.")
        else:
            self.native_root_adopted = True

        lock = root / p".install-lock"
        try:
            lock.mkdir()
        except FileExistsError:
            owner = ""
            with contextlib.suppress(OSError):
                owner = (lock / p"pid").read_text(encoding="utf-8").strip()
            raise SystemExit(f"error: installation is locked (pid {owner}). After confirming no installer is running, remove {lock}.")

        self.native_root = root
        self.native_lock = lock
        try:
            (lock / p"pid").write_text(f"{os.getpid()}\n", encoding="utf-8")
            marker.write_text(f"{NATIVE_OWNER}\n", encoding="utf-8")
            releases.mkdir(exist_ok=True)
            binary_dir.mkdir(exist_ok=True)
            for name in ("prime-agent", "previous"):
                link = binary_dir / name
                if link.exists() or link.is_symlink():
                    if not link.is_symlink() or self.native_parse_target(os.readlink(link)) is None:
                        raise SystemExit("error: unrecognized managed command target.")
            for candidate in root.glob(".install.*"):
                if candidate.is_dir() and not candidate.is_symlink():
                    shutil.rmtree(candidate)
            self.native_stage = Path(tempfile.mkdtemp(prefix=".install.", dir=root))
            if not self.native_recover_activation():
                raise SystemExit(f"error: invalid activation recovery state at {root / p'.activation-state'}.")
            if self.native_recovered:
                self.native_prune_releases()
            if "PRIME_AGENT_EXPECTED_CURRENT" in self.env:
                current = self.native_readlink(binary_dir / p"prime-agent")
                if current != self.env["PRIME_AGENT_EXPECTED_CURRENT"]:
                    raise SystemExit("error: the active release changed; retry the update.")
        except BaseException:
            self.native_cleanup()
            raise

        bin_home = self.env.get("PRIME_AGENT_BIN_DIR") or str(Path(home) / p".local/bin")
        self.native_public_bin = Path(bin_home)

    def native_adopted_root_is_removable(self) -> bool:
        root = self.native_root
        if root is None or not self.native_root_adopted:
            return False
        marker = root / p".managed"
        try:
            if marker.is_symlink() or marker.read_text(encoding="utf-8").strip() != NATIVE_OWNER:
                return False
            allowed = {".managed", "bin", "releases"}
            if {entry.name for entry in root.iterdir()} - allowed:
                return False
            for directory in (root / p"bin", root / p"releases"):
                if directory.is_symlink() or not directory.is_dir() or any(directory.iterdir()):
                    return False
        except OSError:
            return False
        return True

    def native_cleanup(self) -> None:
        stage = self.native_stage
        root = self.native_root
        lock = self.native_lock
        owns_lock = False
        if lock is not None and lock.is_dir() and not lock.is_symlink():
            with contextlib.suppress(OSError):
                owns_lock = (lock / p"pid").read_text(encoding="utf-8").strip() == str(os.getpid())
        if owns_lock and stage is not None and root is not None and (root / p".activation-state").exists():
            with contextlib.suppress(OSError, RuntimeError):
                if self.native_recover_activation():
                    self.native_prune_releases()
        if (
            root is not None
            and self.native_activation_target
            and self.native_activation_previous
            and self.native_readlink(root / p"bin/prime-agent") == self.native_activation_target
            and self.native_readlink(root / p"bin/previous") != self.native_activation_previous
            and stage is not None
        ):
            with contextlib.suppress(OSError, RuntimeError):
                self.native_atomic_link(self.native_activation_previous, root / p"bin/previous")
        self.native_activation_target = ""
        self.native_activation_previous = ""
        if stage is not None and root is not None:
            with contextlib.suppress(OSError):
                if stage.parent == root and stage.name.startswith(".install.") and not stage.is_symlink():
                    shutil.rmtree(stage)
        self.native_stage = None

        if lock is not None and lock.is_dir() and not lock.is_symlink():
            try:
                owner = (lock / p"pid").read_text(encoding="utf-8").strip()
            except OSError:
                owner = ""
            if owner == str(os.getpid()):
                with contextlib.suppress(OSError):
                    (lock / p"pid").unlink()
                    lock.rmdir()
        self.native_lock = None

        if not self.native_activation_target and self.native_adopted_root_is_removable() and root is not None:
            shutil.rmtree(root)
        self.native_root_adopted = False

    @staticmethod
    def native_validate_archive(archive: Path) -> None:
        try:
            with tarfile.open(archive, "r:gz") as tar:
                members = tar.getmembers()
        except (OSError, tarfile.TarError) as error:
            raise ValueError("release archive could not be inspected") from error
        if not members:
            raise ValueError("release archive is empty")
        if len(members) > 10_000:
            raise ValueError("release archive contains too many entries")
        total_size = 0
        for member in members:
            path = PurePosixPath(member.name)
            if "\\" in member.name or path.is_absolute() or ".." in path.parts:
                raise ValueError(f"unsafe archive path: {member.name}")
            if not member.isdir() and not member.isreg():
                raise ValueError(f"unsafe archive member type: {member.name}")
            total_size += member.size
            if member.size > 128 * 1024 * 1024 or total_size > 512 * 1024 * 1024:
                raise ValueError("release archive is too large")

    def native_atomic_link(self, target: str, link: Path) -> None:
        if self.native_stage is None:
            raise RuntimeError("native staging directory is not initialized")
        link.parent.mkdir(parents=True, exist_ok=True)
        temporary_dir = Path(tempfile.mkdtemp(prefix="link.", dir=self.native_stage))
        temporary_link = temporary_dir / p"link"
        try:
            temporary_link.symlink_to(target)
            os.replace(temporary_link, link)
        finally:
            with contextlib.suppress(OSError):
                temporary_link.unlink()
            with contextlib.suppress(OSError):
                temporary_dir.rmdir()

    def native_activate(self, target: str, previous: str) -> None:
        if self.native_root is None or self.native_stage is None:
            raise RuntimeError("native installation root is not prepared")
        self.native_activation_target = target
        self.native_activation_previous = previous
        staged_journal = self.native_stage / p"activation-state"
        journal = self.native_root / p".activation-state"
        staged_journal.write_text(f"{target}\n{previous}\n", encoding="utf-8")
        os.replace(staged_journal, journal)
        self.native_atomic_link(target, self.native_root / p"bin/prime-agent")
        if previous and target != previous:
            self.native_atomic_link(previous, self.native_root / p"bin/previous")
        journal.unlink()
        self.native_activation_target = ""
        self.native_activation_previous = ""

    def native_probe(self, args: Sequence[object]) -> CommandResult:
        argv = [str(arg) for arg in args]
        try:
            process = subprocess.Popen(
                argv,
                env=self.env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                start_new_session=True,
            )
        except OSError as error:
            return CommandResult(127, "", str(error))
        with self._process_lock:
            self._active_process = process
        try:
            try:
                output, errors = process.communicate(timeout=self.native_probe_timeout())
                return CommandResult(process.returncode, output or "", errors or "")
            except subprocess.TimeoutExpired:
                with contextlib.suppress(OSError, ProcessLookupError):
                    os.killpg(process.pid, signal.SIGKILL)
                output, errors = process.communicate()
                message = f"error: executable probe timed out after {self.native_probe_timeout()} seconds."
                return CommandResult(124, output or "", f"{errors or ''}{message}\n")
        finally:
            with self._process_lock:
                if self._active_process is process:
                    self._active_process = None

    def native_validate_release_metadata(self, target: str) -> NativeTarget | None:
        parsed = self.native_parse_target(target)
        if parsed is None:
            return None
        release = parsed.directory
        if release.is_symlink() or not release.is_dir():
            return None
        try:
            if release.resolve() != release.absolute():
                return None
            for asset in (*NATIVE_ASSETS, ".archive-sha256", ".install-source"):
                path = release / asset
                if path.is_symlink() or not path.is_file():
                    return None
                expected_parent = release / PurePosixPath(asset).parent
                if path.parent.resolve() != expected_parent.absolute():
                    return None
            if (release / p".archive-sha256").read_text(encoding="utf-8").strip() != parsed.digest:
                return None
            package = json.loads((release / p"package.json").read_text(encoding="utf-8"))
            if not isinstance(package, dict) or package.get("version") != parsed.version:
                return None
            source = (release / p".install-source").read_text(encoding="utf-8").strip()
            if not source.startswith(("http://", "https://")):
                return None
        except (OSError, UnicodeError, json.JSONDecodeError):
            return None
        return parsed

    def native_verify_release_target(self, target: str, label: str = "release") -> bool:
        parsed = self.native_validate_release_metadata(target)
        if parsed is None:
            return False
        version = self.native_probe([parsed.directory / p"prime-agent", "--version"])
        if not version or version.stdout.strip() != parsed.version:
            return False
        return bool(self.native_probe([parsed.directory / p"prime-agent", "--help"]))

    @staticmethod
    def native_readlink(path: Path) -> str:
        try:
            return os.readlink(path)
        except OSError:
            return ""

    def native_recover_activation(self) -> bool:
        if self.native_root is None:
            return False
        journal = self.native_root / p".activation-state"
        if not journal.exists() and not journal.is_symlink():
            return True
        if journal.is_symlink() or not journal.is_file():
            return False
        try:
            lines = journal.read_text(encoding="utf-8").splitlines()
        except (OSError, UnicodeError):
            return False
        if len(lines) != 2:
            return False
        target, previous = lines
        if not self.native_verify_release_target(target, "recovery-target"):
            return False
        if previous and not self.native_verify_release_target(previous, "recovery-previous"):
            return False
        current = self.native_readlink(self.native_root / p"bin/prime-agent")
        if current == target:
            previous_link = self.native_root / p"bin/previous"
            if previous and previous != target and self.native_readlink(previous_link) != previous:
                self.native_atomic_link(previous, previous_link)
        elif current != previous:
            return False
        journal.unlink()
        self.native_recovered = True
        return True

    def native_release_in_use(self, executable: Path) -> bool | None:
        proc = self.native_sysroot / p"proc"
        if proc.is_dir():
            determined = True
            for entry in proc.iterdir():
                if not entry.name.isdigit():
                    continue
                try:
                    if (entry / p"exe").resolve() == executable.resolve():
                        return True
                except OSError:
                    continue
            return False if determined else None
        lsof = self.command_path("lsof")
        if lsof:
            return bool(self.run([lsof, "-t", "--", executable], capture=True, check=False).stdout.strip())
        return None

    def native_prune_releases(self) -> None:
        if self.native_root is None:
            return
        current = self.native_readlink(self.native_root / p"bin/prime-agent")
        previous = self.native_readlink(self.native_root / p"bin/previous")
        releases = self.native_root / p"releases"
        if releases.is_symlink() or not releases.is_dir():
            return
        for release in releases.iterdir():
            if release.is_symlink() or not release.is_dir():
                continue
            target = f"../releases/{release.name}/prime-agent"
            if target in {current, previous} or self.native_validate_release_metadata(target) is None:
                continue
            in_use = self.native_release_in_use(release / p"prime-agent")
            if in_use is False:
                shutil.rmtree(release)

    def native_rollback(self) -> None:
        self.register_traps()
        self.native_prepare_root()
        if self.native_root is None:
            raise SystemExit("error: native installation root is unavailable.")
        previous_link = self.native_root / p"bin/previous"
        current_link = self.native_root / p"bin/prime-agent"
        if not previous_link.is_symlink():
            raise SystemExit("error: no previous compiled release is available.")
        previous = self.native_readlink(previous_link)
        current = self.native_readlink(current_link)
        expected = self.env.get("PRIME_AGENT_EXPECTED_PREVIOUS")
        if expected and previous != expected:
            raise SystemExit("error: the previous release changed while planning rollback; retry.")
        if not previous or previous == current:
            raise SystemExit("error: no different previous release is available.")
        if not self.native_verify_release_target(previous, "previous"):
            raise SystemExit("error: invalid previous release metadata or assets.")
        if self.native_verify_release_target(current, "current"):
            self.native_activate(previous, current)
        else:
            self.native_atomic_link(previous, current_link)
        self.native_prune_releases()
        print("Restored the previous compiled release.")
        self.native_cleanup()

    def native_check_public_command(self) -> tuple[Path, Path]:
        if self.native_root is None:
            raise RuntimeError("native installation root is not prepared")
        home = self.env.get("HOME")
        configured = self.env.get("PRIME_AGENT_BIN_DIR") or (str(Path(home) / p".local/bin") if home else "")
        public_bin = self.native_public_bin or Path(configured)
        if not public_bin.is_absolute():
            raise SystemExit("error: bin directory must be absolute.")
        self.native_public_bin = public_bin
        if self.env.get("PRIME_AGENT_INSTALL_LINK", "1") == "0":
            return public_bin, public_bin / self.command
        if not self.command or self.command in {".", ".."} or "/" in self.command:
            raise SystemExit("error: command name must be a basename.")
        command = public_bin / self.command
        managed = self.native_root / p"bin/prime-agent"
        if command.exists() or command.is_symlink():
            if not command.is_symlink() or command.readlink() != managed:
                raise SystemExit(f"error: refusing to replace existing command {command}.")
        public_bin.mkdir(parents=True, exist_ok=True)
        return public_bin, command

    def native_install_public_command(self) -> None:
        public_bin, command = self.native_check_public_command()
        if self.env.get("PRIME_AGENT_INSTALL_LINK", "1") == "0" or command.is_symlink():
            return
        if self.native_root is None:
            raise RuntimeError("native installation root is not prepared")
        managed = self.native_root / p"bin/prime-agent"
        temporary = public_bin / f".{self.command}.{os.getpid()}.{secrets.token_hex(3)}"
        try:
            temporary.symlink_to(managed)
            os.replace(temporary, command)
        finally:
            with contextlib.suppress(OSError):
                temporary.unlink()

    def native_configure_path(self) -> None:
        if self.native_public_bin is None:
            raise RuntimeError("native public bin directory is unavailable")
        public_bin = str(self.native_public_bin)
        if public_bin in self.original_path.split(os.pathsep):
            return
        path_line = f"export PATH={self.shell_quote(self.native_public_bin)}:$PATH"
        profile = self.detect_shell_profile()
        if profile is not None:
            try:
                existing = profile.read_text(encoding="utf-8").splitlines()
            except FileNotFoundError:
                existing = []
            if path_line not in existing:
                profile.parent.mkdir(parents=True, exist_ok=True)
                with profile.open("a", encoding="utf-8") as output:
                    output.write(f"\n# Prime Agent\n{path_line}\n")
        print(f"For this shell, run: {path_line}")

    def native_extract_release(self, archive: Path, version: str, native_platform: str, digest: str) -> NativeTarget:
        if self.native_root is None or self.native_stage is None:
            raise RuntimeError("native installation root is not prepared")
        if NATIVE_VERSION_PATTERN.fullmatch(version) is None or native_platform not in NATIVE_PLATFORMS:
            raise ValueError("invalid native release identity")
        if re.fullmatch(r"[0-9a-f]{64}", digest) is None:
            raise ValueError("invalid native release digest")
        actual_digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        if actual_digest != digest:
            raise ValueError("native archive digest mismatch")
        self.native_validate_archive(archive)
        application = self.native_stage / p"application"
        if application.exists():
            shutil.rmtree(application)
        application.mkdir()
        with tarfile.open(archive, "r:gz") as tar:
            for member in tar.getmembers():
                relative = PurePosixPath(member.name)
                destination = application.joinpath(*relative.parts)
                if member.isdir():
                    destination.mkdir(parents=True, exist_ok=True)
                    destination.chmod(member.mode & 0o777)
                    continue
                destination.parent.mkdir(parents=True, exist_ok=True)
                source = tar.extractfile(member)
                if source is None:
                    raise ValueError(f"could not extract archive member: {member.name}")
                with source, destination.open("wb") as output:
                    shutil.copyfileobj(source, output)
                destination.chmod(member.mode & 0o777)

        for asset in NATIVE_ASSETS:
            path = application / asset
            if path.is_symlink() or not path.is_file():
                raise ValueError(f"missing archive asset: {asset}")
        try:
            package = json.loads((application / p"package.json").read_text(encoding="utf-8"))
        except (OSError, UnicodeError, json.JSONDecodeError) as error:
            raise ValueError("invalid package metadata") from error
        if not isinstance(package, dict) or package.get("version") != version:
            raise ValueError("archive version mismatch")
        (application / p"prime-agent").chmod((application / p"prime-agent").stat().st_mode | 0o700)
        (application / p".archive-sha256").write_text(f"{digest}\n", encoding="utf-8")
        (application / p".install-source").write_text(f"{self.base_url}\n", encoding="utf-8")

        name = f"{version}-{native_platform}-{digest}"
        destination = self.native_root / p"releases" / name
        if destination.exists() or destination.is_symlink():
            alphabet = string.ascii_letters + string.digits
            for _attempt in range(100):
                unique = "".join(secrets.choice(alphabet) for _ in range(6))
                candidate = destination.with_name(f"{name}.{unique}")
                if not candidate.exists() and not candidate.is_symlink():
                    destination = candidate
                    name = candidate.name
                    break
            else:
                raise RuntimeError("could not allocate a unique native release directory")
        os.replace(application, destination)
        target = f"../releases/{name}/prime-agent"
        parsed = self.native_parse_target(target)
        if parsed is None:
            raise RuntimeError("created an invalid native release target")
        return parsed

    def native_parse_target(self, target: str | os.PathLike[str]) -> NativeTarget | None:
        target = os.fspath(target)
        match = re.fullmatch(r"\.\./releases/([^/]+)/prime-agent", target)
        if match is None or self.native_root is None:
            return None
        name = match.group(1)
        if name in {"", ".", ".."} or re.fullmatch(r"[0-9A-Za-z.-]+", name) is None:
            return None
        prefix, separator, digest_suffix = name.rpartition("-")
        if not separator:
            return None
        digest, unique_separator, unique = digest_suffix.partition(".")
        if re.fullmatch(r"[0-9a-f]{64}", digest) is None:
            return None
        if unique_separator and re.fullmatch(r"[0-9A-Za-z]{6}", unique) is None:
            return None
        native_platform = next((item for item in NATIVE_PLATFORMS if prefix.endswith(f"-{item}")), None)
        if native_platform is None:
            return None
        version = prefix[: -(len(native_platform) + 1)]
        if NATIVE_VERSION_PATTERN.fullmatch(version) is None:
            return None
        return NativeTarget(
            target=target,
            name=name,
            digest=digest,
            platform=native_platform,
            version=version,
            directory=self.native_root / "releases" / name,
        )

    @staticmethod
    def release_is_node_only(manifest: Path, filename: str) -> bool:
        compiled = False
        matching: list[list[str]] = []
        try:
            lines = manifest.read_text(encoding="utf-8").splitlines()
        except OSError:
            return False
        for line in lines:
            fields = line.split()
            if len(fields) >= 2 and fields[1].endswith(".tar.gz"):
                compiled = True
            if len(fields) >= 2 and fields[1] == filename:
                matching.append(fields)
        if compiled or len(matching) != 1:
            return False
        fields = matching[0]
        return len(fields) == 2 and re.fullmatch(r"[0-9a-fA-F]{64}", fields[0]) is not None

    @staticmethod
    def native_select_checksum(manifest: Path, filename: str) -> str | None:
        try:
            lines = manifest.read_text(encoding="utf-8").splitlines()
        except (OSError, UnicodeError):
            return None
        matches = [line.split() for line in lines if len(line.split()) >= 2 and line.split()[1] == filename]
        if len(matches) != 1:
            return None
        fields = matches[0]
        if len(fields) != 2 or re.fullmatch(r"[0-9a-fA-F]{64}", fields[0]) is None:
            return None
        return fields[0].lower()

    def install_native(self, native_platform: str, args: Sequence[str]) -> int:
        if self.base_url == self.unconfigured_base_url:
            raise SystemExit("error: set PRIME_AGENT_DOWNLOAD_BASE_URL or use the published installer.")
        self.validate_download_base_url()
        self.register_traps()
        self.init_screen()
        version = self.resolve_version(args)
        if NATIVE_VERSION_PATTERN.fullmatch(version) is None:
            raise SystemExit("error: invalid native release version.")

        download_dir = self.temp_dir()
        self.download_dir = download_dir
        filename = f"prime-agent-{version}-{native_platform}.tar.gz"
        manifest = download_dir / p"SHA256SUMS"
        manifest_url = f"{self.base_url}/releases/v{version}/SHA256SUMS"
        if not self.run_animation(
            "Downloading Prime Agent",
            "Downloading release checksums",
            f"Prime Agent v{version}",
            lambda _output: self.curl_download(
                ["-fsSL", "--connect-timeout", "10", "--max-time", "120", manifest_url, "-o", manifest]
            ),
        ):
            raise SystemExit("error: could not download release checksums.")
        digest = self.native_select_checksum(manifest, filename)
        if digest is None:
            node_filename = f"{self.package}-{version}.tgz"
            if self.validate_install_method() == "auto" and self.release_is_node_only(manifest, node_filename):
                shutil.rmtree(download_dir, ignore_errors=True)
                self.download_dir = None
                print("This release only provides npm packages; using the Node installation.", file=sys.stderr)
                return self.install_node_main([version])
            raise SystemExit(f"error: expected one valid checksum for {filename}.")

        if self.env.get("PRIME_AGENT_INSTALLER_NONINTERACTIVE", "0") != "1":
            answer = self.prompt_yes_no(
                f"Install Prime Agent v{version}?",
                "Downloads and verifies the compiled application.",
                "Install? [Y/n]",
            )
            if answer == 1:
                shutil.rmtree(download_dir, ignore_errors=True)
                self.download_dir = None
                return 0

        self.native_prepare_root()
        if self.native_stage is None:
            raise RuntimeError("native staging directory is unavailable")
        shutil.rmtree(download_dir, ignore_errors=True)
        self.download_dir = None
        expected = self.env.get("PRIME_AGENT_EXPECTED_SHA256")
        if expected and expected != digest:
            raise SystemExit("error: release manifest and checksum inventory disagree.")

        archive = self.native_stage / filename
        archive_url = f"{self.base_url}/releases/v{version}/{filename}"
        if not self.run_animation(
            "Downloading Prime Agent",
            "Downloading compiled Prime Agent",
            native_platform,
            lambda _output: self.curl_download(
                ["-fsSL", "--connect-timeout", "10", "--max-time", "300", archive_url, "-o", archive]
            ),
        ):
            raise SystemExit("error: could not download compiled Prime Agent.")

        target = self.native_extract_release(archive, version, native_platform, digest)
        if not self.native_verify_release_target(target.target, "downloaded"):
            shutil.rmtree(target.directory, ignore_errors=True)
            self.native_cleanup()
            if self.validate_install_method() == "auto":
                print("The compiled executable cannot run here; using the Node installation.", file=sys.stderr)
                return self.install_node_main([version])
            raise SystemExit("error: the compiled executable cannot run on this machine.")

        self.native_check_public_command()
        if self.native_root is None:
            raise RuntimeError("native installation root is unavailable")
        current = self.native_readlink(self.native_root / p"bin/prime-agent")
        previous = current if current and self.native_verify_release_target(current, "current") else ""
        self.native_activate(target.target, previous)
        self.native_install_public_command()
        self.native_prune_releases()
        if self.env.get("PRIME_AGENT_INSTALL_LINK", "1") != "0":
            try:
                self.native_configure_path()
            except OSError:
                print(f"Add {self.native_public_bin} to PATH to run Prime Agent.", file=sys.stderr)
        self.screen_update("Prime Agent installed", detail=f"Run it with: {self.command}")
        print(f"Installed Prime Agent {version} at {self.native_root / p'bin/prime-agent'}")
        self.native_cleanup()
        return 0

    def native_probe_timeout(self) -> int:
        value = self.env.get("PRIME_AGENT_PROBE_TIMEOUT_SECONDS", "")
        if not value.isdigit():
            return 60
        timeout = int(value, 10)
        return timeout if 1 <= timeout <= 600 else 60

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
            if not self.run_animation("Resolving latest release", "Resolving latest release", f"Checking the {channel} release channel.", lambda output: self.curl_download(["-fsSL", f"{self.base_url}/{channel}", "-o", path])):
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
            self.curl_download(["-fsSL", f"{NODE_DIST_BASE}/SHASUMS256.txt", "-o", checksums])
            suffix = f"-{platform}-{arch}.tar.xz"
            node_file = next((line.split()[1] for line in checksums.read_text(encoding="utf-8").splitlines() if len(line.split()) >= 2 and line.split()[1].startswith("node-v") and line.split()[1].endswith(suffix)), "")
            if not node_file or "/" in node_file or "\\" in node_file or ".." in node_file or not re.fullmatch(rf"node-v.+-{re.escape(platform)}-{re.escape(arch)}\.tar\.xz", node_file):
                raise RuntimeError(f"No safe Node.js binary is available for {platform}-{arch}.")
            archive = temporary / node_file
            print(f"Downloading Node.js {node_file.removesuffix('.tar.xz')}")
            self.curl_download(["-fsSL", f"{NODE_DIST_BASE}/{node_file}", "-o", archive])
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
        if not self.run_animation("Downloading checksums", "Downloading release checksums", f"Prime Agent v{version}", lambda _output: self.curl_download(["-fsSL", checksums_url, "-o", checksums])):
            raise RuntimeError("could not download release checksums")
        if not self.run_animation("Downloading Prime Agent", f"Downloading Prime Agent v{version}", "Fetching the verified package.", lambda _output: self.curl_download(["-fsSL", tarball_url, "-o", tarball_path])):
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

    def install_node_main(self, args: Sequence[str]) -> int:
        if self.base_url == self.unconfigured_base_url:
            print("error: installer download URL is not configured.\nSet PRIME_AGENT_DOWNLOAD_BASE_URL or use the installer published by the release workflow.", file=sys.stderr)
            return 1
        self.validate_download_base_url()
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

    def main(self, args: Sequence[str]) -> int:
        if args and args[0] == "--rollback":
            self.native_rollback()
            return 0
        if args and args[0] == "--native-platform":
            native_platform = self.native_platform()
            if native_platform is None:
                return 1
            print(native_platform)
            return 0

        method = self.validate_install_method()
        if method != "node":
            native_platform = self.native_platform()
            if native_platform is not None:
                self.install_native(native_platform, args)
                return 0
            if method == "binary":
                print("error: no compatible compiled archive is available for this platform.", file=sys.stderr)
                return 1
            print("Using the Node installation for this platform.", file=sys.stderr)
        return self.install_node_main(args)


def main(args: Sequence[str] | None = None) -> int:
    return Installer().main(sys.argv[1:] if args is None else args)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, ValueError, UnicodeError, subprocess.SubprocessError) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1) from error
