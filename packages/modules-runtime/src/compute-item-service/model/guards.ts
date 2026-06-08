import {
    CircuitItem,
    hasItemInputPins,
    hasItemOutputPins,
    isCircuitItem,
    isItem,
} from "@cnbn/schema";
import { ComputableItem } from "./types";

export const isBakedItem = (arg: unknown): arg is CircuitItem => {
    return isCircuitItem(arg) && arg.options?.baked === true;
};

export const isComputableItem = (arg: unknown): arg is ComputableItem => {
    if (!isItem(arg)) return false;
    if (isCircuitItem(arg)) return isBakedItem(arg);

    return hasItemInputPins(arg) && hasItemOutputPins(arg);
};
