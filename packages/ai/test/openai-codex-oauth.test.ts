import { afterEach, describe, expect, it, vi } from "vitest";
import { loginOpenAICodex, refreshOpenAICodexToken } from "../src/utils/oauth/openai-codex.js";

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
});
