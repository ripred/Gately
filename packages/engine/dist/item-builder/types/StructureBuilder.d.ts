import { ItemOfKind, ScopeOfKind, Id } from "@cnbn/schema";
import type { RemapState } from "./RemapState.js";
export interface StructureBuilderResult {
    items: ItemOfKind[];
    scopes: ScopeOfKind[];
    linkIds: Set<Id>;
    circuitRemaps: Map<Id, RemapState>;
}
//# sourceMappingURL=StructureBuilder.d.ts.map