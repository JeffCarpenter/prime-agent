"""Prime Self Intellect: read and edit Prime Agent's own configuration.

Prime Agent loads its own configuration from two JSON files at startup: a
global file under the agent config directory and an optional per-project file
under `<project-root>/.prime/agent/settings.json` (project values win). This
module reads and edits those files directly — the same files Prime Agent's
own `SettingsManager` reads (see
`packages/coding-agent/src/core/settings-manager.ts` for the full `Settings`
schema and defaults) — without going through a host bridge.

Writes are atomic (write-then-rename) and use the same directory-based
advisory lock scheme as `proper-lockfile`, the library Prime Agent's own
settings writer uses, so this module is safe to run alongside a live Prime
Agent session or daemon.

Changes take effect the next time Prime Agent loads settings (new session,
daemon restart, or an explicit reload) — not automatically inside an
already-running session's in-memory settings, and not on top of CLI-flag or
other runtime overrides applied only in that live session.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import TYPE_CHECKING, Any, Literal

if TYPE_CHECKING:
    from typing_extensions import Self

Scope = Literal["effective", "global", "project"]
WriteScope = Literal["global", "project"]

_CONFIG_DIR_NAME = ".prime/agent"
_ENV_AGENT_DIR = "PRIME_AGENT_CODING_AGENT_DIR"
_LOCK_STALE_SECONDS = 10.0
_LOCK_MAX_ATTEMPTS = 10
_LOCK_RETRY_DELAY_SECONDS = 0.02


def _expand_tilde(path: str) -> str:
    if path == "~":
        return str(Path.home())
    if path.startswith("~/"):
        return str(Path.home()) + path[1:]
    return path


def _agent_dir() -> Path:
    env_dir = os.environ.get(_ENV_AGENT_DIR)
    if env_dir:
        return Path(_expand_tilde(env_dir))
    return Path.home() / _CONFIG_DIR_NAME


def _global_settings_path() -> Path:
    return _agent_dir() / "settings.json"


def _project_settings_path(cwd: str | None) -> Path:
    base = Path(cwd).expanduser() if cwd else Path.cwd()
    return base / _CONFIG_DIR_NAME / "settings.json"


def _settings_path(scope: WriteScope, cwd: str | None) -> Path:
    return _global_settings_path() if scope == "global" else _project_settings_path(cwd)


def _parse_json_object(path: Path, text: str) -> dict[str, Any]:
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"{path} contains invalid JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise TypeError(f"{path} does not contain a JSON object")
    return data


def _read_settings_file(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise OSError(f"could not read {path}: {exc}") from exc
    return _parse_json_object(path, text)


def _deep_merge_one_level(
    base: dict[str, Any], override: dict[str, Any]
) -> dict[str, Any]:
    """Match Prime Agent's own `SettingsManager.deepMergeSettings`: override
    values win; nested-object values merge one level deep; everything else
    (including arrays) is replaced outright."""
    result = dict(base)
    for key, override_value in override.items():
        base_value = base.get(key)
        if isinstance(override_value, dict) and isinstance(base_value, dict):
            result[key] = {**base_value, **override_value}
        else:
            result[key] = override_value
    return result


def _get_by_path(data: dict[str, Any], dotted_path: str) -> tuple[bool, Any]:
    node: Any = data
    for part in dotted_path.split("."):
        if not isinstance(node, dict) or part not in node:
            return False, None
        node = node[part]
    return True, node


def _set_by_path(data: dict[str, Any], dotted_path: str, value: Any) -> dict[str, Any]:
    parts = dotted_path.split(".")
    result = dict(data)
    node = result
    for part in parts[:-1]:
        child = node.get(part)
        child = dict(child) if isinstance(child, dict) else {}
        node[part] = child
        node = child
    node[parts[-1]] = value
    return result


def _unset_by_path(data: dict[str, Any], dotted_path: str) -> dict[str, Any]:
    found, _ = _get_by_path(data, dotted_path)
    if not found:
        raise KeyError(dotted_path)
    parts = dotted_path.split(".")
    result = dict(data)
    node = result
    for part in parts[:-1]:
        child = dict(node[part])
        node[part] = child
        node = child
    node.pop(parts[-1], None)
    return result


class _FileLock:
    """Directory-based advisory lock compatible with the `proper-lockfile`
    scheme Prime Agent's own `SettingsManager` uses for `settings.json`
    (mkdir-based mutual exclusion with mtime-based staleness), so concurrent
    writes from this module and from a live Prime Agent process do not race
    or corrupt each other."""

    def __init__(self, target_path: Path):
        self._lock_path = target_path.with_name(f"{target_path.name}.lock")
        self._acquired = False

    def acquire(self) -> None:
        if self._acquired:
            return
        for attempt in range(1, _LOCK_MAX_ATTEMPTS + 1):
            try:
                self._lock_path.mkdir()
                self._acquired = True
                return
            except FileExistsError:
                if self._steal_if_stale():
                    continue
                if attempt == _LOCK_MAX_ATTEMPTS:
                    raise TimeoutError(
                        f"could not acquire lock on {self._lock_path} after "
                        f"{_LOCK_MAX_ATTEMPTS} attempts (another Prime Agent "
                        "process appears to be writing this settings file)"
                    )
                time.sleep(_LOCK_RETRY_DELAY_SECONDS)

    def _steal_if_stale(self) -> bool:
        try:
            mtime = self._lock_path.stat().st_mtime
        except FileNotFoundError:
            return True
        if time.time() - mtime < _LOCK_STALE_SECONDS:
            return False
        try:
            self._lock_path.rmdir()
        except OSError:
            pass
        return True

    def release(self) -> None:
        if not self._acquired:
            return
        try:
            self._lock_path.rmdir()
        except OSError:
            pass
        self._acquired = False

    def __enter__(self) -> Self:
        self.acquire()
        return self

    def __exit__(self, *exc: object) -> None:
        self.release()


def _update_settings_file(path: Path, mutate: Any) -> dict[str, Any]:
    """Read-modify-write `path` under a lock, mirroring the sequencing of
    Prime Agent's own `FileSettingsStorage.withLock`: acquire the lock before
    reading (when the file already exists), let `mutate` compute the next
    document from the current one, then write atomically before releasing."""
    file_exists = path.exists()
    lock = _FileLock(path)
    if file_exists:
        lock.acquire()
    try:
        current = _read_settings_file(path) if file_exists else {}
        next_data = mutate(current)
        path.parent.mkdir(parents=True, exist_ok=True)
        lock.acquire()
        tmp_path = path.with_name(
            f"{path.name}.{os.getpid()}.{int(time.time() * 1000)}.tmp"
        )
        try:
            tmp_path.write_text(
                json.dumps(next_data, indent=2) + "\n", encoding="utf-8"
            )
            os.replace(tmp_path, path)
        finally:
            if tmp_path.exists():
                tmp_path.unlink()
        return next_data
    finally:
        lock.release()


async def paths(cwd: str | None = None) -> dict[str, Any]:
    """Resolve the `settings.json` paths Prime Agent itself uses.

    Args:
        cwd: Project root to resolve the project settings file under.
            Defaults to the kernel's current working directory.

    Returns a dict with `agent_dir`, `global_settings_path`,
    `global_settings_exists`, `project_settings_path`, and
    `project_settings_exists`.
    """
    global_path = _global_settings_path()
    project_path = _project_settings_path(cwd)
    return {
        "agent_dir": str(_agent_dir()),
        "global_settings_path": str(global_path),
        "global_settings_exists": global_path.exists(),
        "project_settings_path": str(project_path),
        "project_settings_exists": project_path.exists(),
    }


async def get(scope: Scope = "effective", cwd: str | None = None) -> dict[str, Any]:
    """Read Prime Agent's own settings.

    Args:
        scope: `"effective"` (default) merges global then project settings
            the same way Prime Agent's `SettingsManager` does (project
            values win; nested objects merge one level deep; everything else
            is replaced outright) — see `_deep_merge_one_level`. `"global"`
            or `"project"` return that one file's raw contents, or `{}` if
            the file does not exist.
        cwd: Project root to resolve the project settings file under.
            Defaults to the kernel's current working directory.

    Effective settings here reflect only the on-disk files; a live session
    may layer further CLI-flag or runtime overrides on top that this module
    cannot see.
    """
    if scope not in ("effective", "global", "project"):
        raise ValueError('scope must be "effective", "global", or "project"')
    global_settings = _read_settings_file(_global_settings_path())
    if scope == "global":
        return global_settings
    project_settings = _read_settings_file(_project_settings_path(cwd))
    if scope == "project":
        return project_settings
    return _deep_merge_one_level(global_settings, project_settings)


async def get_value(
    path: str,
    scope: Scope = "effective",
    default: Any = None,
    cwd: str | None = None,
) -> Any:
    """Read one setting by dot-path, e.g. `"compaction.enabled"`.

    Args:
        path: Dot-separated key path into the settings object.
        scope: Same meaning as in `get()`.
        default: Value returned when `path` is absent.
        cwd: Project root for `scope="project"` or `"effective"`.
    """
    if not isinstance(path, str) or not path:
        raise ValueError("path must be a non-empty dot-separated string")
    settings = await get(scope=scope, cwd=cwd)
    found, value = _get_by_path(settings, path)
    return value if found else default


async def set_value(
    path: str,
    value: Any,
    scope: WriteScope = "global",
    cwd: str | None = None,
) -> dict[str, Any]:
    """Set one setting by dot-path in `settings.json` and return that
    scope's full updated contents.

    Args:
        path: Dot-separated key path, e.g. `"compaction.enabled"`. Only the
            addressed key is touched; sibling keys are preserved.
        value: Must be JSON-serializable.
        scope: `"global"` writes `~/.prime/agent/settings.json` (or the
            `PRIME_AGENT_CODING_AGENT_DIR` override); `"project"` writes
            `<cwd>/.prime/agent/settings.json`.
        cwd: Project root for `scope="project"`. Defaults to the kernel's
            current working directory.

    See `packages/coding-agent/src/core/settings-manager.ts` for the
    documented `Settings` schema and per-field defaults. Unknown keys are
    written as-is; Prime Agent ignores fields it does not recognize. Changes
    apply the next time Prime Agent loads settings, not to an already-running
    session automatically.
    """
    if scope not in ("global", "project"):
        raise ValueError('scope must be "global" or "project"')
    if not isinstance(path, str) or not path:
        raise ValueError("path must be a non-empty dot-separated string")
    try:
        json.dumps(value)
    except TypeError as exc:
        raise TypeError(f"value for {path!r} must be JSON-serializable: {exc}") from exc
    target = _settings_path(scope, cwd)
    return _update_settings_file(
        target, lambda current: _set_by_path(current, path, value)
    )


async def unset_value(
    path: str,
    scope: WriteScope = "global",
    cwd: str | None = None,
) -> dict[str, Any]:
    """Remove one setting by dot-path from `settings.json` and return that
    scope's full updated contents.

    Args:
        path: Dot-separated key path to remove.
        scope: Same meaning as in `set_value()`.
        cwd: Project root for `scope="project"`.

    Raises:
        KeyError: If `path` is not currently set in that scope's file.
    """
    if scope not in ("global", "project"):
        raise ValueError('scope must be "global" or "project"')
    if not isinstance(path, str) or not path:
        raise ValueError("path must be a non-empty dot-separated string")
    target = _settings_path(scope, cwd)
    try:
        return _update_settings_file(
            target, lambda current: _unset_by_path(current, path)
        )
    except KeyError:
        raise KeyError(f"{path!r} is not set in {scope} settings ({target})") from None
