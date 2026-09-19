# Findings & Decisions: Context7 Skills Module & Changelog Specs

**Co-authored-by:** Gemini Flash 3.8 (agy v1.2.7)

## Requirements
- Clarify Context7 CLI (`ctx7`) capabilities and skills discovery mechanisms.
- Search and identify changelog skills adhering to formal specifications (Keep a Changelog, Conventional Commits, SemVer).
- Extract ephemeral node commands used to drive Context7 headless skill searching into a cohesive, loosely coupled module of functions placed in the Prime Agent package (`packages/coding-agent`).
- Maintain compatibility with prime-agent code standards (`npm run check`, Biome formatting, ESM).

## Context7 Architecture & API Discoveries
- **CLI Interactivity vs Automation**:
  - `ctx7 skills search <query>` automatically spawns an Inquirer interactive TTY selector (`@inquirer/select`). In headless agent environments or automated subprocesses, this causes the command to hang and block execution since no `--json` or non-interactive flag is exposed.
- **Subcommand Visibility & Deprecation**:
  - Top-level `ctx7 --help` omits the `skills` subcommand from its primary list of commands, though `ctx7 skills --help` works.
  - Running skill commands prints an immediate deprecation notice:
    > `Warning: Skill commands are deprecated and will stop working in the next major release.`
- **REST Endpoints (Default Base URL: `https://context7.com`)**:
  - Inspecting `ctx7/dist/index.js` revealed clean, unauthenticated public REST endpoints:
    - `GET /api/v2/skills?query=<query>`: Returns JSON `{ results: Array<Skill> }`. Each item contains `name`, `project`, `description`, `url`, `installCount`, `trustScore`.
    - `GET /api/v2/skills?project=<project>&skill=<skillName>`: Returns single skill metadata object containing direct repository or raw markdown URL (`url`).
    - `POST /api/v2/skills/suggest`: Accepts `{ dependencies: Array<string> }` and returns suggested skills.
  - The endpoint directly provides raw GitHub content URLs (`raw.githubusercontent.com/.../SKILL.md`), enabling headless fetching via standard HTTP GET without GitHub tokens or complex auth.

## Changelog Skills: Bimodal Distribution
Context7 returned 31 indexed skills matching the query `changelog`. Analysis revealed a clear bimodal split:
- **Repo-Specific Internal Configs (~85%)**: Most entries are tailored to private or single-project conventions (e.g., generating `.changelog/<PR>.txt` for Terraform AWS, JetBrains IdeaVim release notes, or Cloudflare doc changelogs).
- **Formal Specification Implementations (~15%)**: A small subset implements vendor-neutral, portable standards:

| Skill | Repository | Spec / Standards | Trust | Installs | Characteristics |
|---|---|---|---|---|---|
| `changelog-automation` | `/wshobson/agents` | Keep a Changelog + Conventional Commits | 9.5 | 18 | Automates generation from commits/PRs; full release workflow following Keep a Changelog. |
| `changelog` | `/intercooperative-network/icn` | Keep a Changelog | 3.1 | - | Groups git log since last tag by `feat`/`fix`/`refactor` into Keep a Changelog sections. |
| `changelog` | `/alirezarezvani/claude-skills` | Conventional Commits | 8.9 | 9 | Provides `/changelog <generate\|lint>` modes for Conventional Commits validation. |
| `changelog-generator` | `/curiouslearner/devkit` | Conventional Commits + SemVer | 9.7 | 4 | Parses conventional commit types to determine semantic version bumps (`major`/`minor`/`patch`). |
| `changelog` | `/sgcarstrends/sgcarstrends` | `semantic-release` + Conventional Commits | - | - | Integrates with `semantic-release` and commitlint standards. |

## Workspace Packaging Boundary
- The workspace retains historical `@earendil-works/pi-*` package identifiers and internal `pi` CLI binary references from its fork heritage, while top-level packaging and release artifacts rebrand to `prime-agent`.
- Scripts at the repository root (`scripts/`) are reserved for release archives, installer packaging, and CI validation.
- Agent-facing CLI tooling and helper scripts belong within `packages/coding-agent/scripts/` (the Prime Agent package itself).

## Technical Decisions
| Decision | Rationale |
|---|---|
| Module located in `packages/coding-agent/scripts/` | Associates Context7 skill management tooling directly with the Prime Agent package (`packages/coding-agent`) rather than repository root. |
| Pure functional module in `packages/coding-agent/scripts/lib/context7-skills.mjs` | Keeps core functions decoupled from CLI/UI concerns, easily testable and importable across repo tools. |
| Dedicated CLI entry point in `packages/coding-agent/scripts/ctx7-skills.mjs` | Allows immediate headless command-line use without needing interactive terminal inputs. |
| Built-in specification matcher (`findSpecificationSkills`) | Encapsulates regex filters for Keep a Changelog, Conventional Commits, SemVer, and OpenAPI. |
| Zero external HTTP/fetch dependencies | Uses native Web API `fetch`, `URLSearchParams`, and `AbortSignal` supported natively in Node.js 20+. |
| Timeout + AbortSignal integration | Prevents network hangs during agent runs (defaults to 15s timeout with optional caller signal). |

## Code Review Discoveries & Technical Debt
A dedicated code review identified several edge cases and potential improvements in the initial implementation:

1. **CLI Flag Ordering & Argument Poisoning**:
   - `runCli` hardcodes positional indexing (`args[1]`). Passing flags before arguments (e.g. `ctx7-skills search --json changelog`) poisons the query parameter by searching for literal `"--json"` and discarding `"changelog"`.
   - *Fix:* Separate flags (`args.filter(a => a.startsWith("--"))`) from positional arguments (`args.filter(a => !a.startsWith("--"))`).

2. **Unhandled HTTP 404 in `getSkill`**:
   - `requestJson` throws an error on non-2xx HTTP responses. Context7 returns HTTP 404 for unknown skills. Because `getSkill` has no `try/catch`, querying a nonexistent skill causes an unhandled promise rejection and CLI stack trace crash instead of cleanly returning `null` or printing the error message.
   - *Fix:* Catch 404 errors in `getSkill` and return `null`.

3. **Filtering Semantics Inconsistency**:
   - `findSpecificationSkills` allows skills with `trustScore: undefined` when `minTrust` is set (`skill.trustScore !== undefined && skill.trustScore < minTrust`), whereas `filterSkills` rejects them (`(skill.trustScore ?? 0) < minTrust`).
   - Sibling functions in the same module should align on uniform missing-score semantics.

4. **Security & Payload Bounds in `fetchSkillContent`**:
   - `fetchSkillContent` accepts arbitrary URLs with no scheme or host validation, posing SSRF risks against internal services (e.g. `http://localhost:8000/mcp`) and supporting `data:` URIs.
   - It buffers the entire response body with `await res.text()` without a maximum byte limit, making it vulnerable to memory exhaustion on unbounded stream responses.

5. **Runtime Node.js Version Clarification**:
   - The use of `AbortSignal.any()` requires Node.js >= 20.0.0. The repository's engine constraint (`>=22.8.0`) satisfies this, but documentation should cite Node 20+ rather than Node 18+.

## Complexity & Risk Assessment
Identified technical debt and backlog items were evaluated on a 0-10 complexity/risk scale:
1. **Context7 Module Hardening & Security (Score: 2.5/10 - Low):**
   - Modifying [`packages/coding-agent/scripts/lib/context7-skills.mjs`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/scripts/lib/context7-skills.mjs) is localized to a single file with zero runtime or daemon dependencies.
   - Fixes for positional argument poisoning, 404 rejections, SSRF checks, and stream byte capping carry minimal risk.
2. **Context7 Integration, Tests, & Types (Score: 4.5/10 - Moderate):**
   - Writing Vitest test suites with mock fetch streams requires deterministic isolation without network calls.
   - Porting to strict TypeScript requires matching repository Biome and compiler settings.
3. **Shell Environments & Runtime Parity (Score: 7.5/10 - High):**
   - Involves cross-process lifecycle coordination across Python daemon, Xonsh subshells, and Zsh PTYs.
   - Process tree termination on abort signals and session recovery in [`AgentSession`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/src/core/agent-session.ts) carry concurrency and platform compatibility risks.

## Issues Encountered
| Issue | Resolution |
|---|---|
| `pnpx ctx7 skills search` hung in subprocess | Analyzed `ctx7/dist/index.js` to extract endpoint URLs and bypass TTY prompts with direct API fetching |
| Query response payload property mismatch | Identified that `/api/v2/skills` returns `{ results: [] }` rather than `{ skills: [] }` |
| Unhandled HTTP 404 in `getSkill` | Identified via code review; documented technical debt to catch 404 and return null |
| Argument poisoning on leading CLI flags | Identified via code review; documented technical debt to filter flags from positionals |
