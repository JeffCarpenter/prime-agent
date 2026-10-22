"""zsh-first shell execution: the hardened upstream rlm.bash machinery under zsh.

Perlis #9: one data structure, many operators. The structure is upstream's
BashHandle (process groups, orphan journal, status channel, bounded output
buffers, kill escalation, kill-on-cancel one-shot awaits). This module adds
no second structure -- it routes that machinery through zsh.

    h = zsh("long-cmd")            # background handle; spawn is immediate
    h.pid; h.running; h.tail(20)   # any touch marks it a background handle
    r = await h                    # -> BashResult(exit_code, output, duration)
    h.kill()                       # TERM the group, escalate to KILL

    r = await zshq("quick-cmd")    # one-shot sugar: run to completion

Shell selection is process-global: the first zsh() pins
PRIME_AGENT_BASH_SHELL for the whole kernel (later bare bash() calls also
run zsh) -- which matches the standing order to prefer zsh before bash.
restore_default_shell() undoes the pin.
"""
from __future__ import annotations

import os
import shutil
from typing import Final

from rlm.bash import BashHandle, BashResult, bash

__all__ = ["zsh", "zshq", "current_shell", "restore_default_shell", "BashHandle", "BashResult"]

_SHELL_ENV: Final[str] = "PRIME_AGENT_BASH_SHELL"


def _resolve_zsh() -> str:
    """Absolute zsh path, mirroring upstream's absolute-path requirement."""
    candidate = shutil.which("zsh")
    if candidate and os.path.isabs(candidate):
        return candidate
    for fallback in ("/usr/bin/zsh", "/usr/sbin/zsh", "/bin/zsh", "/usr/local/bin/zsh"):
        if os.path.isfile(fallback) and os.access(fallback, os.X_OK):
            return fallback
    raise RuntimeError("zsh(): no absolute zsh binary found on PATH or standard locations")


def zsh(command: str) -> BashHandle:
    """Start ``command`` under zsh immediately; await the handle for the result.

    Contract is upstream bash()'s, unchanged: ``await zsh(cmd)`` is a one-shot
    whose cancellation kills the process group; touching .pid/.running/.output()
    /.tail()/.poll()/.kill() first makes it a background handle. All hardening
    (orphan journal, status fence, bounded head+tail buffers, TERM-to-KILL
    escalation) is inherited. Multi-line commands are safe (single -c string).
    """
    os.environ[_SHELL_ENV] = _resolve_zsh()
    return bash(command)


async def zshq(command: str) -> BashResult:
    """Run ``command`` under zsh to completion and return the result."""
    return await zsh(command)


def current_shell() -> str | None:
    """Interpreter bash()-spawned commands will use right now, if pinned."""
    return os.environ.get(_SHELL_ENV)


def restore_default_shell() -> None:
    """Drop the zsh pin; bash() reverts to its upstream default resolution."""
    os.environ.pop(_SHELL_ENV, None)
