import { createEffect, createSignal, onCleanup } from "solid-js";
import { useArduinoHardwareController } from "@gately/features/arduino-hardware";
import { useBooleanAnalysisController } from "@gately/features/boolean-analysis";
import { attachWorkspaceBridge } from "./bridge";
import { createWorkspaceClockController } from "./clock-controller";
import { attachWorkspaceGraphInteractions } from "./graph-interactions";
import { useWorkspaceContextMenu } from "./context-menu";
import { createWorkspaceAutoLayout } from "./auto-layout";
import { createWorkspaceCustomComponents } from "./custom-components";
import { createWorkspacePersistence } from "./persistence";
import { createWorkspaceSimulation } from "./simulation";
import type { WorkspaceController, WorkspaceControllerDeps } from "./types";

export const useWorkspaceController = (deps: WorkspaceControllerDeps): WorkspaceController => {
    const [selectionVersion, setSelectionVersion] = createSignal(0);
    const contextMenu = useWorkspaceContextMenu();
    const signalEventHandlers = new Set<WorkspaceController["hardware"]["handleSignalEvents"]>();
    const simulation = createWorkspaceSimulation({
        logicEngine: deps.logicEngine,
        uiEngine: deps.uiEngine,
        getActiveTabId: deps.getActiveTabId,
        onSignalEvents: (events) => {
            signalEventHandlers.forEach((handler) => handler(events));
        },
    });
    const clock = createWorkspaceClockController({
        logicEngine: deps.logicEngine,
        uiEngine: deps.uiEngine,
        getActiveTabId: deps.getActiveTabId,
        isPaused: () => simulation.isPaused,
        requestSimulationNow: simulation.requestNow,
    });
    const hardware = useArduinoHardwareController({
        logicEngine: deps.logicEngine,
        uiEngine: deps.uiEngine,
        getActiveTabId: deps.getActiveTabId,
        getActiveScopeId: deps.uiEngine.state.activeScopeId,
        requestSimulationNow: simulation.requestNow,
    });
    const booleanAnalysis = useBooleanAnalysisController({
        logicEngine: deps.logicEngine,
        uiEngine: deps.uiEngine,
        getActiveTabId: deps.getActiveTabId,
        getActiveScopeId: deps.uiEngine.state.activeScopeId,
        getRoutingConfig: deps.getRoutingConfig,
    });
    const customComponents = createWorkspaceCustomComponents({
        logicEngine: deps.logicEngine,
        uiEngine: deps.uiEngine,
        getActiveTabId: deps.getActiveTabId,
        getActiveScopeId: deps.uiEngine.state.activeScopeId,
    });
    const persistence = createWorkspacePersistence({
        logicEngine: deps.logicEngine,
        uiEngine: deps.uiEngine,
        configuration: deps.configuration,
        onAfterLoad: customComponents.refresh,
        onAfterProjectLoad: deps.onClean,
        onAfterSave: deps.onClean,
        onDirty: deps.onDirty,
    });
    signalEventHandlers.add(hardware.handleSignalEvents);

    const getSelectionCount = () => {
        selectionVersion();
        return deps.uiEngine.debug.graph()?.getSelectedCellCount?.() ?? 0;
    };
    const autoLayout = createWorkspaceAutoLayout({
        uiEngine: deps.uiEngine,
        getSelectionCount,
        getRoutingConfig: deps.getRoutingConfig,
    });

    const removeSelected = () => {
        const graph = deps.uiEngine.debug.graph();
        if (!graph?.getSelectedCells) return;
        const selected = graph.getSelectedCells();
        if (!selected.length) return;
        graph.removeCells(selected);
        deps.onDirty?.();
    };

    createEffect(() => {
        const graph = deps.uiEngine.debug.graph();
        if (!graph) return;

        const markDirty = () => deps.onDirty?.();
        const dirtyEvents = [
            "cell:added",
            "cell:removed",
            "node:change:data",
            "node:change:position",
            "node:change:size",
            "edge:change:data",
            "edge:change:source",
            "edge:change:target",
            "edge:change:vertices",
            "edge:connected",
        ];
        dirtyEvents.forEach((eventName) => graph.on(eventName, markDirty));

        onCleanup(() => {
            dirtyEvents.forEach((eventName) => graph.off(eventName, markDirty));
        });
    });

    createEffect(() => {
        const graph = deps.uiEngine.debug.graph();
        if (!graph) return;

        const dispose = clock.attachGraph(graph);

        onCleanup(dispose);
    });

    createEffect(() => {
        const isPaused = simulation.isPaused;
        const isDisabled = simulation.isDisabled;
        const activeTabId = deps.uiEngine.state.activeTabId();
        clock.refresh();
        return { activeTabId, isDisabled, isPaused };
    });

    createEffect(() => {
        const graph = deps.uiEngine.debug.graph();
        if (!graph) return;

        const dispose = attachWorkspaceBridge({
            graph,
            uiEngine: deps.uiEngine,
            logicEngine: deps.logicEngine,
            getActiveTabId: deps.getActiveTabId,
            requestSimulationNow: simulation.requestNow,
        });

        onCleanup(dispose);
    });

    createEffect(() => {
        const graph = deps.uiEngine.debug.graph();
        if (!graph) return;

        const dispose = attachWorkspaceGraphInteractions({
            graph,
            bumpSelection: () => setSelectionVersion((v) => v + 1),
            openContextMenuAt: contextMenu.openContextMenuAt,
            closeContextMenu: contextMenu.closeContextMenu,
            setMenuTarget: (target) => contextMenu.setMenuTarget(target),
            getRoutingConfig: deps.getRoutingConfig,
        });

        onCleanup(dispose);
    });

    onCleanup(() => signalEventHandlers.delete(hardware.handleSignalEvents));
    onCleanup(simulation.dispose);
    onCleanup(hardware.dispose);

    return {
        contextMenu,
        getSelectionCount,
        removeSelected,
        simulation,
        clock,
        hardware,
        booleanAnalysis,
        autoLayout,
        customComponents,
        persistence,
    };
};
