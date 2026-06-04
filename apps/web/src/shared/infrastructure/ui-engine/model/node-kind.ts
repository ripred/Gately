import type { KindKey } from "@cnbn/schema";
import type { NodeHashes } from "./nodes-spec";

export type BaseNodeKind = "base:logic" | "base:generator" | "base:display";
export type UINodeKind = BaseNodeKind | "circuit:logic";

const NODE_KIND_BY_HASH: Record<NodeHashes, BaseNodeKind> = {
    BUFFER: "base:logic",
    AND: "base:logic",
    OR: "base:logic",
    NOT: "base:logic",
    NAND: "base:logic",
    NOR: "base:logic",
    XOR: "base:logic",
    XNOR: "base:logic",
    SHIFT_REGISTER_8: "base:logic",
    TOGGLE: "base:generator",
    CLOCK: "base:generator",
    LAMP: "base:display",
    "7_SEG_DISPLAY": "base:display",
    TRUE_CONSTANT: "base:generator",
    FALSE_CONSTANT: "base:generator",
};

export const getNodeKindByHash = (hash: string, fallback: UINodeKind = "circuit:logic"): KindKey =>
    NODE_KIND_BY_HASH[hash as NodeHashes] ?? fallback;
