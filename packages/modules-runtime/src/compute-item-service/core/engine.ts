import { CircuitItem, isLogicItem, LogicItem, LogicValue } from "@cnbn/schema";
import { ComputableItem } from "../model/types";
import { BakeStoreContract, Computable, ComputeStoreContract } from "../model/contracts";
import { isBakedItem } from "../model/guards";

type BinaryLogicValue = "0" | "1";

const comparePin = (left: string, right: string): number => {
    const a = Number(left);
    const b = Number(right);

    if (Number.isFinite(a) && Number.isFinite(b)) return a - b;
    return left.localeCompare(right);
};

const orderedPinValues = (item: CircuitItem): LogicValue[] =>
    Object.keys(item.inputPins)
        .sort(comparePin)
        .map((pin) => item.inputPins[pin].value);

const rowIndexFor = (inputs: BinaryLogicValue[]): number =>
    inputs.length === 0 ? 0 : parseInt(inputs.join(""), 2);

export class DefaultComputeEngine implements Computable {
    constructor(
        private readonly _compute: ComputeStoreContract,
        private readonly _bake: BakeStoreContract
    ) {}

    public computeOuts(item: ComputableItem): LogicValue[] {
        if (isBakedItem(item)) return this._computeBaked(item);
        if (isLogicItem(item)) return this._computeLogic(item);

        throw new Error(`Unsupported type of item kind: "${item.kind}" (hash: ${item.hash})`);
    }

    private _computeLogic(item: LogicItem): LogicValue[] {
        const fn = this._compute.get(item.hash);
        if (fn) return fn(item);

        throw new Error(
            `Missing compute function for item name: "${item.name}" (hash: ${item.hash})`
        );
    }

    private _computeBaked(item: CircuitItem): LogicValue[] {
        const truthTable = this._bake.get(item.hash);
        if (!truthTable)
            throw new Error(
                `Missing bake table for item name: "${item.name}" (hash: ${item.hash})`
            );

        const inputs = orderedPinValues(item);
        if (inputs.every((value): value is BinaryLogicValue => value === "0" || value === "1")) {
            return this._readBakedRow(item, truthTable, rowIndexFor(inputs));
        }

        const unknownIndices = inputs
            .map((value, index) => ({ index, value }))
            .filter(({ value }) => value !== "0" && value !== "1");
        const fallback: LogicValue = unknownIndices.some(
            ({ value }) => value === "X" || value === "Z",
        )
            ? "X"
            : "C";
        const outputCount = this._readBakedRow(item, truthTable, 0).length;
        const stableOutputs: Array<LogicValue | undefined> = Array(outputCount);
        const completions = 2 ** unknownIndices.length;

        for (let completion = 0; completion < completions; completion++) {
            const completed = [...inputs] as BinaryLogicValue[];
            unknownIndices.forEach(({ index }, bitIndex) => {
                const bit = (completion >> (unknownIndices.length - bitIndex - 1)) & 1;
                completed[index] = bit === 1 ? "1" : "0";
            });

            const outputs = this._readBakedRow(item, truthTable, rowIndexFor(completed));
            outputs.forEach((value, index) => {
                if (stableOutputs[index] === undefined) {
                    stableOutputs[index] = value;
                } else if (stableOutputs[index] !== value) {
                    stableOutputs[index] = fallback;
                }
            });
        }

        return stableOutputs.map((value) => value ?? fallback);
    }

    private _readBakedRow(
        item: CircuitItem,
        truthTable: string[],
        rowIndex: number,
    ): LogicValue[] {
        const outputPattern = truthTable[rowIndex];

        if (outputPattern === undefined) {
            throw new Error(`No row #${rowIndex} in bake table for item name: "${item.name}"`);
        }

        return outputPattern.split("") as LogicValue[];
    }
}
