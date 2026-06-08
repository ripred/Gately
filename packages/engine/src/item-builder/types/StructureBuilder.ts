import { ItemOfKind, ScopeOfKind, Id } from "@cnbn/schema";
import type { RemapState } from "./RemapState";

export interface StructureBuilderResult {
    items: ItemOfKind[];
    scopes: ScopeOfKind[];
    linkIds: Set<Id>;
    circuitRemaps: Map<Id, RemapState>;
}
