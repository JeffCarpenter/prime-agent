import { afterEach, describe, expect, it, vi } from "vitest";
import { connectOAuthManualInput, createOAuthTerminalWaiter } from "../src/utils/oauth/terminal-waiter.js";
import { OAuthLoginError } from "../src/utils/oauth/types.js";

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

describe("OAuth terminal waiter", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it("uses deterministic first-settler semantics for manual input", async () => {
		const manual = deferred<string>();
		const waiter = createOAuthTerminalWaiter<string>();
		connectOAuthManualInput(
			waiter,
			() => manual.promise,
			(input) => input,
		);

		manual.resolve("manual-code");
		expect(await waiter.wait()).toBe("manual-code");
		expect(waiter.succeed("browser-code")).toBe(false);
		expect(waiter.fail(new OAuthLoginError("authorization_error", "browser", "late browser error"))).toBe(false);
	});

	it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648])(
		"rejects invalid timeout override %s before allocating a wait",
		(timeoutMs) => {
			expect(() => createOAuthTerminalWaiter({ timeoutMs })).toThrow(
				"OAuth callback timeout must be a finite positive number no greater than 2147483647 ms",
			);
		},
	);

	it("clears its timeout and abort listener after success", async () => {
		vi.useFakeTimers();
		const controller = new AbortController();
		const removeListener = vi.spyOn(controller.signal, "removeEventListener");
		const waiter = createOAuthTerminalWaiter<string>({ timeoutMs: 25, signal: controller.signal });

		expect(waiter.succeed("code")).toBe(true);
		await expect(waiter.wait()).resolves.toBe("code");
		expect(removeListener).toHaveBeenCalledOnce();
		await vi.advanceTimersByTimeAsync(25);
		expect(waiter.fail(new OAuthLoginError("timeout", "timeout", "late timeout"))).toBe(false);
	});

	it("ignores a late manual rejection after the browser settles", async () => {
		const manual = deferred<string>();
		const waiter = createOAuthTerminalWaiter<string>();
		connectOAuthManualInput(
			waiter,
			() => manual.promise,
			(input) => input,
		);

		expect(waiter.succeed("browser-code")).toBe(true);
		expect(await waiter.wait()).toBe("browser-code");
		manual.reject(new Error("late manual cancellation"));
		await Promise.resolve();
		expect(waiter.succeed("second-browser-code")).toBe(false);
	});

	it("settles a manual cancellation once with a typed error", async () => {
		const waiter = createOAuthTerminalWaiter<string>();
		connectOAuthManualInput(
			waiter,
			async () => {
				throw new Error("dialog cancelled");
			},
			(input) => input,
		);

		await expect(waiter.wait()).rejects.toMatchObject({
			name: "OAuthLoginError",
			code: "cancelled",
			source: "manual",
			message: "dialog cancelled",
		});
		expect(waiter.succeed("late-browser-code")).toBe(false);
	});

	it("settles a synchronous manual-input failure once", async () => {
		const waiter = createOAuthTerminalWaiter<string>();
		connectOAuthManualInput(
			waiter,
			() => {
				throw new Error("dialog closed");
			},
			(input) => input,
		);

		await expect(waiter.wait()).rejects.toMatchObject({
			code: "cancelled",
			source: "manual",
			message: "dialog closed",
		});
	});

	it("preserves the documented cancellation message for an empty rejection", async () => {
		const waiter = createOAuthTerminalWaiter<string>();
		connectOAuthManualInput(
			waiter,
			() => Promise.reject(undefined),
			(input) => input,
		);

		await expect(waiter.wait()).rejects.toMatchObject({
			code: "cancelled",
			source: "manual",
			message: "Login cancelled",
		});
	});

	it("preserves a typed manual validation error", async () => {
		const waiter = createOAuthTerminalWaiter<string>();
		connectOAuthManualInput(
			waiter,
			async () => "bad-state",
			() => {
				throw new OAuthLoginError("state_mismatch", "manual", "OAuth state mismatch");
			},
		);

		await expect(waiter.wait()).rejects.toMatchObject({ code: "state_mismatch", source: "manual" });
	});

	it("rejects with a typed timeout and removes its abort listener", async () => {
		vi.useFakeTimers();
		const controller = new AbortController();
		const addListener = vi.spyOn(controller.signal, "addEventListener");
		const removeListener = vi.spyOn(controller.signal, "removeEventListener");
		const waiter = createOAuthTerminalWaiter<string>({ timeoutMs: 25, signal: controller.signal });
		const rejection = expect(waiter.wait()).rejects.toMatchObject({
			name: "OAuthLoginError",
			code: "timeout",
			source: "timeout",
		});

		await vi.advanceTimersByTimeAsync(25);
		await rejection;
		expect(addListener).toHaveBeenCalledOnce();
		expect(removeListener).toHaveBeenCalledOnce();
	});

	it("rejects a pre-aborted wait without attaching a listener", async () => {
		const controller = new AbortController();
		controller.abort();
		const addListener = vi.spyOn(controller.signal, "addEventListener");
		const waiter = createOAuthTerminalWaiter<string>({ signal: controller.signal });

		await expect(waiter.wait()).rejects.toMatchObject({ code: "cancelled", source: "signal" });
		expect(addListener).not.toHaveBeenCalled();
	});

	it("rejects an active wait on abort and removes its listener", async () => {
		const controller = new AbortController();
		const removeListener = vi.spyOn(controller.signal, "removeEventListener");
		const waiter = createOAuthTerminalWaiter<string>({ signal: controller.signal });
		const rejection = expect(waiter.wait()).rejects.toMatchObject({ code: "cancelled", source: "signal" });

		controller.abort();
		await rejection;
		expect(removeListener).toHaveBeenCalledOnce();
	});
});
