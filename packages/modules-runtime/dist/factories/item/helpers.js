import { getGlobalCfg } from "@cnbn/config";
import { mkDefaultPins } from "@cnbn/helpers";
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
    };
};
export const normalizeBasePin = (count, defaultValue, override) => {
    return mkDefaultPins(count, (i) => ({
        value: override?.[i].value ?? defaultValue,
    }));
};
export const normalizeCircuitPins = (pins, defaultValue, type) => {
    const cloneCircuitPin = (pin) => {
        const clone = {
            ...pin,
            value: pin.value ?? defaultValue,
        };
        if ("inputItems" in pin && pin.inputItems) {
            clone.inputItems =
                pin.inputItems.map((input) => ({ ...input }));
        }
        if ("outputItem" in pin && pin.outputItem) {
            clone.outputItem = {
                ...pin.outputItem,
            };
        }
        if ("circuitPins" in pin && Array.isArray(pin.circuitPins)) {
            clone.circuitPins = pin.circuitPins.map((circuitPin) => ({ ...circuitPin }));
        }
        return clone;
    };
    return Object.fromEntries(Object.entries(pins[type]).map(([key, pin]) => [key, cloneCircuitPin(pin)]));
};
