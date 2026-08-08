import { afterEach, describe, expect, it, vi } from "vitest";
import { loginOpenAICodex, loginOpenAICodexBrowser, refreshOpenAICodexToken } from "../src/utils/oauth/openai-codex.js";

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

const fetchFromNetwork = globalThis.fetch.bind(globalThis);

function accessToken(): string {
	const payload = btoa(
		JSON.stringify({
			"https://api.openai.com/auth": { chatgpt_account_id: "account-id" },
		}),
	);
	return `e30.${payload}.signature`;
}

function tokenResponse(): Response {
	return new Response(
		JSON.stringify({ access_token: accessToken(), refresh_token: "refresh-token", expires_in: 3600 }),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	);
}

describe.sequential("OpenAI Codex OAuth", () => {
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
		expect(fetchMock).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(1999);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(2000);
		await expect(loginPromise).resolves.toMatchObject({
			access: token,
			refresh: "refresh-token",
			accountId: "account-123",
		});
		expect(fetchMock).toHaveBeenCalledTimes(4);
	});

	it("cancels while waiting to poll", async () => {
		vi.useFakeTimers();
		const controller = new AbortController();
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
		await expect(loginPromise).rejects.toThrow("Login cancelled");
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

	it("does not write token refresh failures to stderr", async () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		vi.stubGlobal(
			"fetch",
			vi.fn(async (): Promise<Response> => {
				return new Response(
					JSON.stringify({
						error: {
							message: "Could not validate your token. Please try signing in again.",
							type: "invalid_request_error",
						},
					}),
					{ status: 401, statusText: "Unauthorized", headers: { "Content-Type": "application/json" } },
				);
			}),
		);

		await expect(refreshOpenAICodexToken("invalid-refresh-token")).rejects.toThrow(
			/OpenAI Codex token refresh failed \(401\).*Could not validate your token/,
		);
		expect(consoleError).not.toHaveBeenCalled();
	});

	it.each([
		{
			name: "authorization error",
			query: (state: string) => `error=access_denied&state=${encodeURIComponent(state)}`,
			code: "authorization_error",
		},
		{
			name: "missing code",
			query: (state: string) => `state=${encodeURIComponent(state)}`,
			code: "invalid_callback",
		},
		{
			name: "state mismatch",
			query: () => "code=browser-code&state=wrong-state",
			code: "state_mismatch",
		},
	])("settles the $name browser callback with a typed error", async ({ query, code }) => {
		let callbackRequest: Promise<Response> | undefined;
		const loginPromise = loginOpenAICodex({
			onAuth: ({ url }) => {
				const state = new URL(url).searchParams.get("state") ?? "";
				callbackRequest = fetchFromNetwork(`http://127.0.0.1:1455/auth/callback?${query(state)}`);
			},
			onPrompt: async () => "",
			onManualCodeInput: () => new Promise<string>(() => {}),
		});

		await expect(loginPromise).rejects.toMatchObject({
			name: "OAuthLoginError",
			code,
			source: "browser",
		});
		expect((await callbackRequest)?.status).toBe(400);
	});

	it("exchanges a manual result", async () => {
		let authUrl = "";
		const fetchMock = vi.fn(async (_input: unknown, _init?: RequestInit): Promise<Response> => tokenResponse());
		vi.stubGlobal("fetch", fetchMock);

		const credentials = await loginOpenAICodex({
			onAuth: ({ url }) => {
				authUrl = url;
			},
			onPrompt: async () => "",
			onManualCodeInput: async () => {
				const state = new URL(authUrl).searchParams.get("state") ?? "";
				return `manual-code#${state}`;
			},
		});

		expect(credentials.accountId).toBe("account-id");
		const params = new URLSearchParams(String(fetchMock.mock.calls[0]?.[1]?.body));
		expect(params.get("code")).toBe("manual-code");
	});

	it("settles a manual authorization error with a typed error", async () => {
		let authUrl = "";
		const loginPromise = loginOpenAICodex({
			onAuth: ({ url }) => {
				authUrl = url;
			},
			onPrompt: async () => "",
			onManualCodeInput: async () => {
				const state = new URL(authUrl).searchParams.get("state") ?? "";
				return `http://localhost:1455/auth/callback?error=access_denied&state=${encodeURIComponent(state)}`;
			},
		});

		await expect(loginPromise).rejects.toMatchObject({
			code: "authorization_error",
			source: "manual",
		});
	});

	it("uses the browser result when it settles before manual input", async () => {
		let callbackRequest: Promise<Response> | undefined;
		const fetchMock = vi.fn(async (_input: unknown, _init?: RequestInit): Promise<Response> => tokenResponse());
		vi.stubGlobal("fetch", fetchMock);

		const credentials = await loginOpenAICodex({
			onAuth: ({ url }) => {
				const state = new URL(url).searchParams.get("state") ?? "";
				callbackRequest = fetchFromNetwork(
					`http://127.0.0.1:1455/auth/callback?code=browser-code&state=${encodeURIComponent(state)}`,
				);
			},
			onPrompt: async () => "",
			onManualCodeInput: () => new Promise<string>(() => {}),
		});

		expect(credentials.accountId).toBe("account-id");
		expect((await callbackRequest)?.status).toBe(200);
		const params = new URLSearchParams(String(fetchMock.mock.calls[0]?.[1]?.body));
		expect(params.get("code")).toBe("browser-code");
	});

	it("rejects with a typed error after the callback timeout", async () => {
		const onPrompt = vi.fn(async () => "unused");
		const loginPromise = loginOpenAICodex({
			onAuth: () => {},
			onPrompt,
			callbackTimeoutMs: 5,
		});

		await expect(loginPromise).rejects.toMatchObject({ code: "timeout", source: "timeout" });
		expect(onPrompt).not.toHaveBeenCalled();
	});

	it("rejects with a typed cancellation when aborted during the callback wait", async () => {
		const controller = new AbortController();
		const loginPromise = loginOpenAICodex({
			onAuth: () => controller.abort(),
			onPrompt: async () => "",
			signal: controller.signal,
		});

		await expect(loginPromise).rejects.toEqual(
			expect.objectContaining<Partial<OAuthLoginError>>({ code: "cancelled", source: "signal" }),
		);
	});
});
