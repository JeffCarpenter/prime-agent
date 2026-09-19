# Rebase Reconciliation Findings: `stable-prime` onto `stable-pnpm`

**Date:** 2026-09-15  
**Base Branch:** `stable-pnpm` (`eeb4a19fcd48bf496dc561dec7dd1e2ded3ec24c`)  
**Rebased Branch:** `stable-prime` (previously `6d3fb504f5c3f439dc197d566671dda9544500eb`)  
**Previous Base:** `origin/stable-pnpm` (`b1b9bef8c`, pre-v0.9.5 rebase, based on `v0.9.4`)

---

## 1. Overview

Branch `stable-prime` had branched off an earlier revision of `stable-pnpm` when the workspace was at v0.9.4. When `stable-pnpm` was recently rebased onto upstream `stable` (v0.9.5 / `a7d791bc1`), its initial commits were rewritten:
- `467e5b613` (`use pnpm`) -> `091bd72a7`
- `b1b9bef8c` (`chore: add @biomejs/cli-linux-x64, configure pnpm workspace, and fix check dependencies`) -> `b126cceec`
- Follow-up commit on `stable-pnpm`: `eeb4a19fc` (`chore: update pnpm-lock.yaml for v0.9.5 workspace dependencies`)

When executing `git rebase stable-pnpm` from `stable-prime`, git calculated the merge base against `v0.9.4` (`f771dfced`). Git automatically skipped `b1b9bef8c` as previously applied, but attempted to replay `467e5b613`, halting on a merge conflict in `packages/coding-agent/package.json`.

---

## 2. Conflict Analysis & Reconciliation

### Conflicted File: `packages/coding-agent/package.json`

#### Context
- **Upstream / `stable-pnpm` (HEAD @ `eeb4a19fc`):** In v0.9.5 (commit `dd760d31` #2140), native binary compilation was refactored from inline shell pipelines into dedicated Node scripts (`scripts/build-binary.mjs` and `scripts/copy-binary-assets.mjs`). The `build` script uses `pnpm run copy-assets && pnpm run bundle`.
- **Branch commit (`467e5b613`):** Held the pre-v0.9.5 inline `build:binary` script using `pnpm --prefix ...`.

#### Conflict Chunk
```json
<<<<<<< HEAD
		"build:binary": "node scripts/build-binary.mjs",
=======
		"build:binary": "pnpm --prefix ../tui run build && pnpm --prefix ../ai run build && pnpm --prefix ../agent run build && pnpm run build && bun build --compile ./dist/bun/cli.js --outfile dist/pi && pnpm run copy-binary-assets",
>>>>>>> 467e5b613 (use pnpm)
```

#### Reconciliation
1. **`packages/coding-agent/package.json`:** Discarded the obsolete inline `pnpm --prefix ...` invocation in favor of upstream's `"build:binary": "node scripts/build-binary.mjs"`, matching the resolution documented in `2026-09-15-stable-rebase-reconciliation.md`.
2. **`scripts/check-installer.mjs`:** The replay attempt also staged modifications to `scripts/check-installer.mjs` changing npm assertions to pnpm assertions (`Finalizing pnpm install.`). This was an artifact of `467e5b613` that had been explicitly reverted in `b1b9bef8c` / `b126cceec` (since the global shell installer invokes `npm`). Staged changes to `scripts/check-installer.mjs` were restored to match HEAD.
3. **Dropping Empty Commit:** With `packages/coding-agent/package.json` and `scripts/check-installer.mjs` matching HEAD, commit `467e5b613` contained zero diff against `stable-pnpm`. Running `git rebase --continue` dropped the redundant patch.

---

## 3. Replayed Commits

The three feature commits unique to `stable-prime` replayed cleanly on top of `stable-pnpm`:

1. `6ea9da2a1` (was `fc044257f`): `windows: focused build orchestrator + PowerShell installer; both artifact sets; pnpm 12 pack fix`
2. `37bfd406f` (was `472a576a0`): `feat: add dotenv for environment variable management`
3. `987effdd8` (was `6d3fb504f`): `scripts: move install.xsh to scripts/ directory`

### Resulting Linear History

```text
* 987effdd8 (HEAD -> stable-prime) scripts: move install.xsh to scripts/ directory
* 37bfd406f feat: add dotenv for environment variable management
* 6ea9da2a1 windows: focused build orchestrator + PowerShell installer; both artifact sets; pnpm 12 pack fix
* eeb4a19fc (stable-pnpm) chore: update pnpm-lock.yaml for v0.9.5 workspace dependencies
* b126cceec chore: add @biomejs/cli-linux-x64, configure pnpm workspace, and fix check dependencies
* 091bd72a7 use pnpm
* a7d791bc1 (tag: v0.9.5, stable) prepare prime agent v0.9.5 release (#2366)
```

---

## 4. Verification

Ran full workspace verification via `npm run check`:
- **Biome:** 1,088 files checked in 2s with 0 errors or warnings.
- **TypeScript:** `tsgo --noEmit` passed across all 9 workspaces.
- **Supply-Chain Policies:** 425 lockfile entries verified and validated.
- **Installer Checks:** `node scripts/check-installer.mjs` passed.
- **Browser Smoke Test:** `node scripts/check-browser-smoke.mjs` passed.
