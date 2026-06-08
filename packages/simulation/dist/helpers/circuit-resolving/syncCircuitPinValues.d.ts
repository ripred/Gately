import { Id, PinIndex, Read } from "@cnbn/schema";
type CircuitPinChange = {
    type: "input" | "output";
    pin: PinIndex;
};
export declare const syncCircuitPinValues: (getItem: Read<"item">, itemId: Id, changed?: CircuitPinChange, visited?: Set<string>) => void;
export {};
//# sourceMappingURL=syncCircuitPinValues.d.ts.map