# Local fork scope — user decisions

- This is a local fork, not a release. The task is native Rust integration and local Arch package verification, without system installation.
- Follow upstream `.env` behavior. Do not invent a new loading contract.
- Windows runtime verification is not a gate for this task. No claim of Windows verification is implied.
- Installer UX versus native installers/Arch packaging was a false dichotomy. Do not infer permission to discard fork behavior or commission a new installer rewrite.
- KISS: preserve required fork behavior, fix demonstrated blockers, and avoid expanding scope.

Source: user messages in session 01a138aa-67e5-70f5-a2b8-fd07bbaaf035.

## Latest user direction

Finish the rebase. Catalog tests do not need to pass and must not block completion. Stop catalog investigation; integrate and validate the accepted fork changes in the existing validation worktree. Keep REPL state dictionaries current. No new authorization to overwrite protected originals, source-commit/merge, or install has been inferred.
