import { ItemFactory, ScopeFactory } from "@cnbn/modules-runtime";
import * as Schema from "@cnbn/schema";
import {
    BuiltItemsMap,
    InnerItemsBuilderCtx,
    ItemBuilderDeps,
} from "../types/ItemBuilder";
import { RemapService } from "./RemapService";
import { E } from "@engine/errors";
import { saveChildToScope } from "@cnbn/helpers/scope";
import { ResultAccumulator } from "./ResultAccumulator";
import { StructureBuilderResult } from "../types/StructureBuilder";
import { getBuiltItem } from "../helpers";

export class StructureBuilder {
    private readonly _getTpl: ItemBuilderDeps["getTemplate"];
    private readonly _mkItem: ItemFactory;
    private readonly _mkScope: ScopeFactory;
    private readonly _remap: RemapService;
    private readonly _builtItems: BuiltItemsMap = new Map();

    constructor(deps: ItemBuilderDeps, remapService: RemapService) {
        this._getTpl = deps.getTemplate;
        this._mkItem = deps.itemFactory;
        this._mkScope = deps.scopeFactory;
        this._remap = remapService;
    }

    public getBuiltItems() {
        return this._builtItems;
    }

    public clearBuiltItems(): void {
        this._builtItems.clear();
    }

    public build<K extends Schema.KindKey>(args: Schema.ItemArgsOfKind<K>): StructureBuilderResult {
        if (Schema.isBaseArgs(args)) return this._buildBase(args);
        else if (Schema.isCircuitArgs(args)) return this._buildCircuit(args);

        throw E.item.UnknownArgsKind(args);
    }

    private _buildBase<K extends Schema.KindKey>(
        args: Schema.ItemArgsOfKind<K>
    ): StructureBuilderResult {
        const item = this._mkItem(args);
        this._builtItems.set(item.id, item);

        return new ResultAccumulator().add({ items: [item] }).get();
    }

    private _buildCircuit(args: Schema.ItemArgsOfKind<"circuit:logic">): StructureBuilderResult {
        const circuit = this._mkItem<"circuit:logic">(args);
        this._builtItems.set(circuit.id, circuit);

        if (args.options?.baked === true) {
            return new ResultAccumulator().add({ items: [circuit] }).get();
        }

        const childRemap = this._remap.createRemap();

        const scope = this._mkScope<"circuit">({
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

    private _buildChildren(ctx: InnerItemsBuilderCtx): StructureBuilderResult {
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

    private _getItemArgsOfInnerItem<K extends Schema.KindKey>(
        item: Schema.InnerItem<K>,
        newId: Schema.Id,
        path: Schema.HierarchyPath
    ): Schema.ItemArgsOfKind<K> {
        if (item.kind === "circuit:logic") {
            const tpl = this._getTpl(item.hash);
            if (!tpl) throw E.template.NotFound(item.hash);

            const { inputPins, outputPins, items } = tpl as Schema.TemplateOfKind<"circuit:logic">;
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
            } as Schema.ItemArgsOfKind<"circuit:logic">;
        } else {
            return { ...item, id: newId, path };
        }
    }
}
