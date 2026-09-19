# Project Future Work & Technical Debt Backlog

## Overview
This document tracks identified technical debt, planned architectural rectifications, and future roadmap enhancements across `prime-agent`. Items are cataloged with concrete problem statements, proposed remediation, affected subsystems, and priority rankings.

## Complexity & Risk Ratings

| Subsystem / Initiative | Score (0-10) | Complexity Tier | Primary Technical Risks |
|---|---|---|---|
| **Context7 Module Hardening & Security** | `2.5` | Low | Localized logic in single ESM file; zero daemon or agent runtime regression risk. |
| **Context7 Integration, Tests, & Types** | `4.5` | Moderate | Strict TypeScript migration, deterministic Vitest mocks without network egress, skill resolution wiring. |
| **Shell Environments & Runtime Parity** | `7.5` | High | Cross-runtime process lifecycle (Python/Xonsh/Zsh), signal/abort tree teardown, asynchronous generator concurrency in `AgentSession`. |

---

## 1. Context7 Skills Module (`packages/coding-agent`)

The Context7 skills client and CLI utility ([`packages/coding-agent/scripts/lib/context7-skills.mjs`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/scripts/lib/context7-skills.mjs)) was introduced to provide headless, non-interactive discovery and retrieval of agent skills and specification changelog templates. A dedicated code review identified the following debt items and enhancements:

### High Priority: Robustness & Security Hardening

- [ ] **CLI Flag Partitioning & Positional Argument Isolation**
  - **Subsystem:** [`packages/coding-agent/scripts/lib/context7-skills.mjs`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/scripts/lib/context7-skills.mjs) ([`runCli`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/scripts/lib/context7-skills.mjs))
  - **Issue:** Fixed index lookups (`args[1]`, `args[2]`) cause flag values (such as `--json` or `--spec`) passed ahead of arguments to poison positional parameters (e.g. `ctx7-skills search --json changelog` searches for literal `"--json"`).
  - **Remediation:** Partition `args` into a `flags` set and `positionals` list at entry, resolving command and arguments strictly from positionals.

- [ ] **Handled HTTP 404 Rejection in `getSkill`**
  - **Subsystem:** [`packages/coding-agent/scripts/lib/context7-skills.mjs`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/scripts/lib/context7-skills.mjs) ([`getSkill`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/scripts/lib/context7-skills.mjs))
  - **Issue:** Unknown skill queries return HTTP 404 from the Context7 REST API, triggering an uncaught exception in `requestJson` instead of returning `null` or a structured diagnostic.
  - **Remediation:** Annotate errors with `status = res.status` in `requestJson` and catch status `404` inside `getSkill` to cleanly return `null`.

- [ ] **SSRF Defense and Stream Payload Bounds in `fetchSkillContent`**
  - **Subsystem:** [`packages/coding-agent/scripts/lib/context7-skills.mjs`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/scripts/lib/context7-skills.mjs) ([`fetchSkillContent`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/scripts/lib/context7-skills.mjs))
  - **Issue:** Fetching raw markdown URLs accepts arbitrary protocols and unvalidated hosts (posing SSRF risks to local daemon/MCP ports like `http://localhost:8000`), while unbounded `res.text()` stream buffering risks memory exhaustion.
  - **Remediation:** Enforce `https:` protocol, block private/loopback CIDR ranges and metadata endpoints (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`), and implement chunked reader consumption capped at 2 MB.

- [ ] **Harmonized `minTrust` Filter Semantics**
  - **Subsystem:** [`packages/coding-agent/scripts/lib/context7-skills.mjs`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/scripts/lib/context7-skills.mjs) ([`findSpecificationSkills`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/scripts/lib/context7-skills.mjs), [`filterSkills`](file:///home/jeff/code/fork/prime-agent/packages/coding-agent/scripts/lib/context7-skills.mjs))
  - **Issue:** `findSpecificationSkills` retains skills with `trustScore: undefined` when `minTrust` is set, whereas `filterSkills` defaults undefined scores to `0` and discards them.
  - **Remediation:** Align `findSpecificationSkills` to evaluate `(skill.trustScore ?? 0) < minTrust` when `minTrust > 0`.

### Medium Priority: Testing, Types, & Agent Integration

- [ ] **Automated Test Suite for Context7 Utilities**
  - **Subsystem:** `packages/coding-agent/test/`
  - **Task:** Implement unit tests using Vitest and mock network fetch to verify search parsing, specification regex matching, error statuses, and CLI flag handling without real network calls.

- [ ] **TypeScript Migration (`.ts`)**
  - **Subsystem:** `packages/coding-agent/src/`
  - **Task:** Port `context7-skills.mjs` into TypeScript under `packages/coding-agent/src/core/skills/context7.ts`, providing formal interfaces for `SkillMetadata`, `SkillSearchResult`, and `SkillFetchOptions`.

- [ ] **Agent Skill Loader Integration**
  - **Subsystem:** `packages/coding-agent/src/core/skills/`
  - **Task:** Enable prime-agent to directly query and install validated specification skills (e.g. Keep a Changelog) into the local session workspace on demand.

- [ ] **Documentation Clarification for Node Runtime Requirements**
  - **Subsystem:** `packages/coding-agent/scripts/lib/context7-skills.mjs`
  - **Task:** Clarify JSDoc to cite Node.js >= 20.0.0 requirement for `AbortSignal.any()`.

---

## 2. Shell Environments & Runtime Parity (Xonsh & Zsh)

Following the native Xonsh REPL integration ([`.planning/2026-09-13-xonsh-integration/`](file:///home/jeff/code/fork/prime-agent/.planning/2026-09-13-xonsh-integration/task_plan.md)) and Zsh skill validation ([`.planning/2026-09-19-zsh-skill/`](file:///home/jeff/code/fork/prime-agent/.planning/2026-09-19-zsh-skill/task_plan.md)):

- [ ] **Multi-Shell Process Tree Cleanup**
  - **Subsystem:** `prime-agent-runtime` / REPL managers
  - **Task:** Harden subprocess teardown when aborting running shell evaluations across Python, Xonsh, and Zsh subshells to ensure child worker processes do not leak on SIGINT/abort signals.

- [ ] **Dynamic REPL Capability Negotiation**
  - **Subsystem:** `packages/coding-agent/src/core/agent-session.ts`
  - **Task:** Add capability probing to automatically fallback gracefully if an environment lacks Python 3, Xonsh, or Zsh, surfacing actionable installation diagnostics.

---

## 3. Planning & Verification Hygiene

- [ ] **Automated Attestation Verification in CI**
  - **Subsystem:** `.planning/` scripts
  - **Task:** Verify plan integrity and detect accidental tampering or unsynchronized plan states during pull request checks.
