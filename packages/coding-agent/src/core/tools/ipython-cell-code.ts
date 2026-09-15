const BASH_CELL_MAGIC_PATTERN = /^(?:[ \t]*\r?\n)*[ \t]*%%bash\b[^\r\n]*(?:\r?\n|$)/;

export interface ParsedReplBashCell {
	body: string;
}

export function parseReplBashCell(code: string): ParsedReplBashCell | undefined {
	const match = BASH_CELL_MAGIC_PATTERN.exec(code);
	if (!match) {
		return undefined;
	}
	return { body: code.slice(match[0].length) };
}

/** @deprecated Use parseReplBashCell. */
export type ParsedIpythonBashCell = ParsedReplBashCell;
/** @deprecated Use parseReplBashCell. */
export const parseIpythonBashCell = parseReplBashCell;
/** Alias used by native Xonsh cells when accepting legacy %%bash input. */
export const parseXonshBashCell = parseReplBashCell;
