import { listAllCircuitPins, pinOps } from "@cnbn/helpers";
import { isCircuitItem } from "@cnbn/schema";
export const syncCircuitPinValues = (getItem, itemId, changed, visited = new Set()) => {
    const item = getItem(itemId);
    if (!item)
        return;
    const propagateToCircuits = (refs, newValue, type) => {
        for (const ref of refs) {
            const key = `${type}:${ref.circuitId}:${ref.circuitPin}`;
            if (visited.has(key))
                continue;
            visited.add(key);
            const circuit = getItem(ref.circuitId);
            if (!circuit || !isCircuitItem(circuit))
                continue;
            pinOps(circuit)[type].value.set(ref.circuitPin, newValue);
            syncCircuitPinValues(getItem, ref.circuitId, { type, pin: ref.circuitPin }, visited);
        }
    };
    if (changed) {
        const value = pinOps(item)[changed.type].value.get(changed.pin);
        const refs = pinOps(item)[changed.type].circuitPin.listByPin(changed.pin);
        propagateToCircuits(refs, value, changed.type);
        return;
    }
    const all = listAllCircuitPins(item);
    for (const [pin, circuitRefs] of all.in) {
        const value = pinOps(item).input.value.get(pin);
        propagateToCircuits(circuitRefs, value, "input");
    }
    for (const [pin, circuitRefs] of all.out) {
        const value = pinOps(item).output.value.get(pin);
        propagateToCircuits(circuitRefs, value, "output");
    }
};
