import { describe, expect, it } from "vitest";
import type { ItemLink, ItemOfKind, Scope } from "@cnbn/schema";
import { analyzeBooleanScope } from "../analyze";

const tabId = "tab";

const makeScope = (items: ItemOfKind[]): Scope<"tab"> => ({
    kind: "tab",
    id: tabId,
    path: [],
    storedItems: new Map(items.map((item) => [item.id, {}])),
    storedScopes: new Set(),
});

describe("analyzeBooleanScope", () => {
    it("builds a truth table and minimized expressions for a combinational scope", () => {
        const items: ItemOfKind[] = [
            {
                id: "A",
                path: [tabId],
                hash: "TOGGLE",
                name: "A",
                kind: "base:generator",
                outputPins: { 0: { value: "0" } },
            },
            {
                id: "B",
                path: [tabId],
                hash: "TOGGLE",
                name: "B",
                kind: "base:generator",
                outputPins: { 0: { value: "0" } },
            },
            {
                id: "AND",
                path: [tabId],
                hash: "AND",
                name: "AND",
                kind: "base:logic",
                inputPins: { 0: { value: "Z" }, 1: { value: "Z" } },
                outputPins: { 0: { value: "X" } },
            },
            {
                id: "OUT",
                path: [tabId],
                hash: "LAMP",
                name: "OUT",
                kind: "base:display",
                inputPins: { 0: { value: "Z" } },
            },
        ];
        const links: ItemLink[] = [
            { fromItemId: "A", fromPin: "0", toItemId: "AND", toPin: "0" },
            { fromItemId: "B", fromPin: "0", toItemId: "AND", toPin: "1" },
            { fromItemId: "AND", fromPin: "0", toItemId: "OUT", toPin: "0" },
        ];

        const result = analyzeBooleanScope({
            tabId,
            scope: makeScope(items),
            items,
            links,
        });

        expect(result.issues).toEqual([]);
        expect(result.truthTable.map((row) => row.outputs["OUT:0"])).toEqual(["0", "0", "0", "1"]);
        expect(result.optimizedOutputs[0].sop.expression).toBe("AB");
        expect(result.optimizedOutputs[0].pos.expression).toBe("(A) * (B)");
        expect(result.optimizedOutputs[0].karnaughMap?.cells).toHaveLength(2);
    });
});
