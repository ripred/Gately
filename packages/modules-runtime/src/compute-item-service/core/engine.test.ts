import { describe, expect, it } from "vitest";
import type { LogicValue } from "@cnbn/schema";
import { DefaultItemCreator } from "../../factories/item/creator";
import { DefaultComputeEngine } from "./engine";
import { DefaultBakeStore, DefaultComputeStore } from "./stores";

const creator = new DefaultItemCreator();

const createBakedAndItem = (left: LogicValue, right: LogicValue) =>
    creator.create({
        id: "CUSTOM_AND",
        kind: "circuit:logic",
        hash: "CUSTOM_AND",
        name: "Custom AND",
        path: ["tab"],
        options: { baked: true },
        inputPins: {
            "1": { value: right },
            "0": { value: left },
        },
        outputPins: {
            "0": { value: "X" },
        },
    });

const createEngine = () => {
    const bake = new DefaultBakeStore();
    bake.insert("CUSTOM_AND", ["0", "0", "0", "1"]);
    return new DefaultComputeEngine(new DefaultComputeStore(), bake);
};

describe("DefaultComputeEngine baked circuits", () => {
    it("resolves non-binary baked inputs by evaluating binary completions", () => {
        const engine = createEngine();

        expect(engine.computeOuts(createBakedAndItem("0", "X"))).toEqual(["0"]);
        expect(engine.computeOuts(createBakedAndItem("1", "X"))).toEqual(["X"]);
        expect(engine.computeOuts(createBakedAndItem("1", "Z"))).toEqual(["X"]);
        expect(engine.computeOuts(createBakedAndItem("1", "C"))).toEqual(["C"]);
        expect(engine.computeOuts(createBakedAndItem("Z", "0"))).toEqual(["0"]);
    });
});
