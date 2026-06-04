import type { Graph, Node } from "@antv/x6";
import { pinRefToPortId } from "@gately/shared/infrastructure/ui-engine/lib/ports/decode-encode";
import { getPrimaryOutputPin } from "@gately/shared/infrastructure/ui-engine/lib/ports/node-ports";
import { createSignal } from "solid-js";
import { applyOptimisticOutput } from "./node-interactions/optimistic";
import type { WorkspaceUIEngine } from "./types";
import {
    DEFAULT_CLOCK_CONFIG,
    frequencyHzToPeriodMs,
    normalizeClockConfig,
    patchClockConfig,
    readClockConfig,
    type ClockConfig,
} from "./clock-config";
import type { CinabonoClient } from "@cnbn/engine-worker";

type BinaryValue = "0" | "1";

type WorkspaceClockControllerOptions = {
    logicEngine: CinabonoClient;
    uiEngine: WorkspaceUIEngine;
    getActiveTabId: () => string | undefined;
    isPaused: () => boolean;
    requestSimulationNow: () => void | Promise<void>;
};

type ClockNodeState = {
    timeoutId?: ReturnType<typeof setTimeout>;
    value: BinaryValue;
    busy: boolean;
};

type ClockNodeData = {
    hash?: string;
};

const flipBinaryValue = (value: BinaryValue): BinaryValue => (value === "1" ? "0" : "1");

const isClockNode = (node: Node): boolean => {
    const data = (node.getData?.() ?? {}) as ClockNodeData;
    return data.hash === "CLOCK";
};

const readBinaryOutputValue = (node: Node, pin: string): BinaryValue => {
    const portId = pinRefToPortId({ side: "output", index: pin });
    const className = String(node.getPortProp?.(portId, "attrs/circle/class") ?? "");
    if (className.split(/\s+/).includes("value-true")) return "1";
    return "0";
};

const clockDelayMs = (config: ClockConfig, value: BinaryValue): number => {
    const periodMs = frequencyHzToPeriodMs(config.frequencyHz);
    const phaseRatio = value === "1" ? config.dutyCycle : 1 - config.dutyCycle;
    return Math.max(1, periodMs * phaseRatio);
};

export const createWorkspaceClockController = (opts: WorkspaceClockControllerOptions) => {
    const [graph, setGraph] = createSignal<Graph | undefined>();
    const [editingNodeId, setEditingNodeId] = createSignal<string | undefined>();
    const [configVersion, setConfigVersion] = createSignal(0);
    const nodeStates = new Map<string, ClockNodeState>();

    const clearStateTimer = (state: ClockNodeState): void => {
        if (state.timeoutId === undefined) return;
        clearTimeout(state.timeoutId);
        state.timeoutId = undefined;
    };

    const selectedClockNode = (): Node | undefined => {
        const selected = graph()?.getSelectedCells?.() ?? [];
        if (selected.length !== 1) return;
        const [cell] = selected;
        if (!cell?.isNode?.()) return;
        const node = cell as Node;
        return isClockNode(node) ? node : undefined;
    };

    const editingNode = (): Node | undefined => {
        const id = editingNodeId();
        if (!id) return;
        const cell = graph()?.getCellById?.(id);
        if (!cell?.isNode?.()) return;
        const node = cell as Node;
        return isClockNode(node) ? node : undefined;
    };

    const getClockNodes = (): Node[] =>
        (graph()?.getNodes?.() ?? []).filter((node) => isClockNode(node));

    const ensureState = (node: Node, pin: string): ClockNodeState => {
        const existing = nodeStates.get(node.id);
        if (existing) return existing;

        const next = {
            value: readBinaryOutputValue(node, pin),
            busy: false,
        };
        nodeStates.set(node.id, next);
        return next;
    };

    const updateClockOutput = async (node: Node, pin: string, value: BinaryValue): Promise<void> => {
        const tabId = opts.getActiveTabId();
        if (!tabId) return;

        applyOptimisticOutput({
            uiEngine: opts.uiEngine,
            node,
            pin,
            value,
        });

        const result = await opts.logicEngine.call("/item/updateOutput", {
            tabId,
            itemId: node.id,
            pin,
            value,
        });

        if (result.outputEvents.length > 0) {
            opts.uiEngine.commands.applySignalEvents(result.outputEvents);
        }

        await opts.requestSimulationNow();
    };

    const scheduleNode = (node: Node): void => {
        const pin = getPrimaryOutputPin(node);
        if (!pin) return;

        const config = readClockConfig(node);
        const state = ensureState(node, pin);
        clearStateTimer(state);

        if (!config.enabled || opts.isPaused()) return;
        const delay = clockDelayMs(config, state.value);

        state.timeoutId = setTimeout(() => {
            void tickNode(node.id);
        }, delay);
    };

    const tickNode = async (nodeId: string): Promise<void> => {
        const activeGraph = graph();
        const cell = activeGraph?.getCellById?.(nodeId);
        if (!cell?.isNode?.()) {
            nodeStates.delete(nodeId);
            return;
        }

        const node = cell as Node;
        if (!isClockNode(node)) {
            nodeStates.delete(nodeId);
            return;
        }

        const pin = getPrimaryOutputPin(node);
        if (!pin) return;

        const state = ensureState(node, pin);
        if (state.busy) return;

        if (!readClockConfig(node).enabled || opts.isPaused()) {
            clearStateTimer(state);
            return;
        }

        const nextValue = flipBinaryValue(state.value);
        state.value = nextValue;
        state.busy = true;

        try {
            await updateClockOutput(node, pin, nextValue);
        } catch (err) {
            console.error("[workspace-clock] output update failed", err);
        } finally {
            state.busy = false;
            scheduleNode(node);
        }
    };

    const refresh = (): void => {
        const activeGraph = graph();
        const liveNodeIds = new Set(getClockNodes().map((node) => node.id));

        Array.from(nodeStates.entries()).forEach(([nodeId, state]) => {
            if (liveNodeIds.has(nodeId)) return;
            clearStateTimer(state);
            nodeStates.delete(nodeId);
        });

        if (!activeGraph || opts.isPaused()) {
            nodeStates.forEach(clearStateTimer);
            return;
        }

        getClockNodes().forEach(scheduleNode);
    };

    const attachGraph = (nextGraph: Graph): (() => void) => {
        setGraph(nextGraph);

        const onGraphChanged = () => refresh();
        nextGraph.on("cell:added", onGraphChanged);
        nextGraph.on("cell:removed", onGraphChanged);
        nextGraph.on("node:change:data", onGraphChanged);

        refresh();

        return () => {
            nextGraph.off("cell:added", onGraphChanged);
            nextGraph.off("cell:removed", onGraphChanged);
            nextGraph.off("node:change:data", onGraphChanged);
            nodeStates.forEach(clearStateTimer);
            nodeStates.clear();
            if (graph() === nextGraph) setGraph(undefined);
        };
    };

    const openSelectedClockConfig = (): void => {
        const node = selectedClockNode();
        if (!node) return;
        setEditingNodeId(node.id);
    };

    const closeConfig = (): void => {
        setEditingNodeId(undefined);
    };

    const updateEditingConfig = (patch: Partial<ClockConfig>): void => {
        const node = editingNode();
        if (!node) return;
        patchClockConfig(node, patch);
        setConfigVersion((version) => version + 1);
        refresh();
    };

    const resetEditingConfig = (): void => {
        const node = editingNode();
        if (!node) return;
        patchClockConfig(node, normalizeClockConfig(DEFAULT_CLOCK_CONFIG));
        setConfigVersion((version) => version + 1);
        refresh();
    };

    return {
        attachGraph,
        refresh,
        get canConfigureSelectedClock() {
            return selectedClockNode() !== undefined;
        },
        get editingNode() {
            configVersion();
            return editingNode();
        },
        get editingConfig() {
            configVersion();
            const node = editingNode();
            return node ? readClockConfig(node) : DEFAULT_CLOCK_CONFIG;
        },
        openSelectedClockConfig,
        closeConfig,
        updateEditingConfig,
        resetEditingConfig,
    };
};

export type WorkspaceClockController = ReturnType<typeof createWorkspaceClockController>;
