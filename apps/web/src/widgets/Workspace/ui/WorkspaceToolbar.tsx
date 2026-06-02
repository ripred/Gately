import { ArduinoHardwarePanel } from "@gately/features/arduino-hardware";
import { useAddLogicNode } from "@gately/features/nodes/useAddBaseLogic";
import { useUIEngine } from "@gately/shared/infrastructure";
import type { WorkspaceSimulationMode } from "@gately/shared/types";
import { Pusher } from "@gately/shared/ui";
import type { WorkspaceController } from "../lib/types";
import { Component, For, Show } from "solid-js";

const SIMULATION_MODE_OPTIONS: Array<{ value: WorkspaceSimulationMode; label: string }> = [
    { value: "instant", label: "instant" },
    { value: "0.5sec", label: "0.5 sec" },
];

type WorkspaceToolbarProps = Pick<
    WorkspaceController,
    "booleanAnalysis" | "configuration" | "customComponents" | "hardware" | "persistence" | "simulation"
>;

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
    const selectedCustomHash = () => props.customComponents.selectedHash();
    const builtInButtons = [
        { label: "Add TOGGLE", action: addToggle },
        { label: "Add True Constant", action: addTrueConstant },
        { label: "Add False Constant", action: addFalseConstant },
        { label: "Add LAMP", action: addLamp },
        { label: "Add 7-Seg Display", action: add7segDisplay },
        { label: "Add Buffer", action: addBuffer },
        { label: "Add AND", action: addAnd },
        { label: "Add OR", action: addOr },
        { label: "Add NOT", action: addNot },
        { label: "Add NOR", action: addNor },
        { label: "Add NAND", action: addNand },
        { label: "Add XOR", action: addXor },
        { label: "Add XNOR", action: addXnor },
    ];

    return (
        <div data-testid="workspace-toolbar" class="flex flex-col gap-2 p-3">
            <div class="flex flex-wrap items-center gap-2">
                <Pusher
                    class="px-2 py-1 bg-gray-3 rounded text-gray-12 hover:bg-gray-4 data-disabled:bg-gray-2 data-disabled:text-gray-8"
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
                    class="px-2 py-1 bg-gray-3 rounded text-gray-12 hover:bg-gray-4 data-disabled:bg-gray-2 data-disabled:text-gray-8"
                    onClick={props.simulation.nextStep}
                    disabled={props.simulation.isDisabled || !props.simulation.isPaused}
                >
                    Next tick
                </Pusher>
                <select
                    class="px-2 py-1 rounded bg-gray-3 text-gray-12 border border-gray-5"
                    value={props.simulation.mode}
                    disabled={props.simulation.isDisabled || props.simulation.isBusy}
                    onChange={(e) =>
                        (props.simulation.mode = e.currentTarget.value as WorkspaceSimulationMode)
                    }
                >
                    {SIMULATION_MODE_OPTIONS.map((mode) => (
                        <option value={mode.value}>{mode.label}</option>
                    ))}
                </select>
                <span class="text-xs text-gray-10">
                    {props.simulation.isBusy ? "running..." : "idle"}
                </span>
                <ArduinoHardwarePanel hardware={props.hardware} />
                <Pusher
                    class="px-2 py-1 bg-gray-3 rounded text-gray-12 hover:bg-gray-4 data-disabled:bg-gray-2 data-disabled:text-gray-8"
                    onClick={props.booleanAnalysis.analyze}
                    disabled={props.simulation.isDisabled || props.booleanAnalysis.isBusy}
                >
                    Optimize
                </Pusher>
                <Pusher
                    class="px-2 py-1 bg-gray-3 rounded text-gray-12 hover:bg-gray-4 data-disabled:bg-gray-2 data-disabled:text-gray-8"
                    onClick={props.persistence.createTab}
                    disabled={props.persistence.isBusy}
                >
                    New Tab
                </Pusher>
                <Pusher
                    class="px-2 py-1 bg-gray-3 rounded text-gray-12 hover:bg-gray-4 data-disabled:bg-gray-2 data-disabled:text-gray-8"
                    onClick={props.persistence.saveWorkspace}
                    disabled={props.persistence.isBusy}
                >
                    Save
                </Pusher>
                <Pusher
                    class="px-2 py-1 bg-gray-3 rounded text-gray-12 hover:bg-gray-4 data-disabled:bg-gray-2 data-disabled:text-gray-8"
                    onClick={props.persistence.loadWorkspace}
                    disabled={props.persistence.isBusy || !props.persistence.hasSavedWorkspace()}
                >
                    Load
                </Pusher>
                <Pusher
                    class="px-2 py-1 bg-gray-3 rounded text-gray-12 hover:bg-gray-4 data-disabled:bg-gray-2 data-disabled:text-gray-8"
                    onClick={() => uiEngine.commands.zoomOut()}
                    disabled={disabled()}
                >
                    Canvas -
                </Pusher>
                <Pusher
                    class="px-2 py-1 bg-gray-3 rounded text-gray-12 hover:bg-gray-4 data-disabled:bg-gray-2 data-disabled:text-gray-8"
                    onClick={() => uiEngine.commands.resetZoom()}
                    disabled={disabled()}
                >
                    Canvas 100%
                </Pusher>
                <Pusher
                    class="px-2 py-1 bg-gray-3 rounded text-gray-12 hover:bg-gray-4 data-disabled:bg-gray-2 data-disabled:text-gray-8"
                    onClick={() => uiEngine.commands.zoomIn()}
                    disabled={disabled()}
                >
                    Canvas +
                </Pusher>
                <Pusher
                    class="px-2 py-1 bg-gray-3 rounded text-gray-12 hover:bg-gray-4"
                    onClick={props.configuration.uiZoomOut}
                >
                    UI -
                </Pusher>
                <Pusher
                    class="px-2 py-1 bg-gray-3 rounded text-gray-12 hover:bg-gray-4"
                    onClick={props.configuration.resetUiZoom}
                >
                    UI {props.configuration.uiScalePercent()}%
                </Pusher>
                <Pusher
                    class="px-2 py-1 bg-gray-3 rounded text-gray-12 hover:bg-gray-4"
                    onClick={props.configuration.uiZoomIn}
                >
                    UI +
                </Pusher>
            </div>

            <div class="flex flex-wrap gap-2">
                <For each={builtInButtons}>
                    {(button) => (
                        <Pusher
                            class="px-3 py-1 bg-gray-3 rounded-md shadow text-gray-12 hover:bg-gray-4 data-disabled:bg-gray-2 data-disabled:text-gray-8"
                            onClick={button.action}
                            disabled={disabled()}
                        >
                            {button.label}
                        </Pusher>
                    )}
                </For>
            </div>

            <div class="flex flex-wrap items-center gap-2">
                <Pusher
                    class="px-3 py-1 bg-gray-3 rounded-md shadow text-gray-12 hover:bg-gray-4 data-disabled:bg-gray-2 data-disabled:text-gray-8"
                    onClick={props.customComponents.createFromSelection}
                    disabled={disabled() || commandDisabled()}
                >
                    Save Selection
                </Pusher>
                <Show when={props.customComponents.components().length > 0}>
                    <select
                        class="px-2 py-1 rounded bg-gray-3 text-gray-12 border border-gray-5"
                        value={selectedCustomHash() ?? ""}
                        disabled={props.customComponents.isBusy}
                        onChange={(e) =>
                            props.customComponents.setSelectedHash(e.currentTarget.value || undefined)
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
                        class="px-3 py-1 bg-gray-3 rounded-md shadow text-gray-12 hover:bg-gray-4 data-disabled:bg-gray-2 data-disabled:text-gray-8"
                        onClick={props.customComponents.renameSelected}
                        disabled={!selectedCustomHash() || props.customComponents.isBusy}
                    >
                        Rename
                    </Pusher>
                    <Pusher
                        class="px-3 py-1 bg-gray-3 rounded-md shadow text-gray-12 hover:bg-gray-4 data-disabled:bg-gray-2 data-disabled:text-gray-8"
                        onClick={props.customComponents.removeSelected}
                        disabled={!selectedCustomHash() || props.customComponents.isBusy}
                    >
                        Delete
                    </Pusher>
                    <For each={props.customComponents.components()}>
                        {(component) => (
                            <Pusher
                                class="px-3 py-1 bg-gray-3 rounded-md shadow text-gray-12 hover:bg-gray-4 data-disabled:bg-gray-2 data-disabled:text-gray-8"
                                onClick={() => props.customComponents.addComponent(component.hash)}
                                disabled={disabled()}
                            >
                                Add {component.name}
                            </Pusher>
                        )}
                    </For>
                </Show>
            </div>
        </div>
    );
};
