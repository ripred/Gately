import { ArduinoHardwarePanel } from "@gately/features/arduino-hardware";
import { useAddLogicNode } from "@gately/features/nodes/useAddBaseLogic";
import type {
    AppConfigurationController,
    SignalPathColorConfig,
} from "@gately/app/providers/AppConfigurationProvider";
import type { OptimizedCircuitRoutingConfig } from "@gately/features/boolean-analysis/model/optimizedCircuitLayout";
import { useUIEngine } from "@gately/shared/infrastructure";
import type { WorkspaceSimulationMode } from "@gately/shared/types";
import { Pusher } from "@gately/shared/ui";
import type { WorkspaceController } from "../lib/types";
import { Component, For, Show } from "solid-js";

const SIMULATION_MODE_OPTIONS: Array<{ value: WorkspaceSimulationMode; label: string }> = [
    { value: "instant", label: "instant" },
    { value: "0.5sec", label: "0.5 sec" },
];

const ROUTING_SETTINGS: Array<{
    key: keyof OptimizedCircuitRoutingConfig;
    label: string;
    min: number;
    max: number;
    step: number;
}> = [
    { key: "minClearance", label: "Min", min: 16, max: 160, step: 4 },
    { key: "sourceExitClearance", label: "Source exit", min: 16, max: 192, step: 4 },
    { key: "targetGutter", label: "Input lane", min: 16, max: 192, step: 4 },
    { key: "targetGutterStep", label: "Lane step", min: 0, max: 48, step: 2 },
    { key: "farTargetGutterOffset", label: "Far lane", min: 0, max: 160, step: 4 },
    { key: "nearTargetGutterOffset", label: "Near lane", min: 0, max: 160, step: 4 },
    { key: "targetEdgeClearance", label: "Edge pad", min: 16, max: 160, step: 4 },
    { key: "sourceFanoutGutter", label: "Fanout", min: 16, max: 192, step: 4 },
    { key: "detourGap", label: "Detour", min: 16, max: 192, step: 4 },
    { key: "detourStep", label: "Detour step", min: 0, max: 96, step: 4 },
    { key: "parallelRouteSpacing", label: "Route step", min: 0, max: 64, step: 1 },
    { key: "rectClearance", label: "Body pad", min: 0, max: 48, step: 1 },
    { key: "wireClearance", label: "Wire pad", min: 0, max: 48, step: 1 },
    { key: "topRouteClearance", label: "Top pad", min: 16, max: 192, step: 4 },
    { key: "searchMargin", label: "Search pad", min: 16, max: 1024, step: 16 },
    { key: "searchMarginStep", label: "Search step", min: 0, max: 128, step: 4 },
    { key: "outputSinkTargetClearance", label: "Sink side", min: 16, max: 192, step: 4 },
    { key: "outputSinkBottomClearance", label: "Sink lane", min: 16, max: 192, step: 4 },
    { key: "outputSinkPreferredRise", label: "Sink rise", min: 0, max: 192, step: 4 },
];

const SIGNAL_PATH_COLOR_SETTINGS: Array<{
    key: keyof SignalPathColorConfig;
    label: string;
}> = [
    { key: "high", label: "High path" },
    { key: "low", label: "Low path" },
];

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
    const setRoutingDistance = (key: keyof OptimizedCircuitRoutingConfig, value: string) => {
        props.configuration.setRoutingConfig({ [key]: Number(value) });
    };
    const setSignalPathColor = (key: keyof SignalPathColorConfig, value: string) => {
        props.configuration.setSignalPathColors({ [key]: value });
    };
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
                    class="px-2 py-1 bg-gray-3 rounded text-gray-12 hover:bg-gray-4 data-disabled:bg-gray-2 data-disabled:text-gray-8"
                    onClick={props.autoLayout.applySelection}
                    disabled={disabled() || commandDisabled() || props.autoLayout.isDisabled}
                >
                    Auto Layout Selection
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
                    disabled={
                        disabled() ||
                        commandDisabled() ||
                        props.customComponents.selectedNodeCount() === 0
                    }
                >
                    Save Selection
                </Pusher>
                <details class="rounded-md bg-gray-2 px-2 py-1 text-gray-12">
                    <summary class="cursor-pointer select-none">Routing</summary>
                    <div class="mt-2 grid grid-cols-[repeat(2,minmax(7rem,auto))] gap-2">
                        <For each={ROUTING_SETTINGS}>
                            {(setting) => (
                                <label class="flex items-center gap-2 text-xs text-gray-11">
                                    <span class="min-w-16">{setting.label}</span>
                                    <input
                                        class="w-16 rounded border border-gray-5 bg-gray-1 px-1 py-0.5 text-gray-12"
                                        type="number"
                                        min={setting.min}
                                        max={setting.max}
                                        step={setting.step}
                                        value={props.configuration.routingConfig()[setting.key]}
                                        onInput={(e) =>
                                            setRoutingDistance(setting.key, e.currentTarget.value)
                                        }
                                    />
                                </label>
                            )}
                        </For>
                        <Pusher
                            class="px-2 py-1 bg-gray-3 rounded text-gray-12 hover:bg-gray-4"
                            onClick={props.configuration.resetRoutingConfig}
                        >
                            Reset Routing
                        </Pusher>
                    </div>
                </details>
                <details class="rounded-md bg-gray-2 px-2 py-1 text-gray-12">
                    <summary class="cursor-pointer select-none">Signals</summary>
                    <div class="mt-2 grid gap-2">
                        <For each={SIGNAL_PATH_COLOR_SETTINGS}>
                            {(setting) => (
                                <label class="flex items-center gap-2 text-xs text-gray-11">
                                    <span class="min-w-16">{setting.label}</span>
                                    <input
                                        class="h-7 w-10 rounded border border-gray-5 bg-gray-1 p-0.5"
                                        type="color"
                                        value={
                                            props.configuration.signalPathColors()[setting.key]
                                        }
                                        onInput={(e) =>
                                            setSignalPathColor(
                                                setting.key,
                                                e.currentTarget.value,
                                            )
                                        }
                                    />
                                    <span class="font-mono text-[11px] text-gray-10">
                                        {props.configuration.signalPathColors()[setting.key]}
                                    </span>
                                </label>
                            )}
                        </For>
                        <Pusher
                            class="px-2 py-1 bg-gray-3 rounded text-gray-12 hover:bg-gray-4"
                            onClick={props.configuration.resetSignalPathColors}
                        >
                            Reset Signals
                        </Pusher>
                    </div>
                </details>
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
