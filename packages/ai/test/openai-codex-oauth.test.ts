import { afterEach, describe, expect, it, vi } from "vitest";
import {
	loginOpenAICodex,
	loginOpenAICodexBrowser,
	openaiCodexOAuthProvider,
	refreshOpenAICodexToken,
} from "../src/utils/oauth/openai-codex.js";

function jsonResponse(body: unknown, status: number = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function accessToken(accountId: string): string {
	const payload = btoa(JSON.stringify({ "https://api.openai.com/auth": { chatgpt_account_id: accountId } }))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
	return `header.${payload}.signature`;
}

function deferred<T>(): {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (error: unknown) => void;
} {
	let resolvePromise: ((value: T) => void) | undefined;
	let rejectPromise: ((error: unknown) => void) | undefined;
	const promise = new Promise<T>((resolve, reject) => {
		resolvePromise = resolve;
		rejectPromise = reject;
	});
	return {
		promise,
		resolve: (value) => resolvePromise?.(value),
		reject: (error) => rejectPromise?.(error),
	};
}

describe("OpenAI Codex OAuth", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it("completes ChatGPT device login using the server-provided PKCE verifier", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-08-08T00:00:00Z"));
		const onAuth = vi.fn();
		const token = accessToken("account-123");
		let authorizationPolls = 0;
		const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
			const url = input instanceof Request ? input.url : input.toString();
			if (url.endsWith("/api/accounts/deviceauth/usercode")) {
				expect(JSON.parse(String(init?.body))).toEqual({ client_id: "app_EMoamEEZ73f0CkXaXp7hrann" });
				return jsonResponse({ device_auth_id: "device-id", user_code: "ABCD-EFGH", interval: "2" });
			}
			if (url.endsWith("/api/accounts/deviceauth/token")) {
				expect(JSON.parse(String(init?.body))).toEqual({ device_auth_id: "device-id", user_code: "ABCD-EFGH" });
				authorizationPolls += 1;
				if (authorizationPolls === 1) return jsonResponse({ message: "authorization pending" }, 403);
				return jsonResponse({
					authorization_code: "authorization-code",
					code_challenge: "challenge",
					code_verifier: "server-verifier",
				});
			}
			if (url.endsWith("/oauth/token")) {
				const body = new URLSearchParams(String(init?.body));
				expect(body.get("code")).toBe("authorization-code");
				expect(body.get("code_verifier")).toBe("server-verifier");
				expect(body.get("redirect_uri")).toBe("https://auth.openai.com/deviceauth/callback");
				return jsonResponse({ access_token: token, refresh_token: "refresh-token", expires_in: 3600 });
			}
			throw new Error(`Unexpected fetch URL: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		const loginPromise = loginOpenAICodex({ onAuth });
		await vi.advanceTimersByTimeAsync(0);
		expect(onAuth).toHaveBeenCalledWith({
			url: "https://auth.openai.com/codex/device",
			instructions: "Enter code: ABCD-EFGH",
		});
		await vi.advanceTimersByTimeAsync(2000);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(2000);
		await expect(loginPromise).resolves.toMatchObject({
			access: token,
			refresh: "refresh-token",
			accountId: "account-123",
		});
		expect(fetchMock).toHaveBeenCalledTimes(4);
	});

	it("cancels while waiting to poll and removes its abort listener", async () => {
		vi.useFakeTimers();
		const controller = new AbortController();
		const removeListener = vi.spyOn(controller.signal, "removeEventListener");
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async (): Promise<Response> =>
					jsonResponse({ device_auth_id: "device-id", user_code: "ABCD-EFGH", interval: 30 }),
			),
		);

		const loginPromise = loginOpenAICodex({ onAuth: () => {}, signal: controller.signal });
		await vi.advanceTimersByTimeAsync(0);
		controller.abort();
		await expect(loginPromise).rejects.toMatchObject({
			code: "cancelled",
			source: "signal",
			message: "Login cancelled",
		});
		expect(removeListener).toHaveBeenCalledOnce();
	});

	it("rejects a pre-aborted device login before fetching", async () => {
		const controller = new AbortController();
		controller.abort();
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await expect(loginOpenAICodex({ onAuth: () => {}, signal: controller.signal })).rejects.toMatchObject({
			code: "cancelled",
			source: "signal",
			message: "Login cancelled",
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("completes browser login from a pasted redirect URL", async () => {
		const token = accessToken("account-browser");
		const onAuth = vi.fn();
		const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
			const body = new URLSearchParams(String(init?.body));
			expect(body.get("code")).toBe("browser-code");
			expect(body.get("redirect_uri")).toBe("http://localhost:1455/auth/callback");
			return jsonResponse({ access_token: token, refresh_token: "browser-refresh", expires_in: 3600 });
		});
		vi.stubGlobal("fetch", fetchMock);

		const result = await loginOpenAICodexBrowser({
			onAuth,
			onPrompt: async () => {
				const authUrl = new URL(onAuth.mock.calls[0]?.[0].url as string);
				return `http://localhost:1455/auth/callback?code=browser-code&state=${authUrl.searchParams.get("state")}`;
			},
		});

		expect(result).toMatchObject({ accountId: "account-browser", refresh: "browser-refresh" });
		expect(onAuth).toHaveBeenCalledOnce();
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it.each([
		{
			name: "authorization error",
			input: (state: string) =>
				`http://localhost:1455/auth/callback?error=access_denied&state=${encodeURIComponent(state)}`,
			code: "authorization_error",
		},
		{
			name: "missing code",
			input: (state: string) => `http://localhost:1455/auth/callback?state=${encodeURIComponent(state)}`,
			code: "invalid_callback",
		},
		{
			name: "state mismatch",
			input: () => "http://localhost:1455/auth/callback?code=browser-code&state=wrong-state",
			code: "state_mismatch",
		},
	])("settles a pasted $name with a typed error", async ({ input, code }) => {
		let authUrl = "";
		const loginPromise = loginOpenAICodexBrowser({
			onAuth: ({ url }) => {
				authUrl = url;
			},
			onPrompt: async () => input(new URL(authUrl).searchParams.get("state") ?? ""),
		});

		await expect(loginPromise).rejects.toMatchObject({ name: "OAuthLoginError", code, source: "manual" });
	});

	it("times out pending browser input and observes its late rejection", async () => {
		const prompt = deferred<string>();
		const loginPromise = openaiCodexOAuthProvider.login({
			loginFlow: "browser",
			onAuth: () => {},
			onPrompt: () => prompt.promise,
			callbackTimeoutMs: 5,
		});

		await expect(loginPromise).rejects.toMatchObject({ code: "timeout", source: "timeout" });
		prompt.reject(new Error("late prompt cancellation"));
		await Promise.resolve();
	});

	it("cancels pending browser input and ignores its late success", async () => {
		const controller = new AbortController();
		const prompt = deferred<string>();
		const loginPromise = loginOpenAICodexBrowser({
			onAuth: () => controller.abort(),
			onPrompt: () => prompt.promise,
			signal: controller.signal,
		});

		await expect(loginPromise).rejects.toMatchObject({ code: "cancelled", source: "signal" });
		prompt.resolve("late-code");
		await Promise.resolve();
	});

	it("does not write token refresh failures to stderr", async () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async (): Promise<Response> =>
					jsonResponse({ error: { message: "Could not validate your token. Please try signing in again." } }, 401),
			),
		);

		await expect(refreshOpenAICodexToken("invalid-refresh-token")).rejects.toThrow(
			/OpenAI Codex token refresh failed \(401\).*Could not validate your token/,
		);
		expect(consoleError).not.toHaveBeenCalled();
	});
});
