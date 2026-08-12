import { OAuthLoginError, type OAuthLoginErrorCode, type OAuthLoginErrorSource } from "./types.js";

export const DEFAULT_OAUTH_CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;
export const MAX_OAUTH_CALLBACK_TIMEOUT_MS = 2_147_483_647;

export interface OAuthTerminalWaiter<T> {
	wait: () => Promise<T>;
	succeed: (value: T) => boolean;
	fail: (error: OAuthLoginError) => boolean;
}

export function toOAuthLoginError(
	error: unknown,
	code: OAuthLoginErrorCode,
	source: OAuthLoginErrorSource,
): OAuthLoginError {
	if (error instanceof OAuthLoginError) return error;
	const message =
		error instanceof Error
			? error.message
			: typeof error === "string" && error.length > 0
				? error
				: code === "cancelled"
					? "Login cancelled"
					: String(error);
	return new OAuthLoginError(code, source, message, { cause: error });
}

export function validateOAuthCallbackTimeout(timeoutMs?: number): number {
	const resolvedTimeout = timeoutMs ?? DEFAULT_OAUTH_CALLBACK_TIMEOUT_MS;
	if (!Number.isFinite(resolvedTimeout) || resolvedTimeout <= 0 || resolvedTimeout > MAX_OAUTH_CALLBACK_TIMEOUT_MS) {
		throw new RangeError(
			`OAuth callback timeout must be a finite positive number no greater than ${MAX_OAUTH_CALLBACK_TIMEOUT_MS} ms`,
		);
	}
	return resolvedTimeout;
}

export function createOAuthTerminalWaiter<T>(options?: {
	timeoutMs?: number;
	signal?: AbortSignal;
}): OAuthTerminalWaiter<T> {
	const timeoutMs = validateOAuthCallbackTimeout(options?.timeoutMs);
	let settled = false;
	let abortListenerAttached = false;
	let resolveWait: ((value: T) => void) | undefined;
	let rejectWait: ((error: OAuthLoginError) => void) | undefined;
	let timeout: ReturnType<typeof setTimeout> | undefined;

	const waitPromise = new Promise<T>((resolve, reject) => {
		resolveWait = resolve;
		rejectWait = reject;
	});
	void waitPromise.catch(() => {});

	const onAbort = () => {
		fail(new OAuthLoginError("cancelled", "signal", "Login cancelled"));
	};

	const cleanup = () => {
		if (timeout !== undefined) {
			clearTimeout(timeout);
			timeout = undefined;
		}
		if (abortListenerAttached) {
			options?.signal?.removeEventListener("abort", onAbort);
			abortListenerAttached = false;
		}
	};

	const succeed = (value: T): boolean => {
		if (settled) return false;
		settled = true;
		cleanup();
		resolveWait?.(value);
		return true;
	};

	const fail = (error: OAuthLoginError): boolean => {
		if (settled) return false;
		settled = true;
		cleanup();
		rejectWait?.(error);
		return true;
	};

	if (options?.signal?.aborted) {
		fail(new OAuthLoginError("cancelled", "signal", "Login cancelled"));
	} else {
		options?.signal?.addEventListener("abort", onAbort, { once: true });
		abortListenerAttached = options?.signal !== undefined;
		timeout = setTimeout(() => {
			fail(new OAuthLoginError("timeout", "timeout", "OAuth callback timed out"));
		}, timeoutMs);
	}

	return {
		wait: () => waitPromise,
		succeed,
		fail,
	};
}

export function connectOAuthManualInput<T>(
	waiter: OAuthTerminalWaiter<T>,
	readInput: () => Promise<string>,
	parseInput: (input: string) => T,
): void {
	let inputPromise: Promise<string>;
	try {
		inputPromise = readInput();
	} catch (error) {
		waiter.fail(toOAuthLoginError(error, "cancelled", "manual"));
		return;
	}

	void inputPromise.then(
		(input) => {
			try {
				waiter.succeed(parseInput(input));
			} catch (error) {
				waiter.fail(toOAuthLoginError(error, "invalid_callback", "manual"));
			}
		},
		(error) => {
			waiter.fail(toOAuthLoginError(error, "cancelled", "manual"));
		},
	);
}
