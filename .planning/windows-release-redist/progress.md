## Progress
- Final combined Windows release build succeeded: `scripts/pack-windows-release.sh --skip-deps --base-url https://pub-728493de92a943e2a9b2d17b4719f318.r2.dev --channel stable` produced:
  - `packages/coding-agent/binaries/pi-windows-x64.zip` (47940367 bytes, SHA-256 d191f326ed14d2e81019cbac6ddf4450d63b24383eaa69bb424e650b1e0d64e0)
  - Four release tarballs at `packages/coding-agent/release/windows/artifacts/`:
    - `prime-agent-0.9.4.tgz` (10016421 bytes)
    - `prime-agent-ai-0.9.4.tgz` (540691 bytes)
    - `prime-agent-core-0.9.4.tgz` (55271 bytes)
    - `prime-agent-tui-0.9.4.tgz` (412421 bytes)
- SHA-256SUMS and channel metadata (`latest.json`, `stable`) verified; `sha256sum -c SHA256SUMS` passed.
- ZIP content integrity: `unzip -t` passed; required contents (`pi.exe`, `photon_rs_bg.wasm`, Koffi metadata/native module, `theme/`, `assets/`, export-html, docs, examples, skills) all present and PE32+ x86-64 Windows confirmed via `file`.
- All four `tar -tzf` checks passed; `latest.json` manifest contains correct version v0.9.4 and rewritten dependency URLs pointing to release tarballs.
- `npm run check` passed: Biome 990 files, type checks, installer check, browser smoke check – all clean.
- ShellCheck passed for both new shell scripts (`build-windows-binary.sh`, `pack-windows-release.sh`).
- DeepWiki confirmed exact ZIP content contract; PE32+ executable verification; release semantics.
- PowerShell 7 installer `install.ps1` fully read, parsed with pwsh.exe, and reviewed against `install.sh` semantics. No functional blockers found. The only remaining gap: the GitHub Actions workflow (`build-binaries.yml`) only renders `install.sh` via `replaceAll("__PRIME_AGENT_DOWNLOAD_BASE_URL__", baseUrl)`; `install.ps1` must be added with an identical replace step to become a published installer. This is tracked as a follow‑up and is outside the current task scope.
- PowerShell 7 available at `/mnt/c/Program Files/PowerShell/7/pwsh.exe`; author validated parser syntax and help output.
- Pre‑existing user changes preserved: `package.json`, `pnpm-lock.yaml`, `.planning/`, `install.xsh` untouched.
- `.gitignore` updated to include `packages/coding-agent/release/`.

## Next Step
Extend the release publication workflow to also render `install.ps1` (mirror the existing `replaceAll` step for `install.sh`), then close the plan.
