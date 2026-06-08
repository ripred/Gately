import { hasItemInputPins, hasItemOutputPins, isCircuitItem, isItem, } from "@cnbn/schema";
export const isBakedItem = (arg) => {
    return isCircuitItem(arg) && arg.options?.baked === true;
};
export const isComputableItem = (arg) => {
    if (!isItem(arg))
        return false;
    if (isCircuitItem(arg))
        return isBakedItem(arg);
    return hasItemInputPins(arg) && hasItemOutputPins(arg);
};
