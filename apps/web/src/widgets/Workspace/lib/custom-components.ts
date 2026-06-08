import { createEffect, createSignal, onCleanup } from "solid-js";
import type { ApiTemplateSummary } from "@cnbn/engine";
import type { WorkspaceUIEngine } from "./types";
import type { CinabonoClient } from "@cnbn/engine-worker";

export type WorkspaceCustomComponentsController = {
    components: () => ApiTemplateSummary[];
    selectedHash: () => string | undefined;
    setSelectedHash: (hash?: string) => void;
    selectedNodeCount: () => number;
    refresh: () => Promise<void>;
    createFromSelection: (name?: string) => Promise<void>;
    renameSelected: () => Promise<void>;
    removeSelected: () => Promise<void>;
    addComponent: (hash: string) => Promise<void>;
    get isBusy(): boolean;
};

type WorkspaceCustomComponentsDeps = {
    logicEngine: CinabonoClient;
    uiEngine: WorkspaceUIEngine;
    getActiveTabId: () => string | undefined;
    getActiveScopeId: () => string | undefined;
};

const toVisualInput = (component: ApiTemplateSummary) => ({
    hash: component.hash,
    name: component.name,
    label: component.label,
    inputCount: component.inputCount,
    outputCount: component.outputCount,
    runtime: component.runtime,
});

const isNodeCell = (cell: unknown): cell is { id: string; isNode: () => boolean } => {
    if (typeof cell !== "object" || cell === null) return false;

    const candidate = cell as { id?: unknown; isNode?: unknown };
    return typeof candidate.id === "string" && typeof candidate.isNode === "function" && candidate.isNode();
};

const errorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === "object" && error && "error" in error) {
        const nested = (error as { error?: unknown }).error;
        if (nested instanceof Error) return nested.message;
    }
    return fallback;
};

export const createWorkspaceCustomComponents = (
    deps: WorkspaceCustomComponentsDeps,
): WorkspaceCustomComponentsController => {
    const [components, setComponents] = createSignal<ApiTemplateSummary[]>([]);
    const [selectedHash, setSelectedHash] = createSignal<string | undefined>();
    const [selectionVersion, setSelectionVersion] = createSignal(0);
    const [busy, setBusy] = createSignal(false);

    const registerVisuals = (nextComponents = components()) => {
        if (!deps.uiEngine.debug.graph()) return;
        deps.uiEngine.commands.registerCustomComponents(nextComponents.map(toVisualInput));
    };

    const refresh = async () => {
        const templates = (await deps.logicEngine.call("/template/list", undefined)) as ApiTemplateSummary[];
        const custom = templates.filter((template) => template.custom);
        setComponents(custom);
        if (selectedHash() && !custom.some((component) => component.hash === selectedHash())) {
            setSelectedHash(custom[0]?.hash);
        }
        registerVisuals(custom);
    };

    const selectedNodeIds = (): string[] => {
        selectionVersion();
        const graph = deps.uiEngine.debug.graph();
        if (!graph?.getSelectedCells) return [];
        return graph.getSelectedCells().filter(isNodeCell).map((cell) => cell.id);
    };

    const selectedNodeCount = (): number => selectedNodeIds().length;

    const createFromSelection = async (providedName?: string) => {
        const tabId = deps.getActiveTabId();
        const scopeId = deps.getActiveScopeId();
        const selectedItemIds = selectedNodeIds();
        if (!tabId || !scopeId) return;
        if (selectedItemIds.length === 0) {
            window.alert("Select at least one component before saving a custom component.");
            return;
        }

        const name = providedName ?? window.prompt("Custom component name");
        if (!name?.trim()) return;

        setBusy(true);
        try {
            const result = await deps.logicEngine.call("/template/createFromSelection", {
                tabId,
                scopeId,
                name,
                selectedItemIds,
            });
            setSelectedHash(result.summary.hash);
            await refresh();
        } catch (error) {
            window.alert(errorMessage(error, "Unable to save the selected custom component."));
        } finally {
            setBusy(false);
        }
    };

    const renameSelected = async () => {
        const hash = selectedHash();
        const current = components().find((component) => component.hash === hash);
        if (!current) return;

        const name = window.prompt("Custom component name", current.name);
        if (!name?.trim() || name.trim() === current.name) return;

        setBusy(true);
        try {
            await deps.logicEngine.call("/template/update", { hash: current.hash, name });
            await refresh();
        } catch (error) {
            window.alert(errorMessage(error, "Unable to rename the selected custom component."));
        } finally {
            setBusy(false);
        }
    };

    const removeSelected = async () => {
        const hash = selectedHash();
        const current = components().find((component) => component.hash === hash);
        if (!current) return;
        if (!window.confirm(`Delete custom component "${current.name}"?`)) return;

        setBusy(true);
        try {
            await deps.logicEngine.call("/template/remove", { hash: current.hash });
            await refresh();
        } catch (error) {
            window.alert(errorMessage(error, "Unable to delete the selected custom component."));
        } finally {
            setBusy(false);
        }
    };

    const addComponent = async (hash: string) => {
        if (!deps.uiEngine.state.activeScopeId()) return;
        try {
            await deps.uiEngine.commands.addNode({
                hash,
                kind: "circuit:logic",
            });
        } catch (error) {
            window.alert(errorMessage(error, "Unable to add the selected custom component."));
        }
    };

    createEffect(() => {
        deps.uiEngine.debug.graph();
        registerVisuals();
    });

    createEffect(() => {
        const graph = deps.uiEngine.debug.graph();
        if (!graph) return;

        const bumpSelection = () => setSelectionVersion((version) => version + 1);
        graph.on("node:selected", bumpSelection);
        graph.on("node:unselected", bumpSelection);
        graph.on("cell:selected", bumpSelection);
        graph.on("cell:unselected", bumpSelection);
        graph.on("selection:changed", bumpSelection);
        bumpSelection();

        onCleanup(() => {
            graph.off("node:selected", bumpSelection);
            graph.off("node:unselected", bumpSelection);
            graph.off("cell:selected", bumpSelection);
            graph.off("cell:unselected", bumpSelection);
            graph.off("selection:changed", bumpSelection);
        });
    });

    void refresh();

    return {
        components,
        selectedHash,
        setSelectedHash,
        selectedNodeCount,
        refresh,
        createFromSelection,
        renameSelected,
        removeSelected,
        addComponent,
        get isBusy() {
            return busy();
        },
    };
};
