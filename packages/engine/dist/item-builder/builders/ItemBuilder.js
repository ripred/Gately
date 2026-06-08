import { StructureBuilder } from "./StructureBuilder.js";
import { CircuitIOBinder } from "./CircuitIOBuilder.js";
import { RemapService } from "./RemapService.js";
import { processMany } from "@cnbn/utils";
import { isCircuitArgs, isCircuitItem } from "@cnbn/schema";
import { exportBuilderResult } from "../helpers.js";
export class DefaultItemBuilder {
    _structureBuilder;
    _remapService;
    constructor(deps) {
        this._remapService = new RemapService();
        this._structureBuilder = new StructureBuilder(deps, this._remapService);
    }
    build(itemArgs) {
        this._structureBuilder.clearBuiltItems();
        const result = this._structureBuilder.build(itemArgs);
        if (isCircuitArgs(itemArgs))
            this._remapForCircuit(result);
        return exportBuilderResult(result);
    }
    _remapForCircuit(result) {
        const builtItems = this._structureBuilder.getBuiltItems();
        const binder = new CircuitIOBinder(builtItems);
        processMany(result.items, (item) => {
            if (!isCircuitItem(item))
                return;
            const remap = result.circuitRemaps.get(item.id);
            if (!remap)
                throw new Error(`Missing remap state for circuit item "${item.id}".`);
            this._remapService.remapCircuitInOutPins(item, remap);
            binder.bind(item);
        });
    }
}
