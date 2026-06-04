import { createSignal } from "solid-js";
import type { EngineSessionSnapshot } from "@cnbn/engine";
import type { CinabonoClient } from "@cnbn/engine-worker";
import type { LogicValue } from "@cnbn/schema";
import type {
    AppConfigurationController,
    AppConfigurationSnapshot,
} from "@gately/app/providers/AppConfigurationProvider";
import type {
    PinUpdate,
    UIEngineWorkspaceSnapshot,
} from "@gately/shared/infrastructure/ui-engine";
import type { WorkspaceUIEngine } from "./types";

const PROJECT_VERSION = 1;
const PROJECT_FILE_EXTENSION = ".gately.json";
const PROJECT_FILE_TYPE = "application/json";
const LOAD_SETTLE_MAX_BATCHES = 16;
const LOAD_SETTLE_BATCH_TICKS = 512;

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
    name: string;
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

type ProjectFileSelection = {
    file: File;
    handle?: FileSystemFileHandle;
};

type ProjectFileWriteResult = {
    handle?: FileSystemFileHandle;
    saved: boolean;
};

type EngineTabSnapshot = EngineSessionSnapshot["tabs"][number];
type EngineItemSnapshot = EngineTabSnapshot["items"][number][1];

const waitForPaint = (): Promise<void> =>
    new Promise((resolve) => {
        if (typeof requestAnimationFrame === "function") {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
            return;
        }

        setTimeout(resolve, 0);
    });

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

const getOutputPinValue = (
    item: EngineItemSnapshot | undefined,
    pin: string,
): LogicValue | undefined => {
    if (!item || !("outputPins" in item)) return undefined;

    return item.outputPins?.[pin]?.value;
};

const differentLogicValue = (value: LogicValue): LogicValue => {
    switch (value) {
        case "0":
            return "1";
        case "1":
            return "0";
        case "Z":
            return "X";
        default:
            return "Z";
    }
};

const collectPinPatches = (tab: EngineTabSnapshot | undefined): PinUpdate[] => {
    if (!tab) return [];

    const patches: PinUpdate[] = [];
    tab.items.forEach(([entryId, item]) => {
        const elementId = item.id ?? entryId;

        if ("inputPins" in item) {
            Object.entries(item.inputPins ?? {}).forEach(([index, pin]) => {
                patches.push({
                    elementId,
                    pinRef: { side: "input", index },
                    value: pin.value,
                });
            });
        }

        if ("outputPins" in item) {
            Object.entries(item.outputPins ?? {}).forEach(([index, pin]) => {
                patches.push({
                    elementId,
                    pinRef: { side: "output", index },
                    value: pin.value,
                });
            });
        }
    });

    return patches;
};

const seedLinkedInputValues = async (
    deps: WorkspacePersistenceDeps,
    tab: EngineTabSnapshot,
): Promise<void> => {
    const itemsById = new Map(tab.items);

    for (const [, link] of tab.links) {
        const value = getOutputPinValue(itemsById.get(link.fromItemId), link.fromPin);
        if (value === undefined) continue;

        await deps.logicEngine.call("/item/updateInput", {
            tabId: tab.id,
            itemId: link.toItemId,
            pin: link.toPin,
            t: 0,
            value: differentLogicValue(value),
        });
        await deps.logicEngine.call("/item/updateInput", {
            tabId: tab.id,
            itemId: link.toItemId,
            pin: link.toPin,
            t: 1,
            value,
        });
    }
};

const settleTabSignals = async (
    deps: WorkspacePersistenceDeps,
    tabId: string,
): Promise<void> => {
    for (let batch = 0; batch < LOAD_SETTLE_MAX_BATCHES; batch += 1) {
        const status = await deps.logicEngine.call("/simulation/status", { tabId });
        if (status.status?.isFinished) return;

        await deps.logicEngine.call("/simulation/simulate", {
            tabId,
            runCfg: { maxBatchTicks: LOAD_SETTLE_BATCH_TICKS },
        });
    }

    console.warn("[workspace-persistence] loaded workspace simulation did not settle", { tabId });
};

const hydrateLoadedSignalState = async (
    deps: WorkspacePersistenceDeps,
    project: GatelyProjectSnapshot,
): Promise<void> => {
    for (const tab of project.engine.tabs) {
        await seedLinkedInputValues(deps, tab);
        await settleTabSignals(deps, tab.id);
    }

    const activeTabId = deps.uiEngine.state.activeTabId() ?? project.workspace.activeTabId;
    const currentProject = (await deps.logicEngine.call(
        "/session/export",
        undefined,
    )) as EngineSessionSnapshot;
    const activeTab = currentProject.tabs.find((tab) => tab.id === activeTabId);
    const patches = collectPinPatches(activeTab);

    if (!patches.length) return;

    await waitForPaint();
    deps.uiEngine.commands.applyPinPatch(patches);
    await waitForPaint();
    deps.uiEngine.commands.syncSignalPathValues();
};

const chooseProjectFile = async (): Promise<ProjectFileSelection | undefined> => {
    if (window.showOpenFilePicker) {
        const [handle] = await window.showOpenFilePicker({
            excludeAcceptAllOption: false,
            multiple: false,
            types: projectFilePickerTypes(),
        });
        const file = await handle?.getFile();
        return file ? { file, handle } : undefined;
    }

    return new Promise<ProjectFileSelection | undefined>((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = `${PROJECT_FILE_EXTENSION},.json`;
        input.style.display = "none";
        input.addEventListener(
            "change",
            () => {
                const [file] = Array.from(input.files ?? []);
                input.remove();
                resolve(file ? { file } : undefined);
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
    existingHandle?: FileSystemFileHandle,
): Promise<ProjectFileWriteResult> => {
    const blob = new Blob([`${JSON.stringify(project, null, 2)}\n`], {
        type: PROJECT_FILE_TYPE,
    });

    if (existingHandle) {
        const writable = await existingHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return { handle: existingHandle, saved: true };
    }

    if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
            suggestedName,
            types: projectFilePickerTypes(),
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return { handle, saved: true };
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
    return { saved: true };
};

export const createWorkspacePersistence = (
    deps: WorkspacePersistenceDeps,
): WorkspacePersistenceController => {
    const [busy, setBusy] = createSignal(false);
    let currentProjectFileHandle: FileSystemFileHandle | undefined;
    let currentProjectFileName: string | undefined;

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
        await hydrateLoadedSignalState(deps, project);
        deps.onAfterProjectLoad?.();
    };

    const saveWorkspace = async () => {
        setBusy(true);
        try {
            const result = await writeProjectFile(
                await buildProjectSnapshot(),
                currentProjectFileName ?? projectFileName(deps),
                currentProjectFileHandle,
            );
            if (result.handle) {
                currentProjectFileHandle = result.handle;
                currentProjectFileName = result.handle.name;
            }
            if (result.saved) deps.onAfterSave?.();
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
            const selection = await chooseProjectFile();
            if (!selection) return;

            await importProjectSnapshot(parseProject(await selection.file.text()));
            currentProjectFileHandle = selection.handle;
            currentProjectFileName = selection.handle?.name ?? selection.file.name;
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
