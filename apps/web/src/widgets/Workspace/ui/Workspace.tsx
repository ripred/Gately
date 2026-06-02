import { BooleanAnalysisPanel } from "@gately/features/boolean-analysis";
import { useAppConfiguration } from "@gately/app/providers/AppConfigurationProvider";
import { useUIEngine } from "@gately/shared/infrastructure";
import { useLogicEngine } from "@gately/shared/infrastructure/LogicEngine";
import { Component, createSignal, Show } from "solid-js";
import { useWorkspaceController } from "../lib";
import { WorkspaceContextMenu } from "./WorkspaceContextMenu";
import { WorkspaceProjectSidebar } from "./WorkspaceProjectSidebar";
import { WorkspaceSettingsPanel } from "./WorkspaceSettingsPanel";
import { WorkspaceToolbar } from "./WorkspaceToolbar";
import type { WorkspaceViewMode } from "./workbenchTypes";

export const InnerWorkspace: Component = () => {
    const uiEngine = useUIEngine();
    const logicEngine = useLogicEngine();
    const configuration = useAppConfiguration();
    const [viewMode, setViewMode] = createSignal<WorkspaceViewMode>("circuit");
    const projectSidebarCollapsed = () => configuration.workbenchConfig().explorerCollapsed;
    const toggleProjectSidebar = () =>
        configuration.setWorkbenchConfig({ explorerCollapsed: !projectSidebarCollapsed() });
    const controller = useWorkspaceController({
        uiEngine,
        logicEngine,
        getActiveTabId: uiEngine.state.activeTabId,
        getRoutingConfig: configuration.routingConfig,
    });

    return (
        <div class="flex h-full w-full flex-col overflow-hidden">
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
                        mode={viewMode()}
                        persistence={controller.persistence}
                        projectSidebarCollapsed={projectSidebarCollapsed()}
                        configuration={configuration}
                        setMode={setViewMode}
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
                        configuration={configuration}
                        customComponents={controller.customComponents}
                        mode={viewMode()}
                        persistence={controller.persistence}
                        setMode={setViewMode}
                        toggleCollapsed={toggleProjectSidebar}
                    />
                </div>
                <div class="relative min-h-0 flex-1">
                    <Show
                        when={uiEngine.state.activeTabId()}
                        fallback={
                            <Show
                                when={viewMode() === "settings"}
                                fallback={<p class="p-4 text-gray-11">Create a new tab</p>}
                            >
                                <div></div>
                            </Show>
                        }
                    >
                        <div
                            ref={uiEngine.mount.setContainer}
                            class="absolute inset-0"
                            classList={{
                                "opacity-0 pointer-events-none": viewMode() === "settings",
                            }}
                        ></div>
                        <Show when={viewMode() === "circuit"}>
                            <WorkspaceContextMenu
                                contextMenu={controller.contextMenu}
                                getSelectionCount={controller.getSelectionCount}
                                removeSelected={controller.removeSelected}
                            />
                        </Show>
                    </Show>
                    <Show when={viewMode() === "settings"}>
                        <div
                            class="absolute inset-0 z-10"
                            style={{
                                zoom: configuration.uiScale(),
                            }}
                        >
                            <WorkspaceSettingsPanel
                                configuration={configuration}
                                simulation={controller.simulation}
                            />
                        </div>
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
                <span>{viewMode() === "settings" ? "settings" : "circuit canvas"}</span>
                <span>{uiEngine.state.activeNavigationPath().join(" / ") || "no circuit"}</span>
            </div>
        </div>
    );
};

export const Workspace: Component = () => {
    return <InnerWorkspace />;
};
