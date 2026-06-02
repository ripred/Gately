import { describe, expect, it } from "vitest";
import type { BooleanBit, BooleanTruthTableRow } from "../types";
import { buildKarnaughMap } from "../kmap";

const makeBits = (value: number, width: number): BooleanBit[] =>
    value
        .toString(2)
        .padStart(width, "0")
        .split("") as BooleanBit[];

describe("Karnaugh map builder", () => {
    it("builds a 16x16 Gray-code map for eight-variable outputs", () => {
        const truthTable: BooleanTruthTableRow[] = Array.from({ length: 256 }, (_, minterm) => ({
            minterm,
            inputs: makeBits(minterm, 8),
            outputs: { OUT: minterm % 2 === 0 ? "1" : "0" },
        }));

        const map = buildKarnaughMap(
            "OUT",
            ["A", "B", "C", "D", "E", "F", "G", "H"],
            truthTable,
        );

        expect(map?.rowVariables).toEqual(["A", "B", "C", "D"]);
        expect(map?.columnVariables).toEqual(["E", "F", "G", "H"]);
        expect(map?.rowLabels).toHaveLength(16);
        expect(map?.columnLabels).toHaveLength(16);
        expect(map?.cells).toHaveLength(16);
        expect(map?.cells[0]).toHaveLength(16);
        expect(map?.rowLabels.slice(0, 4)).toEqual(["0000", "0001", "0011", "0010"]);
        expect(map?.columnLabels.slice(0, 4)).toEqual(["0000", "0001", "0011", "0010"]);
    });
});
