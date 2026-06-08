import * as Schema from "@cnbn/schema";
import { E } from "../../errors/index.js";
import { saveChildToScope } from "@cnbn/helpers/scope";
import { ResultAccumulator } from "./ResultAccumulator.js";
import { getBuiltItem } from "../helpers.js";
export class StructureBuilder {
    _getTpl;
    _mkItem;
    _mkScope;
    _remap;
    _builtItems = new Map();
    constructor(deps, remapService) {
        this._getTpl = deps.getTemplate;
        this._mkItem = deps.itemFactory;
        this._mkScope = deps.scopeFactory;
        this._remap = remapService;
    }
    getBuiltItems() {
        return this._builtItems;
    }
    clearBuiltItems() {
        this._builtItems.clear();
    }
    build(args) {
        if (Schema.isBaseArgs(args))
            return this._buildBase(args);
        else if (Schema.isCircuitArgs(args))
            return this._buildCircuit(args);
        throw E.item.UnknownArgsKind(args);
    }
    _buildBase(args) {
        const item = this._mkItem(args);
        this._builtItems.set(item.id, item);
        return new ResultAccumulator().add({ items: [item] }).get();
    }
    _buildCircuit(args) {
        const circuit = this._mkItem(args);
        this._builtItems.set(circuit.id, circuit);
        if (args.options?.baked === true) {
            return new ResultAccumulator().add({ items: [circuit] }).get();
        }
        const childRemap = this._remap.createRemap();
        const scope = this._mkScope({
            id: circuit.id,
            path: circuit.path,
            kind: "circuit",
        });
        const childrenResult = this._buildChildren({
            innerItems: args.items,
            circuitScope: scope,
            path: [...circuit.path, circuit.id],
            remap: childRemap,
        });
        return new ResultAccumulator()
            .add({
            items: [circuit],
            scopes: [scope],
            circuitRemaps: new Map([[circuit.id, childRemap]]),
        })
            .add(childrenResult)
            .get();
    }
    _buildChildren(ctx) {
        const { innerItems, circuitScope, path, remap } = ctx;
        const acc = new ResultAccumulator();
        for (const oldId in innerItems) {
            const innerItem = innerItems[oldId];
            const newId = this._remap.remapItemId(oldId, remap);
            const args = this._getItemArgsOfInnerItem(innerItem, newId, path);
            const built = this.build(args);
            const remappedLinks = this._remap.remapLinks(innerItem, remap);
            saveChildToScope(circuitScope, { id: newId, kind: getBuiltItem(built).kind });
            acc.add(built).add({ linkIds: remappedLinks });
        }
        return acc.get();
    }
    _getItemArgsOfInnerItem(item, newId, path) {
        if (item.kind === "circuit:logic") {
            const tpl = this._getTpl(item.hash);
            if (!tpl)
                throw E.template.NotFound(item.hash);
            const { inputPins, outputPins, items } = tpl;
            const meta = { ...(item.meta ?? {}), ...(tpl.meta ?? {}) };
            const options = { ...(item.options ?? {}), ...(tpl.options ?? {}) };
            return {
                ...item,
                id: newId,
                path,
                inputPins,
                outputPins,
                items,
                meta: Object.keys(meta).length ? meta : undefined,
                options: Object.keys(options).length ? options : undefined,
            };
        }
        else {
            return { ...item, id: newId, path };
        }
    }
}
