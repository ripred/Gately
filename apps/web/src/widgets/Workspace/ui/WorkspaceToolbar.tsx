import type {
    AppConfigurationController,
    WorkbenchToolbarGroupKey,
} from "@gately/app/providers/AppConfigurationProvider";
import { ArduinoHardwarePanel } from "@gately/features/arduino-hardware";
import { useAddLogicNode } from "@gately/features/nodes/useAddBaseLogic";
import { useUIEngine } from "@gately/shared/infrastructure";
import type { WorkspaceSimulationMode } from "@gately/shared/types";
import { Pusher } from "@gately/shared/ui";
import type { CustomComponentRuntimeMeta } from "@cnbn/schema";
import type { WorkspaceController } from "../lib/types";
import { Component, For, Show, createSignal } from "solid-js";
import { SIMULATION_MODE_OPTIONS } from "./settingsSchema";
import type { SettingsCategoryId } from "./WorkspaceSettingsPanel";

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
    openSettings: (categoryId?: SettingsCategoryId) => void;
    projectSidebarCollapsed: boolean;
    settingsOpen: boolean;
    toggleProjectSidebar: () => void;
};

const toolbarButton =
    "inline-flex h-7 items-center justify-center rounded border border-gray-5 bg-gray-2 px-2 text-xs leading-none text-gray-12 hover:bg-gray-3 data-disabled:text-gray-8 data-disabled:hover:bg-gray-2";

const toolbarGroup = "flex flex-wrap items-center gap-1 border-r border-gray-4 pr-2";

const customRuntimeStatus = (runtime?: CustomComponentRuntimeMeta): string => {
    switch (runtime?.mode) {
        case "baked-combinational":
            return "baked";
        case "expanded-stateful":
            return "stateful";
        case "expanded-unsupported":
        default:
            return "expanded";
    }
};

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
        addShiftRegister8,
        addToggle,
        addClock,
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
    const [customPartDialogOpen, setCustomPartDialogOpen] = createSignal(false);
    const [customPartName, setCustomPartName] = createSignal("");
    const canSaveCustomPart = () =>
        !disabled() &&
        !commandDisabled() &&
        props.customComponents.selectedNodeCount() > 0;
    const openCustomPartDialog = () => {
        if (!canSaveCustomPart()) return;
        setCustomPartName("");
        setCustomPartDialogOpen(true);
    };
    const closeCustomPartDialog = () => {
        setCustomPartDialogOpen(false);
        setCustomPartName("");
    };
    const submitCustomPartDialog = (event: Event) => {
        event.preventDefault();
        const name = customPartName().trim();
        if (!name || props.customComponents.isBusy) return;

        void props.customComponents.createFromSelection(name).then(() => {
            closeCustomPartDialog();
        });
    };
    const builtInButtons = [
        { label: "TOGGLE", action: addToggle },
        { label: "CLOCK", action: addClock },
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
        { label: "SHIFT-8", action: addShiftRegister8 },
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
                        props.settingsOpen ? "border-primary-7 bg-primary-3" : "",
                    ].join(" ")}
                    onClick={() => props.openSettings("accessibility")}
                >
                    Settings
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
                        disabled={props.persistence.isBusy}
                    >
                        Load
                    </Pusher>
                </div>
            </Show>

            <Show when={toolbarGroupVisible("canvas")}>
                <div class={toolbarGroup}>
                    <Pusher
                        ariaLabel="Zoom out"
                        class={`${toolbarButton} w-7 px-0`}
                        onClick={() => uiEngine.commands.zoomOut()}
                        disabled={disabled() || commandDisabled()}
                    >
                        -
                    </Pusher>
                    <Pusher
                        ariaLabel="Reset zoom"
                        class={`${toolbarButton} w-10 px-0`}
                        onClick={() => uiEngine.commands.resetZoom()}
                        disabled={disabled() || commandDisabled()}
                    >
                        100%
                    </Pusher>
                    <Pusher
                        ariaLabel="Zoom in"
                        class={`${toolbarButton} w-7 px-0`}
                        onClick={() => uiEngine.commands.zoomIn()}
                        disabled={disabled() || commandDisabled()}
                    >
                        +
                    </Pusher>
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
                        onClick={openCustomPartDialog}
                        disabled={
                            !canSaveCustomPart()
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
                                        {component.outputCount} out,{" "}
                                        {customRuntimeStatus(component.runtime)})
                                    </option>
                                )}
                            </For>
                        </select>
                        <Pusher
                            class={toolbarButton}
                            onClick={() => {
                                const hash = selectedCustomHash();
                                if (hash) void props.customComponents.addComponent(hash);
                            }}
                            disabled={
                                disabled() ||
                                commandDisabled() ||
                                !selectedCustomHash()
                            }
                        >
                            Insert
                        </Pusher>
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
            <Show when={customPartDialogOpen()}>
                <div
                    aria-modal="true"
                    class="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4"
                    role="dialog"
                    onClick={closeCustomPartDialog}
                >
                    <form
                        class="w-full max-w-xs rounded border border-gray-5 bg-gray-1 p-3 shadow-xl"
                        onClick={(event) => event.stopPropagation()}
                        onSubmit={submitCustomPartDialog}
                    >
                        <label
                            class="mb-2 block text-xs font-semibold text-gray-11"
                            for="custom-part-name"
                        >
                            Custom component name
                        </label>
                        <input
                            autofocus
                            class="mb-3 h-8 w-full rounded border border-gray-5 bg-gray-2 px-2 text-sm text-gray-12 outline-none ring-primary-7 focus:ring-2"
                            id="custom-part-name"
                            onInput={(event) => setCustomPartName(event.currentTarget.value)}
                            value={customPartName()}
                        />
                        <div class="flex justify-end gap-2">
                            <button
                                class={toolbarButton}
                                onClick={closeCustomPartDialog}
                                type="button"
                            >
                                Cancel
                            </button>
                            <button
                                class={toolbarButton}
                                disabled={!customPartName().trim() || props.customComponents.isBusy}
                                type="submit"
                            >
                                Save Part
                            </button>
                        </div>
                    </form>
                </div>
            </Show>
        </div>
    );
};
