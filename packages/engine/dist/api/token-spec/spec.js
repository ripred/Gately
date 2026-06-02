import { ApiFactories } from "../../api/helpers/index.js";
export const API_SPEC = {
    tab: {
        create: ApiFactories.token("createTab", "public"),
        remove: ApiFactories.token("removeTab", "public"),
    },
    item: {
        _unlinkSingle: ApiFactories.token("unlinkSingleItem", "internal"),
        unlink: ApiFactories.token("unlinkItems", "public"),
        _linkSingle: ApiFactories.token("linkSingleItem", "internal"),
        link: ApiFactories.token("linkItems", "public"),
        _createSingle: ApiFactories.token("createSingleItem", "internal"),
        create: ApiFactories.token("createItems", "public"),
        _removeSingle: ApiFactories.token("removeSingleItem", "internal"),
        remove: ApiFactories.token("removeItems", "public"),
        updateInput: ApiFactories.token("updateItemInput", "public"),
        updateOutput: ApiFactories.token("updateItemOutput", "public"),
    },
    scope: {
        _removeDeep: ApiFactories.token("removeScopeDeep", "internal"),
    },
    simulation: {
        simulate: ApiFactories.token("simulateTab", "public"),
        status: ApiFactories.token("simulationStatus", "public"),
    },
    analysis: {
        boolean: ApiFactories.token("booleanAnalysis", "public"),
    },
    template: {
        list: ApiFactories.token("listTemplates", "public"),
        save: ApiFactories.token("saveTemplate", "public"),
        update: ApiFactories.token("updateTemplate", "public"),
        remove: ApiFactories.token("removeTemplate", "public"),
        createFromSelection: ApiFactories.token("createTemplateFromSelection", "public"),
    },
    session: {
        export: ApiFactories.token("exportSession", "public"),
        import: ApiFactories.token("importSession", "public"),
    },
    plugins: {},
};
