export type LogicNodeHashes =
    | "BUFFER"
    | "AND"
    | "OR"
    | "NOT"
    | "NAND"
    | "NOR"
    | "XOR"
    | "XNOR"
    | "SHIFT_REGISTER_8";

export type GeneratorNodeHashes = "TOGGLE" | "TRUE_CONSTANT" | "FALSE_CONSTANT" | "CLOCK";
export type DisplayNodeHashes = "LAMP" | "7_SEG_DISPLAY";

export type NodeHashes = LogicNodeHashes | GeneratorNodeHashes | DisplayNodeHashes;
