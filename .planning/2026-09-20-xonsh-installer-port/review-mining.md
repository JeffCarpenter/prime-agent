# Review-mining results (2026-09-21)

## Method
Schema first: each rollout was piped through `drivel describe` before any reading; all queries then went through Python `json` parsing (no raw dumps). Harvest kept at `/tmp/review-mining-harvest.json`.

## Sources
- native-parity-gap-review parent `.../sub-6e34bfee/01a0ac4c-0100-70a0-b9a1-c0e4fedaf7df.jsonl` (34 msgs) and child `sub-6ff44e9f/...2709-70a0-b9a1-c0e4fedaf7df.jsonl` (29 msgs).
- node-regression-review parent `.../sub-8e7fff7a/01a0ac4c-019d-7724-ae82-2d735dee80ef.jsonl` (24 msgs) and child `sub-c4b95897/...1f18-70cb-b891-9d2917762190.jsonl` (23 msgs).
- Child kernel states (`kernel-state.dill`/`.json`) hold only source-text variables (`tx`, `nts`, `irt`, `testfiles`).

## Result: null findings
All four sessions terminated on provider usage-limit failures (`status.summary`: "Model request failed: You have hit your ChatGPT usage limit"). Zero assistant text blocks and zero `agent_message` drafts in any rollout. The "no-reply" exits were quota deaths, not unfinished drafting. No conclusions to recover.

## Salvage
1. Comparison areas under inspection when killed: native PATH/bootstrap/fallback tail, public-command and previous-link recovery, curl protocol policy, version resolution, cleanup, quiet/animation handling. These match the open parity topics.
2. High-value oracle discovery: the repo's own TypeScript installer tests encode the behavioral contract and must feed the parity matrix:
   - `packages/coding-agent/test/native-installer.test.ts` (1,390 lines): HTTPS-to-HTTP redirect rejection, beta channel pinning, unmanaged-executable self-update refusal, unrelated public-command refusal, SIGKILL recovery of the previous-link rename, lock not stolen across installations, lock release on terminal hangup, AVX2-only build selection, musl/glibc loader detection and ordering.
   - `packages/coding-agent/test/installer-release-format.test.ts` (153 lines): release archive layout.

## Disposition
Transcripts are exhausted. Per the agreed fallback, the 115-function parity matrix proceeds inline, using `install.sh` plus the two TS test files as oracles. No re-delegation.
