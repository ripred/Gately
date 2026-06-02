import { analyzeBooleanScope } from "@engine/analysis";
import type { BooleanAnalysisResult, BooleanAnalysisScopeInput } from "@engine/analysis";
import { ApiFactories } from "@engine/api";

export type ApiAnalyzeBoolean_Payload = BooleanAnalysisScopeInput;
export type ApiAnalyzeBoolean_Result = BooleanAnalysisResult;

export interface ApiAnalyzeBoolean_Fn {
    (payload: ApiAnalyzeBoolean_Payload): ApiAnalyzeBoolean_Result;
}

export const analyzeBooleanUC = ApiFactories.config((tokens) => ({
    token: tokens.analysis.boolean,
    factory: (ctx) => {
        const analyzeBoolean = ((payload) => {
            const tab = ctx.tools.global.getTab(payload.tabId);
            const exportedScopes = tab.ctx.scopeStore.export();
            const scope =
                tab.ctx.scopeStore.get(payload.scopeId ?? payload.tabId) ??
                exportedScopes[0]?.[1];

            if (!scope) {
                throw new Error(`No scope found for tab "${payload.tabId}".`);
            }

            return analyzeBooleanScope({
                tabId: tab.id,
                scope,
                items: tab.ctx.itemStore.export().map(([, item]) => item),
                links: tab.ctx.linkStore.export().map(([, link]) => link),
            });
        }) as ApiAnalyzeBoolean_Fn;

        return analyzeBoolean;
    },
}));
