import { get } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { anthropicOAuthProvider, loginAnthropic, refreshAnthropicToken } from "../src/utils/oauth/anthropic.js";

function jsonResponse(body: unknown, status: number = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

function getUrl(input: string | URL | Request): string {
	return input instanceof Request ? input.url : input.toString();
}

function getJsonBody(init?: RequestInit): Record<string, string> {
	if (typeof init?.body !== "string") throw new Error(`Expected string request body, got ${typeof init?.body}`);
	return JSON.parse(init.body) as Record<string, string>;
}

function requestCallback(url: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = get(url, (response) => {
			response.resume();
			response.once("end", () => resolve());
		});
		request.once("error", reject);
	});
}

describe.sequential("Anthropic OAuth", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it("uses Anthropic's hosted-code login without a localhost callback", async () => {
		vi.setSystemTime(new Date("2026-08-08T00:00:00Z"));
		const onAuth = vi.fn();
		const onProgress = vi.fn();
		const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
			expect(getUrl(input)).toBe("https://platform.claude.com/v1/oauth/token");
			expect(init?.method).toBe("POST");
			const body = getJsonBody(init);
			expect(body).toMatchObject({
				grant_type: "authorization_code",
				code: "authorization-code",
				redirect_uri: "https://platform.claude.com/oauth/code/callback",
			});
			expect(body.state).toBe(body.code_verifier);
			return jsonResponse({ access_token: "access-token", refresh_token: "refresh-token", expires_in: 3600 });
		});
		vi.stubGlobal("fetch", fetchMock);

		const credentials = await anthropicOAuthProvider.login({
			loginFlow: "headless",
			onAuth,
			onProgress,
			onPrompt: async () => {
				const authUrl = new URL(onAuth.mock.calls[0]?.[0].url as string);
				expect(authUrl.origin).toBe("https://claude.ai");
				expect(authUrl.pathname).toBe("/oauth/authorize");
				expect(authUrl.searchParams.get("redirect_uri")).toBe("https://platform.claude.com/oauth/code/callback");
				return `authorization-code#${authUrl.searchParams.get("state")}`;
			},
		});

		expect(anthropicOAuthProvider.loginFlow).toBe("manual-code");
		expect(anthropicOAuthProvider.browserLoginFlow).toBe("callback");
		expect(onAuth).toHaveBeenCalledWith({
			url: expect.stringContaining("https://claude.ai/oauth/authorize?"),
			instructions: "Complete sign-in, then copy the authorization code shown by Anthropic.",
		});
		expect(onProgress).toHaveBeenCalledWith("Exchanging authorization code for tokens...");
		expect(credentials).toEqual({
			access: "access-token",
			refresh: "refresh-token",
			expires: Date.parse("2026-08-08T00:55:00Z"),
		});
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it("uses Anthropic's localhost callback when browser login is selected", async () => {
		const onAuth = vi.fn();
		let callbackPromise: Promise<void> | undefined;
		const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
			expect(getUrl(input)).toBe("https://platform.claude.com/v1/oauth/token");
			const body = getJsonBody(init);
			expect(body).toMatchObject({
				grant_type: "authorization_code",
				code: "callback-code",
				redirect_uri: "http://localhost:53692/callback",
			});
			return jsonResponse({ access_token: "browser-access", refresh_token: "browser-refresh", expires_in: 3600 });
		});
		vi.stubGlobal("fetch", fetchMock);

		const credentials = await anthropicOAuthProvider.login({
			loginFlow: "browser",
			onAuth: (info) => {
				onAuth(info);
				const authUrl = new URL(info.url);
				expect(authUrl.searchParams.get("redirect_uri")).toBe("http://localhost:53692/callback");
				callbackPromise = requestCallback(
					`http://127.0.0.1:53692/callback?code=callback-code&state=${authUrl.searchParams.get("state")}`,
				);
			},
			onPrompt: async () => {
				throw new Error("Browser callback login should not prompt for a hosted code");
			},
		});

		await callbackPromise;
		expect(credentials).toMatchObject({ access: "browser-access", refresh: "browser-refresh" });
		expect(onAuth).toHaveBeenCalledOnce();
		expect(fetchMock).toHaveBeenCalledOnce();
	});

	it("rejects an authorization result with mismatched OAuth state before exchange", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			loginAnthropic({
				onAuth: () => {},
				onPrompt: async () => "authorization-code#unexpected-state",
			}),
		).rejects.toThrow("OAuth state mismatch");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("normalizes cancellation before token exchange", async () => {
		const controller = new AbortController();
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const loginPromise = loginAnthropic({
			onAuth: () => {},
			onPrompt: async () => {
				controller.abort();
				return "authorization-code";
			},
			signal: controller.signal,
		});

		await expect(loginPromise).rejects.toThrow("Login cancelled");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("validates token exchange responses", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => jsonResponse({ access_token: "access-token" })),
		);

		await expect(
			loginAnthropic({
				onAuth: () => {},
				onPrompt: async () => "authorization-code",
			}),
		).rejects.toThrow("Invalid Anthropic token exchange response: missing expires_in");
	});

	it("omits scope from refresh token requests", async () => {
		const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
			expect(getUrl(input)).toBe("https://platform.claude.com/v1/oauth/token");
			expect(init?.method).toBe("POST");
			const body = getJsonBody(init);
			expect(body.grant_type).toBe("refresh_token");
			expect(body.client_id).toBeTruthy();
			expect(body.refresh_token).toBe("refresh-token");
			expect(body).not.toHaveProperty("scope");
			return jsonResponse({
				access_token: "new-access-token",
				refresh_token: "new-refresh-token",
				expires_in: 3600,
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		const credentials = await refreshAnthropicToken("refresh-token");

		expect(credentials.access).toBe("new-access-token");
		expect(credentials.refresh).toBe("new-refresh-token");
		expect(fetchMock).toHaveBeenCalledOnce();
	});
});
