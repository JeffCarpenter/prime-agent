---
name: zsh
description: Run commands through zsh using the hardened upstream rlm.bash machinery (process groups, orphan journal, bounded buffers, kill escalation). Use when a POSIX-ish shell beyond xonsh subprocess mode is needed.
---

# zsh

Run commands through `zsh` with the same process-group hardening,
bounded-output buffering, and kill escalation as the upstream `bash()`
machinery — inherited unchanged.

## One-shot: Run to Completion

    r = await zshq("long-running-cmd --with args")
    # BashResult(exit_code=0, output="...", duration=...)

## Background: Start and Poll

    h = zsh("long-cmd")            # immediate return; spawn is async
    h.pid                           # process group ID, if started
    h.running                       # bool
    h.tail(20)                      # last 20 lines of output so far
    h.poll()                        # non-blocking check: None if running, else BashResult
    r = await h                     # block for completion -> BashResult
    h.kill()                        # SIGTERM the group, escalate to SIGKILL if needed

## Shell Selection

Shell selection is process-global: the first `zsh()` call pins
`PRIME_AGENT_BASH_SHELL` for the whole kernel (all later `bash()` calls
also run under zsh) — matching the standing order to prefer zsh before bash.

Undo the pin:

    restore_default_shell()

## Hardening Inherited from bash()

All behavior is unchanged from upstream: process groups, orphan journal,
status channel, bounded head+tail buffers, kill-on-cancel one-shot awaits,
SIGTERM → SIGKILL escalation. Multi-line commands are safe (single `-c` string).

## Usage in xonsh REPL

In a xonsh kernel, prefer direct synchronous execution for quick commands
(pytest, git, etc.); use `zsh()` or `bash()` only for background work,
polling, or when you need explicit shell semantics. For long-running tasks,
use `bash()` to keep control flow live.
