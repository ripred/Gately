import { BooleanAnalysisPanel } from "@gately/features/boolean-analysis";
import {
    type AppConfigurationController,
    useAppConfiguration,
} from "@gately/app/providers/AppConfigurationProvider";
import { useUIEngine } from "@gately/shared/infrastructure";
import { useLogicEngine } from "@gately/shared/infrastructure/LogicEngine";
import { Component, createSignal, onCleanup, onMount, Show } from "solid-js";
import { useWorkspaceController } from "../lib";
import { ClockConfigurationModal } from "./ClockConfigurationModal";
import { WorkspaceContextMenu } from "./WorkspaceContextMenu";
import { WorkspaceProjectSidebar } from "./WorkspaceProjectSidebar";
import { WorkspaceSettingsPanel, type SettingsCategoryId } from "./WorkspaceSettingsPanel";
import { WorkspaceToolbar } from "./WorkspaceToolbar";

export const InnerWorkspace: Component = () => {
    const uiEngine = useUIEngine();
    const logicEngine = useLogicEngine();
    const configuration = useAppConfiguration();
    const [workspaceDirty, setWorkspaceDirty] = createSignal(false);
    const markWorkspaceDirty = () => setWorkspaceDirty(true);
    const markWorkspaceClean = () => setWorkspaceDirty(false);
    const markDirtyBefore = <Args extends unknown[]>(
        fn: (...args: Args) => void,
    ): ((...args: Args) => void) => {
        return (...args: Args) => {
            markWorkspaceDirty();
            fn(...args);
        };
    };
    const dirtyAwareConfiguration: AppConfigurationController = {
        ...configuration,
        setUiScale: markDirtyBefore(configuration.setUiScale),
        setRoutingConfig: markDirtyBefore(configuration.setRoutingConfig),
        setSignalPathColors: markDirtyBefore(configuration.setSignalPathColors),
        setWorkbenchConfig: markDirtyBefore(configuration.setWorkbenchConfig),
        uiZoomIn: markDirtyBefore(configuration.uiZoomIn),
        uiZoomOut: markDirtyBefore(configuration.uiZoomOut),
        resetUiZoom: markDirtyBefore(configuration.resetUiZoom),
        resetRoutingConfig: markDirtyBefore(configuration.resetRoutingConfig),
        resetSignalPathColors: markDirtyBefore(configuration.resetSignalPathColors),
        resetWorkbenchConfig: markDirtyBefore(configuration.resetWorkbenchConfig),
        importSnapshot: configuration.importSnapshot,
        exportSnapshot: configuration.exportSnapshot,
    };
    const [settingsOpen, setSettingsOpen] = createSignal(false);
    const [activeSettingsCategoryId, setActiveSettingsCategoryId] =
        createSignal<SettingsCategoryId>("accessibility");
    const projectSidebarCollapsed = () => configuration.workbenchConfig().explorerCollapsed;
    const toggleProjectSidebar = () =>
        dirtyAwareConfiguration.setWorkbenchConfig({
            explorerCollapsed: !projectSidebarCollapsed(),
        });
    const openSettings = (categoryId: SettingsCategoryId = "accessibility") => {
        setActiveSettingsCategoryId(categoryId);
        setSettingsOpen(true);
    };
    const closeSettings = () => setSettingsOpen(false);
    const controller = useWorkspaceController({
        uiEngine,
        logicEngine,
        configuration,
        getActiveTabId: uiEngine.state.activeTabId,
        getRoutingConfig: configuration.routingConfig,
        onDirty: markWorkspaceDirty,
        onClean: markWorkspaceClean,
    });
    const shouldIgnoreShortcut = (event: KeyboardEvent) => {
        const target = event.target as HTMLElement | null;
        if (!target) return false;
        const tag = target.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return true;
        return target.isContentEditable;
    };
    const handleWorkspaceShortcut = (event: KeyboardEvent) => {
        if (event.key === "Escape" && settingsOpen()) {
            event.preventDefault();
            closeSettings();
            return;
        }

        if (shouldIgnoreShortcut(event)) return;
        if (!event.metaKey && !event.ctrlKey) return;
        if (!uiEngine.state.activeScopeId()) return;

        switch (event.key) {
            case "+":
            case "=":
                event.preventDefault();
                uiEngine.commands.zoomIn();
                break;
            case "0":
                event.preventDefault();
                uiEngine.commands.resetZoom();
                break;
            case "-":
                event.preventDefault();
                uiEngine.commands.zoomOut();
                break;
        }
    };

    onMount(() => window.addEventListener("keydown", handleWorkspaceShortcut));
    onCleanup(() => window.removeEventListener("keydown", handleWorkspaceShortcut));

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
        if (!workspaceDirty()) return;

        event.preventDefault();
        event.returnValue = "";
    };

    onMount(() => window.addEventListener("beforeunload", handleBeforeUnload));
    onCleanup(() => window.removeEventListener("beforeunload", handleBeforeUnload));

    return (
        <div class="relative flex h-full w-full flex-col overflow-hidden">
            <div class="relative z-10 shrink-0 border-b border-gray-4 bg-gray-1/95">
                <div
                    style={{
                        zoom: configuration.uiScale(),
                    }}
                >
                    <WorkspaceToolbar
                        booleanAnalysis={controller.booleanAnalysis}
                        autoLayout={controller.autoLayout}
                        customComponents={controller.customComponents}
                        hardware={controller.hardware}
                        settingsOpen={settingsOpen()}
                        openSettings={openSettings}
                        persistence={controller.persistence}
                        projectSidebarCollapsed={projectSidebarCollapsed()}
                        configuration={dirtyAwareConfiguration}
                        simulation={controller.simulation}
                        toggleProjectSidebar={toggleProjectSidebar}
                    />
                </div>
            </div>
            <div
                style={{
                    zoom: configuration.uiScale(),
                }}
            >
                <BooleanAnalysisPanel controller={controller.booleanAnalysis} />
            </div>
            <div class="flex min-h-0 flex-1">
                <div
                    style={{
                        zoom: configuration.uiScale(),
                    }}
                >
                    <WorkspaceProjectSidebar
                        collapsed={projectSidebarCollapsed()}
                        configuration={dirtyAwareConfiguration}
                        customComponents={controller.customComponents}
                        onDirty={markWorkspaceDirty}
                        persistence={controller.persistence}
                        toggleCollapsed={toggleProjectSidebar}
                    />
                </div>
                <div class="relative min-h-0 flex-1">
                    <Show
                        when={uiEngine.state.activeTabId()}
                        fallback={<p class="p-4 text-gray-11">Create a new tab</p>}
                    >
                        <div
                            ref={uiEngine.mount.setContainer}
                            class="absolute inset-0"
                        ></div>
                        <WorkspaceContextMenu
                            clock={controller.clock}
                            contextMenu={controller.contextMenu}
                            getSelectionCount={controller.getSelectionCount}
                            removeSelected={controller.removeSelected}
                        />
                    </Show>
                </div>
            </div>
            <div
                class="flex h-6 shrink-0 items-center gap-4 border-t border-gray-4 bg-gray-2 px-3 text-[11px] text-gray-10"
                style={{
                    zoom: configuration.uiScale(),
                }}
            >
                <span>
                    {controller.simulation.isBusy ? "simulation running" : "simulation idle"}
                </span>
                <span>{controller.getSelectionCount()} selected</span>
                <span>{workspaceDirty() ? "unsaved changes" : "saved"}</span>
                <span>{settingsOpen() ? "settings open" : "circuit canvas"}</span>
                <span>{uiEngine.state.activeNavigationPath().join(" / ") || "no circuit"}</span>
            </div>
            <Show when={settingsOpen()}>
                <div
                    aria-modal="true"
                    class="absolute inset-0 z-50 flex min-h-0 items-stretch justify-center overflow-hidden bg-black/20 p-4"
                    role="dialog"
                    onClick={closeSettings}
                >
                    <div
                        class="flex min-h-0 w-full max-w-[84rem]"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <WorkspaceSettingsPanel
                            activeCategoryId={activeSettingsCategoryId}
                            configuration={dirtyAwareConfiguration}
                            onClose={closeSettings}
                            setActiveCategoryId={setActiveSettingsCategoryId}
                            simulation={controller.simulation}
                        />
                    </div>
                </div>
            </Show>
            <ClockConfigurationModal clock={controller.clock} />
        </div>
    );
};

export const Workspace: Component = () => {
    return <InnerWorkspace />;
};
