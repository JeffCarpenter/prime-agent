# Outstanding Fix PRs Ranked by ROI

Open pull requests in `PrimeIntellect-ai/prime-agent` whose titles begin with “fix” (case-insensitive), ranked by expected user/security impact, affected-user reach, confidence, review cost, mergeability, and regression risk. Within each section, higher is better. Snapshot checked 2026-08-11.

Tier 1 contains ready, non-conflicting PRs with passing recorded checks. PRs with conflicts, drafts, failing checks, or unusually high review cost stay in Tier 4 regardless of potential impact. `*` marks changes already applied to checkout `f6253265c`.

## Tier 1 — Merge next

- [#850](https://github.com/PrimeIntellect-ai/prime-agent/pull/850) fix(coding-agent): report accurate worker lifecycle and hide stopping workers
- [#675](https://github.com/PrimeIntellect-ai/prime-agent/pull/675) fix(coding-agent): preserve live workers during recovery
- [#801](https://github.com/PrimeIntellect-ai/prime-agent/pull/801) fix(coding-agent): honor model scope for subagents
- [#988](https://github.com/PrimeIntellect-ai/prime-agent/pull/988) fix(tui): stop wrap recursion on wide graphemes and recover from lost paste end
- [#996](https://github.com/PrimeIntellect-ai/prime-agent/pull/996) fix(ai): flush trailing SSE events and keep unparented text deltas
- [#991](https://github.com/PrimeIntellect-ai/prime-agent/pull/991) fix(ai): drop tool results whose parent tool call was aborted
- [#1001](https://github.com/PrimeIntellect-ai/prime-agent/pull/1001) fix(coding-agent): run OAuth refresh outside the auth.json file lock
- [#748](https://github.com/PrimeIntellect-ai/prime-agent/pull/748) fix(coding-agent): cache process start id to fix daemon handshake livelock on Windows
- [#722](https://github.com/PrimeIntellect-ai/prime-agent/pull/722) fix: keep worker socket paths under the sun_path limit
- [#972](https://github.com/PrimeIntellect-ai/prime-agent/pull/972) fix(coding-agent): resolve kernel venv python on Windows
- [#670](https://github.com/PrimeIntellect-ai/prime-agent/pull/670) fix(coding-agent): tolerate unsupported directory fsync
- [#842](https://github.com/PrimeIntellect-ai/prime-agent/pull/842) fix(coding-agent): run %%bash cells in Git Bash on Windows, not WSL bash
- [#827](https://github.com/PrimeIntellect-ai/prime-agent/pull/827) fix(ai): repair invalid unicode escape prefixes
- [#897](https://github.com/PrimeIntellect-ai/prime-agent/pull/897) fix(ai): omit service tier for GitHub Copilot
- [#860](https://github.com/PrimeIntellect-ai/prime-agent/pull/860) fix(coding-agent): include Bedrock in Node bundle
- [#785](https://github.com/PrimeIntellect-ai/prime-agent/pull/785) fix(runtime): use SDK HTTP client factory for streamable MCP transport
- [#911](https://github.com/PrimeIntellect-ai/prime-agent/pull/911) fix(coding-agent): preserve sessions during daemon startup
- [#773](https://github.com/PrimeIntellect-ai/prime-agent/pull/773) fix: npm 10+ compatibility across the update and install surfaces
- [#1002](https://github.com/PrimeIntellect-ai/prime-agent/pull/1002) fix(windows): terminate orphaned process trees, not just their roots
- [#975](https://github.com/PrimeIntellect-ai/prime-agent/pull/975) fix(tui): recover autocomplete after provider rejection

## Tier 2 — High value, more review or narrower reach

- [#892](https://github.com/PrimeIntellect-ai/prime-agent/pull/892) fix(coding-agent): keep retried agent messages on one supervisor journal key — no GitHub checks recorded
- [#650](https://github.com/PrimeIntellect-ai/prime-agent/pull/650) fix(coding-agent): drop compact stream deltas that would leave content gaps — no GitHub checks recorded
- [#1083](https://github.com/PrimeIntellect-ai/prime-agent/pull/1083) fix(ai): emit Bedrock cache points for Claude 5 models — no GitHub checks recorded
- [#710](https://github.com/PrimeIntellect-ai/prime-agent/pull/710) fix(coding-agent): validate session persistence boundaries
- [#816](https://github.com/PrimeIntellect-ai/prime-agent/pull/816) fix(coding-agent): survive provider outages in auto-retry (jitter, backoff cap, Retry-After)
- [#980](https://github.com/PrimeIntellect-ai/prime-agent/pull/980) fix(ai): parse streamed tool arguments incrementally
- [#677](https://github.com/PrimeIntellect-ai/prime-agent/pull/677) fix(coding-agent): wait for child compaction continuation
- [#800](https://github.com/PrimeIntellect-ai/prime-agent/pull/800) fix(coding-agent): answer ACP prompts only once the session admits the next turn
- [#881](https://github.com/PrimeIntellect-ai/prime-agent/pull/881) fix(coding-agent): await post-compaction continuation
- [#909](https://github.com/PrimeIntellect-ai/prime-agent/pull/909) fix(coding-agent): sanitize side-question tool history
- [#835](https://github.com/PrimeIntellect-ai/prime-agent/pull/835) fix(rlm): accept empty Codex model catalogs
- [#888](https://github.com/PrimeIntellect-ai/prime-agent/pull/888) fix(goal): pause blocked autonomous continuation
- [#374](https://github.com/PrimeIntellect-ai/prime-agent/pull/374) fix no-env prime authentication isolation
- [#464](https://github.com/PrimeIntellect-ai/prime-agent/pull/464) fix(coding-agent): make subagent cancellation explicit
- [#727](https://github.com/PrimeIntellect-ai/prime-agent/pull/727) fix(coding-agent): reclaim stale session leases on Windows
- [#763](https://github.com/PrimeIntellect-ai/prime-agent/pull/763) fix(coding-agent): rebuild the kernel venv while a kernel is running on Windows
- [#770](https://github.com/PrimeIntellect-ai/prime-agent/pull/770) fix(prime-agent-runtime): kill subprocess tree on TimeoutExpired to prevent Windows kernel hangs
- [#878](https://github.com/PrimeIntellect-ai/prime-agent/pull/878) fix(coding-agent): prevent input corruption in external editors
- [#756](https://github.com/PrimeIntellect-ai/prime-agent/pull/756) fix(ai): normalize unknown provider stop/status values as structured failures (#707)
- [#779](https://github.com/PrimeIntellect-ai/prime-agent/pull/779) fix(agent): stop parallel tool preflight after abort
- [#803](https://github.com/PrimeIntellect-ai/prime-agent/pull/803) fix(coding-agent): decode large worker frames linearly
- [#858](https://github.com/PrimeIntellect-ai/prime-agent/pull/858) fix(coding-agent): make /login sign-in URL copyable from headless terminals
- [#907](https://github.com/PrimeIntellect-ai/prime-agent/pull/907) fix(launcher): pass root tsconfig to tsx, fix send help flags, match rlm attributes
- [#908](https://github.com/PrimeIntellect-ai/prime-agent/pull/908) fix(coding-agent): stabilize macOS process identity
- [#922](https://github.com/PrimeIntellect-ai/prime-agent/pull/922) fix(coding-agent): spread an unqualified find_models across providers
- [#857](https://github.com/PrimeIntellect-ai/prime-agent/pull/857) fix(coding-agent): keep Homebrew installs package-manager owned
- [#890](https://github.com/PrimeIntellect-ai/prime-agent/pull/890) fix(coding-agent): defer and report heartbeat fires a busy session declines
- [#889](https://github.com/PrimeIntellect-ai/prime-agent/pull/889) fix(coding-agent): make continual harness state reachable from the prompt
- [#906](https://github.com/PrimeIntellect-ai/prime-agent/pull/906) fix(ai): route Copilot Grok 4.5 to responses
- [#1013](https://github.com/PrimeIntellect-ai/prime-agent/pull/1013) fix(ai): declare Smithy dependencies used by Bedrock
- [#998](https://github.com/PrimeIntellect-ai/prime-agent/pull/998) fix(ai): reprice Anthropic cache writes from final stream usage
- [#1004](https://github.com/PrimeIntellect-ai/prime-agent/pull/1004) fix(windows): give a starting kernel long enough to publish its ports
- [#994](https://github.com/PrimeIntellect-ai/prime-agent/pull/994) fix(coding-agent): isolate throwing tool_call extension handlers
- [#830](https://github.com/PrimeIntellect-ai/prime-agent/pull/830) fix(coding-agent): bound JSONL command reads from untrusted local peers
- [#839](https://github.com/PrimeIntellect-ai/prime-agent/pull/839) fix(ai): honor an explicitly configured maxTokens
- [#1112](https://github.com/PrimeIntellect-ai/prime-agent/pull/1112) fix(coding-agent): retain required goal skill with --no-skills
- [#367](https://github.com/PrimeIntellect-ai/prime-agent/pull/367) fix anthropic record-valued tool arguments
- [#1095](https://github.com/PrimeIntellect-ai/prime-agent/pull/1095) fix(coding-agent): wait for the kernel to exit in dispose

## Tier 3 — Useful, but niche or lower impact

- [#834](https://github.com/PrimeIntellect-ai/prime-agent/pull/834) fix(coding-agent): preserve harness state on interrupted writes — draft
- [#977](https://github.com/PrimeIntellect-ai/prime-agent/pull/977) fix(coding-agent): implement standard cron semantics
- [#981](https://github.com/PrimeIntellect-ai/prime-agent/pull/981) fix(coding-agent): coalesce daemon peer synchronization
- [#737](https://github.com/PrimeIntellect-ai/prime-agent/pull/737) fix(coding-agent): preserve extension statuses across daemon sessions
- [#815](https://github.com/PrimeIntellect-ai/prime-agent/pull/815) fix(coding-agent): namespace daemon socket by agent dir
- [#1189](https://github.com/PrimeIntellect-ai/prime-agent/pull/1189) fix(coding-agent): stamp agent messages with the sender's compose time
- [#1140](https://github.com/PrimeIntellect-ai/prime-agent/pull/1140) fix(coding-agent): hide Windows console windows for spawned subprocesses
- [#1185](https://github.com/PrimeIntellect-ai/prime-agent/pull/1185) fix(coding-agent): acknowledge prompts queued during streaming
- [#1017](https://github.com/PrimeIntellect-ai/prime-agent/pull/1017) fix(tui): make packed Quick Start runnable
- [#871](https://github.com/PrimeIntellect-ai/prime-agent/pull/871) fix(ai): map Codex stream errors from nested error fields
- [#1026](https://github.com/PrimeIntellect-ai/prime-agent/pull/1026) fix(installer): handle missing POSIX shell on Windows
- [#910](https://github.com/PrimeIntellect-ai/prime-agent/pull/910) fix(coding-agent): reclaim reused Termux lease pids
- [#912](https://github.com/PrimeIntellect-ai/prime-agent/pull/912) fix(coding-agent): accept sparse leap-day schedules
- [#814](https://github.com/PrimeIntellect-ai/prime-agent/pull/814) fix(tui): handle CJK-aware text wrapping
- [#723](https://github.com/PrimeIntellect-ai/prime-agent/pull/723) fix: doctor flags a daemon whose cached spawn paths are gone
- [#730](https://github.com/PrimeIntellect-ai/prime-agent/pull/730) fix: queued message rendered twice after manual compaction
- [#746](https://github.com/PrimeIntellect-ai/prime-agent/pull/746) fix: use Cmd-V for image paste on macOS
- [#682](https://github.com/PrimeIntellect-ai/prime-agent/pull/682) fix(coding-agent): bridge clipboard writes through Herdr
- [#885](https://github.com/PrimeIntellect-ai/prime-agent/pull/885) fix(coding-agent): reject ctx.ui.custom() under daemon/RPC instead of silent no-op
- [#790](https://github.com/PrimeIntellect-ai/prime-agent/pull/790) fix(coding-agent): cap transcript rendering on session resync
- [#828](https://github.com/PrimeIntellect-ai/prime-agent/pull/828) fix(coding-agent): surface RLM subagent registry persistence failures
- [#791](https://github.com/PrimeIntellect-ai/prime-agent/pull/791) fix(ai): restore Kimi K3 reasoning levels
- [#777](https://github.com/PrimeIntellect-ai/prime-agent/pull/777) fix(ai): include cache tokens in Bedrock total fallback
- [#876](https://github.com/PrimeIntellect-ai/prime-agent/pull/876) fix(tui): enable negotiated tmux hyperlinks
- [#866](https://github.com/PrimeIntellect-ai/prime-agent/pull/866) fix(coding-agent): report the worker exit status when the startup gate fails
- [#859](https://github.com/PrimeIntellect-ai/prime-agent/pull/859) fix(coding-agent): add Prime process marker
- [#1035](https://github.com/PrimeIntellect-ai/prime-agent/pull/1035) fix(coding-agent): show progress during `/refine`
- [#1031](https://github.com/PrimeIntellect-ai/prime-agent/pull/1031) fix(coding-agent): show onboarding skip key
- [#726](https://github.com/PrimeIntellect-ai/prime-agent/pull/726) fix(coding-agent): render belowEditor widgets below the prompt in fullscreen
- [#539](https://github.com/PrimeIntellect-ai/prime-agent/pull/539) Fix model search provider ranking
- [#847](https://github.com/PrimeIntellect-ai/prime-agent/pull/847) fix(ai): attribute OpenRouter requests to Prime Agent
- [#1007](https://github.com/PrimeIntellect-ai/prime-agent/pull/1007) fix(coding-agent): update messaging docs
- [#802](https://github.com/PrimeIntellect-ai/prime-agent/pull/802) fix(coding-agent): show current cwd in session tray
- [#817](https://github.com/PrimeIntellect-ai/prime-agent/pull/817) fix(coding-agent): clear selected session anchors on agent deactivate

## Tier 4 — Strategic, blocked, or high review cost

These may have high absolute impact, but conflicts, draft state, failing checks, size, or breadth make their near-term ROI lower. Review them as separate projects.

- [#657](https://github.com/PrimeIntellect-ai/prime-agent/pull/657) fix(coding-agent): preserve untouched bytes when fuzzy edit matching is used — conflicted
- [#1129](https://github.com/PrimeIntellect-ai/prime-agent/pull/1129) fix(installer): isolate npm tarball install prefix — conflicted; no GitHub checks recorded
- [#1128](https://github.com/PrimeIntellect-ai/prime-agent/pull/1128) fix(coding-agent): preserve saved cwd on daemon resume — conflicted
- [#966](https://github.com/PrimeIntellect-ai/prime-agent/pull/966) fix(coding-agent): invalidate snapshot cache when worker recovery drops operations — conflicted; no GitHub checks recorded
- [#1009](https://github.com/PrimeIntellect-ai/prime-agent/pull/1009) fix(coding-agent): kill the background install command on installer interrupt — conflicted
- [#1146](https://github.com/PrimeIntellect-ai/prime-agent/pull/1146) fix(coding-agent): preserve session-start notifications until UI attach
- [#1038](https://github.com/PrimeIntellect-ai/prime-agent/pull/1038) fix(coding-agent): bound host requests and drain lost-idle executions
- [#974](https://github.com/PrimeIntellect-ai/prime-agent/pull/974) fix(ai): make OAuth waits terminal and leak-free
- [#1107](https://github.com/PrimeIntellect-ai/prime-agent/pull/1107) fix(coding-agent): passivate quiescent roots after restart
- [#961](https://github.com/PrimeIntellect-ai/prime-agent/pull/961) fix(coding-agent): make harness writes transactional
- [#1027](https://github.com/PrimeIntellect-ai/prime-agent/pull/1027) fix(release): integrate verified distribution lifecycle
- [#1053](https://github.com/PrimeIntellect-ai/prime-agent/pull/1053) fix(windows): bring Windows to parity with Linux and macOS
- [#851](https://github.com/PrimeIntellect-ai/prime-agent/pull/851) fix(coding-agent): finalize timed-out worker stops instead of stranding registrations
- [#852](https://github.com/PrimeIntellect-ai/prime-agent/pull/852) fix(coding-agent): self-heal stale worker registrations on resume — conflicted
- [#915](https://github.com/PrimeIntellect-ai/prime-agent/pull/915) Fix/process execution security
- [#795](https://github.com/PrimeIntellect-ai/prime-agent/pull/795) fix(agent): fail closed on provider quota exhaustion — draft
- [#565](https://github.com/PrimeIntellect-ai/prime-agent/pull/565) fix(coding-agent): separate active commands from queued input — failing checks
- [#427](https://github.com/PrimeIntellect-ai/prime-agent/pull/427) Fix Ghostty inline image placement — draft

## Superseded, overlapping, or folded into a preferred PR

- [#640](https://github.com/PrimeIntellect-ai/prime-agent/pull/640) fix(agent): discover Codex models with compatible version — superseded by applied #1070.
- [#646](https://github.com/PrimeIntellect-ai/prime-agent/pull/646) fix(ai): omit service_tier for GitHub Copilot Responses models — superseded by #897.
- [#664](https://github.com/PrimeIntellect-ai/prime-agent/pull/664) fix(coding-agent): hide console windows for background child processes — superseded by the comprehensive #1140.
- [#685](https://github.com/PrimeIntellect-ai/prime-agent/pull/685) fix(coding-agent): reject ctx.ui.custom() with a clear error under the daemon architecture — superseded by #885.
- [#687](https://github.com/PrimeIntellect-ai/prime-agent/pull/687) fix(coding-agent): use portable worker socket paths — superseded by #722.
- [#706](https://github.com/PrimeIntellect-ai/prime-agent/pull/706) fix installer fallback for protected npm prefixes — prefer #1129's isolated owned-prefix design.
- [#708](https://github.com/PrimeIntellect-ai/prime-agent/pull/708) fix(ai): normalize unknown provider stop reasons — prefer the smaller, broader-provider #756.
- [#721](https://github.com/PrimeIntellect-ai/prime-agent/pull/721) fix: wait for scheduled post-compaction continuation before reporting idle — superseded by #881.
- [#724](https://github.com/PrimeIntellect-ai/prime-agent/pull/724) fix: rank configured providers first in model selector search — prefer #539, which preserves relevance before provider-status tie-breaking.
- [#778](https://github.com/PrimeIntellect-ai/prime-agent/pull/778) fix(tui): recover autocomplete after provider failures — superseded by the more complete #975.
- [#786](https://github.com/PrimeIntellect-ai/prime-agent/pull/786) fix(daemon): namespace socket by agent dir without lengthening paths — prefer the newer #815.
- [#854](https://github.com/PrimeIntellect-ai/prime-agent/pull/854) fix(runtime): accept RLMSpawnHandle in delete_subagent and align name attributes — folded into #907.
- [#855](https://github.com/PrimeIntellect-ai/prime-agent/pull/855) fix(coding-agent): make rlm.find_models represent every provider and ignore word order — overlaps preferred, smaller #922.
- [#902](https://github.com/PrimeIntellect-ai/prime-agent/pull/902) fix(cli): remove stale send delivery flags from help — folded into #907.
- [#1019](https://github.com/PrimeIntellect-ai/prime-agent/pull/1019) fix(packaging): support branded R2 package artifacts — folded into #1027.

## Already applied

- [#1087](https://github.com/PrimeIntellect-ai/prime-agent/pull/1087) fix(coding-agent): renew imported session IDs *
- [#1081](https://github.com/PrimeIntellect-ai/prime-agent/pull/1081) fix(coding-agent): keep shutdown admission through delays *
- [#1079](https://github.com/PrimeIntellect-ai/prime-agent/pull/1079) fix(coding-agent): delete empty draft sessions on shutdown and sweep ghosts at startup *
- [#1076](https://github.com/PrimeIntellect-ai/prime-agent/pull/1076) fix(coding-agent): clarify active session message errors *
- [#1070](https://github.com/PrimeIntellect-ai/prime-agent/pull/1070) fix(coding-agent): use installed Codex CLI version for model discovery *
- [#1067](https://github.com/PrimeIntellect-ai/prime-agent/pull/1067) fix(package-manager): `~/.agents/skills` incorrectly scoped as project when CWD is under home directory *
- [#1058](https://github.com/PrimeIntellect-ai/prime-agent/pull/1058) fix(coding-agent): prefer durable IDs in agent message labels *
- [#905](https://github.com/PrimeIntellect-ai/prime-agent/pull/905) fix(coding-agent): load tsconfig in source launcher *
