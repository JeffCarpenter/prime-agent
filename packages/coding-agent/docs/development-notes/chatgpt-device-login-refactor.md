# ChatGPT Device Login Refactor

## Summary

Prime Agent's ChatGPT authentication used a localhost OAuth callback and constrained authentication dialogs to a narrow content frame. The interactive flow also identified GitHub Copilot's polling behavior through a hardcoded provider ID, so it could not represent ChatGPT's device-code flow cleanly.

Implementation commit: `d4e95929 fix(auth): use ChatGPT device login`

## Findings

- `packages/coding-agent/src/modes/interactive/auth-flows.ts` treated callback-server authentication as the primary browser flow.
- Device-flow waiting behavior was hardcoded to `github-copilot`.
- A manual redirect-URL promise was allocated for every OAuth provider, even when the provider did not accept manual callback input.
- Authentication overlays used `maxContentWidth: 88`, which could render long authentication URLs in an unnecessarily narrow frame.
- `packages/ai/src/utils/oauth/openai-codex.ts` implemented authorization-code login through a local server on port 1455 rather than ChatGPT Device Login.

## Verified Device Login Protocol

The implementation was checked against the current [`openai/codex`](https://github.com/openai/codex) device-login implementation and app-server documentation using Context7 and DeepWiki.

1. Request a user code from `POST https://auth.openai.com/api/accounts/deviceauth/usercode` with the Codex `client_id`.
2. Display `https://auth.openai.com/codex/device` and the returned `user_code`.
3. Poll `POST https://auth.openai.com/api/accounts/deviceauth/token` using `device_auth_id` and `user_code`.
4. Treat HTTP 403 and 404 poll responses as authorization pending.
5. Respect the server-provided polling interval and stop after 15 minutes.
6. Exchange the returned `authorization_code` using the returned `code_verifier` and redirect URI `https://auth.openai.com/deviceauth/callback`.
7. Store the access token, refresh token, expiration time, and ChatGPT account ID.

The Codex app-server represents this as `chatgptDeviceCode` and returns a verification URL and user code to its frontend. Relevant upstream documentation includes the [Codex app-server README](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md) and the device flow implementation in [`device_code_auth.rs`](https://github.com/openai/codex/blob/main/codex-rs/login/src/device_code_auth.rs).

## Changes

### OAuth provider contract

Added optional `loginFlow: "device"` metadata to `OAuthProviderInterface`. ChatGPT and GitHub Copilot now declare device login through this provider metadata.

This removes provider-ID knowledge from the interactive UI and allows future device-flow providers to receive the same behavior without additional conditionals.

### Interactive authentication

Refactored `auth-flows.ts` to:

- Detect device login from provider metadata.
- Show the browser URL, extracted verification code, and a waiting state for device flows.
- Create and expose manual callback input only for providers using a local callback server.
- Use full-width authentication overlays so URLs and instructions are not constrained to the former narrow frame.

### ChatGPT authentication

Replaced the localhost callback implementation with ChatGPT Device Login. The new implementation includes:

- Strict validation of device-code, poll, and token responses.
- Compatibility with `user_code` and `usercode` response field spellings.
- Numeric and string polling-interval parsing with a safe default.
- A minimum one-second polling interval.
- HTTP 403/404 pending handling.
- A 15-minute deadline.
- Abort-aware requests and waits normalized to `Login cancelled`.
- Cleanup of abort listeners after polling delays complete.
- Server-provided PKCE verifier use during token exchange.
- Base64url-safe JWT decoding for ChatGPT account ID extraction.

Token refresh behavior remains supported.

## Files Changed

- `packages/ai/src/utils/oauth/types.ts`
- `packages/ai/src/utils/oauth/github-copilot.ts`
- `packages/ai/src/utils/oauth/openai-codex.ts`
- `packages/ai/test/openai-codex-oauth.test.ts`
- `packages/ai/CHANGELOG.md`
- `packages/coding-agent/src/modes/interactive/auth-flows.ts`
- `packages/coding-agent/CHANGELOG.md`

## Validation

- `packages/ai/test/openai-codex-oauth.test.ts`: 3 tests passed.
- Successful device login coverage verifies URL/code presentation, polling delay, pending responses, the returned PKCE verifier, redirect URI, credentials, and account ID.
- Cancellation coverage verifies aborting while waiting to poll returns `Login cancelled`.
- Refresh failure coverage remains passing.
- `pnpm run check`: passed, including formatting, linting, type checking, installer rendering, and browser smoke checks.
- `git diff --check`: passed.
