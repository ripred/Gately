import type { BooleanBit, BooleanTruthTableRow, KarnaughMap } from "./types";

const MAX_KARNAUGH_VARIABLES = 8;

const grayCodes = (width: number): BooleanBit[][] => {
    if (width === 0) return [[]];
    if (width === 1) return [["0"], ["1"]];

    const prev = grayCodes(width - 1);
    return [
        ...prev.map((bits) => ["0", ...bits] as BooleanBit[]),
        ...[...prev].reverse().map((bits) => ["1", ...bits] as BooleanBit[]),
    ];
};

const bitsToLabel = (bits: BooleanBit[]): string => bits.length ? bits.join("") : "-";

const bitsToMinterm = (bits: BooleanBit[]): number => {
    return bits.length ? parseInt(bits.join(""), 2) : 0;
};

export const buildKarnaughMap = (
    outputId: string,
    variableSymbols: string[],
    truthTable: BooleanTruthTableRow[]
): KarnaughMap | undefined => {
    const variableCount = variableSymbols.length;
    if (variableCount > MAX_KARNAUGH_VARIABLES) return;

    const rowVariableCount = Math.floor(variableCount / 2);
    const columnVariableCount = variableCount - rowVariableCount;
    const rowVariables = variableSymbols.slice(0, rowVariableCount);
    const columnVariables = variableSymbols.slice(rowVariableCount);
    const rowCodes = grayCodes(rowVariableCount);
    const columnCodes = grayCodes(columnVariableCount);
    const tableByMinterm = new Map(truthTable.map((row) => [row.minterm, row]));

    return {
        outputId,
        rowVariables,
        columnVariables,
        rowLabels: rowCodes.map(bitsToLabel),
        columnLabels: columnCodes.map(bitsToLabel),
        cells: rowCodes.map((rowBits) =>
            columnCodes.map((columnBits) => {
                const bits = [...rowBits, ...columnBits] as BooleanBit[];
                const minterm = bitsToMinterm(bits);
                const row = tableByMinterm.get(minterm);

                return {
                    minterm,
                    bits,
                    value: row?.outputs[outputId] ?? "0",
                };
            })
        ),
    };
};
