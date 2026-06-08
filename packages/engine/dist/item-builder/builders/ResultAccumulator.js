export class ResultAccumulator {
    _result = {
        items: [],
        scopes: [],
        linkIds: new Set(),
        circuitRemaps: new Map(),
    };
    add(result) {
        this._result.items.push(...(result.items ?? []));
        this._result.scopes.push(...(result.scopes ?? []));
        if (result.linkIds)
            result.linkIds.forEach((v) => this._result.linkIds.add(v));
        if (result.circuitRemaps) {
            result.circuitRemaps.forEach((value, key) => this._result.circuitRemaps.set(key, value));
        }
        return this;
    }
    get() {
        return this._result;
    }
}
