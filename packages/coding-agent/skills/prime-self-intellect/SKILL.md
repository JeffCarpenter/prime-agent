---
name: prime-self-intellect
description: Inspect and edit Prime Agent's own configuration — the global (~/.prime/agent/settings.json) and per-project (<project>/.prime/agent/settings.json) settings files Prime Agent itself loads at startup. Supports dot-path get/set/unset and an effective (merged) settings view. Use when the user asks to view, change, or reset a Prime Agent setting (default model/provider, thinking level, compaction, terminal, retry, thinking budgets, etc.), asks what Prime Agent's current configuration is, or wants the agent to configure itself rather than editing settings.json by hand.
---

# Prime Self Intellect

Reads and writes the same `settings.json` files Prime Agent's own
`SettingsManager` reads — directly, with no host bridge — so it works from
any kernel session. See
`packages/coding-agent/src/core/settings-manager.ts` (`Settings` interface)
for the authoritative schema and per-field defaults; this skill does not
duplicate that schema and accepts any dot-path key.

Call directly from the Python REPL:

```python
await prime_self_intellect.paths()
await prime_self_intellect.get()                                   # effective (global + project merged)
await prime_self_intellect.get_value("compaction.enabled")
await prime_self_intellect.set_value("defaultThinkingLevel", "high")
await prime_self_intellect.set_value("terminal.fullscreen", False, scope="project")
await prime_self_intellect.unset_value("theme")
```

## API

- `await paths(cwd=None)` — resolve `agent_dir`, `global_settings_path`,
  `project_settings_path`, and whether each file currently exists.
- `await get(scope="effective", cwd=None)` — read settings. `scope`:
  - `"effective"` — global then project, merged the same way Prime Agent's
    own `SettingsManager` does (project wins; nested objects merge one level
    deep; everything else, including arrays, is replaced outright).
  - `"global"` / `"project"` — that one file's raw contents, `{}` if absent.
- `await get_value(path, scope="effective", default=None, cwd=None)` — one
  setting by dot-path, e.g. `"compaction.enabled"` or
  `"thinkingBudgets.high"`.
- `await set_value(path, value, scope="global", cwd=None)` — set one setting
  by dot-path; `value` must be JSON-serializable. `scope` is `"global"` or
  `"project"` (no `"effective"` — writes always target one file). Returns
  that scope's full updated contents.
- `await unset_value(path, scope="global", cwd=None)` — remove one setting
  by dot-path. Raises `KeyError` if it was not set.

## Behavior notes

- Writes are atomic (write-then-rename) and use a directory-based advisory
  lock compatible with the `proper-lockfile` scheme Prime Agent's own
  settings writer uses, so they are safe to run alongside a live Prime Agent
  session or daemon.
- Changes take effect the next time Prime Agent loads settings (new session,
  daemon restart, or an explicit reload) — not automatically inside an
  already-running session's in-memory settings, and `get`/`get_value` here
  only see on-disk state, not a live session's CLI-flag or other runtime
  overrides.
- `set_value`/`unset_value` touch only the addressed key; sibling keys are
  preserved.
- Only edit settings the user explicitly asked to change, or that are
  directly necessary to satisfy their request — do not proactively
  reconfigure Prime Agent as a side effect of unrelated work.
