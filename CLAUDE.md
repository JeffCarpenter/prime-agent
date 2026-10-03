# Claude Code Notes

See AGENTS.md for project rules.

## Code Intelligence

- Prefer the built-in `LSP` tool (goToDefinition, findReferences, hover, documentSymbol, workspaceSymbol, call hierarchy) over `mcpls`, reading whole files, or brute-force grep.
- `LSP` has no diagnostics operation. Use `npm run check` for diagnostics.
- This repo uses TypeScript 7, which ships no `tsserver.js`, so the stock `typescript-lsp` plugin (`typescript-language-server`) fails. The user-level `typescript7-lsp@ts7-lsp` plugin (`~/.claude/local-plugins/ts7-lsp`, running `/usr/sbin/tsc --lsp --stdio`) replaces it. If `LSP` reports "provides no tsserver.js", that plugin is disabled or missing. A "server is starting" error right after a plugin reload is transient; retry.
