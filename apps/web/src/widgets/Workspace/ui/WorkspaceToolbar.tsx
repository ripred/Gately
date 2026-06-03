import type {
    AppConfigurationController,
    WorkbenchToolbarGroupKey,
} from "@gately/app/providers/AppConfigurationProvider";
import { ArduinoHardwarePanel } from "@gately/features/arduino-hardware";
import { useAddLogicNode } from "@gately/features/nodes/useAddBaseLogic";
import { useUIEngine } from "@gately/shared/infrastructure";
import type { WorkspaceSimulationMode } from "@gately/shared/types";
import { Pusher } from "@gately/shared/ui";
import type { WorkspaceController } from "../lib/types";
import { Component, For, Show } from "solid-js";
import { SIMULATION_MODE_OPTIONS } from "./settingsSchema";
import type { SettingsCategoryId } from "./WorkspaceSettingsPanel";
import type { WorkspaceViewMode } from "./workbenchTypes";

type WorkspaceToolbarProps = Pick<
    WorkspaceController,
    | "autoLayout"
    | "booleanAnalysis"
    | "customComponents"
    | "hardware"
    | "persistence"
    | "simulation"
> & {
    configuration: AppConfigurationController;
    mode: WorkspaceViewMode;
    openSettings: (categoryId?: SettingsCategoryId) => void;
    projectSidebarCollapsed: boolean;
    setMode: (mode: WorkspaceViewMode) => void;
    toggleProjectSidebar: () => void;
};

const toolbarButton =
    "inline-flex h-7 items-center justify-center rounded border border-gray-5 bg-gray-2 px-2 text-xs leading-none text-gray-12 hover:bg-gray-3 data-disabled:text-gray-8 data-disabled:hover:bg-gray-2";

const toolbarGroup = "flex flex-wrap items-center gap-1 border-r border-gray-4 pr-2";

export const WorkspaceToolbar: Component<WorkspaceToolbarProps> = (props) => {
    const uiEngine = useUIEngine();
    const {
        addBuffer,
        addAnd,
        addOr,
        addNot,
        addNor,
        addNand,
        addXor,
        addXnor,
        addToggle,
        addLamp,
        addTrueConstant,
        addFalseConstant,
        add7segDisplay,
    } = useAddLogicNode();
    const disabled = () => !uiEngine.state.activeScopeId();
    const commandDisabled = () =>
        props.simulation.isDisabled ||
        props.booleanAnalysis.isBusy ||
        props.customComponents.isBusy ||
        props.persistence.isBusy;
    const toolbarGroupVisible = (group: WorkbenchToolbarGroupKey) =>
        props.configuration.workbenchConfig().visibleToolbarGroups[group];
    const selectedCustomHash = () => props.customComponents.selectedHash();
    const builtInButtons = [
        { label: "TOGGLE", action: addToggle },
        { label: "1", action: addTrueConstant },
        { label: "0", action: addFalseConstant },
        { label: "LAMP", action: addLamp },
        { label: "7-SEG", action: add7segDisplay },
        { label: "BUF", action: addBuffer },
        { label: "AND", action: addAnd },
        { label: "OR", action: addOr },
        { label: "NOT", action: addNot },
        { label: "NOR", action: addNor },
        { label: "NAND", action: addNand },
        { label: "XOR", action: addXor },
        { label: "XNOR", action: addXnor },
    ];

    return (
        <div
            data-testid="workspace-toolbar"
            class="relative flex min-h-10 flex-wrap items-start gap-2 border-b border-gray-4 bg-gray-1 px-2 py-1 text-gray-12"
        >
            <div class={toolbarGroup}>
                <Pusher class={toolbarButton} onClick={props.toggleProjectSidebar}>
                    {props.projectSidebarCollapsed ? "Explorer >" : "Explorer <"}
                </Pusher>
                <Pusher
                    class={[
                        toolbarButton,
                        props.mode === "circuit" ? "border-primary-7 bg-primary-3" : "",
                    ].join(" ")}
                    onClick={() => props.setMode("circuit")}
                >
                    Circuit
                </Pusher>
                <Pusher
                    class={[
                        toolbarButton,
                        props.mode === "settings" ? "border-primary-7 bg-primary-3" : "",
                    ].join(" ")}
                    onClick={() => props.openSettings("accessibility")}
                >
                    Settings
                </Pusher>
                <Pusher
                    class={toolbarButton}
                    onClick={() => props.openSettings("workbench")}
                >
                    Customize Toolbar
                </Pusher>
            </div>

            <Show when={toolbarGroupVisible("simulation")}>
                <div class={toolbarGroup}>
                    <Pusher
                        class={toolbarButton}
                        onClick={() =>
                            props.simulation.isPaused
                                ? props.simulation.resume()
                                : props.simulation.pause()
                        }
                        disabled={props.simulation.isDisabled}
                    >
                        {props.simulation.isPaused ? "Resume" : "Pause"}
                    </Pusher>
                    <Pusher
                        class={toolbarButton}
                        onClick={props.simulation.nextStep}
                        disabled={props.simulation.isDisabled || !props.simulation.isPaused}
                    >
                        Step
                    </Pusher>
                    <select
                        class="h-7 rounded border border-gray-5 bg-gray-2 px-2 text-xs leading-none text-gray-12"
                        value={props.simulation.mode}
                        disabled={props.simulation.isDisabled || props.simulation.isBusy}
                        onChange={(event) =>
                            (props.simulation.mode =
                                event.currentTarget.value as WorkspaceSimulationMode)
                        }
                    >
                        {SIMULATION_MODE_OPTIONS.map((mode) => (
                            <option value={mode.value}>{mode.label}</option>
                        ))}
                    </select>
                    <span class="px-1 text-[11px] text-gray-10">
                        {props.simulation.isBusy ? "running" : "idle"}
                    </span>
                </div>
            </Show>

            <Show when={toolbarGroupVisible("hardware")}>
                <div class={toolbarGroup}>
                    <ArduinoHardwarePanel
                        hardware={props.hardware}
                        triggerClass={toolbarButton}
                    />
                    <Pusher
                        class={toolbarButton}
                        onClick={props.booleanAnalysis.analyze}
                        disabled={props.simulation.isDisabled || props.booleanAnalysis.isBusy}
                    >
                        Optimize
                    </Pusher>
                </div>
            </Show>

            <Show when={toolbarGroupVisible("workspace")}>
                <div class={toolbarGroup}>
                    <Pusher
                        class={toolbarButton}
                        onClick={props.persistence.createTab}
                        disabled={props.persistence.isBusy}
                    >
                        New
                    </Pusher>
                    <Pusher
                        class={toolbarButton}
                        onClick={props.persistence.saveWorkspace}
                        disabled={props.persistence.isBusy}
                    >
                        Save
                    </Pusher>
                    <Pusher
                        class={toolbarButton}
                        onClick={props.persistence.loadWorkspace}
                        disabled={
                            props.persistence.isBusy ||
                            !props.persistence.hasSavedWorkspace()
                        }
                    >
                        Load
                    </Pusher>
                </div>
            </Show>

            <Show when={toolbarGroupVisible("canvas")}>
                <div class={toolbarGroup}>
                    <Pusher
                        class={toolbarButton}
                        onClick={props.autoLayout.applySelection}
                        disabled={disabled() || commandDisabled() || props.autoLayout.isDisabled}
                    >
                        Auto Layout
                    </Pusher>
                </div>
            </Show>

            <Show when={toolbarGroupVisible("parts")}>
                <div class="flex basis-full flex-wrap items-center gap-1 border-t border-gray-4 pt-1">
                    <span class="mr-1 text-[11px] font-semibold uppercase tracking-wide text-gray-9">
                        Parts
                    </span>
                    <For each={builtInButtons}>
                        {(button) => (
                            <Pusher
                                class={toolbarButton}
                                onClick={button.action}
                                disabled={disabled()}
                            >
                                {button.label}
                            </Pusher>
                        )}
                    </For>
                </div>
            </Show>

            <Show when={toolbarGroupVisible("customParts")}>
                <div class="flex flex-wrap items-center gap-1">
                    <Pusher
                        class={toolbarButton}
                        onClick={props.customComponents.createFromSelection}
                        disabled={
                            disabled() ||
                            commandDisabled() ||
                            props.customComponents.selectedNodeCount() === 0
                        }
                    >
                        Save Part
                    </Pusher>
                    <Show when={props.customComponents.components().length > 0}>
                        <select
                            class="h-7 rounded border border-gray-5 bg-gray-2 px-2 text-xs leading-none text-gray-12"
                            value={selectedCustomHash() ?? ""}
                            disabled={props.customComponents.isBusy}
                            onChange={(event) =>
                                props.customComponents.setSelectedHash(
                                    event.currentTarget.value || undefined,
                                )
                            }
                        >
                            <option value="">Custom Parts</option>
                            <For each={props.customComponents.components()}>
                                {(component) => (
                                    <option value={component.hash}>
                                        {component.name} ({component.inputCount} in,{" "}
                                        {component.outputCount} out)
                                    </option>
                                )}
                            </For>
                        </select>
                        <Pusher
                            class={toolbarButton}
                            onClick={props.customComponents.renameSelected}
                            disabled={!selectedCustomHash() || props.customComponents.isBusy}
                        >
                            Rename
                        </Pusher>
                        <Pusher
                            class={toolbarButton}
                            onClick={props.customComponents.removeSelected}
                            disabled={!selectedCustomHash() || props.customComponents.isBusy}
                        >
                            Delete
                        </Pusher>
                    </Show>
                </div>
            </Show>
        </div>
    );
};
