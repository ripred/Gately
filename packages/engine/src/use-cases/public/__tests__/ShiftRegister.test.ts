import { describe, expect, it } from "vitest";
import { CinabonoBuilder } from "@engine/engine/builder";
import type { LogicValue } from "@cnbn/schema";
import { readFileSync } from "node:fs";
import type { EngineSessionSnapshot } from "../Session";

type GatelyProjectSnapshot = {
    engine: EngineSessionSnapshot;
    workspace: {
        activeTabId: string;
    };
};

describe("SHIFT_REGISTER_8 built-in", () => {
    it("preserves template pin counts when optional metadata is undefined", async () => {
        const engine = await new CinabonoBuilder().build();
        const { tabId } = engine.api.tab.create({ id: "tab" });

        const result = engine.api.item.create({
            id: "SHIFT",
            kind: "base:logic",
            hash: "SHIFT_REGISTER_8",
            path: [tabId],
            meta: undefined,
        });

        expect(Object.keys(result.builtItem.inputPins)).toHaveLength(3);
        expect(Object.keys(result.builtItem.outputPins)).toHaveLength(9);
    });

    it("creates a 3-input, 9-output register and simulates clock/update edges", async () => {
        const engine = await new CinabonoBuilder().build();
        const { tabId } = engine.api.tab.create({ id: "tab" });

        const result = engine.api.item.create({
            id: "SHIFT",
            kind: "base:logic",
            hash: "SHIFT_REGISTER_8",
            path: [tabId],
        });

        expect(Object.keys(result.builtItem.inputPins)).toHaveLength(3);
        expect(Object.keys(result.builtItem.outputPins)).toHaveLength(9);

        const readOutputs = (): LogicValue[] => {
            const tab = engine.deps.stores.tab.get(tabId);
            const item = tab?.ctx.itemStore.get("SHIFT");
            if (!item || !("outputPins" in item)) return [];

            return Array.from({ length: 9 }, (_, index) => item.outputPins[String(index)].value);
        };

        const setInput = (pin: string, value: LogicValue): void => {
            engine.api.item.updateInput({ tabId, itemId: "SHIFT", pin, value });
            engine.api.simulation.simulate({ tabId, runCfg: { maxBatchTicks: 10 } });
        };

        const pulseClock = (serial: LogicValue): void => {
            setInput("0", serial);
            setInput("1", "1");
            setInput("1", "0");
        };

        setInput("0", "1");
        setInput("1", "0");
        setInput("2", "0");

        pulseClock("1");
        pulseClock("0");

        expect(readOutputs()).toEqual(["0", "0", "0", "0", "0", "0", "0", "0", "0"]);

        setInput("2", "1");
        expect(readOutputs()).toEqual(["0", "1", "0", "0", "0", "0", "0", "0", "0"]);

        setInput("2", "0");
        pulseClock("1");
        expect(readOutputs()).toEqual(["0", "1", "0", "0", "0", "0", "0", "0", "0"]);
    });

    it("loads the clocked shift-register example workspace and simulates it", async () => {
        const project = JSON.parse(
            readFileSync(
                new URL(
                    "../../../../../../examples/clocked-shift-register-demo.gately.json",
                    import.meta.url,
                ),
                "utf8",
            ),
        ) as GatelyProjectSnapshot;
        const engine = await new CinabonoBuilder().build();
        engine.api.session.import(project.engine);
        const tabId = project.workspace.activeTabId;

        const setInput = (pin: string, value: LogicValue): void => {
            engine.api.item.updateInput({ tabId, itemId: "shift_register", pin, value });
            engine.api.simulation.simulate({ tabId, runCfg: { maxBatchTicks: 10 } });
        };

        const pulseClock = (serial: LogicValue): void => {
            setInput("0", serial);
            setInput("1", "1");
            setInput("1", "0");
        };

        const readOutputs = (): LogicValue[] => {
            const tab = engine.deps.stores.tab.get(tabId);
            const item = tab?.ctx.itemStore.get("shift_register");
            if (!item || !("outputPins" in item)) return [];

            return Array.from({ length: 9 }, (_, index) => item.outputPins[String(index)].value);
        };

        setInput("1", "0");
        setInput("2", "0");
        pulseClock("1");
        pulseClock("0");

        expect(readOutputs()).toEqual(["0", "0", "0", "0", "0", "0", "0", "0", "0"]);

        setInput("2", "1");
        expect(readOutputs()).toEqual(["0", "1", "0", "0", "0", "0", "0", "0", "0"]);
    });
});
