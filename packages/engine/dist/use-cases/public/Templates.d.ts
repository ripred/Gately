import { Id, TemplateOfKind } from "@cnbn/schema";
export type ApiTemplateSummary = {
    hash: string;
    name: string;
    kind: TemplateOfKind["kind"];
    custom: boolean;
    inputCount: number;
    outputCount: number;
    label?: string;
    createdAt?: number;
    updatedAt?: number;
};
export type ApiCreateTemplateFromSelectionPayload = {
    tabId: Id;
    scopeId?: Id;
    selectedItemIds: Id[];
    name: string;
    hash?: string;
};
export type ApiCreateTemplateFromSelectionResult = {
    template: TemplateOfKind<"circuit:logic">;
    summary: ApiTemplateSummary;
};
export type ApiSaveTemplatePayload = {
    template: TemplateOfKind;
};
export type ApiGetTemplatePayload = {
    hash: string;
};
export type ApiUpdateTemplatePayload = {
    hash: string;
    name: string;
};
export type ApiRemoveTemplatePayload = {
    hash: string;
};
export interface ApiListTemplates_Fn {
    (): ApiTemplateSummary[];
}
export interface ApiGetTemplate_Fn {
    (payload: ApiGetTemplatePayload): TemplateOfKind;
}
export interface ApiSaveTemplate_Fn {
    (payload: ApiSaveTemplatePayload): ApiTemplateSummary;
}
export interface ApiUpdateTemplate_Fn {
    (payload: ApiUpdateTemplatePayload): ApiTemplateSummary;
}
export interface ApiRemoveTemplate_Fn {
    (payload: ApiRemoveTemplatePayload): {
        removed: boolean;
        template?: ApiTemplateSummary;
    };
}
export interface ApiCreateTemplateFromSelection_Fn {
    (payload: ApiCreateTemplateFromSelectionPayload): ApiCreateTemplateFromSelectionResult;
}
export declare const validateCustomTemplate: (template: TemplateOfKind) => TemplateOfKind<"circuit:logic">;
export declare const listTemplatesUC: import("../../api/index.js").ApiConfigFactory<import("../../api/index.js").ApiToken<ApiListTemplates_Fn, "public">>;
export declare const getTemplateUC: import("../../api/index.js").ApiConfigFactory<import("../../api/index.js").ApiToken<ApiGetTemplate_Fn, "public">>;
export declare const saveTemplateUC: import("../../api/index.js").ApiConfigFactory<import("../../api/index.js").ApiToken<ApiSaveTemplate_Fn, "public">>;
export declare const updateTemplateUC: import("../../api/index.js").ApiConfigFactory<import("../../api/index.js").ApiToken<ApiUpdateTemplate_Fn, "public">>;
export declare const removeTemplateUC: import("../../api/index.js").ApiConfigFactory<import("../../api/index.js").ApiToken<ApiRemoveTemplate_Fn, "public">>;
export declare const createTemplateFromSelectionUC: import("../../api/index.js").ApiConfigFactory<import("../../api/index.js").ApiToken<ApiCreateTemplateFromSelection_Fn, "public">>;
//# sourceMappingURL=Templates.d.ts.map