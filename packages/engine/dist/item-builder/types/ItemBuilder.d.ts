import { StructureBuilderResult } from "../../item-builder/types/StructureBuilder.js";
import { ItemFactory, ScopeFactory } from "@cnbn/modules-runtime";
import * as Schema from "@cnbn/schema";
import type { RemapState } from "./RemapState.js";
export interface InnerItemsBuilderCtx {
    innerItems: Schema.InnerItemsMap;
    circuitScope: Schema.CircuitScope;
    path: Schema.HierarchyPath;
    remap: RemapState;
}
export type ItemBuilderResult<K extends Schema.KindKey = Schema.KindKey> = Omit<StructureBuilderResult, "linkIds" | "circuitRemaps"> & {
    linkIds: Schema.Id[];
    builtItem: Schema.ItemOfKind<K>;
};
export interface ItemBuilderDeps {
    getTemplate: Schema.Read<"template">;
    itemFactory: ItemFactory;
    scopeFactory: ScopeFactory;
}
export type { RemapState };
export type BuiltItemsMap = Map<Schema.Id, Schema.ItemOfKind>;
//# sourceMappingURL=ItemBuilder.d.ts.map