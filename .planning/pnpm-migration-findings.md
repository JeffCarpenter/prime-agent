# pnpm Migration Findings

## Overview

During the migration from `npm` to `pnpm` (v12.3.4) on the `stable-pnpm` branch, several issues emerged due to the shift from npm's flat, hoisted `node_modules` structure to pnpm's symlinked, isolated dependency tree.

---

## 1. Phantom Dependencies Exposed by Isolated `node_modules`

Under npm, transitive dependencies were hoisted to the top-level `node_modules` directory, allowing files to import unlisted packages. Under pnpm, imports can only resolve packages explicitly declared in the importing package's `package.json`.

### A. Biome Platform Binary Resolution
* **Symptom:** `biome check` failed with:
  ```text
  Error: Cannot find module '@biomejs/cli-linux-x64/biome'
  Require stack: .../node_modules/@biomejs/biome/bin/biome
  ```
* **Cause:** The `@biomejs/biome` runner resolves its platform-specific binary via `require.resolve("@biomejs/cli-linux-x64/biome")`. The package name is `@biomejs/cli-linux-x64` (not `@biomejs/cli-linux-x64/biome`), and `/biome` is the executable path inside it.
* **Resolution:** Added `@biomejs/cli-linux-x64` to root `devDependencies` in `package.json`.

### B. AWS Bedrock SDK Phantom Dependencies (`packages/ai`)
* **Symptom:** `tsgo --noEmit` failed with:
  ```text
  packages/ai/src/providers/amazon-bedrock.ts:23:35 - error TS2307: Cannot find module '@smithy/types' or its corresponding type declarations.
  packages/ai/src/providers/amazon-bedrock.ts:164:42 - error TS2307: Cannot find module '@smithy/node-http-handler' or its corresponding type declarations.
  ```
* **Cause:** `amazon-bedrock.ts` directly imports `@smithy/types` and `@smithy/node-http-handler`. In npm, these were hoisted from `@aws-sdk/client-bedrock-runtime`. In pnpm, they were invisible to `packages/ai`.
* **Resolution:** Explicitly added `@smithy/types` and `@smithy/node-http-handler` to `packages/ai/package.json` `dependencies`.

### C. Root Build Scripts Missing Direct Dependencies
* **Symptom:** `pnpm run check:browser-smoke` failed with:
  ```text
  Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'esbuild' imported from .../scripts/check-browser-smoke.mjs
  ```
* **Cause:** `scripts/check-browser-smoke.mjs` imports `esbuild` directly at the repository root. It previously relied on `tsx`'s internal dependency on `esbuild` being hoisted to the root.
* **Resolution:** Added `esbuild` to root `devDependencies` in `package.json`.

### D. Transitive Optional Bundling Traversal in Browser Smoke Check
* **Symptom:** `esbuild` failed during `check:browser-smoke`:
  ```text
  node_modules/.pnpm/@mistralai+mistralai@2.6.4/node_modules/@mistralai/mistralai/esm/extra/observability/otel.js:7:75: ERROR: Could not resolve "@opentelemetry/api"
  ```
* **Cause:** In the original `package-lock.json`, `@mistralai/mistralai` was locked to `2.2.1` which did not include telemetry tracing. Fresh resolution pulled `2.6.4`, which contains an optional peer dependency on `@opentelemetry/api`. `esbuild`'s full browser bundle pass traced into `otel.js` and failed when resolving `@opentelemetry/api`.
* **Resolution:** Added `@opentelemetry/api` to `packages/ai/package.json`.

---

## 2. pnpm v12 Configuration and Workspace Resolution

### A. Configuration Target
* In pnpm v12, executing `pnpm config set --location project <key> <value>` persists settings directly into `pnpm-workspace.yaml` (using camelCase) rather than `.npmrc`.

### B. Monorepo Package Resolution (`linkWorkspacePackages`)
* **Symptom:** Running `pnpm add` or `pnpm install` attempted to fetch monorepo packages (e.g., `@earendil-works/pi-coding-agent@^0.9.4`) from the public npm registry (`https://registry.npmjs.org/`) and failed with `ERR_PNPM_NO_MATCHING_VERSION` because `0.9.4` is not yet published to npm.
* **Cause:** Without explicit workspace linking instructions, pnpm's resolver defaulted to registry lookups for semver ranges matching local packages.
* **Resolution:** Configured `linkWorkspacePackages: deep` in `pnpm-workspace.yaml`.

### C. Build Script Execution Authorizations (`allowBuilds`)
* pnpm v12 blocks lifecycle build/install scripts by default (`ERR_PNPM_IGNORED_BUILDS`).
* Approved build scripts must be registered under `allowBuilds` in `pnpm-workspace.yaml` (configured via `pnpm approve-builds`):
  ```yaml
  allowBuilds:
    '@google/genai': true
    canvas: true
    esbuild: true
    koffi: true
    protobufjs: true
  ```

---

## 3. Installer Script Scope

* `install.sh` is an end-user curl-based installer executing `npm install -g` with npm 12 security policy flags (`--allow-remote=all`, `--allow-scripts`).
* `scripts/check-installer.mjs` tests `install.sh` behavior against various npm versions (10, 11, 12).
* In a prior commit, references to `prime_agent_npm_install` in `scripts/check-installer.mjs` were mistakenly renamed to `prime_agent_pnpm_install`. Since `install.sh` defines `prime_agent_npm_install`, `scripts/check-installer.mjs` was restored to test `npm` installations.
