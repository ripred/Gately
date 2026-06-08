import { isCircuitItem } from "@cnbn/schema";
import { SimulationCtx } from "../../model";
import { TargetParams } from "./types";
import { pinOps } from "@cnbn/helpers";

export const resolveOutputDriver = (
    { getItem }: Pick<SimulationCtx, "getItem">,
    { itemId, pin }: TargetParams
): TargetParams[] => {
    const resolve = (target: TargetParams, visited: Set<string>): TargetParams[] => {
        const key = `${target.itemId}:${target.pin}`;
        if (visited.has(key)) return [];
        visited.add(key);

        const item = getItem(target.itemId);
        if (!item || item.options?.isEnable === false) return [];

        if (!isCircuitItem(item) || item.options?.baked === true) return [target];

        const driver = pinOps(item).output.items.get(target.pin);
        return driver ? resolve({ itemId: driver.itemId, pin: driver.pin }, visited) : [];
    };

    return resolve({ itemId, pin }, new Set());
};
