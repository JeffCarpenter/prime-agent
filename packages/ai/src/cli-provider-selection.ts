export function parseOAuthProviderSelection(input: string, providerCount: number): number | undefined {
	const normalized = input.trim();
	if (!/^[1-9][0-9]*$/.test(normalized)) return undefined;
	if (!Number.isSafeInteger(providerCount) || providerCount < 1) return undefined;

	const selection = Number(normalized);
	if (!Number.isSafeInteger(selection) || selection > providerCount) return undefined;
	return selection - 1;
}
