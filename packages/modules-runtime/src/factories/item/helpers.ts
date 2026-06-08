import { getGlobalCfg } from "@cnbn/config";
import { mkDefaultPins } from "@cnbn/helpers";
import { LogicValueBase, WithCircuitPins, BasePin } from "@cnbn/schema";

type CircuitTemplatePin =
    | WithCircuitPins<"template">["inputPins"][string]
    | WithCircuitPins<"template">["outputPins"][string];
type CircuitItemPin =
    | WithCircuitPins<"item">["inputPins"][string]
    | WithCircuitPins<"item">["outputPins"][string];

export const getDefaultSettings = () => {
    return {
        displayValue: () => getGlobalCfg().pins.initialDisplayValue,
        generatorValue: () => getGlobalCfg().pins.initialGeneratorValue,
        baseInputValue: () => getGlobalCfg().pins.initialBaseInputValue,
        baseOutputValue: () => getGlobalCfg().pins.initialBaseOutputValue,
        circInputValue: () => getGlobalCfg().pins.initialCircuitInputValue,
        circOutputValue: () => getGlobalCfg().pins.initialCircuitOutputValue,
        logicInputsNum: () => getGlobalCfg().pins.numOfBaseLogicInputs,
        displayInputsNum: () => getGlobalCfg().pins.numOfDisplayInputs,
        genOutputsNum: () => getGlobalCfg().pins.numOfGeneratorOutputs,
    } as const;
};

export const normalizeBasePin = (
    count: number,
    defaultValue: LogicValueBase,
    override?: BasePin<"template">
): BasePin<"item"> => {
    return mkDefaultPins(count, (i) => ({
        value: override?.[i].value ?? defaultValue,
    }));
};

export const normalizeCircuitPins = <T extends keyof WithCircuitPins<"template">>(
    pins: WithCircuitPins<"template">,
    defaultValue: LogicValueBase,
    type: T
): WithCircuitPins<"item">[T] => {
    const cloneCircuitPin = (pin: CircuitTemplatePin): CircuitItemPin => {
        const clone: CircuitItemPin = {
            ...pin,
            value: pin.value ?? defaultValue,
        };

        if ("inputItems" in pin && pin.inputItems) {
            (clone as WithCircuitPins<"item">["inputPins"][string]).inputItems =
                pin.inputItems.map((input) => ({ ...input }));
        }

        if ("outputItem" in pin && pin.outputItem) {
            (clone as WithCircuitPins<"item">["outputPins"][string]).outputItem = {
                ...pin.outputItem,
            };
        }

        if ("circuitPins" in pin && Array.isArray(pin.circuitPins)) {
            clone.circuitPins = pin.circuitPins.map((circuitPin) => ({ ...circuitPin }));
        }

        return clone;
    };

    return Object.fromEntries(
        Object.entries(pins[type]).map(([key, pin]) => [key, cloneCircuitPin(pin)]),
    ) as WithCircuitPins<"item">[T];
};
