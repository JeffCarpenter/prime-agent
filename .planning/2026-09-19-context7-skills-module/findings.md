# Findings & Decisions: Context7 Skills Module & Changelog Specs

**Co-authored-by:** Gemini Flash 3.8 (agy v1.2.7)

## Requirements
- Clarify Context7 CLI (`ctx7`) capabilities and skill discovery mechanisms.
- Identify changelog skills adhering to Keep a Changelog, Conventional Commits, or SemVer.
- Extract headless Context7 driver commands into an ESM module under `packages/coding-agent`.
- Comply with `prime-agent` standards: Biome formatting, TypeScript checks, and ESM.

## Context7 Architecture & API Discoveries
- **CLI Interactivity and Automation**:
  `ctx7 skills search <query>` spawns an interactive `@inquirer/select` prompt. Because the CLI provides no `--json` or non-interactive flag, headless subprocesses hang.
- **Subcommand Visibility and Deprecation**:
  Top-level `ctx7 --help` omits the `skills` subcommand, though `ctx7 skills --help` works. Running skill commands prints a deprecation warning:
  > `Warning: Skill commands are deprecated and will stop working in the next major release.`
- **REST Endpoints (Default Base URL: `https://context7.com`)**:
  Public endpoints in `ctx7/dist/index.js` require no authentication:
  - `GET /api/v2/skills?query=<query>`: Returns `{ results: Skill[] }`. Each item contains `name`, `project`, `description`, `url`, `installCount`, and `trustScore`.
  - `GET /api/v2/skills?project=<project>&skill=<skillName>`: Returns skill metadata with a direct GitHub URL (`url`).
  - `POST /api/v2/skills/suggest`: Accepts `{ dependencies: string[] }` and returns suggested skills.
  The API provides direct markdown URLs (`raw.githubusercontent.com/.../SKILL.md`), enabling unauthenticated HTTP downloads.

## Changelog Skills: Bimodal Distribution
Context7 returned 31 skills for the query `changelog`. The results divide into two categories:
- **Project-Specific Configurations (~85%)**: Tailored to single-project conventions, such as `.changelog/<PR>.txt` for Terraform AWS, IdeaVim release notes, or Cloudflare documentation.
- **Specification Implementations (~15%)**: Portable skills that implement published standards:

| Skill | Repository | Spec / Standards | Trust | Installs | Characteristics |
|---|---|---|---|---|---|
| `changelog-automation` | `/wshobson/agents` | Keep a Changelog + Conventional Commits | 9.5 | 18 | Generates changelogs from commits and pull requests; implements Keep a Changelog. |
| `changelog` | `/intercooperative-network/icn` | Keep a Changelog | 3.1 | - | Groups git commits since the last tag into Keep a Changelog sections. |
| `changelog` | `/alirezarezvani/claude-skills` | Conventional Commits | 8.9 | 9 | Provides `/changelog <generate\|lint>` modes to validate Conventional Commits. |
| `changelog-generator` | `/curiouslearner/devkit` | Conventional Commits + SemVer | 9.7 | 4 | Parses conventional commit types to determine version bumps (`major`, `minor`, `patch`). |
| `changelog` | `/sgcarstrends/sgcarstrends` | `semantic-release` + Conventional Commits | - | - | Integrates with `semantic-release` and Commitlint. |

## Workspace Packaging Boundary
- The workspace retains `@earendil-works/pi-*` package identifiers and `pi` CLI references from upstream, but publishes under the `prime-agent` name.
- Root scripts (`scripts/`) serve release archives, installer packaging, and CI checks.
- Agent tools and helper scripts belong in `packages/coding-agent/scripts/`.

## Technical Decisions
| Decision | Rationale |
|---|---|
| Module placed in `packages/coding-agent/scripts/` | Houses Context7 skill tooling in `packages/coding-agent` instead of the workspace root. |
| Pure functional module in `packages/coding-agent/scripts/lib/context7-skills.mjs` | Decouples core functions from the CLI, simplifying tests and imports. |
| Dedicated CLI entry point in `packages/coding-agent/scripts/ctx7-skills.mjs` | Enables headless execution without interactive terminal input. |
| Built-in specification matcher (`findSpecificationSkills`) | Filters skills by Keep a Changelog, Conventional Commits, SemVer, and OpenAPI. |
| Zero external HTTP/fetch dependencies | Uses native Node 20+ Web APIs: `fetch`, `URLSearchParams`, and `AbortSignal`. |
| Timeout + AbortSignal integration | Aborts stalled network requests after 15 seconds or on caller signal. |

## Code Review Discoveries & Technical Debt
A dedicated code review identified five issues:

1. **CLI Flag Ordering & Argument Poisoning**:
   `runCli` uses fixed indexes (`args[1]`). Placing flags before arguments (for example, `ctx7-skills search --json changelog`) assigns `"--json"` to the query and discards `"changelog"`.
   *Remedy:* Partition flags from positional arguments before reading commands.

2. **Unhandled HTTP 404 in `getSkill`**:
   `requestJson` throws on non-2xx responses. Because `getSkill` lacks error handling, queries for unknown skills cause uncaught exceptions rather than returning `null`.
   *Remedy:* Catch 404 responses in `getSkill` and return `null`.

3. **Inconsistent Filter Semantics**:
   `findSpecificationSkills` retains skills when `trustScore` is undefined. In contrast, `filterSkills` assigns undefined scores a value of 0 and rejects them.
   *Remedy:* Align missing-score handling across both functions.

4. **Security & Payload Bounds in `fetchSkillContent`**:
   `fetchSkillContent` accepts arbitrary URLs without validating schemes or hosts, permitting SSRF attacks against internal services like `http://localhost:8000`. In addition, buffering entire responses with `res.text()` risks memory exhaustion.
   *Remedy:* Enforce `https:`, block loopback and private CIDR ranges, and cap stream reads at 2 MB.

5. **Runtime Node.js Version Clarification**:
   `AbortSignal.any()` requires Node.js 20 or later. Documentation should state this requirement clearly.

## Complexity & Risk Assessment
Evaluated technical debt items on a 0–10 scale:
1. **Context7 Module Hardening & Security (Score: 2.5/10 — Low):**
   Changes remain isolated to [`packages/coding-agent/scripts/lib/context7-skills.mjs`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/scripts/lib/context7-skills.mjs). Fixing argument ordering, 404 handling, SSRF protections, and stream limits carries minimal risk.
2. **Context7 Integration, Tests, & Types (Score: 4.5/10 — Moderate):**
   Writing Vitest suites requires deterministic mocks without network access. Migrating to TypeScript requires strict compiler and Biome compliance.
3. **Shell Environments & Runtime Parity (Score: 7.5/10 — High):**
   Requires coordinating process lifecycles across Python, Xonsh, and Zsh. Subprocess teardown on abort signals and session recovery in [`AgentSession`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/agent-session.ts) present concurrency and platform risks.

## Issues Encountered
| Issue | Resolution |
|---|---|
| `pnpx ctx7 skills search` hung in subprocess | Extracted endpoint URLs from `ctx7/dist/index.js` and bypassed TTY prompts with direct API calls |
| Query response payload property mismatch | Mapped responses to `data.results` after inspecting the API |
| Unhandled HTTP 404 in `getSkill` | Flagged in review; logged technical debt to return `null` on 404 responses |
| Argument poisoning on leading CLI flags | Flagged in review; logged technical debt to partition flags from positional arguments |
