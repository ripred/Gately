import { ApiFactories } from "../../api/index.js";
import { validateCustomTemplate } from "./Templates.js";
export const ENGINE_SESSION_VERSION = 1;
const isCustomTemplate = (template) => template.kind === "circuit:logic" && Boolean(template.meta?.custom);
const validateSessionSnapshot = (payload) => {
    if (payload.version !== ENGINE_SESSION_VERSION) {
        throw new Error(`Unsupported engine session version "${payload.version}".`);
    }
    if (!Array.isArray(payload.templates)) {
        throw new Error("Engine session templates are invalid.");
    }
    if (!Array.isArray(payload.tabs)) {
        throw new Error("Engine session tabs are invalid.");
    }
    payload.templates.forEach(([hash, template]) => {
        if (!isCustomTemplate(template))
            return;
        const custom = validateCustomTemplate(template);
        if (custom.hash !== hash) {
            throw new Error(`Custom template key "${hash}" does not match hash "${custom.hash}".`);
        }
    });
    return payload;
};
const serializeScope = (scope) => ({
    id: scope.id,
    kind: scope.kind,
    path: [...scope.path],
    storedScopes: Array.from(scope.storedScopes),
    storedItems: Array.from(scope.storedItems.entries()),
});
const deserializeScope = (scope) => ({
    id: scope.id,
    kind: scope.kind,
    path: [...scope.path],
    storedScopes: new Set(scope.storedScopes),
    storedItems: new Map(scope.storedItems),
});
const serializeTab = (tab) => ({
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
        });
        return exportSession;
    },
}));
export const importSessionUC = ApiFactories.config((tokens) => ({
    token: tokens.session.import,
    factory: (ctx) => {
        const importSession = ((payload) => {
            const snapshot = validateSessionSnapshot(payload);
            ctx.deps.stores.tab.export().forEach(([tabId, tab]) => {
                tab.close();
                ctx.deps.stores.tab.remove(tabId);
            });
            ctx.deps.stores.template.export().forEach(([hash, template]) => {
                if (isCustomTemplate(template))
                    ctx.deps.stores.template.remove(hash);
            });
            snapshot.templates.forEach(([hash, template]) => {
                if (!isCustomTemplate(template))
                    return;
                ctx.deps.stores.template.insert(hash, template);
            });
            snapshot.tabs.forEach((tabSnapshot) => {
                const tab = ctx.deps.factories.tab(tabSnapshot.id);
                ctx.deps.stores.tab.insert(tab.id, tab);
                tabSnapshot.items.forEach(([id, item]) => tab.ctx.itemStore.insert(id, item));
                tabSnapshot.links.forEach(([id, link]) => tab.ctx.linkStore.insert(id, link));
                tabSnapshot.scopes.forEach(([id, scope]) => tab.ctx.scopeStore.insert(id, deserializeScope(scope)));
            });
            return {
                imported: true,
                tabCount: snapshot.tabs.length,
                templateCount: snapshot.templates.length,
            };
        });
        return importSession;
    },
}));
