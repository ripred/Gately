import { isCircuitItem } from "@cnbn/schema";
import { pinOps } from "@cnbn/helpers";
export const resolveOutputDriver = ({ getItem }, { itemId, pin }) => {
    const resolve = (target, visited) => {
        const key = `${target.itemId}:${target.pin}`;
        if (visited.has(key))
            return [];
        visited.add(key);
        const item = getItem(target.itemId);
        if (!item || item.options?.isEnable === false)
            return [];
        if (!isCircuitItem(item) || item.options?.baked === true)
            return [target];
        const driver = pinOps(item).output.items.get(target.pin);
        return driver ? resolve({ itemId: driver.itemId, pin: driver.pin }, visited) : [];
    };
    return resolve({ itemId, pin }, new Set());
};
