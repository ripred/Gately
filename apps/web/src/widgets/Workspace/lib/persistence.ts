import { createSignal } from "solid-js";
import type { EngineSessionSnapshot } from "@cnbn/engine";
import type { CinabonoClient } from "@cnbn/engine-worker";
import type {
    AppConfigurationController,
    AppConfigurationSnapshot,
} from "@gately/app/providers/AppConfigurationProvider";
import type {
    UIEngineWorkspaceSnapshot,
} from "@gately/shared/infrastructure/ui-engine/model/types";
import type { WorkspaceUIEngine } from "./types";

const PROJECT_VERSION = 1;
const PROJECT_FILE_EXTENSION = ".gately.json";
const PROJECT_FILE_TYPE = "application/json";

type GatelyProjectSnapshot = {
    version: typeof PROJECT_VERSION;
    savedAt: number;
    engine: EngineSessionSnapshot;
    workspace: UIEngineWorkspaceSnapshot;
    configuration?: AppConfigurationSnapshot;
};

type FileSystemWritableFileStream = {
    close: () => Promise<void>;
    write: (data: Blob) => Promise<void>;
};

type FileSystemFileHandle = {
    createWritable: () => Promise<FileSystemWritableFileStream>;
    getFile: () => Promise<File>;
};

type FilePickerAcceptType = {
    accept: Record<string, string[]>;
    description: string;
};

declare global {
    interface Window {
        showOpenFilePicker?: (options?: {
            excludeAcceptAllOption?: boolean;
            multiple?: boolean;
            types?: FilePickerAcceptType[];
        }) => Promise<FileSystemFileHandle[]>;
        showSaveFilePicker?: (options?: {
            suggestedName?: string;
            types?: FilePickerAcceptType[];
        }) => Promise<FileSystemFileHandle>;
    }
}

export type WorkspacePersistenceController = {
    saveWorkspace: () => Promise<void>;
    loadWorkspace: () => Promise<void>;
    createTab: () => Promise<void>;
    get isBusy(): boolean;
};

type WorkspacePersistenceDeps = {
    logicEngine: CinabonoClient;
    uiEngine: WorkspaceUIEngine;
    configuration: AppConfigurationController;
    onAfterLoad?: () => Promise<void> | void;
    onAfterProjectLoad?: () => void;
    onAfterSave?: () => void;
    onDirty?: () => void;
};

const parseProject = (raw: string): GatelyProjectSnapshot => {
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

const userCanceledFilePicker = (error: unknown): boolean =>
    error instanceof DOMException && error.name === "AbortError";

const projectFilePickerTypes = (): FilePickerAcceptType[] => [
    {
        accept: {
            [PROJECT_FILE_TYPE]: [PROJECT_FILE_EXTENSION, ".json"],
        },
        description: "Gately workspace",
    },
];

const sanitizeFileName = (name: string): string => {
    const sanitized = name
        .trim()
        .replace(/[^a-z0-9._-]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
    return sanitized || "gately-workspace";
};

const projectFileName = (deps: WorkspacePersistenceDeps): string => {
    const activeTabId = deps.uiEngine.state.activeTabId();
    const activeTab = activeTabId
        ? deps.uiEngine.state.tabs().find((tab) => tab.id === activeTabId)
        : undefined;
    return `${sanitizeFileName(activeTab?.name ?? "gately-workspace")}${PROJECT_FILE_EXTENSION}`;
};

const chooseProjectFile = async (): Promise<File | undefined> => {
    if (window.showOpenFilePicker) {
        const [handle] = await window.showOpenFilePicker({
            excludeAcceptAllOption: false,
            multiple: false,
            types: projectFilePickerTypes(),
        });
        return handle?.getFile();
    }

    return new Promise<File | undefined>((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = `${PROJECT_FILE_EXTENSION},.json`;
        input.style.display = "none";
        input.addEventListener(
            "change",
            () => {
                const [file] = Array.from(input.files ?? []);
                input.remove();
                resolve(file);
            },
            { once: true },
        );
        input.addEventListener(
            "cancel",
            () => {
                input.remove();
                resolve(undefined);
            },
            { once: true },
        );
        document.body.append(input);
        input.click();
    });
};

const writeProjectFile = async (
    project: GatelyProjectSnapshot,
    suggestedName: string,
): Promise<boolean> => {
    const blob = new Blob([`${JSON.stringify(project, null, 2)}\n`], {
        type: PROJECT_FILE_TYPE,
    });

    if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
            suggestedName,
            types: projectFilePickerTypes(),
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
    }

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = suggestedName;
    link.style.display = "none";
    document.body.append(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return true;
};

export const createWorkspacePersistence = (
    deps: WorkspacePersistenceDeps,
): WorkspacePersistenceController => {
    const [busy, setBusy] = createSignal(false);

    const buildProjectSnapshot = async (): Promise<GatelyProjectSnapshot> => ({
        version: PROJECT_VERSION,
        savedAt: Date.now(),
        engine: (await deps.logicEngine.call("/session/export", undefined)) as EngineSessionSnapshot,
        workspace: deps.uiEngine.commands.exportWorkspaceSnapshot(),
        configuration: deps.configuration.exportSnapshot(),
    });

    const importProjectSnapshot = async (project: GatelyProjectSnapshot): Promise<void> => {
        await deps.logicEngine.call("/session/import", project.engine);
        await deps.onAfterLoad?.();
        deps.uiEngine.commands.importWorkspaceSnapshot(project.workspace);
        deps.configuration.importSnapshot(project.configuration);
        deps.onAfterProjectLoad?.();
    };

    const saveWorkspace = async () => {
        setBusy(true);
        try {
            const saved = await writeProjectFile(await buildProjectSnapshot(), projectFileName(deps));
            if (saved) deps.onAfterSave?.();
        } catch (error) {
            if (!userCanceledFilePicker(error)) {
                window.alert(error instanceof Error ? error.message : "Unable to save workspace.");
            }
        } finally {
            setBusy(false);
        }
    };

    const loadWorkspace = async () => {
        setBusy(true);
        try {
            const file = await chooseProjectFile();
            if (!file) return;

            await importProjectSnapshot(parseProject(await file.text()));
        } catch (error) {
            if (!userCanceledFilePicker(error)) {
                window.alert(error instanceof Error ? error.message : "Unable to load workspace file.");
            }
        } finally {
            setBusy(false);
        }
    };

    const createTab = async () => {
        await deps.uiEngine.commands.createTab({ name: "untitled" });
        deps.onDirty?.();
    };

    return {
        saveWorkspace,
        loadWorkspace,
        createTab,
        get isBusy() {
            return busy();
        },
    };
};
