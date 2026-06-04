import { describe, expect, it } from "vitest";
import { DefaultItemCreator } from "../../../factories/item/creator";
import { computeSHIFT_REGISTER_8 } from "./computeFns";
import type { LogicValue } from "@cnbn/schema";

const creator = new DefaultItemCreator();

const createShiftRegister8 = () =>
    creator.create({
        id: "shift",
        kind: "base:logic",
        hash: "SHIFT_REGISTER_8",
        path: ["tab"],
        meta: { numOfInputs: 3, numOfOutputs: 9 },
    });

const setInput = (
    item: ReturnType<typeof createShiftRegister8>,
    pin: number,
    value: LogicValue,
): void => {
    item.inputPins[String(pin)].value = value;
};

const compute = (item: ReturnType<typeof createShiftRegister8>): LogicValue[] =>
    computeSHIFT_REGISTER_8(item);

const clockPulse = (
    item: ReturnType<typeof createShiftRegister8>,
    serial: LogicValue,
): LogicValue[] => {
    setInput(item, 0, serial);
    setInput(item, 1, "1");
    const result = compute(item);
    setInput(item, 1, "0");
    compute(item);
    return result;
};

describe("computeSHIFT_REGISTER_8", () => {
    it("shifts on clock rising edges and latches parallel outputs on update rising edges", () => {
        const item = createShiftRegister8();

        setInput(item, 0, "1");
        setInput(item, 1, "0");
        setInput(item, 2, "0");

        expect(compute(item)).toEqual(["0", "0", "0", "0", "0", "0", "0", "0", "0"]);

        expect(clockPulse(item, "1")).toEqual([
            "0",
            "0",
            "0",
            "0",
            "0",
            "0",
            "0",
            "0",
            "0",
        ]);
        expect(clockPulse(item, "0")).toEqual([
            "0",
            "0",
            "0",
            "0",
            "0",
            "0",
            "0",
            "0",
            "0",
        ]);

        setInput(item, 2, "1");
        expect(compute(item)).toEqual(["0", "1", "0", "0", "0", "0", "0", "0", "0"]);

        setInput(item, 0, "1");
        expect(compute(item)).toEqual(["0", "1", "0", "0", "0", "0", "0", "0", "0"]);
    });

    it("exposes the internal last stage as carry", () => {
        const item = createShiftRegister8();

        setInput(item, 1, "0");
        setInput(item, 2, "0");
        compute(item);

        clockPulse(item, "1");
        for (let i = 0; i < 7; i += 1) {
            clockPulse(item, "0");
        }

        expect(compute(item)[8]).toBe("1");
    });
});
