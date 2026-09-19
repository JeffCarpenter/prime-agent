# Findings

## Artifact workflows
- `scripts/build-binaries.sh --platform windows-x64` builds one standalone coding-agent distribution: `packages/coding-agent/binaries/pi-windows-x64.zip`.
- The ZIP includes compiled `pi.exe`, assets, docs, examples, skills, `photon_rs_bg.wasm`, and the Windows Koffi native module.
- `scripts/pack-prime-agent-release.mjs` builds four platform-neutral tarballs: `prime-agent`, `prime-agent-ai`, `prime-agent-core`, and `prime-agent-tui`, plus checksums and channel metadata.
- No existing command creates both artifact sets. DeepWiki independently confirmed that composing these two workflows is the intended reuse boundary.

## Release package semantics
- A base URL is mandatory because internal package dependencies are rewritten to immutable release tarball URLs.
- Channel defaults to `stable`; version defaults to `PRIME_AGENT_VERSION` or the coding-agent package version.
- The packer deletes its chosen output directory and rejects paths outside `packages/coding-agent/release/`.
- A dedicated default such as `packages/coding-agent/release/windows` avoids deleting production or beta outputs.

## Risks found
- The inherited multi-platform builder deletes the entire `packages/coding-agent/binaries/` tree even for one target. A Windows-only script must delete only its Windows directory and ZIP.
- The inherited builder always runs `npm ci`. This branch uses pnpm, and the current user-owned `package.json`/`pnpm-lock.yaml` include `dotenv` while `package-lock.json` does not. The npm path currently fails and can destroy the installed dependency tree.
- The inherited dependency step force-installs bindings for every supported OS. A Windows-only build should install only host build dependencies plus Windows x64 optional dependencies.
- pnpm 12 supports repeated `pnpm install --os <OS> --cpu <CPU>` flags and `--force`, which can materialize target optional dependencies from the lockfile without adding them to manifests.
- The Windows target uses `bun build --compile --external koffi --target=bun-windows-x64`; Koffi must remain external and its `win32_x64/koffi.node` file must be copied beside the executable.
- There is no Microsoft VC++ redistributable bundling workflow. “Redist” here means the project distribution archives, not `vc_redist`.

## External research caveat
DeepWiki described channel and version as mandatory. Local source shows only base URL is mandatory. Local source governs the implementation.

## Implementation and validation results
- `scripts/build-windows-binary.sh` now owns the Windows-only build rather than delegating to the destructive multi-platform builder.
- It uses `pnpm install --frozen-lockfile` with both host and `win32` OS selectors, materializing target optional dependencies without touching manifests or using stale `package-lock.json`.
- Windows cleanup is limited to `binaries/windows-x64` and `pi-windows-x64.zip`; a seeded Darwin sentinel survived the real build.
- Archive assembly must follow the current generated paths exactly: `dist/bun/cli.js`, `dist/modes/interactive/theme`, `dist/modes/interactive/assets`, and `dist/core/export-html`.
- Windows Koffi requires `index.js`, `package.json`, and `build/koffi/win32_x64/koffi.node`, not only the native file.
- pnpm 12 does not accept `pnpm pack <directory>`. The working form is `pnpm --dir <directory> pack --pack-destination <output>`.
- When forwarding script arguments with `pnpm run`, do not include npm’s standalone `--`; pnpm passes it literally to the Node program.
- The final combined command succeeded and emitted both artifact families for version 0.9.4.
- `unzip -t`, all four `tar -tzf` checks, and `sha256sum -c SHA256SUMS` passed. Required ZIP contents and all release metadata were present.
- DeepWiki independently confirmed the exact current ZIP content contract: `pi.exe`, singular `theme/`, `assets/`, HTML export resources, Photon WASM, Koffi metadata/native module, docs, examples, and skills.
- `file` identified `pi.exe` as a PE32+ x86-64 Windows console executable and `koffi.node` as a PE32+ x86-64 Windows DLL.

## PowerShell installer scope
- The generated stable manifest is `<base-url>/latest.json`; beta uses `beta.json`.
- Release archives live at `<base-url>/releases/v<version>/...` and include SHA-256 metadata.
- The public `prime-agent` tarball already embeds immutable URLs for its three internal package dependencies.
- `install.sh` is the authoritative behavior reference, but `install.ps1` should use PowerShell 7-native download, hashing, archive/package installation, error handling, and PATH logic.
- PowerShell 7 validation is available from WSL via `/mnt/c/Program Files/PowerShell/7/pwsh.exe`.
- `install.ps1` now resolves stable/beta manifests or explicit versions, cross-checks manifest and `SHA256SUMS`, verifies the tarball hash, and invokes npm with Windows-safe PowerShell argument arrays.
- Installer author and nested reviewer validated stable, beta, explicit prerelease, whitespace normalization, tamper rejection before npm, invalid channel rejection, cleanup, parser, and help behavior with PowerShell 7.6.6.
- Root repeated the PowerShell parser and full-help checks successfully.
- Release publication currently renders and uploads only `install.sh`; `install.ps1` must be rendered and uploaded in the same stable/beta workflow to be usable as a published installer.

## PowerShell installer review
- **Minimum Node version**: install.ps1 requires Node 22.8.0, matching `engines.node` in `package.json`. This is consistent; `install.sh` had a pre‑existing 20.6.0 spec that conflicts with engines – not a blocker for this script.
- **Channel / manifest handling**: `Get-ChannelRelease` reads `latest.json`/`beta.json` and validates checksums. `install.sh` reads a plain‑text `stable`/`beta` pointer file. Both work; PS version is stricter and correct.
- **npm 12 flags**: Same gating logic (`$NpmVersionText -notmatch '^(\d+)\.' → [int]$Matches[1] -ge 12`) – parity with `install.sh`.
- **env var bootstrap**: Explicitly sets `PRIME_AGENT_BOOTSTRAP_TOOLS_ON_INSTALL=1`, `PRIME_AGENT_BOOTSTRAP_KERNEL_ON_INSTALL` and `PRIME_AGENT_INSTALL_UV` as `"1"` or `"0"`; postinstall checks `=== "1"` – correct.
- **Checksum verification**: `Get-ChecksumFromSums` reads `SHA256SUMS`, matches exactly one line per tarball – matches `install.sh` contract.
- **`$Matches` variable**: `Get-ChecksumFromSums` assigns to `$Matches`, which shadows the automatic variable populated by `-match`/`-notmatch`. Works but a future maintainer might be confused. Not a functional blocker.
- **Sentinel / unconfigured detection**: `$UnconfiguredBaseUrl` / `$ConfiguredBaseUrl` placeholder scheme uses concatenation (`__PRIME_AGENT_DOWNLOAD_BASE` + `_URL__`) to prevent sed replacement in unpublished copies – identical design to `install.sh`.
- **`-Force` / `-SkipPythonRuntime` switches**: Mirror `install.sh`'s concepts; skip interactive confirmation and set vars accordingly.
- **Publishing workflow gap**: The GitHub Actions workflow (`build-binaries.yml`) only renders `install.sh` via `replaceAll("__PRIME_AGENT_DOWNLOAD_BASE_URL__", baseUrl)`. `install.ps1` is **not** part of the release pipeline, so a user who downloads the published `install.sh` cannot get the PowerShell installer unless they manually set `PRIME_AGENT_DOWNLOAD_BASE_URL`. Recommendation: add an identical `replaceAll` step for `install.ps1` to the workflow (outside current task scope but should be tracked).
- **Complexity**: The script is larger than `install.sh` (screen‑rendering code stripped out), but all core install‑logic (download, checksum, npm install, PATH guidance) is present and correct.

All other task items (Windows ZIP build, four‑package release, SHA‑256, checksums, sentinel preservation, `npm run check`, etc.) are complete. No functional blockers remain; the only open item is extending the publishing workflow to also render `install.ps1`.
