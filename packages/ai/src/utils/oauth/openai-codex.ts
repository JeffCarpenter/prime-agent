/** OpenAI Codex (ChatGPT OAuth) device login flow. */

import type { OAuthCredentials, OAuthLoginCallbacks, OAuthProviderInterface } from "./types.js";

const AUTH_BASE_URL = "https://auth.openai.com";
const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const DEVICE_CODE_URL = `${AUTH_BASE_URL}/api/accounts/deviceauth/usercode`;
const DEVICE_TOKEN_URL = `${AUTH_BASE_URL}/api/accounts/deviceauth/token`;
const DEVICE_VERIFICATION_URL = `${AUTH_BASE_URL}/codex/device`;
const DEVICE_REDIRECT_URI = `${AUTH_BASE_URL}/deviceauth/callback`;
const TOKEN_URL = `${AUTH_BASE_URL}/oauth/token`;
const DEVICE_LOGIN_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_SECONDS = 5;
const JWT_CLAIM_PATH = "https://api.openai.com/auth";

type TokenSuccess = { type: "success"; access: string; refresh: string; expires: number };
type TokenFailure = { type: "failed"; message: string; status?: number };
type TokenResult = TokenSuccess | TokenFailure;

type DeviceCode = {
	deviceAuthId: string;
	userCode: string;
	intervalMs: number;
};

type DeviceAuthorization = {
	authorizationCode: string;
	codeVerifier: string;
};

type JwtPayload = {
	[JWT_CLAIM_PATH]?: {
		chatgpt_account_id?: string;
	};
	[key: string]: unknown;
};

function loginCancelledError(): Error {
	return new Error("Login cancelled");
}

function throwIfAborted(signal?: AbortSignal): void {
	if (signal?.aborted) throw loginCancelledError();
}

async function fetchDuringLogin(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
	try {
		return await fetch(url, { ...init, signal });
	} catch (error) {
		if (signal?.aborted) throw loginCancelledError();
		throw error;
	}
}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(loginCancelledError());
			return;
		}

		const onAbort = () => {
			clearTimeout(timeout);
			reject(loginCancelledError());
		};
		const timeout = setTimeout(() => {
			signal?.removeEventListener("abort", onAbort);
			resolve();
		}, ms);
		signal?.addEventListener("abort", onAbort, { once: true });
	});
}

async function responseError(response: Response): Promise<string> {
	const body = await response.text().catch(() => "");
	return body || response.statusText || "Unknown error";
}

function requireRecord(value: unknown, context: string): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`Invalid ${context} response`);
	}
	return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, field: string, context: string): string {
	const value = record[field];
	if (typeof value !== "string" || value.length === 0) {
		throw new Error(`Invalid ${context} response: missing ${field}`);
	}
	return value;
}

function parsePollInterval(value: unknown): number {
	const seconds = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
	if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_POLL_INTERVAL_SECONDS * 1000;
	return Math.max(1000, Math.floor(seconds * 1000));
}

async function requestDeviceCode(signal?: AbortSignal): Promise<DeviceCode> {
	throwIfAborted(signal);
	const response = await fetchDuringLogin(
		DEVICE_CODE_URL,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ client_id: CLIENT_ID }),
		},
		signal,
	);

	if (!response.ok) {
		throw new Error(`OpenAI Codex device login failed (${response.status}): ${await responseError(response)}`);
	}

	const data = requireRecord(await response.json(), "device code");
	const userCode = data.user_code ?? data.usercode;
	if (typeof userCode !== "string" || userCode.length === 0) {
		throw new Error("Invalid device code response: missing user_code");
	}

	return {
		deviceAuthId: requireString(data, "device_auth_id", "device code"),
		userCode,
		intervalMs: parsePollInterval(data.interval),
	};
}

async function pollForDeviceAuthorization(device: DeviceCode, signal?: AbortSignal): Promise<DeviceAuthorization> {
	const deadline = Date.now() + DEVICE_LOGIN_TIMEOUT_MS;

	while (Date.now() < deadline) {
		await abortableSleep(Math.min(device.intervalMs, deadline - Date.now()), signal);
		throwIfAborted(signal);

		const response = await fetchDuringLogin(
			DEVICE_TOKEN_URL,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ device_auth_id: device.deviceAuthId, user_code: device.userCode }),
			},
			signal,
		);

		if (response.status === 403 || response.status === 404) continue;
		if (!response.ok) {
			throw new Error(
				`OpenAI Codex device authorization failed (${response.status}): ${await responseError(response)}`,
			);
		}

		const data = requireRecord(await response.json(), "device authorization");
		requireString(data, "code_challenge", "device authorization");
		return {
			authorizationCode: requireString(data, "authorization_code", "device authorization"),
			codeVerifier: requireString(data, "code_verifier", "device authorization"),
		};
	}

	throw new Error("OpenAI Codex device login timed out");
}

function decodeJwt(token: string): JwtPayload | null {
	try {
		const payload = token.split(".")[1];
		if (!payload) return null;
		const base64 = payload
			.replace(/-/g, "+")
			.replace(/_/g, "/")
			.padEnd(Math.ceil(payload.length / 4) * 4, "=");
		return JSON.parse(atob(base64)) as JwtPayload;
	} catch {
		return null;
	}
}

async function exchangeAuthorizationCode(
	code: string,
	verifier: string,
	redirectUri: string,
	signal?: AbortSignal,
): Promise<TokenResult> {
	const response = await fetchDuringLogin(
		TOKEN_URL,
		{
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "authorization_code",
				client_id: CLIENT_ID,
				code,
				code_verifier: verifier,
				redirect_uri: redirectUri,
			}),
		},
		signal,
	);

	if (!response.ok) {
		return {
			type: "failed",
			status: response.status,
			message: `OpenAI Codex token exchange failed (${response.status}): ${await responseError(response)}`,
		};
	}

	const data = requireRecord(await response.json(), "token exchange");
	const access = data.access_token;
	const refresh = data.refresh_token;
	const expiresIn = data.expires_in;
	if (typeof access !== "string" || typeof refresh !== "string" || typeof expiresIn !== "number") {
		return { type: "failed", message: "OpenAI Codex token exchange response missing fields" };
	}
	return { type: "success", access, refresh, expires: Date.now() + expiresIn * 1000 };
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResult> {
	try {
		const response = await fetch(TOKEN_URL, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "refresh_token",
				refresh_token: refreshToken,
				client_id: CLIENT_ID,
			}),
		});

		if (!response.ok) {
			return {
				type: "failed",
				status: response.status,
				message: `OpenAI Codex token refresh failed (${response.status}): ${await responseError(response)}`,
			};
		}

		const data = requireRecord(await response.json(), "token refresh");
		const access = data.access_token;
		const refresh = data.refresh_token;
		const expiresIn = data.expires_in;
		if (typeof access !== "string" || typeof refresh !== "string" || typeof expiresIn !== "number") {
			return { type: "failed", message: "OpenAI Codex token refresh response missing fields" };
		}
		return { type: "success", access, refresh, expires: Date.now() + expiresIn * 1000 };
	} catch (error) {
		return {
			type: "failed",
			message: `OpenAI Codex token refresh error: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

function getAccountId(accessToken: string): string | null {
	const accountId = decodeJwt(accessToken)?.[JWT_CLAIM_PATH]?.chatgpt_account_id;
	return typeof accountId === "string" && accountId.length > 0 ? accountId : null;
}

export async function loginOpenAICodex(options: {
	onAuth: (info: { url: string; instructions?: string }) => void;
	signal?: AbortSignal;
}): Promise<OAuthCredentials> {
	const device = await requestDeviceCode(options.signal);
	options.onAuth({ url: DEVICE_VERIFICATION_URL, instructions: `Enter code: ${device.userCode}` });
	const authorization = await pollForDeviceAuthorization(device, options.signal);
	const tokenResult = await exchangeAuthorizationCode(
		authorization.authorizationCode,
		authorization.codeVerifier,
		DEVICE_REDIRECT_URI,
		options.signal,
	);
	if (tokenResult.type !== "success") throw new Error(tokenResult.message);

	const accountId = getAccountId(tokenResult.access);
	if (!accountId) throw new Error("Failed to extract accountId from token");
	return {
		access: tokenResult.access,
		refresh: tokenResult.refresh,
		expires: tokenResult.expires,
		accountId,
	};
}

export async function refreshOpenAICodexToken(refreshToken: string): Promise<OAuthCredentials> {
	const result = await refreshAccessToken(refreshToken);
	if (result.type !== "success") throw new Error(result.message);
	const accountId = getAccountId(result.access);
	if (!accountId) throw new Error("Failed to extract accountId from token");
	return { access: result.access, refresh: result.refresh, expires: result.expires, accountId };
}

export const openaiCodexOAuthProvider: OAuthProviderInterface = {
	id: "openai-codex",
	name: "ChatGPT Plus/Pro (Codex Subscription)",
	loginFlow: "device",
	browserLoginFlow: "manual-code",

	login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
		return loginOpenAICodex({ onAuth: callbacks.onAuth, signal: callbacks.signal });
	},

	refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
		return refreshOpenAICodexToken(credentials.refresh);
	},

	getApiKey(credentials: OAuthCredentials): string {
		return credentials.access;
	},
};
