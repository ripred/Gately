import { WithOf } from "../shared.js";
import { KindKey, LogicValue, PinIndex } from "./types.js";
export type isSymmetric = boolean;
export type AutoTriggers = Record<PinIndex, AutoTrigger>;
export type AutoTrigger = {
    initialValue: LogicValue;
};
export type CustomComponentRuntimeMode = "baked-combinational" | "expanded-stateful" | "expanded-unsupported";
export type CustomComponentRuntimeMeta = {
    mode: CustomComponentRuntimeMode;
    reason?: string;
    inputCount: number;
    outputCount: number;
    rowCount?: number;
    signature: string;
    updatedAt: number;
};
export type WithMeta<K extends KindKey = KindKey> = {
    meta?: WithOf<K, MetaMap>;
};
export type MetaMap = {
    base: {
        generator: {
            autoTriggers?: AutoTriggers;
            numOfOutputs?: number;
        };
        logic: {
            isSymmetric?: boolean;
            numOfInputs?: number;
            numOfOutputs?: number;
        };
        display: {
            numOfInputs?: number;
        };
    };
    circuit: {
        logic: {
            isSymmetric?: boolean;
            custom?: boolean;
            label?: string;
            createdAt?: number;
            updatedAt?: number;
            runtime?: CustomComponentRuntimeMeta;
        };
    };
};
//# sourceMappingURL=meta.d.ts.map