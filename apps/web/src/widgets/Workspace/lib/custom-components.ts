import { createEffect, createSignal } from "solid-js";
import type { ApiTemplateSummary } from "@cnbn/engine";
import type { WorkspaceUIEngine } from "./types";
import type { CinabonoClient } from "@cnbn/engine-worker";

export type WorkspaceCustomComponentsController = {
    components: () => ApiTemplateSummary[];
    selectedHash: () => string | undefined;
    setSelectedHash: (hash?: string) => void;
    refresh: () => Promise<void>;
    createFromSelection: () => Promise<void>;
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
});

const isNodeCell = (cell: unknown): cell is { id: string; isNode: () => boolean } => {
    if (typeof cell !== "object" || cell === null) return false;

    const candidate = cell as { id?: unknown; isNode?: unknown };
    return typeof candidate.id === "string" && typeof candidate.isNode === "function" && candidate.isNode();
};

export const createWorkspaceCustomComponents = (
    deps: WorkspaceCustomComponentsDeps,
): WorkspaceCustomComponentsController => {
    const [components, setComponents] = createSignal<ApiTemplateSummary[]>([]);
    const [selectedHash, setSelectedHash] = createSignal<string | undefined>();
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
        const graph = deps.uiEngine.debug.graph();
        if (!graph?.getSelectedCells) return [];
        return graph.getSelectedCells().filter(isNodeCell).map((cell) => cell.id);
    };

    const createFromSelection = async () => {
        const tabId = deps.getActiveTabId();
        const scopeId = deps.getActiveScopeId();
        const selectedItemIds = selectedNodeIds();
        if (!tabId || !scopeId || selectedItemIds.length === 0) return;

        const name = window.prompt("Custom component name");
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
        } finally {
            setBusy(false);
        }
    };

    const addComponent = async (hash: string) => {
        if (!deps.uiEngine.state.activeScopeId()) return;
        await deps.uiEngine.commands.addNode({
            hash,
            kind: "circuit:logic",
        });
    };

    createEffect(() => {
        deps.uiEngine.debug.graph();
        registerVisuals();
    });

    void refresh();

    return {
        components,
        selectedHash,
        setSelectedHash,
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
