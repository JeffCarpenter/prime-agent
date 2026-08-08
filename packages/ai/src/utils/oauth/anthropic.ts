/** Anthropic OAuth flow for Claude Pro/Max subscriptions. */

import { generatePKCE } from "./pkce.js";
import type { OAuthCredentials, OAuthLoginCallbacks, OAuthPrompt, OAuthProviderInterface } from "./types.js";

const decode = (value: string) => atob(value);
const CLIENT_ID = decode("OWQxYzI1MGEtZTYxYi00NGQ5LTg4ZWQtNTk0NGQxOTYyZjVl");
const AUTHORIZE_URL = "https://claude.ai/oauth/authorize";
const TOKEN_URL = "https://platform.claude.com/v1/oauth/token";
const REDIRECT_URI = "https://platform.claude.com/oauth/code/callback";
const SCOPES =
	"org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload";
const REQUEST_TIMEOUT_MS = 30_000;
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

type AuthorizationResult = {
	code: string;
	state: string;
};

function loginCancelledError(): Error {
	return new Error("Login cancelled");
}

function throwIfAborted(signal?: AbortSignal): void {
	if (signal?.aborted) throw loginCancelledError();
}

function requireRecord(value: unknown, context: string): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`Invalid Anthropic ${context} response`);
	}
	return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, field: string, context: string): string {
	const value = record[field];
	if (typeof value !== "string" || value.length === 0) {
		throw new Error(`Invalid Anthropic ${context} response: missing ${field}`);
	}
	return value;
}

function requireExpiresIn(record: Record<string, unknown>, context: string): number {
	const value = record.expires_in;
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
		throw new Error(`Invalid Anthropic ${context} response: missing expires_in`);
	}
	return value;
}

async function responseError(response: Response): Promise<string> {
	const body = await response.text().catch(() => "");
	return body || response.statusText || "Unknown error";
}

async function postJson(
	url: string,
	body: Record<string, string>,
	context: string,
	signal?: AbortSignal,
): Promise<Record<string, unknown>> {
	throwIfAborted(signal);
	const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
	const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

	let response: Response;
	try {
		response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify(body),
			signal: requestSignal,
		});
	} catch (error) {
		if (signal?.aborted) throw loginCancelledError();
		if (timeoutSignal.aborted) throw new Error(`Anthropic ${context} request timed out`);
		throw new Error(`Anthropic ${context} request failed: ${error instanceof Error ? error.message : String(error)}`);
	}

	if (!response.ok) {
		throw new Error(`Anthropic ${context} failed (${response.status}): ${await responseError(response)}`);
	}

	let data: unknown;
	try {
		data = await response.json();
	} catch {
		throw new Error(`Anthropic ${context} returned invalid JSON`);
	}
	return requireRecord(data, context);
}

function parseAuthorizationInput(input: string, expectedState: string): AuthorizationResult {
	const value = input.trim();
	if (!value) throw new Error("Missing authorization code");

	let code: string | undefined;
	let state: string | undefined;
	try {
		const url = new URL(value);
		code = url.searchParams.get("code") ?? undefined;
		state = url.searchParams.get("state") ?? undefined;
	} catch {
		const separator = value.lastIndexOf("#");
		if (separator >= 0) {
			code = value.slice(0, separator);
			state = value.slice(separator + 1);
		} else if (value.includes("code=")) {
			const params = new URLSearchParams(value);
			code = params.get("code") ?? undefined;
			state = params.get("state") ?? undefined;
		} else {
			code = value;
		}
	}

	if (!code) throw new Error("Missing authorization code");
	const resolvedState = state || expectedState;
	if (resolvedState !== expectedState) throw new Error("OAuth state mismatch");
	return { code, state: resolvedState };
}

function credentialsFromTokenResponse(data: Record<string, unknown>, context: string): OAuthCredentials {
	const expiresIn = requireExpiresIn(data, context);
	return {
		access: requireString(data, "access_token", context),
		refresh: requireString(data, "refresh_token", context),
		expires: Date.now() + expiresIn * 1000 - EXPIRY_BUFFER_MS,
	};
}

async function exchangeAuthorizationCode(
	authorization: AuthorizationResult,
	verifier: string,
	signal?: AbortSignal,
): Promise<OAuthCredentials> {
	const data = await postJson(
		TOKEN_URL,
		{
			grant_type: "authorization_code",
			client_id: CLIENT_ID,
			code: authorization.code,
			state: authorization.state,
			redirect_uri: REDIRECT_URI,
			code_verifier: verifier,
		},
		"token exchange",
		signal,
	);
	return credentialsFromTokenResponse(data, "token exchange");
}

/**
 * Completes Anthropic's CLI-compatible hosted-code login.
 *
 * Anthropic does not expose RFC 8628 device authorization through its SDK.
 * Its browser handoff uses authorization code + PKCE and displays a code that
 * the user returns to the CLI after the hosted callback completes.
 */
export async function loginAnthropic(options: {
	onAuth: (info: { url: string; instructions?: string }) => void;
	onPrompt: (prompt: OAuthPrompt) => Promise<string>;
	onProgress?: (message: string) => void;
	signal?: AbortSignal;
}): Promise<OAuthCredentials> {
	throwIfAborted(options.signal);
	const { verifier, challenge } = await generatePKCE();
	throwIfAborted(options.signal);

	const authParams = new URLSearchParams({
		code: "true",
		client_id: CLIENT_ID,
		response_type: "code",
		redirect_uri: REDIRECT_URI,
		scope: SCOPES,
		code_challenge: challenge,
		code_challenge_method: "S256",
		state: verifier,
	});

	options.onAuth({
		url: `${AUTHORIZE_URL}?${authParams.toString()}`,
		instructions: "Complete sign-in, then copy the authorization code shown by Anthropic.",
	});
	const input = await options.onPrompt({
		message: "Paste Anthropic authorization code",
		placeholder: "code#state",
	});
	throwIfAborted(options.signal);
	const authorization = parseAuthorizationInput(input, verifier);

	options.onProgress?.("Exchanging authorization code for tokens...");
	return exchangeAuthorizationCode(authorization, verifier, options.signal);
}

export async function refreshAnthropicToken(refreshToken: string): Promise<OAuthCredentials> {
	const data = await postJson(
		TOKEN_URL,
		{
			grant_type: "refresh_token",
			client_id: CLIENT_ID,
			refresh_token: refreshToken,
		},
		"token refresh",
	);
	return credentialsFromTokenResponse(data, "token refresh");
}

export const anthropicOAuthProvider: OAuthProviderInterface = {
	id: "anthropic",
	name: "Anthropic (Claude Pro/Max)",
	loginFlow: "manual-code",

	login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
		return loginAnthropic({
			onAuth: callbacks.onAuth,
			onPrompt: callbacks.onPrompt,
			onProgress: callbacks.onProgress,
			signal: callbacks.signal,
		});
	},

	refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
		return refreshAnthropicToken(credentials.refresh);
	},

	getApiKey(credentials: OAuthCredentials): string {
		return credentials.access;
	},
};
