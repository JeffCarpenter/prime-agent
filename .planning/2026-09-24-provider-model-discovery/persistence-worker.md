# Persistence worker

Changed paths:
- `packages/coding-agent/src/core/session-manager.ts`
- `packages/coding-agent/test/session-manager/file-operations.test.ts`

Implemented session v4 and v3 numeric-cost migration across assistant, compaction, branch-summary, and child-attribution usage. Tagged known/unknown values are left intact. Missing historical costs are not invented. Existing atomic migration rewrite persists v4 on open.

Tests: `npx tsx ../../node_modules/vitest/dist/cli.js --run test/session-manager/file-operations.test.ts` from packages/coding-agent.
- RED: 3 new table cases failed because header remained v3 (54 passed).
- GREEN: 57 passed.
- Mutation: replacing numeric conversion with return caused legacy regression to fail (56 passed); restored.
- Final validation pending below.
- `npm run check:test-policy`: passed.
- `npm run check`: Biome and policy passed, TypeScript failed in other workers' migration areas; no errors in either scoped file. Full output saved in persistence-check.log. Check automatically formatted 10 existing modified files outside ownership; no manual edits or reverts made there.
- Local test additions exceed local source additions; parent notified to account budget across coordinated change.

Final focused tests: 57/57 passed with shuffle seeds 41 and 97. v3 numeric migration and v4 known/unknown persisted records validated. Existing crash-repair tests emitted expected repair diagnostics. No commits, subagents, or live provider calls.
