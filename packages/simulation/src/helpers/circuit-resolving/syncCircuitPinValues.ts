import { listAllCircuitPins, pinOps } from "@cnbn/helpers";
import { CircuitPinRef, Id, isCircuitItem, LogicValue, PinIndex, Read } from "@cnbn/schema";

type CircuitPinChange = {
    type: "input" | "output";
    pin: PinIndex;
};

export const syncCircuitPinValues = (
    getItem: Read<"item">,
    itemId: Id,
    changed?: CircuitPinChange,
    visited = new Set<string>()
): void => {
    const item = getItem(itemId);
    if (!item) return;

    const propagateToCircuits = (
        refs: CircuitPinRef[],
        newValue: LogicValue,
        type: "input" | "output"
    ) => {
        for (const ref of refs) {
            const key = `${type}:${ref.circuitId}:${ref.circuitPin}`;
            if (visited.has(key)) continue;
            visited.add(key);

            const circuit = getItem(ref.circuitId);
            if (!circuit || !isCircuitItem(circuit)) continue;

            pinOps(circuit)[type].value.set(ref.circuitPin, newValue);
            syncCircuitPinValues(
                getItem,
                ref.circuitId,
                { type, pin: ref.circuitPin },
                visited
            );
        }
    };

    if (changed) {
        const value = pinOps(item)[changed.type].value.get(changed.pin);
        const refs = pinOps(item)[changed.type].circuitPin.listByPin(changed.pin);
        propagateToCircuits(refs, value, changed.type);
        return;
    }

    const all = listAllCircuitPins(item);

    for (const [pin, circuitRefs] of all.in as [PinIndex, CircuitPinRef[]][]) {
        const value = pinOps(item).input.value.get(pin);

        propagateToCircuits(circuitRefs, value, "input");
    }

    for (const [pin, circuitRefs] of all.out as [PinIndex, CircuitPinRef[]][]) {
        const value = pinOps(item).output.value.get(pin);

        propagateToCircuits(circuitRefs, value, "output");
    }
};
