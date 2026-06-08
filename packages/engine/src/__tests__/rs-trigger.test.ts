import { LogicValue, hasItemInputPins, hasItemOutputPins } from "@cnbn/schema";
import { CinabonoBuilder } from "@engine/engine/builder";
import { describe, expect, it } from "vitest";

describe("RS-TRIGGER built-in", () => {
    it("builds the NOR latch structure and preserves state through simulation", async () => {
        const engine = await new CinabonoBuilder().build();

        const tabResult = engine.api.tab.create({ id: "tab" });

        const itemsResult = engine.api.item.create({
            id: "RS",
            kind: "circuit:logic",
            path: [tabResult.tabId],
            hash: "RS-TRIGGER",
        });
        const tabContext = engine.deps.stores.tab.get(tabResult.tabId)?.ctx;
        expect(tabContext).toBeDefined();

        const circuit = itemsResult.builtItem;
        const innerItems = itemsResult.items.filter((item) => item.id !== circuit.id);
        const firstNor = innerItems[0]!;
        const secondNor = innerItems[1]!;
        expect(circuit.id).toBe("RS");
        expect(innerItems.map((item) => item.hash).sort()).toEqual(["NOR", "NOR"]);
        expect(Object.keys(circuit.inputPins)).toEqual(["0", "1"]);
        expect(Object.keys(circuit.outputPins)).toEqual(["0", "1"]);
        expect(itemsResult.linkIds.sort()).toEqual([
            `${firstNor.id}:0:${secondNor.id}:0`,
            `${secondNor.id}:0:${firstNor.id}:1`,
        ].sort());

        const readCircuit = (): [LogicValue, LogicValue] => {
            const item = tabContext!.itemStore.get("RS");
            expect(item && hasItemOutputPins(item)).toBe(true);
            return [item.outputPins["0"].value, item.outputPins["1"].value];
        };
        const setInput = (pin: string, value: LogicValue): void => {
            engine.api.item.updateInput({ tabId: "tab", itemId: "RS", pin, value });
        };
        const simulate = (): Array<{ itemId: string; pin: string; value: LogicValue }> =>
            engine.api.simulation
                .simulate({ tabId: "tab", runCfg: { maxBatchTicks: 20 } })
                .tickEvents.filter((event) => event.kind === "output")
                .map((event) => ({
                    itemId: event.itemId,
                    pin: event.pin,
                    value: event.value,
                }));

        const initialEvents = simulate();
        expect(readCircuit()).toEqual(["X", "X"]);
        expect(initialEvents).toEqual([]);

        setInput("1", "0");
        setInput("0", "1");
        const setEvents = simulate();
        expect(readCircuit()).toEqual(["0", "1"]);
        expect(setEvents).toEqual(
            expect.arrayContaining([
                { itemId: firstNor.id, pin: "0", value: "0" },
                { itemId: secondNor.id, pin: "0", value: "1" },
            ]),
        );

        setInput("0", "0");
        expect(simulate()).toEqual([]);
        expect(readCircuit()).toEqual(["0", "1"]);

        setInput("1", "1");
        const resetEvents = simulate();
        expect(readCircuit()).toEqual(["1", "0"]);
        expect(resetEvents).toEqual(
            expect.arrayContaining([
                { itemId: firstNor.id, pin: "0", value: "1" },
                { itemId: secondNor.id, pin: "0", value: "0" },
            ]),
        );

        const storedCircuit = tabContext!.itemStore.get("RS");
        expect(storedCircuit && hasItemInputPins(storedCircuit)).toBe(true);
        expect(storedCircuit && hasItemOutputPins(storedCircuit)).toBe(true);
        expect(storedCircuit!.inputPins["0"].value).toBe("0");
        expect(storedCircuit!.inputPins["1"].value).toBe("1");
    });
});
