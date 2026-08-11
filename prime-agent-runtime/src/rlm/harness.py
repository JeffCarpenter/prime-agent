"""Persistent harness-state helpers for Prime Agent's RLM kernel.

The state model is intentionally small: it records prompt notes, memory,
skills, subagent specs, and refinement events in the session-local harness
store by default; pass ``global_=True`` for the cross-session global store.
Execution still belongs to Prime Agent's TypeScript host and the existing
``rlm.run`` recursion bridge.

Cross-language commits use the same protocol as the TypeScript host: populate a
private candidate lock before atomically installing it as ``<state>.lock``, reload
under that lock, advance the document's monotonic revision, fsync a same-directory
temporary file, atomically replace the state document, and fence every operation
by the exact owner fingerprint. Direct stale saves fail explicitly; ordinary
Python mutations reload and merge. Valid foreign-host owners are never reclaimed
automatically: this is a same-host protocol, not a renewable distributed lease.
Only genuinely absent owner metadata is eligible for missing-owner reclamation;
other owner-read failures abort without moving the lock or touching state.
"""

from __future__ import annotations

import ctypes
import errno
import hashlib
import json
import math
import os
import shutil
import socket
import subprocess
import sys
import time
import uuid
from contextlib import contextmanager
from ctypes import wintypes
from dataclasses import asdict, dataclass, field, fields
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterator, Literal, TypeVar, cast

HarnessKind = Literal["prompt", "memory", "skill", "subagent"]
HarnessScope = Literal["local", "global"]
ThinkingLevel = Literal["off", "minimal", "low", "medium", "high", "xhigh", "max"]

_DEFAULT_FILE_NAME = "harness_state.json"
_DEFAULT_HARNESS_DIR_NAME = "harness"
WINDOWS_PERSISTENCE_UNSUPPORTED_ERROR = "Persistent harness storage is unsupported on Windows"
_KINDS: tuple[HarnessKind, ...] = ("prompt", "memory", "skill", "subagent")
_THINKING_LEVELS: tuple[ThinkingLevel, ...] = ("off", "minimal", "low", "medium", "high", "xhigh", "max")
_DEFAULT_LOCK_TIMEOUT_SECONDS = 10.0
_DEFAULT_STALE_LOCK_SECONDS = 60.0
_LOCK_POLL_SECONDS = 0.01
_LOCK_OWNER_FILE_NAME = "owner.json"
_MAX_LOCK_DURATION_SECONDS = 2_147_483.647
_MAX_HARNESS_REVISION = (1 << 53) - 1
_state_cache: dict[tuple[Path, HarnessScope], "HarnessState"] = {}
_MutationResult = TypeVar("_MutationResult")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _hostname() -> str:
    return socket.gethostname()


def _lock_path(file_path: Path) -> Path:
    return Path(f"{file_path}.lock")


def _pid_alive(pid: int) -> bool:
    if os.name == "nt":
        process_query_limited_information = 0x1000
        still_active = 259
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel32.OpenProcess.restype = wintypes.HANDLE
        kernel32.GetExitCodeProcess.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
        kernel32.GetExitCodeProcess.restype = wintypes.BOOL
        kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
        kernel32.CloseHandle.restype = wintypes.BOOL
        handle = kernel32.OpenProcess(process_query_limited_information, False, pid)
        if not handle:
            return ctypes.get_last_error() == 5
        try:
            exit_code = wintypes.DWORD()
            if not kernel32.GetExitCodeProcess(handle, ctypes.byref(exit_code)):
                return True
            return exit_code.value == still_active
        finally:
            kernel32.CloseHandle(handle)
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except OSError:
        # An unexpected probe failure is not proof that the process is gone.
        return True


def _run_process_query(command: list[str]) -> str:
    result = subprocess.run(
        command,
        capture_output=True,
        check=True,
        text=True,
        timeout=2,
        env={**os.environ, "TZ": "UTC", "LC_ALL": "C"},
    )
    return result.stdout.strip()


def _get_process_start_id(
    pid: int,
    *,
    platform: str = sys.platform,
    query: Callable[[list[str]], str] = _run_process_query,
    read_text: Callable[[Path], str] = lambda path: path.read_text(encoding="utf-8"),
) -> str | None:
    try:
        if platform == "win32":
            script = (
                f"$p = Get-Process -Id {pid} -ErrorAction Stop; "
                "[Console]::Write($p.StartTime.ToUniversalTime().Ticks)"
            )
            value = query(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script])
            return f"win:{value}" if value else None
        if platform.startswith("linux"):
            contents = read_text(Path(f"/proc/{pid}/stat"))
            fields_after_name = contents.rsplit(")", 1)[1].strip().split()
            return f"proc:{fields_after_name[19]}" if len(fields_after_name) > 19 else None
        value = query(["ps", "-p", str(pid), "-o", "lstart="])
        return f"ps2:{value}" if value else None
    except (IndexError, OSError, subprocess.SubprocessError):
        return None


@dataclass(frozen=True)
class _LockObservation:
    owner: dict[str, Any] | None
    fingerprint: str


def _lock_fingerprint(contents: str) -> str:
    return hashlib.sha256(contents.encode("utf-8")).hexdigest()


def _compare_process_start_ids(recorded: str | None, observed: str | None) -> Literal["match", "mismatch", "unverifiable"]:
    if recorded is None or observed is None:
        return "unverifiable"
    if recorded == observed:
        return "match"
    recorded_prefix, recorded_separator, _ = recorded.partition(":")
    observed_prefix, observed_separator, _ = observed.partition(":")
    if not recorded_prefix or not recorded_separator or not observed_prefix or not observed_separator:
        return "mismatch"
    return "mismatch" if recorded_prefix == observed_prefix else "unverifiable"


def _read_lock_observation(lock_path: Path) -> _LockObservation | None:
    try:
        stat = lock_path.stat()
    except FileNotFoundError:
        return None
    except OSError as error:
        raise OSError(
            error.errno,
            f"Cannot inspect harness-state lock at {lock_path}; refusing to reclaim the lock",
        ) from error
    owner_path = lock_path / _LOCK_OWNER_FILE_NAME if lock_path.is_dir() else lock_path
    try:
        raw_owner = owner_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        if not lock_path.is_dir():
            return None
        try:
            missing_owner_stat = lock_path.stat()
        except FileNotFoundError:
            return None
        fingerprint = _lock_fingerprint(
            f"missing:{missing_owner_stat.st_dev}:{missing_owner_stat.st_ino}:{missing_owner_stat.st_mtime_ns}"
        )
        return _LockObservation(owner=None, fingerprint=fingerprint)
    except OSError as error:
        raise OSError(
            error.errno,
            f"Cannot inspect harness-state lock owner at {lock_path}; refusing to reclaim the lock",
        ) from error
    try:
        owner = json.loads(raw_owner)
    except ValueError:
        owner = None
    if not isinstance(owner, dict):
        owner = None
    elif (
        type(owner.get("pid")) is not int
        or owner["pid"] <= 0
        or not isinstance(owner.get("hostname"), str)
        or not owner["hostname"]
        or not isinstance(owner.get("token"), str)
        or not owner["token"]
        or (
            "process_start_id" in owner
            and (not isinstance(owner["process_start_id"], str) or not owner["process_start_id"])
        )
    ):
        owner = None
    return _LockObservation(owner=owner, fingerprint=_lock_fingerprint(raw_owner))


def _lock_is_stale(
    lock_path: Path,
    observation: _LockObservation | None,
    stale_lock_seconds: float,
) -> bool:
    owner = observation.owner if observation else None
    if owner:
        if owner["hostname"] != _hostname():
            return False
        if not _pid_alive(owner["pid"]):
            return True
        if process_start_id := owner.get("process_start_id"):
            current_start_id = _get_process_start_id(owner["pid"])
            return _compare_process_start_ids(process_start_id, current_start_id) == "mismatch"
        return False
    try:
        return time.time() - lock_path.stat().st_mtime >= stale_lock_seconds
    except FileNotFoundError:
        return False


def _lock_timeout_error(lock_path: Path, observation: _LockObservation | None) -> TimeoutError:
    owner = observation.owner if observation else None
    if owner and owner["hostname"] != _hostname():
        return TimeoutError(
            f"Timed out waiting for harness-state lock {lock_path} owned by foreign host "
            f"{owner['hostname']}. Automatic foreign-host reclamation is disabled because "
            "harness-state locking is same-host only. Verify the remote owner is inactive, "
            "then remove the lock directory manually."
        )
    return TimeoutError(f"Timed out waiting for harness-state lock {lock_path}")


def _is_target_exists_error(error: OSError, *, platform: str = os.name) -> bool:
    if error.errno in (errno.EEXIST, errno.ENOTEMPTY):
        return True
    return platform == "nt" and error.errno in (errno.EACCES, errno.EPERM)


def _restore_moved_lock(moved_path: Path, lock_path: Path) -> None:
    try:
        moved_path.rename(lock_path)
    except OSError as error:
        if not _is_target_exists_error(error):
            raise


def _remove_lock_path(path: Path) -> None:
    if path.is_dir():
        shutil.rmtree(path)
    else:
        path.unlink()


def _remove_observed_lock(lock_path: Path, observed: _LockObservation) -> bool:
    moved_path = Path(f"{lock_path}.moved.{os.getpid()}.{uuid.uuid4()}")
    try:
        lock_path.rename(moved_path)
    except FileNotFoundError:
        return False
    try:
        moved = _read_lock_observation(moved_path)
    except OSError:
        _restore_moved_lock(moved_path, lock_path)
        raise
    if moved is None or moved.fingerprint != observed.fingerprint:
        _restore_moved_lock(moved_path, lock_path)
        return False
    _remove_lock_path(moved_path)
    return True


def _validate_lock_duration(value: float, name: str, *, allow_zero: bool) -> float:
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
        or value < (0 if allow_zero else 0.001)
        or value > _MAX_LOCK_DURATION_SECONDS
    ):
        qualifier = "non-negative" if allow_zero else "positive"
        raise ValueError(
            f"{name} must be a finite {qualifier} duration no greater than "
            f"{_MAX_LOCK_DURATION_SECONDS} seconds"
        )
    return float(value)


@contextmanager
def _state_lock(
    file_path: Path,
    *,
    timeout_seconds: float = _DEFAULT_LOCK_TIMEOUT_SECONDS,
    stale_lock_seconds: float = _DEFAULT_STALE_LOCK_SECONDS,
) -> Iterator[Callable[[], None]]:
    timeout_seconds = _validate_lock_duration(timeout_seconds, "timeout_seconds", allow_zero=False)
    stale_lock_seconds = _validate_lock_duration(stale_lock_seconds, "stale_lock_seconds", allow_zero=True)
    lock_path = _lock_path(file_path)
    token = str(uuid.uuid4())
    owner = {
        "pid": os.getpid(),
        "hostname": _hostname(),
        "token": token,
        "created_at": _now(),
    }
    if process_start_id := _get_process_start_id(os.getpid()):
        owner["process_start_id"] = process_start_id
    owner_contents = f"{json.dumps(owner)}\n"
    owner_fingerprint = _lock_fingerprint(owner_contents)
    deadline = time.monotonic() + timeout_seconds
    file_path.parent.mkdir(parents=True, exist_ok=True)
    while True:
        candidate_path = Path(f"{lock_path}.candidate.{os.getpid()}.{uuid.uuid4()}")
        try:
            descriptor: int | None = None
            try:
                descriptor = os.open(candidate_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                with os.fdopen(descriptor, "w", encoding="utf-8") as candidate:
                    descriptor = None
                    candidate.write(owner_contents)
                    candidate.flush()
                    os.fsync(candidate.fileno())
                # Hard-link installation is atomic and no-replace. Directory
                # rename may overwrite a fresh empty destination on POSIX.
                os.link(candidate_path, lock_path)
            finally:
                if descriptor is not None:
                    os.close(descriptor)
                try:
                    candidate_path.unlink()
                except OSError:
                    # A private candidate is recoverable and cannot grant ownership.
                    pass
            break
        except OSError as error:
            if not _is_target_exists_error(error) or (
                error.errno in (errno.EACCES, errno.EPERM) and not lock_path.exists()
            ):
                raise
        observation = _read_lock_observation(lock_path)
        if observation and _lock_is_stale(lock_path, observation, stale_lock_seconds):
            _remove_observed_lock(lock_path, observation)
            continue
        if time.monotonic() >= deadline:
            raise _lock_timeout_error(lock_path, observation)
        time.sleep(min(_LOCK_POLL_SECONDS, max(0.001, deadline - time.monotonic())))

    def assert_owned() -> None:
        observation = _read_lock_observation(lock_path)
        if observation is None or observation.fingerprint != owner_fingerprint:
            raise RuntimeError(f"Lost harness-state lock ownership for {lock_path}")

    assert_owned()
    try:
        yield assert_owned
    finally:
        observation = _read_lock_observation(lock_path)
        if observation and observation.fingerprint == owner_fingerprint:
            _remove_observed_lock(lock_path, observation)


_UNSUPPORTED_WINDOWS_DIRECTORY_FSYNC = {
    errno.EACCES,
    errno.EBADF,
    errno.EINVAL,
    errno.EISDIR,
    errno.EPERM,
}


def _fsync_directory(
    directory: Path,
    *,
    platform: str = os.name,
    open_fn: Callable[[Path, int], int] = os.open,
    fsync_fn: Callable[[int], None] = os.fsync,
    close_fn: Callable[[int], None] = os.close,
) -> None:
    descriptor: int | None = None
    try:
        descriptor = open_fn(directory, os.O_RDONLY)
        fsync_fn(descriptor)
    except OSError as error:
        if platform != "nt" or error.errno not in _UNSUPPORTED_WINDOWS_DIRECTORY_FSYNC:
            raise
    finally:
        if descriptor is not None:
            close_fn(descriptor)


def _slug(raw: str, fallback: str) -> str:
    normalized = "".join(ch.lower() if ch.isalnum() else "_" for ch in raw.strip())
    normalized = "_".join(part for part in normalized.split("_") if part)
    return (normalized or fallback)[:80]


def _agent_dir() -> Path:
    raw = (
        os.environ.get("PRIME_AGENT_CODING_AGENT_DIR")
        or os.environ.get("PI_CODING_AGENT_DIR")
        or str(Path.home() / ".prime" / "agent")
    )
    return Path(raw).expanduser().resolve()


def _resolve_global_flag(global_: bool = False, extra: dict[str, Any] | None = None) -> bool:
    extra = dict(extra or {})
    if "global" in extra:
        value = extra.pop("global")
        if not isinstance(value, bool):
            raise TypeError(f"global must be a bool, got {type(value).__name__}")
        global_ = value
    if extra:
        unexpected = next(iter(extra))
        raise TypeError(f"unexpected keyword argument {unexpected!r}")
    return bool(global_)


def _strip_scope_prefix(id: str | None, global_: bool) -> tuple[str | None, bool]:
    # overview() displays entries as [local:id]/[global:id]; accept those ids
    # verbatim. A global: prefix routes to the global store unless the caller
    # already forced a scope via global_.
    if isinstance(id, str):
        scope, sep, rest = id.partition(":")
        if sep and rest and scope in ("local", "global"):
            return rest, global_ or scope == "global"
    return id, global_


def _env_dir(name: str) -> str | None:
    # Set-but-empty env values must behave as unset; a bare "" would skip the
    # session-dir fallback and land local writes in the global agent-dir default.
    value = (os.environ.get(name) or "").strip()
    return value or None


def _state_file(state_dir: str | Path | None = None, *, global_: bool = False) -> Path:
    root: str | Path | None = state_dir
    if root is None:
        root = _env_dir("RLM_GLOBAL_HARNESS_STATE_DIR") if global_ else _env_dir("RLM_HARNESS_STATE_DIR")
    if root is None and not global_ and (session_dir := _env_dir("RLM_SESSION_DIR")):
        root = Path(session_dir) / _DEFAULT_HARNESS_DIR_NAME
    if root is None and not global_:
        raise RuntimeError(
            "Local harness state requires RLM_HARNESS_STATE_DIR or RLM_SESSION_DIR. "
            "Use get_harness_state(global_=True) for global state."
        )
    if root:
        return Path(root).expanduser().resolve() / _DEFAULT_FILE_NAME
    return _agent_dir() / _DEFAULT_HARNESS_DIR_NAME / _DEFAULT_FILE_NAME


def _chmod_open_file(fd: int, path: Path, mode: int) -> None:
    if hasattr(os, "fchmod"):
        os.fchmod(fd, mode)
    else:
        path.chmod(mode)


def _ensure_private_directory(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    info = path.lstat()
    if stat.S_ISLNK(info.st_mode) or not stat.S_ISDIR(info.st_mode):
        raise OSError(f"Refusing to use non-directory private path: {path}")
    if os.name == "nt":
        path.chmod(0o700)
        return
    flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(path, flags)
    try:
        if not stat.S_ISDIR(os.fstat(fd).st_mode):
            raise OSError(f"Refusing to use non-directory private path: {path}")
        _chmod_open_file(fd, path, 0o700)
    finally:
        os.close(fd)


def _open_private_for_read(path: Path):
    info = path.lstat()
    if stat.S_ISLNK(info.st_mode) or not stat.S_ISREG(info.st_mode):
        raise OSError(f"Refusing to use non-regular private file: {path}")
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(path, flags)
    try:
        opened = os.fstat(fd)
        if not stat.S_ISREG(opened.st_mode):
            raise OSError(f"Refusing to use non-regular private file: {path}")
        _chmod_open_file(fd, path, 0o600)
        return os.fdopen(fd, "r", encoding="utf-8")
    except BaseException:
        os.close(fd)
        raise


def _write_private_json_atomic(path: Path, data: dict[str, Any]) -> None:
    _ensure_private_directory(path.parent)
    if os.path.lexists(path):
        info = path.lstat()
        if stat.S_ISLNK(info.st_mode) or not stat.S_ISREG(info.st_mode):
            raise OSError(f"Refusing to replace non-regular private file: {path}")
    temp_path = path.parent / f".{path.name}.{os.getpid()}.{secrets.token_hex(12)}.tmp"
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
    fd: int | None = None
    try:
        fd = os.open(temp_path, flags, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            fd = None
            json.dump(data, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, path)
    finally:
        if fd is not None:
            os.close(fd)
        try:
            temp_path.unlink()
        except FileNotFoundError:
            pass


@dataclass
class HarnessEntry:
    """A reusable prompt, memory, skill, or subagent record."""

    id: str
    kind: HarnessKind
    title: str
    content: str
    path: str = "general"
    scope: HarnessScope = "local"
    reference: dict[str, Any] = field(default_factory=dict)
    arguments: dict[str, Any] = field(default_factory=dict)
    thinking: ThinkingLevel | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    source: str = "agent"
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)
    version: int = 1


@dataclass
class RefinementEvent:
    """A recorded online harness-refinement pass."""

    id: str
    trigger: str
    changes: list[str]
    evidence: str = ""
    outcome: str = ""
    created_at: str = field(default_factory=_now)


_ENTRY_FIELDS = {field.name for field in fields(HarnessEntry)}
_REFINEMENT_FIELDS = {field.name for field in fields(RefinementEvent)}


def _validate_python_skill_reference(reference: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(reference, dict):
        raise ValueError("skill entries require a Python reference")
    normalized = dict(reference)
    if normalized.get("type") != "python":
        raise ValueError("skill reference.type must be 'python'")
    if not any(isinstance(normalized.get(key), str) and normalized[key] for key in ("import", "python_import")):
        raise ValueError("skill reference requires a Python import")
    if not any(isinstance(normalized.get(key), str) and normalized[key] for key in ("callable", "call_pattern")):
        raise ValueError("skill reference requires a callable or call_pattern")
    return normalized


def _validate_subagent_thinking(value: Any) -> ThinkingLevel:
    if not isinstance(value, str):
        raise TypeError(f"subagent thinking must be a string, got {type(value).__name__}")
    normalized = value.strip()
    if normalized not in _THINKING_LEVELS:
        raise ValueError(f"subagent thinking must be one of: {', '.join(_THINKING_LEVELS)}")
    return cast(ThinkingLevel, normalized)


def _entry_dict(entry: HarnessEntry) -> dict[str, Any]:
    data = asdict(entry)
    if entry.thinking is None:
        data.pop("thinking", None)
    return data


class HarnessState:
    """CRUD store for reset-free harness refinement state."""

    def __init__(
        self,
        file_path: str | Path | None = None,
        *,
        in_memory: bool = False,
        scope: HarnessScope = "local",
        local_write_error: str | None = None,
        lock_timeout_seconds: float = _DEFAULT_LOCK_TIMEOUT_SECONDS,
        stale_lock_seconds: float = _DEFAULT_STALE_LOCK_SECONDS,
    ):
        # Windows cannot provide the required no-follow and private-ACL guarantees
        # through this portable implementation. Keep reads as an empty proxy and
        # reject every mutation without resolving or touching a path.
        if os.name == "nt":
            in_memory = True
            local_write_error = WINDOWS_PERSISTENCE_UNSUPPORTED_ERROR
        # in_memory mode never resolves or touches a path. It is the safe fallback when
        # path resolution itself fails, so constructing it cannot re-raise that error.
        if in_memory:
            self.file_path: Path | None = None
        else:
            self.file_path = (
                Path(file_path).expanduser().parent.resolve() / Path(file_path).expanduser().name
                if file_path
                else _state_file(global_=(scope == "global"))
            )
        self.scope: HarnessScope = scope
        # When set, local mutations raise instead of vanishing into a volatile
        # store; reads and global_=True delegation keep working.
        self._local_write_error = local_write_error
        self._lock_timeout_seconds = _validate_lock_duration(
            lock_timeout_seconds,
            "lock_timeout_seconds",
            allow_zero=False,
        )
        self._stale_lock_seconds = _validate_lock_duration(
            stale_lock_seconds,
            "stale_lock_seconds",
            allow_zero=True,
        )
        self.revision = 0
        self.entries: dict[HarnessKind, dict[str, HarnessEntry]] = {kind: {} for kind in _KINDS}
        self.refinements: list[RefinementEvent] = []
        self._global_target_state_dir: Path | None = None
        # mtime of the file as of the last load/save, used to detect out-of-process
        # writes (e.g. the host `/refine` command) and avoid clobbering them.
        self._loaded_mtime: int | None = None
        self.load()

    def _ensure_local_writable(self) -> None:
        if self._local_write_error is not None:
            raise RuntimeError(self._local_write_error)

    def _disk_mtime(self) -> int | None:
        if self.file_path is None:
            return None
        try:
            info = self.file_path.lstat()
            if stat.S_ISLNK(info.st_mode) or not stat.S_ISREG(info.st_mode):
                return None
            return info.st_mtime_ns
        except OSError:
            return None

    def _sync_from_disk(self) -> None:
        """Reload if another process rewrote the state file since we last touched it.

        The kernel keeps a long-lived ``HarnessState`` in memory while the host
        ``/refine`` command rewrites the same file from a separate process. Without
        this guard the next in-kernel ``save()`` would overwrite host edits with a
        stale snapshot. We re-read whenever the on-disk mtime no longer matches the
        value recorded at our last load/save.
        """
        if self._disk_mtime() != self._loaded_mtime:
            self.load()

    def load(self) -> "HarnessState":
        if self.file_path is None:
            return self
        if not self.file_path.exists():
            self.revision = 0
            self.entries = {kind: {} for kind in _KINDS}
            self.refinements = []
            self._loaded_mtime = None
            return self
        info = self.file_path.lstat()
        if stat.S_ISLNK(info.st_mode) or not stat.S_ISREG(info.st_mode):
            # Keep prompt construction/read APIs available, but permanently block
            # mutation of this unsafe persistent sink.
            self._local_write_error = f"Refusing to use non-regular private file: {self.file_path}"
            self._loaded_mtime = None
            return self
        mtime = self._disk_mtime()
        try:
            with _open_private_for_read(self.file_path) as f:
                data = json.load(f)
        except (OSError, ValueError):
            # A corrupt or unreadable file must not crash read-only kernel access.
            # Mutations validate strictly under the lock and refuse to overwrite it.
            data = {}
        # json.load returns non-dict types for valid JSON like `null`, `[]`, or a bare
        # string; coerce those to an empty object before attribute access.
        if not isinstance(data, dict):
            data = {}

        revision = data.get("revision", 0)
        self.revision = (
            revision
            if type(revision) is int and 0 <= revision <= _MAX_HARNESS_REVISION
            else 0
        )

        entries: dict[HarnessKind, dict[str, HarnessEntry]] = {kind: {} for kind in _KINDS}
        raw_entries = data.get("entries", {})
        if isinstance(raw_entries, dict):
            for kind in _KINDS:
                raw_kind_entries = raw_entries.get(kind, {})
                if not isinstance(raw_kind_entries, dict):
                    continue
                for entry_id, raw_entry in raw_kind_entries.items():
                    if isinstance(raw_entry, dict):
                        entry_data = {key: value for key, value in raw_entry.items() if key in _ENTRY_FIELDS}
                        entry_data["id"] = str(entry_id)
                        entry_data["kind"] = kind
                        if not isinstance(entry_data.get("title"), str) or not isinstance(
                            entry_data.get("content"), str
                        ):
                            continue
                        if not isinstance(entry_data.get("path"), str):
                            entry_data["path"] = "general"
                        if entry_data.get("scope") not in ("local", "global"):
                            entry_data["scope"] = self.scope
                        if not isinstance(entry_data.get("source"), str):
                            entry_data["source"] = "agent"
                        version = entry_data.get("version", 1)
                        if isinstance(version, str):
                            try:
                                version = int(version)
                            except ValueError:
                                version = 1
                        if not isinstance(version, int):
                            version = 1
                        entry_data["version"] = version
                        if not isinstance(entry_data.get("reference"), dict):
                            entry_data["reference"] = {}
                        if not isinstance(entry_data.get("arguments"), dict):
                            entry_data["arguments"] = {}
                        if not isinstance(entry_data.get("metadata"), dict):
                            entry_data["metadata"] = {}
                        thinking = entry_data.get("thinking")
                        if kind == "subagent" and thinking is not None:
                            try:
                                entry_data["thinking"] = _validate_subagent_thinking(thinking)
                            except (TypeError, ValueError):
                                entry_data["thinking"] = None
                        else:
                            entry_data["thinking"] = None
                        entries[kind][str(entry_id)] = HarnessEntry(**entry_data)
        self.entries = entries

        self.refinements = []
        raw_refinements = data.get("refinements", [])
        if isinstance(raw_refinements, list):
            for raw_event in raw_refinements:
                if isinstance(raw_event, dict):
                    event_data = {key: value for key, value in raw_event.items() if key in _REFINEMENT_FIELDS}
                    if not isinstance(event_data.get("id"), str) or not isinstance(
                        event_data.get("trigger"), str
                    ):
                        continue
                    changes = event_data.get("changes")
                    if isinstance(changes, str):
                        event_data["changes"] = [changes]
                    elif isinstance(changes, list):
                        event_data["changes"] = [str(change) for change in changes]
                    elif not isinstance(changes, list):
                        continue
                    self.refinements.append(RefinementEvent(**event_data))
        self._loaded_mtime = mtime
        return self

    def _global_target(self, global_: bool, extra: dict[str, Any] | None = None) -> "HarnessState | None":
        if not _resolve_global_flag(global_, extra):
            return None
        target = get_harness_state(state_dir=self._global_target_state_dir, global_=True)
        if self.file_path is not None and target.file_path == self.file_path and target.scope == self.scope:
            return None
        return target

    def _document(self, revision: int) -> dict[str, Any]:
        return {
            "schema": 1,
            "revision": revision,
            "entries": {
                kind: {entry_id: _entry_dict(entry) for entry_id, entry in records.items()}
                for kind, records in self.entries.items()
            },
            "refinements": [asdict(event) for event in self.refinements],
        }

    def _disk_revision(self) -> int:
        if self.file_path is None or not self.file_path.exists():
            return 0
        try:
            data = json.loads(self.file_path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as error:
            raise RuntimeError(
                f"Harness state at {self.file_path} is invalid; refusing to overwrite it"
            ) from error
        if not isinstance(data, dict):
            raise RuntimeError(f"Harness state at {self.file_path} is invalid; refusing to overwrite it")
        revision = data.get("revision", 0)
        if type(revision) is not int or revision < 0 or revision > _MAX_HARNESS_REVISION:
            raise RuntimeError(
                f"Harness state at {self.file_path} has an invalid revision; refusing to overwrite it"
            )
        return revision

    def _write_atomic(self, data: dict[str, Any], assert_lock_owned: Callable[[], None]) -> None:
        if self.file_path is None:
            return
        assert_lock_owned()
        mode = self.file_path.stat().st_mode & 0o777 if self.file_path.exists() else 0o600
        temp_path = Path(f"{self.file_path}.{os.getpid()}.{uuid.uuid4()}.tmp")
        descriptor: int | None = None
        try:
            descriptor = os.open(temp_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
            with os.fdopen(descriptor, "w", encoding="utf-8") as file:
                descriptor = None
                json.dump(data, file, indent=2, ensure_ascii=False)
                file.write("\n")
                file.flush()
                os.fsync(file.fileno())
            assert_lock_owned()
            os.replace(temp_path, self.file_path)
            _fsync_directory(self.file_path.parent)
        finally:
            if descriptor is not None:
                os.close(descriptor)
            try:
                temp_path.unlink()
            except FileNotFoundError:
                pass

    def _save_locked(self, assert_lock_owned: Callable[[], None]) -> "HarnessState":
        if self.revision >= _MAX_HARNESS_REVISION:
            raise RuntimeError(
                f"Harness-state revision at {self.file_path} is exhausted; refusing to overwrite it"
            )
        next_revision = self.revision + 1
        try:
            self._write_atomic(self._document(next_revision), assert_lock_owned)
            self.revision = next_revision
            self._loaded_mtime = self._disk_mtime()
        except Exception:
            # Replacement may already be visible when directory fsync fails.
            # Reload so the in-memory view matches whichever document won.
            try:
                self.load()
            except Exception:
                pass
            raise
        return self

    def _mutate(self, mutation: Callable[[], _MutationResult]) -> _MutationResult:
        if self.file_path is None:
            return mutation()
        with _state_lock(
            self.file_path,
            timeout_seconds=self._lock_timeout_seconds,
            stale_lock_seconds=self._stale_lock_seconds,
        ) as assert_lock_owned:
            # load() reads the document unconditionally. Do not replace it with
            # _sync_from_disk(): equal/coarse mtimes must not preserve stale state.
            assert_lock_owned()
            self._disk_revision()
            self.load()
            try:
                result = mutation()
                if result is not False:
                    self._save_locked(assert_lock_owned)
                return result
            except Exception:
                try:
                    self.load()
                except Exception:
                    pass
                raise

    def save(self) -> "HarnessState":
        if self.file_path is None:
            # in_memory fallback: nothing to persist.
            return self
        with _state_lock(
            self.file_path,
            timeout_seconds=self._lock_timeout_seconds,
            stale_lock_seconds=self._stale_lock_seconds,
        ) as assert_lock_owned:
            assert_lock_owned()
            disk_revision = self._disk_revision()
            if disk_revision != self.revision:
                raise RuntimeError(
                    f"Harness-state revision conflict at {self.file_path}: "
                    f"expected {self.revision}, found {disk_revision}"
                )
            return self._save_locked(assert_lock_owned)

    def upsert(
        self,
        kind: HarnessKind,
        title: str,
        content: str,
        *,
        id: str | None = None,
        path: str = "general",
        reference: dict[str, Any] | None = None,
        arguments: dict[str, Any] | None = None,
        thinking: ThinkingLevel | None = None,
        metadata: dict[str, Any] | None = None,
        source: str = "agent",
        global_: bool = False,
        **kwargs: Any,
    ) -> HarnessEntry:
        id, global_ = _strip_scope_prefix(id, global_)
        if target := self._global_target(global_, kwargs):
            return target.upsert(
                kind,
                title,
                content,
                id=id,
                path=path,
                reference=reference,
                arguments=arguments,
                thinking=thinking,
                metadata=metadata,
                source=source,
            )
        self._ensure_local_writable()
        return self._mutate(
            lambda: self._upsert(
                kind,
                title,
                content,
                id=id,
                path=path,
                reference=reference,
                arguments=arguments,
                thinking=thinking,
                metadata=metadata,
                source=source,
            )
        )

    def _upsert(
        self,
        kind: HarnessKind,
        title: str,
        content: str,
        *,
        id: str | None = None,
        path: str | None = None,
        reference: dict[str, Any] | None = None,
        arguments: dict[str, Any] | None = None,
        thinking: ThinkingLevel | None = None,
        metadata: dict[str, Any] | None = None,
        source: str = "agent",
    ) -> HarnessEntry:
        # Caller is responsible for loading under the cross-process lock first.
        if kind not in self.entries:
            raise ValueError(f"unknown harness kind {kind!r}; expected one of {_KINDS}")
        if thinking is not None:
            if kind != "subagent":
                raise ValueError("thinking is supported only for subagent entries")
            thinking = _validate_subagent_thinking(thinking)

        entry_id = id or _slug(title, kind)
        existing = self.entries[kind].get(entry_id)
        if existing:
            existing.title = title
            existing.content = content
            # Preserve path/reference/arguments/thinking/metadata when the caller omits
            # them (None) so updating only an entry's title or content does not reset
            # its grouping path or wipe a skill's reference/argument contract. An
            # explicit container value (including {}) still overwrites.
            if path is not None:
                existing.path = path
            if reference is not None:
                existing.reference = dict(reference)
            if arguments is not None:
                existing.arguments = dict(arguments)
            if thinking is not None:
                existing.thinking = thinking
            if metadata is not None:
                existing.metadata = dict(metadata)
            existing.source = source
            existing.updated_at = _now()
            existing.version += 1
            entry = existing
        else:
            entry = HarnessEntry(
                id=entry_id,
                kind=kind,
                title=title,
                content=content,
                path=path if path is not None else "general",
                scope=self.scope,
                reference=dict(reference or {}),
                arguments=dict(arguments or {}),
                thinking=thinking,
                metadata=dict(metadata or {}),
                source=source,
            )
            self.entries[kind][entry_id] = entry
        return entry

    def get(self, kind: HarnessKind, id: str, *, global_: bool = False, **kwargs: Any) -> HarnessEntry | None:
        id, global_ = _strip_scope_prefix(id, global_)
        if target := self._global_target(global_, kwargs):
            return target.get(kind, id)
        self._sync_from_disk()
        if kind not in self.entries:
            raise ValueError(f"unknown harness kind {kind!r}; expected one of {_KINDS}")
        return self.entries[kind].get(id)

    def delete(self, kind: HarnessKind, id: str, *, global_: bool = False, **kwargs: Any) -> bool:
        id, global_ = _strip_scope_prefix(id, global_)
        if target := self._global_target(global_, kwargs):
            return target.delete(kind, id)
        self._ensure_local_writable()
        return self._mutate(lambda: self._delete(kind, id))

    def _delete(self, kind: HarnessKind, id: str) -> bool:
        if kind not in self.entries:
            raise ValueError(f"unknown harness kind {kind!r}; expected one of {_KINDS}")
        if id not in self.entries[kind]:
            return False
        del self.entries[kind][id]
        return True

    def list(
        self,
        kind: HarnessKind | None = None,
        *,
        global_: bool = False,
        include_global: bool = False,
        **kwargs: Any,
    ) -> list[HarnessEntry]:
        """Entries in this store, optionally merged with the global store.

        ``include_global=True`` returns the same union the host builds this session's
        system prompt from, so a spawned child can read every entry its prompt was
        derived from in one call. ``global_=True`` still reads the global store alone.
        """
        if target := self._global_target(global_, kwargs):
            return target.list(kind)
        self._sync_from_disk()
        kinds = [kind] if kind else list(_KINDS)
        records: list[HarnessEntry] = []
        for current_kind in kinds:
            if current_kind not in self.entries:
                raise ValueError(f"unknown harness kind {current_kind!r}; expected one of {_KINDS}")
            records.extend(self.entries[current_kind].values())
        if include_global and (global_state := self._global_peer()) is not None:
            local_keys = {(entry.kind, entry.id) for entry in records}
            records.extend(
                entry for entry in global_state.list(kind) if (entry.kind, entry.id) not in local_keys
            )
        return sorted(records, key=lambda entry: (entry.kind, entry.path, entry.title, entry.id))

    def _global_peer(self) -> "HarnessState | None":
        """The global store, when it exists and is not this store itself."""
        if self.scope == "global":
            return None
        try:
            target = get_harness_state(state_dir=self._global_target_state_dir, global_=True)
        except (OSError, RuntimeError):
            return None
        if self.file_path is not None and target.file_path == self.file_path:
            return None
        return target

    def create(
        self,
        kind: HarnessKind,
        title: str,
        content: str,
        *,
        id: str | None = None,
        path: str = "general",
        reference: dict[str, Any] | None = None,
        arguments: dict[str, Any] | None = None,
        thinking: ThinkingLevel | None = None,
        metadata: dict[str, Any] | None = None,
        source: str = "agent",
        global_: bool = False,
        **kwargs: Any,
    ) -> HarnessEntry:
        id, global_ = _strip_scope_prefix(id, global_)
        if target := self._global_target(global_, kwargs):
            return target.create(
                kind,
                title,
                content,
                id=id,
                path=path,
                reference=reference,
                arguments=arguments,
                thinking=thinking,
                metadata=metadata,
                source=source,
            )
        self._ensure_local_writable()
        return self._mutate(
            lambda: self._create(
                kind,
                title,
                content,
                id=id,
                path=path,
                reference=reference,
                arguments=arguments,
                thinking=thinking,
                metadata=metadata,
                source=source,
            )
        )

    def _create(
        self,
        kind: HarnessKind,
        title: str,
        content: str,
        *,
        id: str | None,
        path: str,
        reference: dict[str, Any] | None,
        arguments: dict[str, Any] | None,
        thinking: ThinkingLevel | None,
        metadata: dict[str, Any] | None,
        source: str,
    ) -> HarnessEntry:
        if kind not in self.entries:
            raise ValueError(f"unknown harness kind {kind!r}; expected one of {_KINDS}")
        entry_id = id or _slug(title, kind)
        if entry_id in self.entries[kind]:
            raise ValueError(f"{kind} entry {entry_id!r} already exists")
        return self._upsert(
            kind,
            title,
            content,
            id=entry_id,
            path=path,
            reference=reference,
            arguments=arguments,
            thinking=thinking,
            metadata=metadata,
            source=source,
        )

    def update(
        self,
        kind: HarnessKind,
        id: str,
        title: str,
        content: str,
        *,
        path: str | None = None,
        reference: dict[str, Any] | None = None,
        arguments: dict[str, Any] | None = None,
        thinking: ThinkingLevel | None = None,
        metadata: dict[str, Any] | None = None,
        source: str = "agent",
        global_: bool = False,
        **kwargs: Any,
    ) -> HarnessEntry:
        id, global_ = _strip_scope_prefix(id, global_)
        if target := self._global_target(global_, kwargs):
            return target.update(
                kind,
                id,
                title,
                content,
                path=path,
                reference=reference,
                arguments=arguments,
                thinking=thinking,
                metadata=metadata,
                source=source,
            )
        self._ensure_local_writable()
        return self._mutate(
            lambda: self._update(
                kind,
                id,
                title,
                content,
                path=path,
                reference=reference,
                arguments=arguments,
                thinking=thinking,
                metadata=metadata,
                source=source,
            )
        )

    def _update(
        self,
        kind: HarnessKind,
        id: str,
        title: str,
        content: str,
        *,
        path: str | None,
        reference: dict[str, Any] | None,
        arguments: dict[str, Any] | None,
        thinking: ThinkingLevel | None,
        metadata: dict[str, Any] | None,
        source: str,
    ) -> HarnessEntry:
        if kind not in self.entries:
            raise ValueError(f"unknown harness kind {kind!r}; expected one of {_KINDS}")
        if id not in self.entries[kind]:
            raise ValueError(f"{kind} entry {id!r} does not exist")
        return self._upsert(
            kind,
            title,
            content,
            id=id,
            path=path,
            reference=reference,
            arguments=arguments,
            thinking=thinking,
            metadata=metadata,
            source=source,
        )

    def create_memory(
        self,
        title: str,
        content: str,
        *,
        id: str | None = None,
        path: str = "general",
        metadata: dict[str, Any] | None = None,
        global_: bool = False,
        **kwargs: Any,
    ) -> HarnessEntry:
        return self.create("memory", title, content, id=id, path=path, metadata=metadata, global_=global_, **kwargs)

    def update_memory(
        self,
        id: str,
        title: str,
        content: str,
        *,
        path: str | None = None,
        metadata: dict[str, Any] | None = None,
        global_: bool = False,
        **kwargs: Any,
    ) -> HarnessEntry:
        return self.update("memory", id, title, content, path=path, metadata=metadata, global_=global_, **kwargs)

    def delete_memory(self, id: str, *, global_: bool = False, **kwargs: Any) -> bool:
        return self.delete("memory", id, global_=global_, **kwargs)

    def create_prompt_note(
        self,
        title: str,
        content: str,
        *,
        id: str | None = None,
        path: str = "policy",
        metadata: dict[str, Any] | None = None,
        global_: bool = False,
        **kwargs: Any,
    ) -> HarnessEntry:
        return self.create("prompt", title, content, id=id, path=path, metadata=metadata, global_=global_, **kwargs)

    def update_prompt_note(
        self,
        id: str,
        title: str,
        content: str,
        *,
        path: str | None = None,
        metadata: dict[str, Any] | None = None,
        global_: bool = False,
        **kwargs: Any,
    ) -> HarnessEntry:
        return self.update("prompt", id, title, content, path=path, metadata=metadata, global_=global_, **kwargs)

    def delete_prompt_note(self, id: str, *, global_: bool = False, **kwargs: Any) -> bool:
        return self.delete("prompt", id, global_=global_, **kwargs)

    def create_skill(
        self,
        title: str,
        content: str,
        *,
        id: str | None = None,
        path: str = "general",
        reference: dict[str, Any] | None = None,
        arguments: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
        global_: bool = False,
        **kwargs: Any,
    ) -> HarnessEntry:
        return self.create(
            "skill",
            title,
            content,
            id=id,
            path=path,
            reference=_validate_python_skill_reference(reference),
            arguments=arguments,
            metadata=metadata,
            global_=global_,
            **kwargs,
        )

    def update_skill(
        self,
        id: str,
        title: str,
        content: str,
        *,
        path: str | None = None,
        reference: dict[str, Any] | None = None,
        arguments: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
        global_: bool = False,
        **kwargs: Any,
    ) -> HarnessEntry:
        # Only validate a reference when one is supplied; omitting it preserves the
        # existing reference (see _upsert) rather than forcing every title/content-only
        # update to re-send the full Python reference.
        validated_reference = _validate_python_skill_reference(reference) if reference is not None else None
        return self.update(
            "skill",
            id,
            title,
            content,
            path=path,
            reference=validated_reference,
            arguments=arguments,
            metadata=metadata,
            global_=global_,
            **kwargs,
        )

    def delete_skill(self, id: str, *, global_: bool = False, **kwargs: Any) -> bool:
        return self.delete("skill", id, global_=global_, **kwargs)

    def create_subagent(
        self,
        title: str,
        content: str,
        *,
        id: str | None = None,
        path: str = "general",
        thinking: ThinkingLevel | None = None,
        metadata: dict[str, Any] | None = None,
        global_: bool = False,
        **kwargs: Any,
    ) -> HarnessEntry:
        return self.create(
            "subagent",
            title,
            content,
            id=id,
            path=path,
            thinking=thinking,
            metadata=metadata,
            global_=global_,
            **kwargs,
        )

    def update_subagent(
        self,
        id: str,
        title: str,
        content: str,
        *,
        path: str | None = None,
        thinking: ThinkingLevel | None = None,
        metadata: dict[str, Any] | None = None,
        global_: bool = False,
        **kwargs: Any,
    ) -> HarnessEntry:
        return self.update(
            "subagent",
            id,
            title,
            content,
            path=path,
            thinking=thinking,
            metadata=metadata,
            global_=global_,
            **kwargs,
        )

    def delete_subagent(self, id: str, *, global_: bool = False, **kwargs: Any) -> bool:
        return self.delete("subagent", id, global_=global_, **kwargs)

    def record_refinement(
        self,
        trigger: str,
        changes: list[str] | str,
        *,
        evidence: str = "",
        outcome: str = "",
        id: str | None = None,
        global_: bool = False,
        **kwargs: Any,
    ) -> RefinementEvent:
        if target := self._global_target(global_, kwargs):
            return target.record_refinement(trigger, changes, evidence=evidence, outcome=outcome, id=id)
        self._ensure_local_writable()
        return self._mutate(
            lambda: self._record_refinement(
                trigger,
                changes,
                evidence=evidence,
                outcome=outcome,
                id=id,
            )
        )

    def _record_refinement(
        self,
        trigger: str,
        changes: list[str] | str,
        *,
        evidence: str,
        outcome: str,
        id: str | None,
    ) -> RefinementEvent:
        event_id = id or f"refine_{len(self.refinements) + 1:04d}"
        normalized_changes = [changes] if isinstance(changes, str) else list(changes)
        event = RefinementEvent(
            id=event_id,
            trigger=trigger,
            changes=normalized_changes,
            evidence=evidence,
            outcome=outcome,
        )
        self.refinements.append(event)
        return event

    def plan_refinement(
        self,
        observation: str,
        *,
        failing_component: str = "",
        next_step: str = "",
    ) -> list[str]:
        target = f" for {failing_component}" if failing_component else ""
        plan = [
            f"Diagnose the repeated failure or opportunity{target}: {observation}",
            "Update the smallest useful prompt note, memory item, skill, or subagent spec.",
            "Run the next action with the changed harness state, then record the outcome.",
        ]
        if next_step:
            plan.append(f"Immediate validation step: {next_step}")
        return plan

    def overview(
        self,
        *,
        max_entries_per_kind: int = 20,
        global_: bool = False,
        include_global: bool = False,
        **kwargs: Any,
    ) -> str:
        if target := self._global_target(global_, kwargs):
            return target.overview(max_entries_per_kind=max_entries_per_kind)
        self._sync_from_disk()
        if include_global and (peer := self._global_peer()) is not None:
            body = self._overview_body(max_entries_per_kind, include_global_pointer=False)
            return f"{body}\n\n{peer.overview(max_entries_per_kind=max_entries_per_kind)}"
        return self._overview_body(max_entries_per_kind)

    def _overview_body(self, max_entries_per_kind: int, *, include_global_pointer: bool = True) -> str:
        lines = [
            f"Harness state ({self.scope}): {self.file_path}",
            "Call contract: installed Python skills use await <skill_import>(...) or a matching shell CLI; "
            "harness skill entries are Python REPL skills and must include a Python reference plus arguments. "
            "Spawn a subagent spec by composing a concise task prompt and calling "
            "handle = await rlm('sub-task', thinking=...); admission returns immediately with rlm_child_id, name, "
            "session_dir, and model, never the child's answer. A subagent spec may include a canonical thinking "
            "preference; "
            "pass it only when it appears in the selected model's effective thinking_levels. Results arrive only "
            "through explicit agent_message replies or "
            "files; children reply with await agent_message.send(message, receiver_role='parent'). Use "
            "await rlm.list_subagents() to recover direct child handles and await agent_message.send(..., "
            "receiver_role='child', receiver_name=handle.name) for follow-ups.",
        ]
        for kind in _KINDS:
            records = self.list(kind)[:max_entries_per_kind]
            lines.append(f"{kind}: {len(self.entries[kind])}")
            for entry in records:
                summary = entry.content.strip().replace("\n", " ")
                if len(summary) > 120:
                    summary = f"{summary[:117]}..."
                argument_summary = ""
                if entry.kind == "skill" and entry.arguments:
                    argument_text = json.dumps(entry.arguments, ensure_ascii=False, sort_keys=True)
                    if len(argument_text) > 120:
                        argument_text = f"{argument_text[:117]}..."
                    argument_summary = f" args={argument_text}"
                reference_summary = ""
                if entry.kind == "skill" and entry.reference:
                    reference_text = json.dumps(entry.reference, ensure_ascii=False, sort_keys=True)
                    if len(reference_text) > 120:
                        reference_text = f"{reference_text[:117]}..."
                    reference_summary = f" ref={reference_text}"
                thinking_summary = f" thinking={entry.thinking}" if entry.kind == "subagent" and entry.thinking else ""
                lines.append(
                    f"  - [{entry.scope}:{entry.id}] {entry.title} ({entry.path}, v{entry.version})"
                    f"{reference_summary}{argument_summary}{thinking_summary}: {summary}"
                )
            overflow = len(self.entries[kind]) - len(records)
            if overflow > 0:
                lines.append(f"  - +{overflow} more")
        if self.refinements:
            lines.append(f"refinements: {len(self.refinements)}")
            for event in self.refinements[-5:]:
                lines.append(f"  - [{event.id}] {event.trigger}: {', '.join(event.changes)}")
        else:
            lines.append("refinements: 0")
        if include_global_pointer:
            lines.extend(self._global_pointer_lines())
        return "\n".join(lines)

    def _global_pointer_lines(self) -> list[str]:
        """Name the global store from a local overview.

        A spawned child starts with an empty local store while its system prompt was
        built from the merged local + global state. Without this pointer the first
        thing such a child reads is an empty overview that never mentions the global
        store exists, so it concludes the harness is empty.
        """
        peer = self._global_peer()
        if peer is None:
            return []
        peer._sync_from_disk()
        counts = ", ".join(f"{kind}: {len(peer.entries[kind])}" for kind in _KINDS)
        return [
            f"global store (not listed above): {peer.file_path}",
            f"  {counts}, refinements: {len(peer.refinements)}",
            "  read it with overview(global_=True), list(<kind>, global_=True), or get(<kind>, 'global:<id>'); "
            "pass include_global=True to overview()/list() for the merged view this session's system prompt was built from",
        ]

    def snapshot(self, *, global_: bool = False, **kwargs: Any) -> dict[str, Any]:
        if target := self._global_target(global_, kwargs):
            return target.snapshot()
        self._sync_from_disk()
        return {
            "file_path": str(self.file_path),
            "scope": self.scope,
            "entries": {
                kind: {entry_id: _entry_dict(entry) for entry_id, entry in records.items()}
                for kind, records in self.entries.items()
            },
            "refinements": [asdict(event) for event in self.refinements],
        }


def get_harness_state(
    state_dir: str | Path | None = None, *, global_: bool = False, **kwargs: Any
) -> HarnessState:
    """Return the cached local harness state, or global when requested."""
    global_ = _resolve_global_flag(global_, kwargs)
    scope: HarnessScope = "global" if global_ else "local"
    if os.name == "nt":
        # Do not resolve state_dir or access the filesystem on unsupported Windows.
        return HarnessState(in_memory=True, scope=scope, local_write_error=WINDOWS_PERSISTENCE_UNSUPPORTED_ERROR)
    file_path = _state_file(state_dir, global_=global_)
    cache_key = (file_path, scope)
    state = _state_cache.get(cache_key)
    if state is None:
        state = HarnessState(file_path, scope=scope)
        # Recorded at construction only: an instance created from env defaults must
        # keep targeting RLM_GLOBAL_HARNESS_STATE_DIR even when a later explicit
        # state_dir call aliases the same local file. An explicit dir that merely
        # aliases the env resolution must not sandbox later global_=True writes
        # either, so pin only when the explicit dir actually diverges.
        if state_dir is not None:
            try:
                env_file: Path | None = _state_file(global_=global_)
            except RuntimeError:
                env_file = None
            if file_path != env_file:
                state._global_target_state_dir = Path(state_dir).expanduser().resolve()
        _state_cache[cache_key] = state
    return state


__all__ = [
    "HarnessEntry",
    "HarnessKind",
    "HarnessScope",
    "HarnessState",
    "RefinementEvent",
    "ThinkingLevel",
    "get_harness_state",
]
