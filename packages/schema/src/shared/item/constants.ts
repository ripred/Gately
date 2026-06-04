export const ItemRegistry = {
    base: ["generator", "display", "logic"],
    circuit: ["logic"],
} as const;

export const LogicItemNameList = [
    "AND",
    "NOT",
    "BUFFER",
    "OR",
    "NOR",
    "NAND",
    "XOR",
    "XNOR",
    "SHIFT_REGISTER_8",
] as const;
