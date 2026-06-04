import type { Graph, Node } from "@antv/x6";
import type { KindKey } from "@cnbn/schema";
import type { EngineSignalEvent } from "@gately/shared/types";
import type { Accessor } from "solid-js";
import type { XYCoords } from "@gately/shared/types";
import type {
    CustomComponentVisualInput,
    PinUpdate,
    UIScopeSnapshot,
    UIEngineTabCloseConditions,
    UIEngineTabCreateInput,
    UIEngineTab,
    UIEngineScope,
    UIEngineWorkspaceSnapshot,
} from "../model";

export type UIEngineAddNodeCommandInput = {
    hash: string;
    kind?: KindKey;
    meta?: { numOfInputs?: number; numOfOutputs?: number };
    position?: XYCoords;
};

export type UIEngineCreateTabCommandInput = UIEngineTabCreateInput;

export type UIEngineCloseTabCommandConditions = UIEngineTabCloseConditions;

export type UIEngineFitContentCommandInput = {
    padding?: number;
    minScale?: number;
    maxScale?: number;
};

export type UIEngineCommandApi = {
    createTab: (input?: UIEngineCreateTabCommandInput) => Promise<{ tabId: string }>;
    openTab: (tabId?: string) => void;
    openScope: (scopeId: string, tabId?: string) => void;
    renameScope: (scopeId: string, name: string) => void;
    canCloseTab: (tabId: string, conditions?: UIEngineCloseTabCommandConditions) => boolean;
    closeTab: (
        tabId: string,
        conditions?: UIEngineCloseTabCommandConditions,
    ) => Promise<boolean>;
    addNode: (input: UIEngineAddNodeCommandInput) => Promise<Node | undefined>;
    registerCustomComponents: (inputs: CustomComponentVisualInput[]) => void;
    zoomIn: () => number;
    zoomOut: () => number;
    resetZoom: () => number;
    fitContent: (input?: UIEngineFitContentCommandInput) => number;
    exportScopeSnapshot: () => UIScopeSnapshot;
    importScopeSnapshot: (snapshot?: Partial<UIScopeSnapshot> | null) => void;
    syncSignalPathValues: () => void;
    exportWorkspaceSnapshot: () => UIEngineWorkspaceSnapshot;
    importWorkspaceSnapshot: (snapshot: UIEngineWorkspaceSnapshot) => void;
    applyPinPatch: (patch: PinUpdate | PinUpdate[]) => void;
    applySignalEvents: (events: EngineSignalEvent | EngineSignalEvent[]) => void;
};

export type UIEngineStateApi = {
    ready: Accessor<boolean>;
    selectionCount: () => number;
    tabs: () => UIEngineTab[];
    activeTabId: Accessor<string | undefined>;
    activeScopeId: Accessor<string | undefined>;
    getScopeById: (id: string) => UIEngineScope | undefined;
    getScopeChildrenById: (id: string) => UIEngineScope[];
    getNavigationPathByTabId: (tabId: string) => string[];
    getNavigationScopesByTabId: (tabId: string) => UIEngineScope[];
    activeNavigationPath: () => string[];
    activeNavigationScopes: () => UIEngineScope[];
};

export type UIEngineMountApi = {
    setContainer: (container?: HTMLDivElement) => void;
};

export type UIEngineDebugApi = {
    graph: () => Graph | undefined;
};

export type UIEnginePublicApi = {
    mount: UIEngineMountApi;
    state: UIEngineStateApi;
    commands: UIEngineCommandApi;
    debug: UIEngineDebugApi;
};

export type UIEngineInstance = UIEnginePublicApi & {
    dispose: () => void;
};
