/** Anthropic OAuth flow for Claude Pro/Max subscriptions. */

import { createServer, type Server } from "node:http";
import { oauthErrorHtml, oauthSuccessHtml } from "./oauth-page.js";
import { generatePKCE } from "./pkce.js";
import {
	connectOAuthManualInput,
	createOAuthTerminalWaiter,
	type OAuthTerminalWaiter,
	toOAuthLoginError,
} from "./terminal-waiter.js";
import {
	type OAuthCredentials,
	type OAuthLoginCallbacks,
	OAuthLoginError,
	type OAuthLoginErrorSource,
	type OAuthPrompt,
	type OAuthProviderInterface,
} from "./types.js";

type AuthorizationResult = { code: string; state: string };

const decode = (value: string) => atob(value);
const CLIENT_ID = decode("OWQxYzI1MGEtZTYxYi00NGQ5LTg4ZWQtNTk0NGQxOTYyZjVl");
const AUTHORIZE_URL = "https://claude.ai/oauth/authorize";
const TOKEN_URL = "https://platform.claude.com/v1/oauth/token";
const HOSTED_CODE_REDIRECT_URI = "https://platform.claude.com/oauth/code/callback";
const CALLBACK_HOST = process.env.PI_OAUTH_CALLBACK_HOST || "127.0.0.1";
const CALLBACK_PORT = 53692;
const CALLBACK_PATH = "/callback";
const BROWSER_REDIRECT_URI = `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`;
const SCOPES =
	"org:create_api_key user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload";
const REQUEST_TIMEOUT_MS = 30_000;
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

type CallbackServer = {
	server: Server;
	waiter: OAuthTerminalWaiter<AuthorizationResult>;
};

function loginCancelledError(): OAuthLoginError {
	return new OAuthLoginError("cancelled", "signal", "Login cancelled");
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

function parseAuthorizationInput(
	input: string,
	expectedState: string,
	source: OAuthLoginErrorSource = "manual",
): AuthorizationResult {
	const value = input.trim();
	if (!value) throw new OAuthLoginError("invalid_callback", source, "Missing authorization code");

	let code: string | undefined;
	let state: string | undefined;
	let error: string | undefined;
	try {
		const url = new URL(value);
		code = url.searchParams.get("code") ?? undefined;
		state = url.searchParams.get("state") ?? undefined;
		error = url.searchParams.get("error") ?? undefined;
	} catch {
		const separator = value.lastIndexOf("#");
		if (separator >= 0) {
			code = value.slice(0, separator);
			state = value.slice(separator + 1);
		} else if (value.includes("code=")) {
			const params = new URLSearchParams(value);
			code = params.get("code") ?? undefined;
			state = params.get("state") ?? undefined;
			error = params.get("error") ?? undefined;
		} else if (value.includes("error=")) {
			const params = new URLSearchParams(value);
			error = params.get("error") ?? undefined;
			state = params.get("state") ?? undefined;
		} else {
			code = value;
		}
	}

	if (error) {
		throw new OAuthLoginError("authorization_error", source, `Anthropic authentication failed: ${error}`);
	}
	if (!code) throw new OAuthLoginError("invalid_callback", source, "Missing authorization code");
	const resolvedState = state || expectedState;
	if (resolvedState !== expectedState) throw new OAuthLoginError("state_mismatch", source, "OAuth state mismatch");
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
	redirectUri: string,
	signal?: AbortSignal,
): Promise<OAuthCredentials> {
	const data = await postJson(
		TOKEN_URL,
		{
			grant_type: "authorization_code",
			client_id: CLIENT_ID,
			code: authorization.code,
			state: authorization.state,
			redirect_uri: redirectUri,
			code_verifier: verifier,
		},
		"token exchange",
		signal,
	);
	return credentialsFromTokenResponse(data, "token exchange");
}

function createAuthorizationUrl(challenge: string, state: string, redirectUri: string): string {
	const authParams = new URLSearchParams({
		code: "true",
		client_id: CLIENT_ID,
		response_type: "code",
		redirect_uri: redirectUri,
		scope: SCOPES,
		code_challenge: challenge,
		code_challenge_method: "S256",
		state,
	});
	return `${AUTHORIZE_URL}?${authParams.toString()}`;
}

async function startCallbackServer(options: {
	expectedState: string;
	callbackTimeoutMs?: number;
	signal?: AbortSignal;
}): Promise<CallbackServer> {
	throwIfAborted(options.signal);
	const waiter = createOAuthTerminalWaiter<AuthorizationResult>({
		timeoutMs: options.callbackTimeoutMs,
		signal: options.signal,
	});
	return new Promise((resolve, reject) => {
		const server = createServer((request, response) => {
			try {
				const url = new URL(request.url || "", "http://localhost");
				if (url.pathname !== CALLBACK_PATH) {
					response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
					response.end(oauthErrorHtml("Callback route not found."));
					return;
				}

				const error = url.searchParams.get("error");
				if (error) {
					response.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
					response.end(oauthErrorHtml("Anthropic authentication did not complete.", `Error: ${error}`));
					waiter.fail(
						new OAuthLoginError("authorization_error", "browser", `Anthropic authentication failed: ${error}`),
					);
					return;
				}

				const code = url.searchParams.get("code");
				const state = url.searchParams.get("state");
				if (!code || !state) {
					response.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
					response.end(oauthErrorHtml("Missing code or state parameter."));
					waiter.fail(new OAuthLoginError("invalid_callback", "browser", "Missing code or state parameter"));
					return;
				}
				if (state !== options.expectedState) {
					response.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
					response.end(oauthErrorHtml("State mismatch."));
					waiter.fail(new OAuthLoginError("state_mismatch", "browser", "OAuth state mismatch"));
					return;
				}

				response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
				response.end(oauthSuccessHtml("Anthropic authentication completed. You can close this window."));
				waiter.succeed({ code, state });
			} catch (error) {
				response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
				response.end("Internal error");
				waiter.fail(toOAuthLoginError(error, "invalid_callback", "browser"));
			}
		});

		const onStartupError = (error: Error) => {
			const loginError = new OAuthLoginError(
				"callback_server_error",
				"server",
				`Could not start Anthropic callback server: ${error.message}`,
				{ cause: error },
			);
			waiter.fail(loginError);
			reject(loginError);
		};
		server.once("error", onStartupError);
		server.listen(CALLBACK_PORT, CALLBACK_HOST, () => {
			server.removeListener("error", onStartupError);
			server.on("error", (error) => {
				waiter.fail(toOAuthLoginError(error, "callback_server_error", "server"));
			});
			resolve({
				server,
				waiter,
			});
		});
	});
}

async function closeServer(server: Server): Promise<void> {
	if (!server.listening) return;
	await new Promise<void>((resolve, reject) => {
		server.close((error) => {
			if (error) reject(error);
			else resolve();
		});
		server.closeIdleConnections();
	});
}

/**
 * Completes Anthropic's CLI-compatible hosted-code login.
 *
 * Anthropic does not expose an RFC 8628 device authorization endpoint.
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

	options.onAuth({
		url: createAuthorizationUrl(challenge, verifier, HOSTED_CODE_REDIRECT_URI),
		instructions: "Complete sign-in, then copy the authorization code shown by Anthropic.",
	});
	const input = await options.onPrompt({
		message: "Paste Anthropic authorization code",
		placeholder: "code#state",
	});
	throwIfAborted(options.signal);
	const authorization = parseAuthorizationInput(input, verifier);

	options.onProgress?.("Exchanging authorization code for tokens...");
	return exchangeAuthorizationCode(authorization, verifier, HOSTED_CODE_REDIRECT_URI, options.signal);
}

/** Completes Anthropic authorization code + PKCE through a localhost callback. */
export async function loginAnthropicBrowser(options: {
	onAuth: (info: { url: string; instructions?: string }) => void;
	onManualCodeInput?: () => Promise<string>;
	onProgress?: (message: string) => void;
	signal?: AbortSignal;
	callbackTimeoutMs?: number;
}): Promise<OAuthCredentials> {
	throwIfAborted(options.signal);
	const { verifier, challenge } = await generatePKCE();
	const callbackServer = await startCallbackServer({
		expectedState: verifier,
		callbackTimeoutMs: options.callbackTimeoutMs,
		signal: options.signal,
	});

	try {
		throwIfAborted(options.signal);
		options.onAuth({
			url: createAuthorizationUrl(challenge, verifier, BROWSER_REDIRECT_URI),
			instructions: "Complete sign-in in your browser. The local callback will finish authentication automatically.",
		});
		if (options.onManualCodeInput) {
			connectOAuthManualInput(callbackServer.waiter, options.onManualCodeInput, (input) =>
				parseAuthorizationInput(input, verifier),
			);
		}
		const authorization = await callbackServer.waiter.wait();
		throwIfAborted(options.signal);
		options.onProgress?.("Exchanging authorization code for tokens...");
		return await exchangeAuthorizationCode(authorization, verifier, BROWSER_REDIRECT_URI, options.signal);
	} finally {
		callbackServer.waiter.fail(new OAuthLoginError("cancelled", "server", "OAuth callback wait closed"));
		await closeServer(callbackServer.server);
	}
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
	browserLoginFlow: "callback",
	usesCallbackServer: true,

	login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
		if (callbacks.loginFlow === "browser") {
			return loginAnthropicBrowser({
				onAuth: callbacks.onAuth,
				onManualCodeInput: callbacks.onManualCodeInput,
				onProgress: callbacks.onProgress,
				signal: callbacks.signal,
				callbackTimeoutMs: callbacks.callbackTimeoutMs,
			});
		}
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
