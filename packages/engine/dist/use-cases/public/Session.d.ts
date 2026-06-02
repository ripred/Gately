import type { Entries, Id, ItemLink, ItemOfKind, Scope, ScopeChildItem, TemplateOfKind } from "@cnbn/schema";
export declare const ENGINE_SESSION_VERSION = 1;
export type SerializedScope = Omit<Scope, "storedScopes" | "storedItems"> & {
    storedScopes: Id[];
    storedItems: Entries<Id, ScopeChildItem>;
};
export type SerializedTab = {
    id: Id;
    items: Entries<Id, ItemOfKind>;
    links: Entries<Id, ItemLink>;
    scopes: Entries<Id, SerializedScope>;
};
export type EngineSessionSnapshot = {
    version: typeof ENGINE_SESSION_VERSION;
    templates: Entries<string, TemplateOfKind>;
    tabs: SerializedTab[];
};
export interface ApiExportSession_Fn {
    (): EngineSessionSnapshot;
}
export interface ApiImportSession_Fn {
    (payload: EngineSessionSnapshot): {
        imported: true;
        tabCount: number;
        templateCount: number;
    };
}
export declare const exportSessionUC: import("../../api/index.js").ApiConfigFactory<import("../../api/index.js").ApiToken<ApiExportSession_Fn, "public">>;
export declare const importSessionUC: import("../../api/index.js").ApiConfigFactory<import("../../api/index.js").ApiToken<ApiImportSession_Fn, "public">>;
//# sourceMappingURL=Session.d.ts.map