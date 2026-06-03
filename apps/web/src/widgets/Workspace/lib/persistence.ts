import { createSignal } from "solid-js";
import type { EngineSessionSnapshot } from "@cnbn/engine";
import type { CinabonoClient } from "@cnbn/engine-worker";
import type {
    UIEngineWorkspaceSnapshot,
} from "@gately/shared/infrastructure/ui-engine/model/types";
import type { WorkspaceUIEngine } from "./types";

const STORAGE_KEY = "gately.workspace.v1";
const PROJECT_VERSION = 1;

type GatelyProjectSnapshot = {
    version: typeof PROJECT_VERSION;
    savedAt: number;
    engine: EngineSessionSnapshot;
    workspace: UIEngineWorkspaceSnapshot;
};

export type WorkspacePersistenceController = {
    hasSavedWorkspace: () => boolean;
    saveWorkspace: () => Promise<void>;
    loadWorkspace: () => Promise<void>;
    createTab: () => Promise<void>;
    get isBusy(): boolean;
};

type WorkspacePersistenceDeps = {
    logicEngine: CinabonoClient;
    uiEngine: WorkspaceUIEngine;
    onAfterLoad?: () => Promise<void> | void;
};

const readProject = (): GatelyProjectSnapshot | undefined => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    let parsed: Partial<GatelyProjectSnapshot>;
    try {
        parsed = JSON.parse(raw) as Partial<GatelyProjectSnapshot>;
    } catch (cause) {
        throw new Error("Saved workspace data is not valid JSON.", { cause });
    }

    if (parsed.version !== PROJECT_VERSION || !parsed.engine || !parsed.workspace) {
        throw new Error("Saved workspace uses an unsupported format.");
    }

    return parsed as GatelyProjectSnapshot;
};

export const createWorkspacePersistence = (
    deps: WorkspacePersistenceDeps,
): WorkspacePersistenceController => {
    const [busy, setBusy] = createSignal(false);
    const [hasSavedWorkspace, setHasSavedWorkspace] = createSignal(
        Boolean(window.localStorage.getItem(STORAGE_KEY)),
    );

    const saveWorkspace = async () => {
        setBusy(true);
        try {
            const project: GatelyProjectSnapshot = {
                version: PROJECT_VERSION,
                savedAt: Date.now(),
                engine: (await deps.logicEngine.call("/session/export", undefined)) as EngineSessionSnapshot,
                workspace: deps.uiEngine.commands.exportWorkspaceSnapshot(),
            };

            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
            setHasSavedWorkspace(true);
        } finally {
            setBusy(false);
        }
    };

    const loadWorkspace = async () => {
        setBusy(true);
        try {
            const project = readProject();
            if (!project) return;

            await deps.logicEngine.call("/session/import", project.engine);
            await deps.onAfterLoad?.();
            deps.uiEngine.commands.importWorkspaceSnapshot(project.workspace);
        } catch (error) {
            window.alert(error instanceof Error ? error.message : "Unable to load saved workspace.");
        } finally {
            setBusy(false);
        }
    };

    const createTab = async () => {
        await deps.uiEngine.commands.createTab({ name: "Untitled" });
    };

    return {
        hasSavedWorkspace,
        saveWorkspace,
        loadWorkspace,
        createTab,
        get isBusy() {
            return busy();
        },
    };
};
