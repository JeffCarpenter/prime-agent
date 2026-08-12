import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMcpOAuthProvider } from "../src/mcp/oauth.js";
import { OAuthLoginError } from "../src/utils/oauth/types.js";

const fetchFromNetwork = globalThis.fetch.bind(globalThis);

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
	return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

function urlOf(input: unknown): string {
	if (typeof input === "string") return input;
	if (input instanceof URL) return input.toString();
	if (input instanceof Request) return input.url;
	throw new Error(`Unsupported fetch input: ${String(input)}`);
}

const RESOURCE = "https://mcp.plane.so/http/mcp";
const PLANE_ISSUER = "https://mcp.plane.so/http";
const PLANE_PRM_URL = "https://mcp.plane.so/.well-known/oauth-protected-resource/http/mcp";
const PLANE_META_URL = "https://mcp.plane.so/.well-known/oauth-authorization-server/http";
const PLANE_META = {
	issuer: PLANE_ISSUER,
	authorization_endpoint: "https://mcp.plane.so/http/authorize",
	token_endpoint: "https://mcp.plane.so/http/token",
	registration_endpoint: "https://mcp.plane.so/http/register",
	scopes_supported: ["read", "write"],
};
const ORIGIN_URL = "https://srv.test/mcp";
const ORIGIN_META = {
	issuer: "https://srv.test/tenant",
	authorization_endpoint: "https://srv.test/authorize",
	token_endpoint: "https://srv.test/token",
	registration_endpoint: "https://srv.test/register",
	scopes_supported: ["read", "write"],
};

function absentPrm(input: unknown): Response | undefined {
	const url = urlOf(input);
	if (url === ORIGIN_URL) return new Response("", { status: 404 });
	if (url === "https://srv.test/.well-known/oauth-protected-resource/mcp") return new Response("", { status: 404 });
	if (url === "https://srv.test/.well-known/oauth-protected-resource") return new Response("", { status: 404 });
	return undefined;
}

async function loginWithManualCode(
	provider: ReturnType<typeof createMcpOAuthProvider>,
): Promise<{ creds: object; authUrl: string }> {
	let authUrl = "";
	const creds = await provider.login({
		onAuth: (info) => {
			authUrl = info.url;
		},
		onPrompt: async () => "",
		onManualCodeInput: async () => {
			const params = new URL(authUrl).searchParams;
			return `${params.get("redirect_uri")}?code=the-code&state=${params.get("state")}`;
		},
	});
	return { creds, authUrl };
}

const CALLBACK_PORT_BASE = Number(process.env.PI_MCP_OAUTH_CALLBACK_PORT || 53700);

async function occupyCallbackPort(port: number): Promise<Server | undefined> {
	const server = createServer();
	const bound = await new Promise<boolean>((resolve) => {
		server.once("error", () => resolve(false));
		server.listen(port, "127.0.0.1", () => resolve(true));
	});
	return bound ? server : undefined;
}

async function closeServers(servers: ReadonlyArray<Server | undefined>): Promise<void> {
	await Promise.all(
		servers.map(
			(server) =>
				new Promise<void>((resolve) => {
					if (!server) {
						resolve();
						return;
					}
					server.close(() => resolve());
				}),
		),
	);
}

describe.sequential("MCP OAuth provider", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("has a namespaced id and label", () => {
		const provider = createMcpOAuthProvider({ server: "linear", label: "Linear", url: ORIGIN_URL });
		expect(provider.id).toBe("mcp:linear");
		expect(provider.name).toBe("Linear");
		expect(provider.usesCallbackServer).toBe(true);
	});

	it("discovers Plane protected-resource metadata and its external pathful issuer", async () => {
		const fetchMock = vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
			const url = urlOf(input);
			if (url === RESOURCE) {
				expect(init?.headers).toBeUndefined();
				return new Response("", { status: 401 });
			}
			if (url === PLANE_PRM_URL) return jsonResponse({ resource: RESOURCE, authorization_servers: [PLANE_ISSUER] });
			if (url === PLANE_META_URL) return jsonResponse(PLANE_META);
			if (url === PLANE_META.registration_endpoint) {
				expect(init?.redirect).toBe("error");
				return jsonResponse({ client_id: "plane-client" });
			}
			if (url === PLANE_META.token_endpoint) {
				expect(init?.redirect).toBe("error");
				const params = new URLSearchParams(String(init?.body));
				expect(params.get("grant_type")).toBe("authorization_code");
				expect(params.get("resource")).toBe(RESOURCE);
				return jsonResponse({ access_token: "access-1", refresh_token: "refresh-1", expires_in: 3600 });
			}
			throw new Error(`unexpected fetch: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		const { creds, authUrl } = await loginWithManualCode(createMcpOAuthProvider({ server: "plane", url: RESOURCE }));
		expect(creds).toMatchObject({
			access: "access-1",
			endpoint: RESOURCE,
			resource: RESOURCE,
			issuer: PLANE_ISSUER,
			tokenEndpoint: PLANE_META.token_endpoint,
		});
		const authParams = new URL(authUrl).searchParams;
		expect(authParams.get("client_id")).toBe("plane-client");
		expect(authParams.get("resource")).toBe(RESOURCE);
		expect(authParams.get("scope")).toBe("read write");
		expect(fetchMock).toHaveBeenCalledWith(RESOURCE, expect.objectContaining({ redirect: "error" }));
	});

	it("uses pathful OIDC metadata when RFC 8414 returns a non-metadata document", async () => {
		const issuer = "https://login.example/tenant";
		const oidcMeta = "https://login.example/tenant/.well-known/openid-configuration";
		const metadata = {
			...PLANE_META,
			issuer,
			authorization_endpoint: "https://login.example/tenant/authorize",
			token_endpoint: "https://login.example/tenant/token",
			registration_endpoint: "https://login.example/tenant/register",
		};
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown): Promise<Response> => {
				const url = urlOf(input);
				if (url === RESOURCE) return new Response("", { status: 404 });
				if (url === PLANE_PRM_URL) return jsonResponse({ resource: RESOURCE, authorization_servers: [issuer] });
				if (url === "https://login.example/.well-known/oauth-authorization-server/tenant")
					return new Response("<html>not metadata</html>", {
						status: 200,
						headers: { "Content-Type": "text/html" },
					});
				if (url === oidcMeta) return jsonResponse(metadata);
				if (url === metadata.registration_endpoint) return jsonResponse({ client_id: "c" });
				if (url === metadata.token_endpoint) return jsonResponse({ access_token: "a", expires_in: 60 });
				throw new Error(`unexpected fetch: ${url}`);
			}),
		);
		const { creds } = await loginWithManualCode(createMcpOAuthProvider({ server: "plane", url: RESOURCE }));
		expect(creds).toMatchObject({ resource: RESOURCE, issuer });
	});

	it("fails closed after protected-resource metadata selects an issuer", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown): Promise<Response> => {
				const url = urlOf(input);
				if (url === RESOURCE)
					return new Response("", {
						status: 401,
						headers: { "WWW-Authenticate": `Bearer resource_metadata="${PLANE_PRM_URL}"` },
					});
				if (url === PLANE_PRM_URL)
					return jsonResponse({ resource: RESOURCE, authorization_servers: [PLANE_ISSUER] });
				if (url === PLANE_META_URL) return jsonResponse({ ...PLANE_META, issuer: "https://wrong.example" });
				if (url === "https://mcp.plane.so/http/.well-known/openid-configuration")
					return new Response("", { status: 404 });
				throw new Error(`unexpected fetch: ${url}`);
			}),
		);
		await expect(
			createMcpOAuthProvider({ server: "plane", url: RESOURCE }).login({
				onAuth: () => {},
				onPrompt: async () => "",
			}),
		).rejects.toThrow("issuer does not exactly match");
	});

	it("accepts a same-origin pathful issuer from origin-level metadata when protected-resource metadata is absent", async () => {
		const fetchMock = vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
			const missing = absentPrm(input);
			if (missing) return missing;
			const url = urlOf(input);
			if (url === "https://srv.test/.well-known/oauth-authorization-server") return jsonResponse(ORIGIN_META);
			if (url === ORIGIN_META.registration_endpoint) return jsonResponse({ client_id: "origin-client" });
			if (url === ORIGIN_META.token_endpoint) {
				const params = new URLSearchParams(String(init?.body));
				expect(params.get("resource")).toBeNull();
				return jsonResponse({ access_token: "origin-access", refresh_token: "origin-refresh", expires_in: 3600 });
			}
			throw new Error(`unexpected fetch: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);
		const { creds, authUrl } = await loginWithManualCode(
			createMcpOAuthProvider({ server: "origin", url: ORIGIN_URL }),
		);
		expect(creds).toMatchObject({
			access: "origin-access",
			endpoint: ORIGIN_URL,
			resource: undefined,
			issuer: undefined,
		});
		expect(new URL(authUrl).searchParams.get("resource")).toBeNull();
		expect(fetchMock.mock.calls.map(([input]) => urlOf(input))).not.toContain(
			"https://srv.test/.well-known/oauth-protected-resource",
		);
	});

	it("validates refresh binding and retains the protected-resource resource indicator", async () => {
		const fetchMock = vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
			const url = urlOf(input);
			if (url === RESOURCE)
				return new Response("", {
					status: 401,
					headers: { "WWW-Authenticate": `Bearer resource_metadata="${PLANE_PRM_URL}"` },
				});
			if (url === PLANE_PRM_URL) return jsonResponse({ resource: RESOURCE, authorization_servers: [PLANE_ISSUER] });
			if (url === PLANE_META_URL) return jsonResponse(PLANE_META);
			if (url === PLANE_META.token_endpoint) {
				const params = new URLSearchParams(String(init?.body));
				expect(params.get("resource")).toBe(RESOURCE);
				return jsonResponse({ access_token: "access-2", expires_in: 1800 });
			}
			throw new Error(`unexpected fetch: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);
		const provider = createMcpOAuthProvider({ server: "plane", url: RESOURCE });
		const refreshed = await provider.refreshToken({
			access: "access-1",
			refresh: "old-refresh",
			expires: 0,
			endpoint: RESOURCE,
			resource: RESOURCE,
			issuer: PLANE_ISSUER,
			tokenEndpoint: PLANE_META.token_endpoint,
			clientId: "client-xyz",
		} as never);
		expect(refreshed).toMatchObject({
			access: "access-2",
			refresh: "old-refresh",
			endpoint: RESOURCE,
			resource: RESOURCE,
			issuer: PLANE_ISSUER,
		});
		await expect(
			provider.refreshToken({ access: "a", refresh: "r", expires: 0, endpoint: "https://other.test/mcp" } as never),
		).rejects.toThrow("not bound");
		await expect(
			provider.refreshToken({
				access: "a",
				refresh: "r",
				expires: 0,
				endpoint: RESOURCE,
				resource: RESOURCE,
				issuer: PLANE_ISSUER,
				tokenEndpoint: "https://attacker.example/token",
				clientId: "client-xyz",
			} as never),
		).rejects.toThrow("token endpoint does not match");
		expect(fetchMock.mock.calls.map(([input]) => urlOf(input))).not.toContain("https://attacker.example/token");
	});

	it("keeps an origin-level resource identifier free of a synthetic trailing slash", async () => {
		const resource = "https://root.example";
		const prm = "https://root.example/.well-known/oauth-protected-resource";
		const issuer = "https://root.example";
		const asMetadata = "https://root.example/.well-known/oauth-authorization-server";
		const metadata = {
			issuer,
			authorization_endpoint: "https://root.example/authorize",
			token_endpoint: "https://root.example/token",
		};
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown): Promise<Response> => {
				const url = urlOf(input);
				if (url === "https://root.example/") return new Response("", { status: 401 });
				if (url === prm) return jsonResponse({ resource, authorization_servers: [issuer] });
				if (url === asMetadata) return jsonResponse(metadata);
				if (url === metadata.token_endpoint) return jsonResponse({ access_token: "root-access" });
				throw new Error(`unexpected fetch: ${url}`);
			}),
		);
		const { creds, authUrl } = await loginWithManualCode(
			createMcpOAuthProvider({ server: "root", url: resource, clientId: "root-client" }),
		);
		expect(creds).toMatchObject({ endpoint: resource, resource, issuer });
		expect(new URL(authUrl).searchParams.get("resource")).toBe(resource);
	});

	it("preserves the resource query in RFC 9728 discovery and never probes root metadata", async () => {
		const resource = "https://mcp.example/mcp?tenant=a";
		const prm = "https://mcp.example/.well-known/oauth-protected-resource/mcp?tenant=a";
		const issuer = "https://login.example/tenant";
		const asMetadata = "https://login.example/.well-known/oauth-authorization-server/tenant";
		const metadata = {
			issuer,
			authorization_endpoint: "https://login.example/tenant/authorize",
			token_endpoint: "https://login.example/tenant/token",
		};
		const fetchMock = vi.fn(async (input: unknown): Promise<Response> => {
			const url = urlOf(input);
			if (url === resource) return new Response("", { status: 401 });
			if (url === prm) return jsonResponse({ resource, authorization_servers: [issuer] });
			if (url === asMetadata) return jsonResponse(metadata);
			if (url === metadata.token_endpoint) return jsonResponse({ access_token: "query-access" });
			throw new Error(`unexpected fetch: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);
		const { creds } = await loginWithManualCode(
			createMcpOAuthProvider({ server: "query", url: resource, clientId: "query-client" }),
		);
		expect(creds).toMatchObject({ resource, issuer });
		expect(fetchMock.mock.calls.map(([input]) => urlOf(input))).not.toContain(
			"https://mcp.example/.well-known/oauth-protected-resource",
		);
	});

	it("requires re-login when refresh discovery changes from origin-only to resource-bound", async () => {
		const fetchMock = vi.fn(async (input: unknown): Promise<Response> => {
			const url = urlOf(input);
			if (url === RESOURCE) return new Response("", { status: 401 });
			if (url === PLANE_PRM_URL) return jsonResponse({ resource: RESOURCE, authorization_servers: [PLANE_ISSUER] });
			if (url === PLANE_META_URL) return jsonResponse(PLANE_META);
			throw new Error(`unexpected fetch: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);
		await expect(
			createMcpOAuthProvider({ server: "plane", url: RESOURCE }).refreshToken({
				access: "origin-access",
				refresh: "origin-refresh",
				expires: 0,
				endpoint: RESOURCE,
				tokenEndpoint: PLANE_META.token_endpoint,
				clientId: "origin-client",
			} as never),
		).rejects.toThrow("discovery mode changed");
		expect(fetchMock.mock.calls.map(([input]) => urlOf(input))).not.toContain(PLANE_META.token_endpoint);
	});

	it("rejects a redirected token POST", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
				const missing = absentPrm(input);
				if (missing) return missing;
				const url = urlOf(input);
				if (url === "https://srv.test/.well-known/oauth-authorization-server") return jsonResponse(ORIGIN_META);
				if (url === ORIGIN_META.token_endpoint) {
					expect(init?.redirect).toBe("error");
					return new Response("redirect", { status: 302, headers: { Location: "https://evil.test/token" } });
				}
				throw new Error(`unexpected fetch: ${url}`);
			}),
		);
		const provider = createMcpOAuthProvider({ server: "origin", url: ORIGIN_URL, clientId: "c" });
		await expect(
			provider.refreshToken({
				access: "a",
				refresh: "r",
				expires: 0,
				endpoint: ORIGIN_URL,
				tokenEndpoint: ORIGIN_META.token_endpoint,
			} as never),
		).rejects.toThrow("Token request");
	});

	it("uses a WWW-Authenticate resource_metadata pointer before derived locations", async () => {
		const pointer = "https://metadata.example/resources/plane";
		const fetchMock = vi.fn(async (input: unknown): Promise<Response> => {
			const url = urlOf(input);
			if (url === RESOURCE)
				return new Response("", {
					status: 401,
					headers: { "WWW-Authenticate": `Bearer realm="mcp", resource_metadata="${pointer}"` },
				});
			if (url === pointer) return jsonResponse({ resource: RESOURCE, authorization_servers: [PLANE_ISSUER] });
			if (url === PLANE_META_URL) return jsonResponse(PLANE_META);
			if (url === PLANE_META.registration_endpoint) return jsonResponse({ client_id: "pointer-client" });
			if (url === PLANE_META.token_endpoint) return jsonResponse({ access_token: "pointer-access" });
			throw new Error(`unexpected fetch: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		const { creds } = await loginWithManualCode(createMcpOAuthProvider({ server: "plane", url: RESOURCE }));
		expect(creds).toMatchObject({ access: "pointer-access", resource: RESOURCE, issuer: PLANE_ISSUER });
		expect(fetchMock.mock.calls.map(([input]) => urlOf(input))).not.toContain(PLANE_PRM_URL);
	});

	it("rejects protected-resource metadata for a different resource", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown): Promise<Response> => {
				const url = urlOf(input);
				if (url === RESOURCE) return new Response("", { status: 401 });
				if (url === PLANE_PRM_URL)
					return jsonResponse({ resource: "https://attacker.example/mcp", authorization_servers: [PLANE_ISSUER] });
				throw new Error(`unexpected fetch: ${url}`);
			}),
		);

		await expect(
			createMcpOAuthProvider({ server: "plane", url: RESOURCE }).login({
				onAuth: () => {},
				onPrompt: async () => "",
			}),
		).rejects.toThrow("resource does not exactly match");
	});

	it("falls back to the next port when the base callback port is in use", async () => {
		// Occupy the base callback port. If something already holds it (e.g. a stray
		// local daemon), that satisfies the precondition too — bind best-effort.
		const blocker = createServer();
		const blockerBound = await new Promise<boolean>((resolve) => {
			blocker.once("error", () => resolve(false));
			blocker.listen(CALLBACK_PORT_BASE, "127.0.0.1", () => resolve(true));
		});
		try {
			vi.stubGlobal(
				"fetch",
				vi.fn(async (input: unknown): Promise<Response> => {
					const missing = absentPrm(input);
					if (missing) return missing;
					const url = urlOf(input);
					if (url === "https://srv.test/.well-known/oauth-authorization-server") return jsonResponse(ORIGIN_META);
					if (url === ORIGIN_META.registration_endpoint) return jsonResponse({ client_id: "c" });
					if (url === ORIGIN_META.token_endpoint) return jsonResponse({ access_token: "a", expires_in: 60 });
					throw new Error(`unexpected fetch: ${url}`);
				}),
			);
			const { authUrl } = await loginWithManualCode(createMcpOAuthProvider({ server: "demo", url: ORIGIN_URL }));
			const redirect = new URL(authUrl).searchParams.get("redirect_uri") ?? "";
			const redirectPort = Number(new URL(redirect).port);
			expect(redirectPort).toBeGreaterThan(CALLBACK_PORT_BASE);
			expect(redirectPort).toBeLessThan(CALLBACK_PORT_BASE + 10);
		} finally {
			if (blockerBound) await new Promise<void>((resolve) => blocker.close(() => resolve()));
		}
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
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown): Promise<Response> => {
				const missing = absentPrm(input);
				if (missing) return missing;
				const url = urlOf(input);
				if (url.endsWith("/.well-known/oauth-authorization-server")) return jsonResponse(ORIGIN_META);
				throw new Error(`unexpected fetch: ${url}`);
			}),
		);
		let callbackRequest: Promise<Response> | undefined;
		const provider = createMcpOAuthProvider({ server: "demo", url: ORIGIN_URL, clientId: "client" });
		const loginPromise = provider.login({
			onAuth: ({ url }) => {
				const authUrl = new URL(url);
				const state = authUrl.searchParams.get("state") ?? "";
				const redirectUri = authUrl.searchParams.get("redirect_uri") ?? "";
				callbackRequest = fetchFromNetwork(`${redirectUri}?${query(state)}`);
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

	it("uses the browser result when it settles before manual input", async () => {
		let callbackRequest: Promise<Response> | undefined;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
				const missing = absentPrm(input);
				if (missing) return missing;
				const url = urlOf(input);
				if (url.endsWith("/.well-known/oauth-authorization-server")) return jsonResponse(ORIGIN_META);
				if (url === ORIGIN_META.token_endpoint) {
					expect(new URLSearchParams(String(init?.body)).get("code")).toBe("browser-code");
					return jsonResponse({ access_token: "access", refresh_token: "refresh", expires_in: 3600 });
				}
				throw new Error(`unexpected fetch: ${url}`);
			}),
		);
		const provider = createMcpOAuthProvider({ server: "demo", url: ORIGIN_URL, clientId: "client" });

		const credentials = await provider.login({
			onAuth: ({ url }) => {
				const authUrl = new URL(url);
				const state = authUrl.searchParams.get("state") ?? "";
				const redirectUri = authUrl.searchParams.get("redirect_uri") ?? "";
				callbackRequest = fetchFromNetwork(`${redirectUri}?code=browser-code&state=${encodeURIComponent(state)}`);
			},
			onPrompt: async () => "",
			onManualCodeInput: () => new Promise<string>(() => {}),
		});

		expect(credentials.access).toBe("access");
		expect((await callbackRequest)?.status).toBe(200);
	});

	it("closes the callback server when token exchange fails", async () => {
		let callbackRequest: Promise<Response> | undefined;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown): Promise<Response> => {
				const missing = absentPrm(input);
				if (missing) return missing;
				const url = urlOf(input);
				if (url.endsWith("/.well-known/oauth-authorization-server")) return jsonResponse(ORIGIN_META);
				if (url === ORIGIN_META.token_endpoint) return jsonResponse({ error: "exchange failed" }, 400);
				throw new Error(`unexpected fetch: ${url}`);
			}),
		);
		const provider = createMcpOAuthProvider({ server: "demo", url: ORIGIN_URL, clientId: "client" });
		const loginPromise = provider.login({
			onAuth: ({ url }) => {
				const authUrl = new URL(url);
				const state = authUrl.searchParams.get("state") ?? "";
				const redirectUri = authUrl.searchParams.get("redirect_uri") ?? "";
				callbackRequest = fetchFromNetwork(`${redirectUri}?code=browser-code&state=${encodeURIComponent(state)}`);
			},
			onPrompt: async () => "",
		});

		await expect(loginPromise).rejects.toThrow("Token request to https://srv.test/token failed: 400");
		expect((await callbackRequest)?.status).toBe(200);
		const rebound = await occupyCallbackPort(CALLBACK_PORT_BASE);
		expect(rebound).toBeDefined();
		await closeServers([rebound]);
	});

	it("settles a manual authorization error with a typed error", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown): Promise<Response> => {
				const missing = absentPrm(input);
				if (missing) return missing;
				const url = urlOf(input);
				if (url.endsWith("/.well-known/oauth-authorization-server")) return jsonResponse(ORIGIN_META);
				throw new Error(`unexpected fetch: ${url}`);
			}),
		);
		let authUrl = "";
		const provider = createMcpOAuthProvider({ server: "demo", url: ORIGIN_URL, clientId: "client" });
		const loginPromise = provider.login({
			onAuth: ({ url }) => {
				authUrl = url;
			},
			onPrompt: async () => "",
			onManualCodeInput: async () => {
				const url = new URL(authUrl);
				const state = url.searchParams.get("state") ?? "";
				const redirectUri = url.searchParams.get("redirect_uri") ?? "";
				return `${redirectUri}?error=access_denied&state=${encodeURIComponent(state)}`;
			},
		});

		await expect(loginPromise).rejects.toMatchObject({
			code: "authorization_error",
			source: "manual",
		});
	});

	it("rejects with a typed error after the callback timeout", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown): Promise<Response> => {
				const missing = absentPrm(input);
				if (missing) return missing;
				const url = urlOf(input);
				if (url.endsWith("/.well-known/oauth-authorization-server")) return jsonResponse(ORIGIN_META);
				throw new Error(`unexpected fetch: ${url}`);
			}),
		);
		const onPrompt = vi.fn(async () => "unused");
		const provider = createMcpOAuthProvider({ server: "demo", url: ORIGIN_URL, clientId: "client" });
		const loginPromise = provider.login({ onAuth: () => {}, onPrompt, callbackTimeoutMs: 5 });

		await expect(loginPromise).rejects.toMatchObject({ code: "timeout", source: "timeout" });
		expect(onPrompt).not.toHaveBeenCalled();
		const rebound = await occupyCallbackPort(CALLBACK_PORT_BASE);
		expect(rebound).toBeDefined();
		await closeServers([rebound]);
	});

	it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648])(
		"rejects invalid callback timeout %s without opening the browser",
		async (callbackTimeoutMs) => {
			vi.stubGlobal(
				"fetch",
				vi.fn(async (input: unknown): Promise<Response> => {
					const missing = absentPrm(input);
					if (missing) return missing;
					const url = urlOf(input);
					if (url.endsWith("/.well-known/oauth-authorization-server")) return jsonResponse(ORIGIN_META);
					throw new Error(`unexpected fetch: ${url}`);
				}),
			);
			const onAuth = vi.fn();
			const provider = createMcpOAuthProvider({ server: "demo", url: ORIGIN_URL, clientId: "client" });

			await expect(provider.login({ onAuth, onPrompt: async () => "", callbackTimeoutMs })).rejects.toThrow(
				"OAuth callback timeout must be a finite positive number",
			);
			expect(onAuth).not.toHaveBeenCalled();
		},
	);

	it("rejects a pre-aborted login before discovery", async () => {
		const controller = new AbortController();
		controller.abort();
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const provider = createMcpOAuthProvider({ server: "demo", url: ORIGIN_URL, clientId: "client" });

		await expect(
			provider.login({ onAuth: () => {}, onPrompt: async () => "", signal: controller.signal }),
		).rejects.toMatchObject({ code: "cancelled", source: "signal" });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("rejects with a typed cancellation when aborted during the callback wait", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown): Promise<Response> => {
				const missing = absentPrm(input);
				if (missing) return missing;
				const url = urlOf(input);
				if (url.endsWith("/.well-known/oauth-authorization-server")) return jsonResponse(ORIGIN_META);
				throw new Error(`unexpected fetch: ${url}`);
			}),
		);
		const controller = new AbortController();
		const provider = createMcpOAuthProvider({ server: "demo", url: ORIGIN_URL, clientId: "client" });
		const loginPromise = provider.login({
			onAuth: () => controller.abort(),
			onPrompt: async () => "",
			signal: controller.signal,
		});

		await expect(loginPromise).rejects.toEqual(
			expect.objectContaining<Partial<OAuthLoginError>>({ code: "cancelled", source: "signal" }),
		);
	});

	it("returns a typed callback-server error when every callback port is occupied", async () => {
		const blockers = await Promise.all(
			Array.from({ length: 10 }, (_, index) => occupyCallbackPort(CALLBACK_PORT_BASE + index)),
		);
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown): Promise<Response> => {
				const missing = absentPrm(input);
				if (missing) return missing;
				const url = urlOf(input);
				if (url.endsWith("/.well-known/oauth-authorization-server")) return jsonResponse(ORIGIN_META);
				throw new Error(`unexpected fetch: ${url}`);
			}),
		);
		try {
			const provider = createMcpOAuthProvider({
				server: "demo",
				url: ORIGIN_URL,
				clientId: "client",
			});
			const error = await provider.login({ onAuth: () => {}, onPrompt: async () => "" }).then(
				() => undefined,
				(reason: unknown) => reason,
			);

			expect(error).toBeInstanceOf(OAuthLoginError);
			expect(error).toMatchObject({
				code: "callback_server_error",
				source: "server",
				cause: expect.objectContaining({ code: "EADDRINUSE" }),
			});
			expect((error as Error).message).toMatch(/ports .* are all in use/i);
		} finally {
			await closeServers(blockers);
		}
	});

	it("refreshes tokens, keeping the prior refresh token when omitted", async () => {
		const fetchMock = vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
			const missing = absentPrm(input);
			if (missing) return missing;
			const url = urlOf(input);
			if (url === "https://srv.test/.well-known/oauth-authorization-server") return jsonResponse(ORIGIN_META);
			if (url === ORIGIN_META.token_endpoint) {
				const params = new URLSearchParams(String(init?.body));
				expect(params.get("grant_type")).toBe("refresh_token");
				expect(params.get("refresh_token")).toBe("old-refresh");
				return jsonResponse({ access_token: "access-2", expires_in: 1800 });
			}
			throw new Error(`unexpected fetch: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		const provider = createMcpOAuthProvider({ server: "demo", url: ORIGIN_URL });
		const refreshed = await provider.refreshToken({
			access: "access-1",
			refresh: "old-refresh",
			expires: Date.now() - 1000,
			tokenEndpoint: ORIGIN_META.token_endpoint,
			clientId: "client-xyz",
			endpoint: ORIGIN_URL,
		} as never);

		expect(refreshed.access).toBe("access-2");
		expect(refreshed.refresh).toBe("old-refresh");
	});

	it("fails clearly when dynamic client registration is unavailable", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: unknown): Promise<Response> => {
				const missing = absentPrm(input);
				if (missing) return missing;
				const url = urlOf(input);
				if (url === "https://srv.test/.well-known/oauth-authorization-server")
					return jsonResponse({ ...ORIGIN_META, registration_endpoint: undefined });
				throw new Error(`unexpected fetch: ${url}`);
			}),
		);
		await expect(
			createMcpOAuthProvider({ server: "slackish", url: ORIGIN_URL }).login({
				onAuth: () => {},
				onPrompt: async () => "",
			}),
		).rejects.toThrow("dynamic client registration");
	});
});
