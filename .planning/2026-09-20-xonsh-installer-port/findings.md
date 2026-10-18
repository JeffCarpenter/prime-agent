# Findings

- `install.sh`: 2,356 lines, 115 function definitions; behavior oracle for the port.
- Xonsh `CommandPipeline` truthiness = exit 0; iteration = lazy output; `.rtn`/`.out` = sync points. Supervised `Popen` limited to cancellation, probe timeouts, quiet output, explicit cwd.
- Native install is transactional: owned root, lock, staging, immutable releases, atomic links, durable activation journal, recovery, rollback, conservative pruning.
- Trust chain is cumulative: HTTPS policy -> curl protocol pinning -> exact checksum selection -> SHA-256 -> archive traversal/link rejection -> required assets -> package version match -> executable probes -> atomic activation. No later check compensates for a weaker earlier one.
- Auto fallback to Node is narrow: Node-only manifests and failed executable probes only. Checksum/archive/metadata failures and `binary` mode never fall back.
- Offline fixtures (fake feeds, generated tarballs, probe scripts, temp homes) cover the native lifecycle without network or credentials.
- 2026-09-20: closed RED where `install_native()` never called `native_configure_path()`; restored 18/18 GREEN.
- `.planning/xonsh-installer/` notes from 2026-09-16 no longer exist; this directory supersedes them.
- Scoped-env rule: `command_path` treats the installer env as authoritative (`path if path is not None else self.env.get("PATH", "")`); a scoped env without `PATH` finds nothing rather than leaking ambient `os.environ` (matches shell `command -v` semantics under the installer's PATH).
- Session-continuity lessons (2026-09-20): the working tree is the only source of truth after resets; compacted summaries and untracked planning dirs are hints, not state (other sessions advanced the port and deleted `.planning/xonsh-installer/` between turns). Re-run the suite before claiming status.
- `or`-defaulting hazard: `path or self.env.get("PATH")` leaks ambient `os.environ` when the key is absent; use explicit `is not None` checks for scoped lookup. Caught only by a sentinel-command test planted in the ambient PATH.
- Precise failure messages can mislead: `FileNotFoundError .../profile` was a missing orchestration phase (`native_configure_path` tail), not a fixture bug. Trace to root cause before touching tests.
