# Catalog test provenance

Root checked `crates/pa-tui/tests/agents_view_catalog_settle_carry.rs`. Git blob is identical in upstream `v0.10.0`, native HEAD, and current validation working file: `5646601c22e9a39187be86a00fd743c3df026f18`.

Commands: `git log --follow --max-count=8 --date=iso-strict --format=... -- <path>`; `git rev-parse v0.10.0:<path>`; `git rev-parse HEAD:<path>`; `git hash-object <path>`, all in the validation worktree.

History: introduced in `39bc99a91` by author `kt`, committed by GitHub, “Port Prime Agent to Rust (#2524)”. Later file edits: `24285eb03` and `7fa55b6b9`, author Sebastian Müller. These tests originate upstream, not in this local reconciliation or its child agents.

Origin does not establish the cause of observed failures. Current root verification occurred before any catalog repair.
