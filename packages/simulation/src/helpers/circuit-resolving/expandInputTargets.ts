import { isCircuitItem } from "@cnbn/schema";
import { SimulationCtx } from "@sim/model";
import { TargetParams } from "./types";
import { pinOps } from "@cnbn/helpers";

export const expandInputTargets = (
    { getItem }: Pick<SimulationCtx, "getItem">,
    { itemId, pin: inputPin }: TargetParams
): TargetParams[] => {
    const expand = (target: TargetParams, visited: Set<string>): TargetParams[] => {
        const key = `${target.itemId}:${target.pin}`;
        if (visited.has(key)) return [];
        visited.add(key);

        const item = getItem(target.itemId);
        if (!item || item.options?.isEnable === false) return [];

        if (!isCircuitItem(item) || item.options?.baked === true) return [target];

        const receivers = pinOps(item).input.items.get(target.pin);
        return receivers.flatMap((receiver) => expand(receiver, visited));
    };

    return expand({ itemId, pin: inputPin }, new Set());
};
