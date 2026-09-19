# Project Future Work & Technical Debt Backlog

## Overview
This document tracks technical debt, architectural fixes, and roadmap enhancements for `prime-agent`. Each entry defines the problem, proposed fix, affected subsystems, and priority.

## Complexity & Risk Ratings

| Subsystem / Initiative | Score (0–10) | Complexity Tier | Primary Technical Risks |
|---|---|---|---|
| **Context7 Module Hardening & Security** | `2.5` | Low | Logic remains confined to one ESM file with no daemon or runtime risk. |
| **Context7 Integration, Tests, & Types** | `4.5` | Moderate | Requires TypeScript migration, deterministic Vitest mocks without network calls, and skill resolution wiring. |
| **Shell Environments & Runtime Parity** | `7.5` | High | Involves process lifecycles across Python, Xonsh, and Zsh, signal teardown, and asynchronous generator concurrency in `AgentSession`. |

---

## 1. Context7 Skills Module (`packages/coding-agent`)

The Context7 skills client and CLI utility ([`packages/coding-agent/scripts/lib/context7-skills.mjs`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/scripts/lib/context7-skills.mjs)) provides headless discovery and retrieval of agent skills and changelog templates. Code review identified four priority issues and four enhancements:

### High Priority: Robustness & Security Hardening

- [ ] **CLI Flag Partitioning & Positional Argument Isolation**
  - **Subsystem:** [`packages/coding-agent/scripts/lib/context7-skills.mjs`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/scripts/lib/context7-skills.mjs) ([`runCli`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/scripts/lib/context7-skills.mjs))
  - **Issue:** Fixed index lookups (`args[1]`, `args[2]`) cause flags placed before arguments to overwrite positional parameters. For example, `ctx7-skills search --json changelog` searches for the literal string `"--json"`.
  - **Remediation:** Partition `args` into a `flags` set and a `positionals` list on entry. Resolve commands and arguments from positionals alone.

- [ ] **Handled HTTP 404 Rejection in `getSkill`**
  - **Subsystem:** [`packages/coding-agent/scripts/lib/context7-skills.mjs`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/scripts/lib/context7-skills.mjs) ([`getSkill`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/scripts/lib/context7-skills.mjs))
  - **Issue:** Queries for unknown skills return HTTP 404 from the Context7 REST API, triggering an uncaught exception in `requestJson` instead of returning `null`.
  - **Remediation:** Attach `status = res.status` to errors in `requestJson`. Catch status 404 in `getSkill` and return `null`.

- [ ] **SSRF Defense and Stream Payload Bounds in `fetchSkillContent`**
  - **Subsystem:** [`packages/coding-agent/scripts/lib/context7-skills.mjs`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/scripts/lib/context7-skills.mjs) ([`fetchSkillContent`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/scripts/lib/context7-skills.mjs))
  - **Issue:** Fetching raw markdown URLs allows arbitrary protocols and unvalidated hosts, creating SSRF risks against local endpoints such as `http://localhost:8000`. Unbounded stream buffering with `res.text()` also risks memory exhaustion.
  - **Remediation:** Enforce the `https:` protocol, block private and loopback CIDR ranges (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, and `::1`), and limit stream reads to 2 MB.

- [ ] **Harmonized `minTrust` Filter Semantics**
  - **Subsystem:** [`packages/coding-agent/scripts/lib/context7-skills.mjs`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/scripts/lib/context7-skills.mjs) ([`findSpecificationSkills`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/scripts/lib/context7-skills.mjs), [`filterSkills`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/scripts/lib/context7-skills.mjs))
  - **Issue:** `findSpecificationSkills` retains skills when `trustScore` is undefined, even with `minTrust` set. In contrast, `filterSkills` defaults undefined scores to 0 and drops them.
  - **Remediation:** Update `findSpecificationSkills` to evaluate `(skill.trustScore ?? 0) < minTrust` when `minTrust > 0`.

### Medium Priority: Testing, Types, & Agent Integration

- [ ] **Automated Test Suite for Context7 Utilities**
  - **Subsystem:** `packages/coding-agent/test/`
  - **Task:** Write Vitest unit tests with mocked fetch calls to verify search parsing, regular expressions, error handling, and CLI flags without network traffic.

- [ ] **TypeScript Migration (`.ts`)**
  - **Subsystem:** `packages/coding-agent/src/`
  - **Task:** Port `context7-skills.mjs` to `packages/coding-agent/src/core/skills/context7.ts`, defining interfaces for `SkillMetadata`, `SkillSearchResult`, and `SkillFetchOptions`.

- [ ] **Agent Skill Loader Integration**
  - **Subsystem:** `packages/coding-agent/src/core/skills/`
  - **Task:** Allow `prime-agent` to query and install specification skills directly into the session workspace.

- [ ] **Documentation Clarification for Node Runtime Requirements**
  - **Subsystem:** `packages/coding-agent/scripts/lib/context7-skills.mjs`
  - **Task:** Update JSDoc to note that `AbortSignal.any()` requires Node.js 20 or later.

---

## 2. Shell Environments & Runtime Parity (Xonsh & Zsh)

Two tasks follow the native Xonsh REPL integration ([`.planning/2026-09-13-xonsh-integration/`](file:///home/jeff/code/fork/prime-agent/.planning/2026-09-13-xonsh-integration/task_plan.md)) and Zsh skill validation ([`.planning/2026-09-19-zsh-skill/`](file:///home/jeff/code/fork/prime-agent/.planning/2026-09-19-zsh-skill/task_plan.md)):

- [ ] **Multi-Shell Process Tree Cleanup**
  - **Subsystem:** `prime-agent-runtime` / REPL managers
  - **Task:** Harden subprocess teardown across Python, Xonsh, and Zsh subshells so child processes do not leak on SIGINT or abort signals.

- [ ] **Dynamic REPL Capability Negotiation**
  - **Subsystem:** `packages/coding-agent/src/core/agent-session.ts`
  - **Task:** Probe environment capabilities and fall back cleanly when Python 3, Xonsh, or Zsh is absent, printing installation instructions.

---

## 3. Planning & Verification Hygiene

- [ ] **Automated Attestation Verification in CI**
  - **Subsystem:** `.planning/` scripts
  - **Task:** Verify plan integrity and detect unsynchronized plan states during pull request checks.
