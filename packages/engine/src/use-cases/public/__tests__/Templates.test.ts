import { describe, expect, it } from "vitest";
import { CinabonoBuilder } from "@engine/engine/builder";
import {
    LogicValue,
    hasItemInputPins,
    hasItemOutputPins,
    isGeneratorItem,
    type InnerItemInputLinks,
    type InnerItemOutputLinks,
} from "@cnbn/schema";

type InnerItemWithLinks = {
    inputLinks?: InnerItemInputLinks;
    outputLinks?: InnerItemOutputLinks;
};

type Engine = Awaited<ReturnType<CinabonoBuilder["build"]>>;

const seedGeneratorLinks = (engine: Engine, tabId: string): void => {
    const snapshot = engine.api.session.export();
    const tab = snapshot.tabs.find((item) => item.id === tabId);
    expect(tab).toBeDefined();

    const itemsById = new Map(tab!.items);
    for (const [, link] of tab!.links) {
        const from = itemsById.get(link.fromItemId);
        if (!from || !isGeneratorItem(from) || !hasItemOutputPins(from)) continue;

        const value = from.outputPins[link.fromPin]?.value;
        if (value === undefined) continue;

        engine.api.item.updateInput({
            tabId,
            itemId: link.toItemId,
            pin: link.toPin,
            t: 0,
            value,
        });
    }
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

    it("settles imported custom component NOT outputs from default-false external inputs", async () => {
        const engine = await new CinabonoBuilder().build();
        const { tabId } = engine.api.tab.create({ id: "tab" });

        engine.api.item.create([
            { id: "SRC", kind: "base:generator", hash: "TOGGLE", path: [tabId] },
            { id: "SRC_NOT", kind: "base:logic", hash: "NOT", path: [tabId] },
            { id: "SRC_OUT", kind: "base:display", hash: "LAMP", path: [tabId] },
        ]);
        engine.api.item.link([
            {
                tabId,
                link: { fromItemId: "SRC", fromPin: "0", toItemId: "SRC_NOT", toPin: "0" },
            },
            {
                tabId,
                link: { fromItemId: "SRC_NOT", fromPin: "0", toItemId: "SRC_OUT", toPin: "0" },
            },
        ]);

        engine.api.template.createFromSelection({
            tabId,
            hash: "CUSTOM_NOT_FROM_UI",
            name: "NOT From UI",
            selectedItemIds: ["SRC", "SRC_NOT", "SRC_OUT"],
        });

        engine.api.item.create([
            { id: "A", kind: "base:generator", hash: "TOGGLE", path: [tabId] },
            {
                id: "CUSTOM_NOT",
                kind: "circuit:logic",
                hash: "CUSTOM_NOT_FROM_UI",
                path: [tabId],
            },
            { id: "DISPLAY", kind: "base:display", hash: "LAMP", path: [tabId] },
        ]);
        engine.api.item.link([
            {
                tabId,
                link: { fromItemId: "A", fromPin: "0", toItemId: "CUSTOM_NOT", toPin: "0" },
            },
            {
                tabId,
                link: { fromItemId: "CUSTOM_NOT", fromPin: "0", toItemId: "DISPLAY", toPin: "0" },
            },
        ]);

        const importedEngine = await new CinabonoBuilder().build();
        const snapshot = engine.api.session.export();
        importedEngine.api.session.import(snapshot);

        const readValues = (): { customInput: LogicValue; customOutput: LogicValue; displayInput: LogicValue } => {
            const tabContext = importedEngine.deps.stores.tab.get(tabId)?.ctx;
            expect(tabContext).toBeDefined();

            const custom = tabContext!.itemStore.get("CUSTOM_NOT");
            const display = tabContext!.itemStore.get("DISPLAY");
            expect(custom && hasItemInputPins(custom) && hasItemOutputPins(custom)).toBe(true);
            expect(display && hasItemInputPins(display)).toBe(true);

            return {
                customInput: custom!.inputPins["0"].value,
                customOutput: custom!.outputPins["0"].value,
                displayInput: display!.inputPins["0"].value,
            };
        };

        seedGeneratorLinks(importedEngine, tabId);
        importedEngine.api.simulation.simulate({ tabId, runCfg: { maxBatchTicks: 128 } });

        expect(readValues()).toEqual({
            customInput: "0",
            customOutput: "1",
            displayInput: "1",
        });
    });

    it("settles imported custom component OR chains fed by default-false inverted inputs", async () => {
        const engine = await new CinabonoBuilder().build();
        const { tabId } = engine.api.tab.create({ id: "tab" });

        engine.api.item.create([
            { id: "SRC_B", kind: "base:generator", hash: "TOGGLE", path: [tabId] },
            { id: "SRC_C", kind: "base:generator", hash: "TOGGLE", path: [tabId] },
            { id: "SRC_D", kind: "base:generator", hash: "TOGGLE", path: [tabId] },
            { id: "NOT_C", kind: "base:logic", hash: "NOT", path: [tabId] },
            { id: "OR_B_NOT_C", kind: "base:logic", hash: "OR", path: [tabId] },
            { id: "OR_SEG_C", kind: "base:logic", hash: "OR", path: [tabId] },
            { id: "SRC_OUT", kind: "base:display", hash: "LAMP", path: [tabId] },
        ]);
        engine.api.item.link([
            {
                tabId,
                link: { fromItemId: "SRC_B", fromPin: "0", toItemId: "OR_B_NOT_C", toPin: "0" },
            },
            {
                tabId,
                link: { fromItemId: "SRC_C", fromPin: "0", toItemId: "NOT_C", toPin: "0" },
            },
            {
                tabId,
                link: { fromItemId: "NOT_C", fromPin: "0", toItemId: "OR_B_NOT_C", toPin: "1" },
            },
            {
                tabId,
                link: { fromItemId: "OR_B_NOT_C", fromPin: "0", toItemId: "OR_SEG_C", toPin: "0" },
            },
            {
                tabId,
                link: { fromItemId: "SRC_D", fromPin: "0", toItemId: "OR_SEG_C", toPin: "1" },
            },
            {
                tabId,
                link: { fromItemId: "OR_SEG_C", fromPin: "0", toItemId: "SRC_OUT", toPin: "0" },
            },
        ]);

        engine.api.template.createFromSelection({
            tabId,
            hash: "CUSTOM_SEG_C_PATH",
            name: "Segment C Path",
            selectedItemIds: [
                "SRC_B",
                "SRC_C",
                "SRC_D",
                "NOT_C",
                "OR_B_NOT_C",
                "OR_SEG_C",
                "SRC_OUT",
            ],
        });

        engine.api.item.create([
            { id: "B", kind: "base:generator", hash: "TOGGLE", path: [tabId] },
            { id: "C", kind: "base:generator", hash: "TOGGLE", path: [tabId] },
            { id: "D", kind: "base:generator", hash: "TOGGLE", path: [tabId] },
            {
                id: "CUSTOM_SEG_C",
                kind: "circuit:logic",
                hash: "CUSTOM_SEG_C_PATH",
                path: [tabId],
            },
            { id: "DISPLAY", kind: "base:display", hash: "LAMP", path: [tabId] },
        ]);
        engine.api.item.link([
            {
                tabId,
                link: { fromItemId: "B", fromPin: "0", toItemId: "CUSTOM_SEG_C", toPin: "0" },
            },
            {
                tabId,
                link: { fromItemId: "C", fromPin: "0", toItemId: "CUSTOM_SEG_C", toPin: "1" },
            },
            {
                tabId,
                link: { fromItemId: "D", fromPin: "0", toItemId: "CUSTOM_SEG_C", toPin: "2" },
            },
            {
                tabId,
                link: { fromItemId: "CUSTOM_SEG_C", fromPin: "0", toItemId: "DISPLAY", toPin: "0" },
            },
        ]);

        const importedEngine = await new CinabonoBuilder().build();
        const snapshot = engine.api.session.export();
        importedEngine.api.session.import(snapshot);

        seedGeneratorLinks(importedEngine, tabId);
        importedEngine.api.simulation.simulate({ tabId, runCfg: { maxBatchTicks: 128 } });

        const tabContext = importedEngine.deps.stores.tab.get(tabId)?.ctx;
        expect(tabContext).toBeDefined();
        const custom = tabContext!.itemStore.get("CUSTOM_SEG_C");
        const display = tabContext!.itemStore.get("DISPLAY");
        expect(custom && hasItemInputPins(custom) && hasItemOutputPins(custom)).toBe(true);
        expect(display && hasItemInputPins(display)).toBe(true);

        expect({
            customInputs: [
                custom!.inputPins["0"].value,
                custom!.inputPins["1"].value,
                custom!.inputPins["2"].value,
            ],
            customOutput: custom!.outputPins["0"].value,
            displayInput: display!.inputPins["0"].value,
        }).toEqual({
            customInputs: ["0", "0", "0"],
            customOutput: "1",
            displayInput: "1",
        });
    });

    it("loads nested custom components into another saved custom component and reuses the reloaded hierarchy", async () => {
        const baseNotHash = "CUSTOM_NESTED_BASE_NOT";
        const bufferHash = "CUSTOM_NESTED_DOUBLE_NOT_BUFFER";
        const mcuHash = "CUSTOM_NESTED_MCU_WRAPPER";

        const authoringEngine = await new CinabonoBuilder().build();
        const { tabId: libraryTabId } = authoringEngine.api.tab.create({ id: "library" });

        authoringEngine.api.item.create([
            { id: "BASE_IN", kind: "base:generator", hash: "TOGGLE", path: [libraryTabId] },
            { id: "BASE_NOT", kind: "base:logic", hash: "NOT", path: [libraryTabId] },
            { id: "BASE_OUT", kind: "base:display", hash: "LAMP", path: [libraryTabId] },
        ]);
        authoringEngine.api.item.link([
            {
                tabId: libraryTabId,
                link: { fromItemId: "BASE_IN", fromPin: "0", toItemId: "BASE_NOT", toPin: "0" },
            },
            {
                tabId: libraryTabId,
                link: { fromItemId: "BASE_NOT", fromPin: "0", toItemId: "BASE_OUT", toPin: "0" },
            },
        ]);

        authoringEngine.api.template.createFromSelection({
            tabId: libraryTabId,
            hash: baseNotHash,
            name: "Nested Base NOT",
            selectedItemIds: ["BASE_IN", "BASE_NOT", "BASE_OUT"],
        });

        authoringEngine.api.item.create([
            { id: "BUFFER_IN", kind: "base:generator", hash: "TOGGLE", path: [libraryTabId] },
            { id: "BUFFER_NOT_A", kind: "circuit:logic", hash: baseNotHash, path: [libraryTabId] },
            { id: "BUFFER_NOT_B", kind: "circuit:logic", hash: baseNotHash, path: [libraryTabId] },
            { id: "BUFFER_OUT", kind: "base:display", hash: "LAMP", path: [libraryTabId] },
        ]);
        authoringEngine.api.item.link([
            {
                tabId: libraryTabId,
                link: {
                    fromItemId: "BUFFER_IN",
                    fromPin: "0",
                    toItemId: "BUFFER_NOT_A",
                    toPin: "0",
                },
            },
            {
                tabId: libraryTabId,
                link: {
                    fromItemId: "BUFFER_NOT_A",
                    fromPin: "0",
                    toItemId: "BUFFER_NOT_B",
                    toPin: "0",
                },
            },
            {
                tabId: libraryTabId,
                link: {
                    fromItemId: "BUFFER_NOT_B",
                    fromPin: "0",
                    toItemId: "BUFFER_OUT",
                    toPin: "0",
                },
            },
        ]);

        const bufferTemplateResult = authoringEngine.api.template.createFromSelection({
            tabId: libraryTabId,
            hash: bufferHash,
            name: "Nested Double NOT Buffer",
            selectedItemIds: ["BUFFER_IN", "BUFFER_NOT_A", "BUFFER_NOT_B", "BUFFER_OUT"],
        });

        expect(bufferTemplateResult.summary).toMatchObject({
            hash: bufferHash,
            custom: true,
            inputCount: 1,
            outputCount: 1,
        });
        expect(
            Object.values(bufferTemplateResult.template.items).filter(
                (item) => item.kind === "circuit:logic" && item.hash === baseNotHash,
            ),
        ).toHaveLength(2);

        authoringEngine.api.tab.remove({ tabId: libraryTabId });
        expect(authoringEngine.api.session.export().tabs).toHaveLength(0);

        const compositionEngine = await new CinabonoBuilder().build();
        compositionEngine.api.session.import(authoringEngine.api.session.export());

        const { tabId: compositionTabId } = compositionEngine.api.tab.create({ id: "composition" });
        compositionEngine.api.item.create([
            { id: "MCU_IN", kind: "base:generator", hash: "TOGGLE", path: [compositionTabId] },
            { id: "MCU_BUFFER", kind: "circuit:logic", hash: bufferHash, path: [compositionTabId] },
            { id: "MCU_OUT", kind: "base:display", hash: "LAMP", path: [compositionTabId] },
        ]);
        compositionEngine.api.item.link([
            {
                tabId: compositionTabId,
                link: { fromItemId: "MCU_IN", fromPin: "0", toItemId: "MCU_BUFFER", toPin: "0" },
            },
            {
                tabId: compositionTabId,
                link: { fromItemId: "MCU_BUFFER", fromPin: "0", toItemId: "MCU_OUT", toPin: "0" },
            },
        ]);

        const mcuTemplateResult = compositionEngine.api.template.createFromSelection({
            tabId: compositionTabId,
            hash: mcuHash,
            name: "Nested MCU Wrapper",
            selectedItemIds: ["MCU_IN", "MCU_BUFFER", "MCU_OUT"],
        });
        expect(
            Object.values(mcuTemplateResult.template.items).filter(
                (item) => item.kind === "circuit:logic" && item.hash === bufferHash,
            ),
        ).toHaveLength(1);

        compositionEngine.api.tab.remove({ tabId: compositionTabId });

        const { tabId: finalTabId } = compositionEngine.api.tab.create({ id: "final" });
        compositionEngine.api.item.create([
            { id: "FINAL_IN", kind: "base:generator", hash: "TOGGLE", path: [finalTabId] },
            { id: "MCU_NODE", kind: "circuit:logic", hash: mcuHash, path: [finalTabId] },
            { id: "FINAL_OUT", kind: "base:display", hash: "LAMP", path: [finalTabId] },
        ]);
        compositionEngine.api.item.link([
            {
                tabId: finalTabId,
                link: { fromItemId: "FINAL_IN", fromPin: "0", toItemId: "MCU_NODE", toPin: "0" },
            },
            {
                tabId: finalTabId,
                link: { fromItemId: "MCU_NODE", fromPin: "0", toItemId: "FINAL_OUT", toPin: "0" },
            },
        ]);

        const readFinalValues = (
            engine: Engine,
        ): { sourceOutput: LogicValue; moduleInput: LogicValue; moduleOutput: LogicValue; displayInput: LogicValue } => {
            const tabContext = engine.deps.stores.tab.get(finalTabId)?.ctx;
            expect(tabContext).toBeDefined();

            const source = tabContext!.itemStore.get("FINAL_IN");
            const module = tabContext!.itemStore.get("MCU_NODE");
            const display = tabContext!.itemStore.get("FINAL_OUT");
            expect(source && hasItemOutputPins(source)).toBe(true);
            expect(module && hasItemInputPins(module) && hasItemOutputPins(module)).toBe(true);
            expect(display && hasItemInputPins(display)).toBe(true);

            return {
                sourceOutput: source!.outputPins["0"].value,
                moduleInput: module!.inputPins["0"].value,
                moduleOutput: module!.outputPins["0"].value,
                displayInput: display!.inputPins["0"].value,
            };
        };

        const expectEfficientFinalHierarchy = (engine: Engine): void => {
            const tabContext = engine.deps.stores.tab.get(finalTabId)?.ctx;
            expect(tabContext).toBeDefined();

            const items = tabContext!.itemStore.export().map(([, item]) => item);
            const hashCounts = items.reduce<Record<string, number>>((counts, item) => {
                counts[item.hash] = (counts[item.hash] ?? 0) + 1;
                return counts;
            }, {});

            expect(items).toHaveLength(8);
            expect(tabContext!.scopeStore.export()).toHaveLength(5);
            expect(tabContext!.linkStore.export()).toHaveLength(3);
            expect(hashCounts).toMatchObject({
                [mcuHash]: 1,
                [bufferHash]: 1,
                [baseNotHash]: 2,
                NOT: 2,
                TOGGLE: 1,
                LAMP: 1,
            });
        };

        const verifyFinalTruthTable = (engine: Engine): void => {
            seedGeneratorLinks(engine, finalTabId);
            engine.api.simulation.simulate({ tabId: finalTabId, runCfg: { maxBatchTicks: 128 } });
            expect(readFinalValues(engine)).toEqual({
                sourceOutput: "0",
                moduleInput: "0",
                moduleOutput: "0",
                displayInput: "0",
            });

            engine.api.item.updateOutput({
                tabId: finalTabId,
                itemId: "FINAL_IN",
                pin: "0",
                value: "1",
            });
            engine.api.simulation.simulate({ tabId: finalTabId, runCfg: { maxBatchTicks: 128 } });
            expect(readFinalValues(engine)).toEqual({
                sourceOutput: "1",
                moduleInput: "1",
                moduleOutput: "1",
                displayInput: "1",
            });

            engine.api.item.updateOutput({
                tabId: finalTabId,
                itemId: "FINAL_IN",
                pin: "0",
                value: "0",
            });
            engine.api.simulation.simulate({ tabId: finalTabId, runCfg: { maxBatchTicks: 128 } });
            expect(readFinalValues(engine)).toEqual({
                sourceOutput: "0",
                moduleInput: "0",
                moduleOutput: "0",
                displayInput: "0",
            });
        };

        expect(compositionEngine.api.template.list().filter((template) => template.custom)).toEqual([
            expect.objectContaining({ hash: baseNotHash, inputCount: 1, outputCount: 1 }),
            expect.objectContaining({ hash: bufferHash, inputCount: 1, outputCount: 1 }),
            expect.objectContaining({ hash: mcuHash, inputCount: 1, outputCount: 1 }),
        ]);

        expectEfficientFinalHierarchy(compositionEngine);
        verifyFinalTruthTable(compositionEngine);

        const reloadedEngine = await new CinabonoBuilder().build();
        reloadedEngine.api.session.import(compositionEngine.api.session.export());

        expectEfficientFinalHierarchy(reloadedEngine);
        verifyFinalTruthTable(reloadedEngine);
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
