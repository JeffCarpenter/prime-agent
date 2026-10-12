# Arch Linux PKGBUILD Findings: Native Rust Transition & Packaging Divergence

> **Review Authority:** Build Engineering Planning Review (2026-10-11)  
> **Target:** [`pkgbuild/PKGBUILD`](file:///home/jeff/code/fork/prime-agent/pkgbuild/PKGBUILD)  
> **Status:** Approved for Native Rust Realignment (Phase 5 `p5-t1`)

---

## 1. The Packaging Time Warp (Legacy Node.js vs. Native Rust)

`pkgbuild/PKGBUILD` was bumped from `0.9.6` to `0.9.8`, but its build and package pipeline remains **100% hardwired to the retired Node.js/TypeScript architecture**:

1. **Obsolete Dependencies:**
   * Declares `depends=('nodejs>=22.8.0' 'python>=3.11' 'uv')` and `makedepends=('pnpm' 'rsync')`.
   * The native target architecture requires `rust` / `cargo` for building, and only `python>=3.11` and `uv` at runtime for the sidecar. Node.js is obsolete.
2. **Zombie Build & Package Steps:**
   * `build()` executes `pnpm install --frozen-lockfile` and `pnpm run build`.
   * `package()` executes `pnpm deploy --prod --filter @earendil-works/pi-coding-agent "$install_dir"`.
   * Symlinks `/usr/lib/prime-agent/dist/bundle/cli.js` to `/usr/bin/prime-agent`.
3. **Architectural Contradiction:**
   * Upstream commit `39bc99a91` (PR #2524, `v0.10.0`) dropped 1,181 TypeScript files across `packages/*` and root `package.json`, replacing the core engine with a native Rust workspace (`crates/*`).
   * The Architectural Decision Record (ADR) explicitly rejected dual-stack coexistence as dead maintenance debt.
   * While the fork's active branch (`xonsh-rust`) and reconciliation plan target native Rust, the packaging recipe was still packaging the dead TypeScript stack.

---

## 2. Untracked Artifacts Lingering in Source Tree

The `pkgbuild/` directory contains accumulated, untracked release tarballs and build residue:
* `prime-agent-0.9.6-1-x86_64.pkg.tar.zst` (~29.5 MB)
* `prime-agent-debug-0.9.6-1-x86_64.pkg.tar.zst` (~110 KB)
* `prime-agent-0.9.8-1-x86_64.pkg.tar.zst` (~29.4 MB)
* `prime-agent-debug-0.9.8-1-x86_64.pkg.tar.zst` (~111 KB)
* `.makepkg-test.9PpgMi/` (residual build directory)

These artifacts should not linger untracked inside the working tree and should be pruned or gitignored.

---

## 3. Dynamic Catalog Asset Generation: Feature Context & Packaging Strategy

Upstream's release packaging specification ([`package_release.py`](file:///home/jeff/code/fork/prime-agent/.worktrees/native-rust-upstream-baseline-20261011/scripts/package_release.py)) strictly mandates the following staged payload:
* `prime-agent` (ELF binary)
* `prime-agent-runtime/` (Python kernel runtime)
* `skills/` (Builtin skills)
* `models.bundled.json` (Model definitions)
* `mcp-services.bundled.json` (MCP service catalogs)

### Architectural Intent: Dynamic Bundling as a Feature
* **Curated Freshness by Design:** Upstream dynamically generates `models.bundled.json` and `mcp-services.bundled.json` via `bundle_catalog.py` at release assembly time. This is **effectively a feature**: it guarantees that packaged distribution binaries ship with the freshest, verified live model capabilities, pricing metadata, and MCP service definitions without polluting Git source tree history with rapidly churning static snapshots.

### Packaging Implementation for Clean-Room Builds:
* In isolated Linux packaging environments (such as Arch Linux clean chroots via `makepkg` / `devtools`), **network access is severed** during the `build()` and `package()` steps.
* To preserve both the freshness benefits of this catalog feature and Arch packaging determinism, the native recipe will:
  1. Fetch or generate verified catalog assets prior to offline build invocation, or
  2. Declare the generated catalogs as checksum-pinned entries in the PKGBUILD `source=()` array, or
  3. Include a local static fallback fixture for chroot / offline compilation.

---

## 4. Complex Node Post-Processing Tech Debt

The existing `PKGBUILD` contains extensive workarounds for Node.js / pnpm quirks that can be completely eliminated in the native Rust recipe:
* Pruning `.bin` directories across installed packages.
* Pruning multi-platform `koffi` native binaries down to `linux_x64`.
* Splitting pnpm hardlinks via `cp --reflink=auto` to avoid Arch package hardlink breakages.
* Pruning `.venv`, `__pycache__`, and test directories across the source tree.

Transitioning to native Rust replaces this fragile post-processing with standard Cargo installation:
* `cargo build --release -p pa-cli`
* Installing `/usr/bin/prime-agent` directly.
* Installing `prime-agent-runtime/` and `skills/` cleanly into `/usr/lib/prime-agent/` or `/usr/share/prime-agent/`.

---

## 5. Approved Native Realignment Plan (Phase 5 `p5-t1`)

User authorization (2026-10-11) has formally approved realigning `PKGBUILD`:
1. **Target:** Native release binary (`crates/pa-cli`) + Python runtime (`prime-agent-runtime/`) + skills (`skills/`).
2. **Version:** Standardized on upstream authoritative **`0.10.0`** (replacing `0.9.8`).
3. **Build Toolchain:** `makedepends=('cargo' 'python-installer' 'python-build')`, dropping `pnpm` and `nodejs`.
4. **Offline Resilience:** Bundle static catalog fixtures to ensure deterministic, zero-network builds under clean chroots.
