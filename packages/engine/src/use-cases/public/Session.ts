import { ApiFactories } from "@engine/api";
import type { TabContract } from "@engine/tab-factory";
import type { Entries, Id, ItemLink, ItemOfKind, Scope, ScopeChildItem, TemplateOfKind } from "@cnbn/schema";

export const ENGINE_SESSION_VERSION = 1;

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
    (payload: EngineSessionSnapshot): { imported: true; tabCount: number; templateCount: number };
}

const isCustomTemplate = (template: TemplateOfKind): boolean =>
    template.kind === "circuit:logic" && Boolean(template.meta?.custom);

const serializeScope = (scope: Scope): SerializedScope => ({
    id: scope.id,
    kind: scope.kind,
    path: [...scope.path],
    storedScopes: Array.from(scope.storedScopes),
    storedItems: Array.from(scope.storedItems.entries()),
});

const deserializeScope = (scope: SerializedScope): Scope => ({
    id: scope.id,
    kind: scope.kind,
    path: [...scope.path],
    storedScopes: new Set(scope.storedScopes),
    storedItems: new Map(scope.storedItems),
});

const serializeTab = (tab: TabContract): SerializedTab => ({
    id: tab.id,
    items: tab.ctx.itemStore.export(),
    links: tab.ctx.linkStore.export(),
    scopes: tab.ctx.scopeStore.export().map(([scopeId, scope]) => [scopeId, serializeScope(scope)]),
});

export const exportSessionUC = ApiFactories.config((tokens) => ({
    token: tokens.session.export,
    factory: (ctx) => {
        const exportSession = (() => {
            const templates = ctx.deps.stores.template
                .export()
                .filter(([, template]) => isCustomTemplate(template));
            const tabs = ctx.deps.stores.tab.export().map(([, tab]) => serializeTab(tab));

            return {
                version: ENGINE_SESSION_VERSION,
                templates,
                tabs,
            };
        }) as ApiExportSession_Fn;

        return exportSession;
    },
}));

export const importSessionUC = ApiFactories.config((tokens) => ({
    token: tokens.session.import,
    factory: (ctx) => {
        const importSession = ((payload) => {
            if (payload.version !== ENGINE_SESSION_VERSION) {
                throw new Error(`Unsupported engine session version "${payload.version}".`);
            }

            ctx.deps.stores.tab.export().forEach(([tabId, tab]) => {
                tab.close();
                ctx.deps.stores.tab.remove(tabId);
            });

            ctx.deps.stores.template.export().forEach(([hash, template]) => {
                if (isCustomTemplate(template)) ctx.deps.stores.template.remove(hash);
            });

            payload.templates.forEach(([hash, template]) => {
                if (!isCustomTemplate(template)) return;
                ctx.deps.stores.template.insert(hash, template);
            });

            payload.tabs.forEach((tabSnapshot) => {
                const tab = ctx.deps.factories.tab(tabSnapshot.id);
                ctx.deps.stores.tab.insert(tab.id, tab);

                tabSnapshot.items.forEach(([id, item]) => tab.ctx.itemStore.insert(id, item));
                tabSnapshot.links.forEach(([id, link]) => tab.ctx.linkStore.insert(id, link));
                tabSnapshot.scopes.forEach(([id, scope]) =>
                    tab.ctx.scopeStore.insert(id, deserializeScope(scope)),
                );
            });

            return {
                imported: true,
                tabCount: payload.tabs.length,
                templateCount: payload.templates.length,
            };
        }) as ApiImportSession_Fn;

        return importSession;
    },
}));

