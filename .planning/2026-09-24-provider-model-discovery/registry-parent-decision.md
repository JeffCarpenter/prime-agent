# Registry fallback decision

Use the existing custom-model client defaults for slug-only live entries: reasoning false, text input only, contextWindow 128000, maxTokens 16384. These are client fallback limits, not provider-verified capabilities. Reuse existing default constants if available; do not derive metadata or prices from a different model. Cost remains explicitly unknown. Explain the fallback in a short code comment and worker report. Preserve catalog metadata whenever available. Do not claim these limits were returned by Codex.

Do not generate catalog assets concurrently; report the missing-catalog test evidence.
