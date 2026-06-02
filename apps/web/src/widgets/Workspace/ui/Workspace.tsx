import { BooleanAnalysisPanel } from "@gately/features/boolean-analysis";
import { useAppConfiguration } from "@gately/app/providers/AppConfigurationProvider";
import { useUIEngine } from "@gately/shared/infrastructure";
import { useLogicEngine } from "@gately/shared/infrastructure/LogicEngine";
import { Component, Show } from "solid-js";
import { useWorkspaceController } from "../lib";
import { WorkspaceContextMenu } from "./WorkspaceContextMenu";
import { WorkspaceToolbar } from "./WorkspaceToolbar";

export const InnerWorkspace: Component = () => {
    const uiEngine = useUIEngine();
    const logicEngine = useLogicEngine();
    const configuration = useAppConfiguration();
    const controller = useWorkspaceController({
        uiEngine,
        logicEngine,
        getActiveTabId: uiEngine.state.activeTabId,
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
                        configuration={configuration}
                        customComponents={controller.customComponents}
                        hardware={controller.hardware}
                        persistence={controller.persistence}
                        simulation={controller.simulation}
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
            <div class="relative min-h-0 flex-1">
                <Show
                    when={uiEngine.state.activeTabId()}
                    fallback={<p class="p-4 text-gray-11">Create a new tab</p>}
                >
                    <div ref={uiEngine.mount.setContainer} class="absolute inset-0"></div>
                    <WorkspaceContextMenu
                        contextMenu={controller.contextMenu}
                        getSelectionCount={controller.getSelectionCount}
                        removeSelected={controller.removeSelected}
                    />
                </Show>
            </div>
        </div>
    );
};

export const Workspace: Component = () => {
    return <InnerWorkspace />;
};
