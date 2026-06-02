import { describe, expect, it } from "vitest";
import type { BooleanBit, BooleanImplicant } from "../types";
import { buildPosExpression, buildSopExpression } from "../minimize";

const toBits = (value: number, width: number): BooleanBit[] =>
    value
        .toString(2)
        .padStart(width, "0")
        .split("") as BooleanBit[];

const termCoversBits = (term: BooleanImplicant, bits: BooleanBit[]): boolean =>
    term.bits.every((bit, index) => bit === "-" || bit === bits[index]);

const termsEvaluateToOne = (terms: BooleanImplicant[], minterm: number, variableCount: number): boolean =>
    terms.some((term) => termCoversBits(term, toBits(minterm, variableCount)));

const termMinterms = (term: BooleanImplicant, variableCount: number): number[] =>
    Array.from({ length: 2 ** variableCount }, (_, minterm) => minterm).filter((minterm) =>
        termCoversBits(term, toBits(minterm, variableCount))
    );

describe("Boolean minimizer", () => {
    it("minimizes SOP for a two-input AND", () => {
        const expression = buildSopExpression([3], ["A", "B"]);

        expect(expression.expression).toBe("AB");
        expect(expression.gateCountEstimate).toBe(1);
    });

    it("minimizes POS for a two-input AND", () => {
        const expression = buildPosExpression([0, 1, 2], ["A", "B"]);

        expect(expression.expression).toBe("(A) * (B)");
    });

    it("handles constants", () => {
        expect(buildSopExpression([], ["A", "B"]).expression).toBe("0");
        expect(buildSopExpression([0, 1, 2, 3], ["A", "B"]).expression).toBe("1");
        expect(buildPosExpression([], ["A", "B"]).expression).toBe("1");
        expect(buildPosExpression([0, 1, 2, 3], ["A", "B"]).expression).toBe("0");
    });

    it("prefers the largest available power-of-two SOP groups", () => {
        const expression = buildSopExpression([0, 1, 2, 3, 7], ["A", "B", "C"]);

        expect(expression.terms).toEqual([
            { bits: ["0", "-", "-"], minterms: [0, 1, 2, 3] },
            { bits: ["-", "1", "1"], minterms: [3, 7] },
        ]);
        expect(expression.expression).toBe("A' + BC");
    });

    it("keeps every optimized SOP cube inside the original one-valued minterms", () => {
        const symbols = ["A", "B", "C", "D", "E", "F", "G", "H"];
        const variableCount = symbols.length;
        const targetTerms: BooleanImplicant[] = [
            { bits: ["-", "-", "-", "0", "-", "-", "-", "1"], minterms: [] },
            { bits: ["-", "-", "-", "-", "-", "-", "1", "-"], minterms: [] },
            { bits: ["-", "-", "-", "-", "1", "1", "-", "-"], minterms: [] },
            { bits: ["-", "-", "-", "1", "-", "-", "-", "0"], minterms: [] },
            { bits: ["-", "-", "1", "-", "-", "-", "-", "-"], minterms: [] },
            { bits: ["1", "1", "-", "-", "-", "-", "-", "-"], minterms: [] },
        ];
        const minterms = Array.from({ length: 2 ** variableCount }, (_, minterm) => minterm).filter(
            (minterm) => targetTerms.some((term) => termCoversBits(term, toBits(minterm, variableCount)))
        );
        const mintermSet = new Set(minterms);
        const expression = buildSopExpression(minterms, symbols);

        for (let minterm = 0; minterm < 2 ** variableCount; minterm++) {
            expect(termsEvaluateToOne(expression.terms, minterm, variableCount)).toBe(mintermSet.has(minterm));
        }

        for (const term of expression.terms) {
            expect(termMinterms(term, variableCount).every((minterm) => mintermSet.has(minterm))).toBe(true);
        }
    });
});
