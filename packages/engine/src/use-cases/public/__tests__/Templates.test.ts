import { describe, expect, it } from "vitest";
import { CinabonoBuilder } from "@engine/engine/builder";
import {
    LogicValue,
    hasItemInputPins,
    hasItemOutputPins,
    type InnerItemInputLinks,
    type InnerItemOutputLinks,
} from "@cnbn/schema";

type InnerItemWithLinks = {
    inputLinks?: InnerItemInputLinks;
    outputLinks?: InnerItemOutputLinks;
};

describe("template public use cases", () => {
    it("creates a custom component from an arbitrary selected subgraph boundary", async () => {
        const engine = await new CinabonoBuilder().build();
        const { tabId } = engine.api.tab.create({ id: "tab" });

        engine.api.item.create([
            { id: "A", kind: "base:generator", hash: "TOGGLE", path: [tabId] },
            { id: "B", kind: "base:generator", hash: "TOGGLE", path: [tabId] },
            { id: "AND_0", kind: "base:logic", hash: "AND", path: [tabId] },
            { id: "OR_0", kind: "base:logic", hash: "OR", path: [tabId] },
            { id: "OUT", kind: "base:display", hash: "LAMP", path: [tabId] },
        ]);

        engine.api.item.link([
            {
                tabId,
                link: { fromItemId: "A", fromPin: "0", toItemId: "AND_0", toPin: "0" },
            },
            {
                tabId,
                link: { fromItemId: "B", fromPin: "0", toItemId: "AND_0", toPin: "1" },
            },
            {
                tabId,
                link: { fromItemId: "AND_0", fromPin: "0", toItemId: "OR_0", toPin: "0" },
            },
            {
                tabId,
                link: { fromItemId: "B", fromPin: "0", toItemId: "OR_0", toPin: "1" },
            },
            {
                tabId,
                link: { fromItemId: "OR_0", fromPin: "0", toItemId: "OUT", toPin: "0" },
            },
        ]);

        const result = engine.api.template.createFromSelection({
            tabId,
            hash: "CUSTOM_SHARED_INPUT",
            name: "Shared Input",
            selectedItemIds: ["AND_0", "OR_0"],
        });

        expect(result.summary).toMatchObject({
            hash: "CUSTOM_SHARED_INPUT",
            name: "Shared Input",
            custom: true,
            inputCount: 2,
            outputCount: 1,
        });
        expect(engine.api.template.get({ hash: "CUSTOM_SHARED_INPUT" })).toMatchObject({
            hash: "CUSTOM_SHARED_INPUT",
            name: "Shared Input",
            kind: "circuit:logic",
        });
        expect(result.template.inputPins["0"].inputItems).toEqual([
            { itemId: "AND_0", pin: "0" },
        ]);
        expect(result.template.inputPins["1"].inputItems).toEqual([
            { itemId: "AND_0", pin: "1" },
            { itemId: "OR_0", pin: "1" },
        ]);
        expect(result.template.outputPins["0"].outputItem).toEqual({
            itemId: "OR_0",
            pin: "0",
        });
        expect((result.template.items["AND_0"] as InnerItemWithLinks).outputLinks?.["0"]).toEqual([
            "AND_0:0:OR_0:0",
        ]);
        expect((result.template.items["OR_0"] as InnerItemWithLinks).inputLinks?.["0"]).toBe(
            "AND_0:0:OR_0:0",
        );
    });

    it("preserves multiple output pins in custom templates", async () => {
        const engine = await new CinabonoBuilder().build();
        const { tabId } = engine.api.tab.create({ id: "tab" });

        engine.api.item.create([
            { id: "A", kind: "base:generator", hash: "TOGGLE", path: [tabId] },
            { id: "NOT_0", kind: "base:logic", hash: "NOT", path: [tabId] },
            { id: "BUFFER_0", kind: "base:logic", hash: "BUFFER", path: [tabId] },
            { id: "OUT_0", kind: "base:display", hash: "LAMP", path: [tabId] },
            { id: "OUT_1", kind: "base:display", hash: "LAMP", path: [tabId] },
        ]);

        engine.api.item.link([
            {
                tabId,
                link: { fromItemId: "A", fromPin: "0", toItemId: "NOT_0", toPin: "0" },
            },
            {
                tabId,
                link: { fromItemId: "A", fromPin: "0", toItemId: "BUFFER_0", toPin: "0" },
            },
            {
                tabId,
                link: { fromItemId: "NOT_0", fromPin: "0", toItemId: "OUT_0", toPin: "0" },
            },
            {
                tabId,
                link: { fromItemId: "BUFFER_0", fromPin: "0", toItemId: "OUT_1", toPin: "0" },
            },
        ]);

        const result = engine.api.template.createFromSelection({
            tabId,
            hash: "CUSTOM_TWO_OUTPUTS",
            name: "Two Outputs",
            selectedItemIds: ["NOT_0", "BUFFER_0"],
        });

        expect(result.summary.inputCount).toBe(1);
        expect(result.summary.outputCount).toBe(2);
        expect(result.template.outputPins["0"].outputItem).toEqual({
            itemId: "NOT_0",
            pin: "0",
        });
        expect(result.template.outputPins["1"].outputItem).toEqual({
            itemId: "BUFFER_0",
            pin: "0",
        });
    });

    it("simulates a saved custom component instance and fans out to external receivers", async () => {
        const engine = await new CinabonoBuilder().build();
        const { tabId } = engine.api.tab.create({ id: "tab" });

        engine.api.item.create([
            { id: "A", kind: "base:generator", hash: "TOGGLE", path: [tabId] },
            { id: "B", kind: "base:generator", hash: "TOGGLE", path: [tabId] },
            { id: "AND_0", kind: "base:logic", hash: "AND", path: [tabId] },
            { id: "OR_0", kind: "base:logic", hash: "OR", path: [tabId] },
            { id: "OUT", kind: "base:display", hash: "LAMP", path: [tabId] },
        ]);

        engine.api.item.link([
            {
                tabId,
                link: { fromItemId: "A", fromPin: "0", toItemId: "AND_0", toPin: "0" },
            },
            {
                tabId,
                link: { fromItemId: "B", fromPin: "0", toItemId: "AND_0", toPin: "1" },
            },
            {
                tabId,
                link: { fromItemId: "AND_0", fromPin: "0", toItemId: "OR_0", toPin: "0" },
            },
            {
                tabId,
                link: { fromItemId: "B", fromPin: "0", toItemId: "OR_0", toPin: "1" },
            },
            {
                tabId,
                link: { fromItemId: "OR_0", fromPin: "0", toItemId: "OUT", toPin: "0" },
            },
        ]);

        engine.api.template.createFromSelection({
            tabId,
            hash: "CUSTOM_RUNTIME",
            name: "Runtime Custom",
            selectedItemIds: ["AND_0", "OR_0"],
        });
        engine.api.item.create([
            {
                id: "CUSTOM_NODE",
                kind: "circuit:logic",
                hash: "CUSTOM_RUNTIME",
                path: [tabId],
            },
            { id: "CUSTOM_OUT", kind: "base:display", hash: "LAMP", path: [tabId] },
        ]);
        engine.api.item.link({
            tabId,
            link: { fromItemId: "CUSTOM_NODE", fromPin: "0", toItemId: "CUSTOM_OUT", toPin: "0" },
        });

        const tabContext = engine.deps.stores.tab.get(tabId)?.ctx;
        expect(tabContext).toBeDefined();

        const readCustomOutput = () => {
            const item = tabContext!.itemStore.get("CUSTOM_NODE");
            expect(item && hasItemOutputPins(item)).toBe(true);
            return item!.outputPins["0"].value;
        };
        const readLampInput = () => {
            const item = tabContext!.itemStore.get("CUSTOM_OUT");
            expect(item && hasItemInputPins(item)).toBe(true);
            return item!.inputPins["0"].value;
        };
        const simulate = () =>
            engine.api.simulation.simulate({ tabId, runCfg: { maxBatchTicks: 20 } });

        engine.api.item.updateInput({ tabId, itemId: "CUSTOM_NODE", pin: "0", value: "1" });
        engine.api.item.updateInput({ tabId, itemId: "CUSTOM_NODE", pin: "1", value: "0" });
        simulate();
        expect(readCustomOutput()).toBe("0");
        expect(readLampInput()).toBe("0");

        engine.api.item.updateInput({ tabId, itemId: "CUSTOM_NODE", pin: "1", value: "1" });
        simulate();
        expect(readCustomOutput()).toBe("1");
        expect(readLampInput()).toBe("1");
    });

    it("round-trips custom templates and tab stores through engine session snapshots", async () => {
        const engine = await new CinabonoBuilder().build();
        const { tabId } = engine.api.tab.create({ id: "tab" });

        engine.api.item.create([
            { id: "A", kind: "base:generator", hash: "TOGGLE", path: [tabId] },
            { id: "BUFFER_0", kind: "base:logic", hash: "BUFFER", path: [tabId] },
            { id: "OUT", kind: "base:display", hash: "LAMP", path: [tabId] },
        ]);
        engine.api.item.link([
            {
                tabId,
                link: { fromItemId: "A", fromPin: "0", toItemId: "BUFFER_0", toPin: "0" },
            },
            {
                tabId,
                link: { fromItemId: "BUFFER_0", fromPin: "0", toItemId: "OUT", toPin: "0" },
            },
        ]);

        engine.api.template.createFromSelection({
            tabId,
            hash: "CUSTOM_BUFFER",
            name: "Saved Buffer",
            selectedItemIds: ["BUFFER_0"],
        });

        const snapshot = engine.api.session.export();
        expect(snapshot.templates.map(([hash]) => hash)).toEqual(["CUSTOM_BUFFER"]);
        expect(snapshot.tabs).toHaveLength(1);

        engine.api.session.import(snapshot);

        expect(
            engine.api.template.list().find((template) => template.hash === "CUSTOM_BUFFER"),
        ).toMatchObject({ custom: true, inputCount: 1, outputCount: 1 });
        expect(engine.api.session.export().tabs[0].items.map(([id]) => id).sort()).toEqual([
            "A",
            "BUFFER_0",
            "OUT",
        ]);
    });

    it("round-trips a live custom component instance with external toggles and display output", async () => {
        const engine = await new CinabonoBuilder().build();
        const { tabId } = engine.api.tab.create({ id: "tab" });

        engine.api.item.create([
            { id: "SRC_A", kind: "base:generator", hash: "TOGGLE", path: [tabId] },
            { id: "SRC_B", kind: "base:generator", hash: "TOGGLE", path: [tabId] },
            { id: "SRC_AND", kind: "base:logic", hash: "AND", path: [tabId] },
            { id: "SRC_OUT", kind: "base:display", hash: "LAMP", path: [tabId] },
        ]);
        engine.api.item.link([
            {
                tabId,
                link: { fromItemId: "SRC_A", fromPin: "0", toItemId: "SRC_AND", toPin: "0" },
            },
            {
                tabId,
                link: { fromItemId: "SRC_B", fromPin: "0", toItemId: "SRC_AND", toPin: "1" },
            },
            {
                tabId,
                link: { fromItemId: "SRC_AND", fromPin: "0", toItemId: "SRC_OUT", toPin: "0" },
            },
        ]);

        engine.api.template.createFromSelection({
            tabId,
            hash: "CUSTOM_AND_FROM_UI",
            name: "AND From UI",
            selectedItemIds: ["SRC_A", "SRC_B", "SRC_AND", "SRC_OUT"],
        });

        engine.api.item.create([
            { id: "A", kind: "base:generator", hash: "TOGGLE", path: [tabId] },
            { id: "B", kind: "base:generator", hash: "TOGGLE", path: [tabId] },
            {
                id: "CUSTOM_NODE",
                kind: "circuit:logic",
                hash: "CUSTOM_AND_FROM_UI",
                path: [tabId],
            },
            { id: "CUSTOM_OUT", kind: "base:display", hash: "LAMP", path: [tabId] },
        ]);
        engine.api.item.link([
            {
                tabId,
                link: { fromItemId: "A", fromPin: "0", toItemId: "CUSTOM_NODE", toPin: "0" },
            },
            {
                tabId,
                link: { fromItemId: "B", fromPin: "0", toItemId: "CUSTOM_NODE", toPin: "1" },
            },
            {
                tabId,
                link: { fromItemId: "CUSTOM_NODE", fromPin: "0", toItemId: "CUSTOM_OUT", toPin: "0" },
            },
        ]);

        const readValues = (
            targetEngine: typeof engine,
        ): { customInput: LogicValue[]; customOutput: LogicValue; displayInput: LogicValue } => {
            const tabContext = targetEngine.deps.stores.tab.get(tabId)?.ctx;
            expect(tabContext).toBeDefined();

            const custom = tabContext!.itemStore.get("CUSTOM_NODE");
            const display = tabContext!.itemStore.get("CUSTOM_OUT");
            expect(custom && hasItemInputPins(custom) && hasItemOutputPins(custom)).toBe(true);
            expect(display && hasItemInputPins(display)).toBe(true);

            return {
                customInput: [custom!.inputPins["0"].value, custom!.inputPins["1"].value],
                customOutput: custom!.outputPins["0"].value,
                displayInput: display!.inputPins["0"].value,
            };
        };
        const setToggle = (id: string, value: LogicValue): void => {
            engine.api.item.updateOutput({ tabId, itemId: id, pin: "0", value });
        };
        const simulate = (targetEngine = engine): void => {
            targetEngine.api.simulation.simulate({ tabId, runCfg: { maxBatchTicks: 20 } });
        };

        simulate();
        expect(readValues(engine)).toEqual({
            customInput: ["0", "0"],
            customOutput: "0",
            displayInput: "0",
        });

        setToggle("A", "1");
        setToggle("B", "1");
        simulate();
        expect(readValues(engine)).toEqual({
            customInput: ["1", "1"],
            customOutput: "1",
            displayInput: "1",
        });

        const snapshot = engine.api.session.export();
        const importedEngine = await new CinabonoBuilder().build();
        importedEngine.api.session.import(snapshot);

        expect(readValues(importedEngine)).toEqual({
            customInput: ["1", "1"],
            customOutput: "1",
            displayInput: "1",
        });

        importedEngine.api.item.updateOutput({ tabId, itemId: "B", pin: "0", value: "0" });
        simulate(importedEngine);
        expect(readValues(importedEngine)).toEqual({
            customInput: ["1", "0"],
            customOutput: "0",
            displayInput: "0",
        });
    });

    it("removes unused custom templates", async () => {
        const engine = await new CinabonoBuilder().build();
        const { tabId } = engine.api.tab.create({ id: "tab" });

        engine.api.item.create([
            { id: "A", kind: "base:generator", hash: "TOGGLE", path: [tabId] },
            { id: "BUFFER_0", kind: "base:logic", hash: "BUFFER", path: [tabId] },
            { id: "OUT", kind: "base:display", hash: "LAMP", path: [tabId] },
        ]);
        engine.api.item.link([
            {
                tabId,
                link: { fromItemId: "A", fromPin: "0", toItemId: "BUFFER_0", toPin: "0" },
            },
            {
                tabId,
                link: { fromItemId: "BUFFER_0", fromPin: "0", toItemId: "OUT", toPin: "0" },
            },
        ]);

        engine.api.template.createFromSelection({
            tabId,
            hash: "CUSTOM_UNUSED",
            name: "Unused Custom",
            selectedItemIds: ["BUFFER_0"],
        });

        expect(engine.api.template.remove({ hash: "CUSTOM_UNUSED" })).toMatchObject({
            removed: true,
            template: { hash: "CUSTOM_UNUSED", custom: true },
        });
        expect(engine.api.template.list().some((template) => template.hash === "CUSTOM_UNUSED")).toBe(
            false,
        );
    });

    it("rejects removal of custom templates that are used by live items", async () => {
        const engine = await new CinabonoBuilder().build();
        const { tabId } = engine.api.tab.create({ id: "tab" });

        engine.api.item.create([
            { id: "A", kind: "base:generator", hash: "TOGGLE", path: [tabId] },
            { id: "BUFFER_0", kind: "base:logic", hash: "BUFFER", path: [tabId] },
            { id: "OUT", kind: "base:display", hash: "LAMP", path: [tabId] },
        ]);
        engine.api.item.link([
            {
                tabId,
                link: { fromItemId: "A", fromPin: "0", toItemId: "BUFFER_0", toPin: "0" },
            },
            {
                tabId,
                link: { fromItemId: "BUFFER_0", fromPin: "0", toItemId: "OUT", toPin: "0" },
            },
        ]);

        engine.api.template.createFromSelection({
            tabId,
            hash: "CUSTOM_IN_USE",
            name: "In Use Custom",
            selectedItemIds: ["BUFFER_0"],
        });
        engine.api.item.create({
            id: "CUSTOM_NODE",
            kind: "circuit:logic",
            hash: "CUSTOM_IN_USE",
            path: [tabId],
        });

        expect(() => engine.api.template.remove({ hash: "CUSTOM_IN_USE" })).toThrow(
            /still used by 1 item/,
        );
        expect(
            engine.api.template.list().some((template) => template.hash === "CUSTOM_IN_USE"),
        ).toBe(true);
    });

    it("rejects selections that contain missing item ids", async () => {
        const engine = await new CinabonoBuilder().build();
        const { tabId } = engine.api.tab.create({ id: "tab" });

        engine.api.item.create([
            { id: "A", kind: "base:generator", hash: "TOGGLE", path: [tabId] },
            { id: "BUFFER_0", kind: "base:logic", hash: "BUFFER", path: [tabId] },
            { id: "OUT", kind: "base:display", hash: "LAMP", path: [tabId] },
        ]);
        engine.api.item.link([
            {
                tabId,
                link: { fromItemId: "A", fromPin: "0", toItemId: "BUFFER_0", toPin: "0" },
            },
            {
                tabId,
                link: { fromItemId: "BUFFER_0", fromPin: "0", toItemId: "OUT", toPin: "0" },
            },
        ]);

        expect(() =>
            engine.api.template.createFromSelection({
                tabId,
                hash: "CUSTOM_PARTIAL",
                name: "Partial",
                selectedItemIds: ["BUFFER_0", "MISSING"],
            }),
        ).toThrow(/MISSING/);
    });

    it("rejects malformed custom templates at the public save boundary", async () => {
        const engine = await new CinabonoBuilder().build();

        expect(() =>
            engine.api.template.save({
                template: {
                    hash: "CUSTOM_BAD",
                    name: "Bad Custom",
                    kind: "circuit:logic",
                    meta: { custom: true },
                    items: {},
                    inputPins: {},
                    outputPins: {},
                },
            }),
        ).toThrow(/at least one item/);
    });

    it("rejects removal of custom templates used by other custom templates", async () => {
        const engine = await new CinabonoBuilder().build();
        const { tabId } = engine.api.tab.create({ id: "tab" });

        engine.api.item.create([
            { id: "A", kind: "base:generator", hash: "TOGGLE", path: [tabId] },
            { id: "BUFFER_0", kind: "base:logic", hash: "BUFFER", path: [tabId] },
            { id: "OUT", kind: "base:display", hash: "LAMP", path: [tabId] },
        ]);
        engine.api.item.link([
            {
                tabId,
                link: { fromItemId: "A", fromPin: "0", toItemId: "BUFFER_0", toPin: "0" },
            },
            {
                tabId,
                link: { fromItemId: "BUFFER_0", fromPin: "0", toItemId: "OUT", toPin: "0" },
            },
        ]);

        const base = engine.api.template.createFromSelection({
            tabId,
            hash: "CUSTOM_BASE",
            name: "Base Custom",
            selectedItemIds: ["BUFFER_0"],
        });
        engine.api.template.save({
            template: {
                ...base.template,
                hash: "CUSTOM_WRAPPER",
                name: "Wrapper Custom",
                items: {
                    wrapped: {
                        kind: "circuit:logic",
                        hash: "CUSTOM_BASE",
                        name: "Wrapped Base",
                    },
                },
                inputPins: {
                    "0": { inputItems: [{ itemId: "wrapped", pin: "0" }] },
                },
                outputPins: {
                    "0": { outputItem: { itemId: "wrapped", pin: "0" } },
                },
            },
        });

        expect(() => engine.api.template.remove({ hash: "CUSTOM_BASE" })).toThrow(
            /CUSTOM_WRAPPER/,
        );
    });

    it("validates session imports before replacing current tabs", async () => {
        const engine = await new CinabonoBuilder().build();
        const { tabId } = engine.api.tab.create({ id: "tab" });

        engine.api.item.create({
            id: "A",
            kind: "base:generator",
            hash: "TOGGLE",
            path: [tabId],
        });
        const goodSnapshot = engine.api.session.export();

        expect(() =>
            engine.api.session.import({
                version: 1,
                templates: [
                    [
                        "CUSTOM_BAD",
                        {
                            hash: "CUSTOM_BAD",
                            name: "Bad Custom",
                            kind: "circuit:logic",
                            meta: { custom: true },
                            items: {},
                            inputPins: {},
                            outputPins: {},
                        },
                    ],
                ],
                tabs: [],
            }),
        ).toThrow(/at least one item/);

        expect(engine.api.session.export().tabs[0].items.map(([id]) => id)).toEqual(
            goodSnapshot.tabs[0].items.map(([id]) => id),
        );
    });
});
