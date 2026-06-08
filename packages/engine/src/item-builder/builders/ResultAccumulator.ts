import { StructureBuilderResult } from "../types/StructureBuilder";

export class ResultAccumulator {
    private readonly _result: StructureBuilderResult = {
        items: [],
        scopes: [],
        linkIds: new Set(),
        circuitRemaps: new Map(),
    };

    public add(result: Partial<StructureBuilderResult>) {
        this._result.items.push(...(result.items ?? []));
        this._result.scopes.push(...(result.scopes ?? []));

        if (result.linkIds) result.linkIds.forEach((v) => this._result.linkIds.add(v));
        if (result.circuitRemaps) {
            result.circuitRemaps.forEach((value, key) => this._result.circuitRemaps.set(key, value));
        }

        return this;
    }

    public get(): StructureBuilderResult {
        return this._result;
    }
}
