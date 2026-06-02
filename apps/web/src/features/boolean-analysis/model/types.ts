import type { ApiAnalyzeBoolean_Result } from "@cnbn/engine";
import type { CinabonoClient } from "@cnbn/engine-worker";
import type { UIEnginePublicApi } from "@gately/shared/infrastructure/ui-engine";

export type BooleanAnalysisControllerDeps = {
    logicEngine: CinabonoClient;
    uiEngine: Pick<UIEnginePublicApi, "commands" | "debug" | "state">;
    getActiveTabId: () => string | undefined;
    getActiveScopeId: () => string | undefined;
};

export type BooleanAnalysisController = {
    get isOpen(): boolean;
    get isBusy(): boolean;
    get isSynthesizing(): boolean;
    get result(): ApiAnalyzeBoolean_Result | undefined;
    get error(): string | undefined;
    analyze: () => void;
    createOptimizedCircuit: () => void;
    createOptimizedCircuitInNewTab: () => void;
    createDemoCircuitInNewTab: () => void;
    close: () => void;
};
