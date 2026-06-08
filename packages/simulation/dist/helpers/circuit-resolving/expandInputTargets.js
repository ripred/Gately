import { isCircuitItem } from "@cnbn/schema";
import { pinOps } from "@cnbn/helpers";
export const expandInputTargets = ({ getItem }, { itemId, pin: inputPin }) => {
    const expand = (target, visited) => {
        const key = `${target.itemId}:${target.pin}`;
        if (visited.has(key))
            return [];
        visited.add(key);
        const item = getItem(target.itemId);
        if (!item || item.options?.isEnable === false)
            return [];
        if (!isCircuitItem(item) || item.options?.baked === true)
            return [target];
        const receivers = pinOps(item).input.items.get(target.pin);
        return receivers.flatMap((receiver) => expand(receiver, visited));
    };
    return expand({ itemId, pin: inputPin }, new Set());
};
