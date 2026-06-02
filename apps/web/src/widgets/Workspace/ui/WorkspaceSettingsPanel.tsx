import {
    WORKBENCH_EXPLORER_WIDTH_LIMITS,
    type AppConfigurationController,
} from "@gately/app/providers/AppConfigurationProvider";
import type { WorkspaceSimulationMode } from "@gately/shared/types";
import type { WorkspaceSimulationController } from "../lib/types";
import { Component, For } from "solid-js";
import {
    EXPLORER_SECTION_SETTINGS,
    ROUTING_SETTINGS,
    SIGNAL_PATH_COLOR_SETTINGS,
    SIMULATION_MODE_OPTIONS,
    TOOLBAR_GROUP_SETTINGS,
    setExplorerSectionExpanded,
    setExplorerWidth,
    setRoutingDistance,
    setSignalPathColor,
    setToolbarGroupVisible,
} from "./settingsSchema";

type WorkspaceSettingsPanelProps = {
    configuration: AppConfigurationController;
    simulation: WorkspaceSimulationController;
};

export const WorkspaceSettingsPanel: Component<WorkspaceSettingsPanelProps> = (props) => (
    <div class="h-full overflow-auto bg-gray-1 text-gray-12">
        <div class="mx-auto flex max-w-6xl flex-col gap-6 px-8 py-7">
            <header class="border-b border-gray-4 pb-4">
                <p class="text-xs font-bold uppercase tracking-wide text-gray-10">
                    Gately Preferences
                </p>
                <h1 class="mt-1 text-2xl font-semibold text-gray-12">Settings</h1>
            </header>

            <section class="grid grid-cols-[14rem_minmax(0,1fr)] gap-8 border-b border-gray-4 pb-6">
                <div>
                    <h2 class="text-sm font-semibold text-gray-12">Accessibility</h2>
                    <p class="mt-2 text-xs leading-5 text-gray-10">
                        Controls the application chrome scale. Circuit canvas zoom remains separate.
                    </p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <button
                        class="rounded border border-gray-5 bg-gray-2 px-3 py-1.5 text-sm text-gray-12 hover:bg-gray-3"
                        onClick={props.configuration.uiZoomOut}
                    >
                        UI -
                    </button>
                    <button
                        class="rounded border border-gray-5 bg-gray-2 px-3 py-1.5 text-sm text-gray-12 hover:bg-gray-3"
                        onClick={props.configuration.resetUiZoom}
                    >
                        UI {props.configuration.uiScalePercent()}%
                    </button>
                    <button
                        class="rounded border border-gray-5 bg-gray-2 px-3 py-1.5 text-sm text-gray-12 hover:bg-gray-3"
                        onClick={props.configuration.uiZoomIn}
                    >
                        UI +
                    </button>
                </div>
            </section>

            <section class="grid grid-cols-[14rem_minmax(0,1fr)] gap-8 border-b border-gray-4 pb-6">
                <div>
                    <h2 class="text-sm font-semibold text-gray-12">Workbench</h2>
                    <p class="mt-2 text-xs leading-5 text-gray-10">
                        Controls the IDE chrome around the familiar circuit canvas.
                    </p>
                </div>
                <div class="grid gap-4">
                    <label class="flex items-start gap-3 text-sm text-gray-12">
                        <input
                            class="mt-1"
                            type="checkbox"
                            checked={props.configuration.workbenchConfig().explorerCollapsed}
                            onChange={(event) =>
                                props.configuration.setWorkbenchConfig({
                                    explorerCollapsed: event.currentTarget.checked,
                                })
                            }
                        />
                        <span>
                            <span class="block font-medium">Collapse explorer sidebar</span>
                            <span class="block text-xs leading-5 text-gray-9">
                                Keep the project explorer minimized by default.
                            </span>
                        </span>
                    </label>
                    <label class="grid max-w-xs gap-1 text-xs text-gray-10">
                        <span class="font-medium text-gray-11">Explorer width</span>
                        <input
                            class="rounded border border-gray-5 bg-gray-2 px-2 py-1.5 text-sm text-gray-12"
                            type="number"
                            min={WORKBENCH_EXPLORER_WIDTH_LIMITS.min}
                            max={WORKBENCH_EXPLORER_WIDTH_LIMITS.max}
                            step={8}
                            value={props.configuration.workbenchConfig().explorerWidth}
                            onInput={(event) =>
                                setExplorerWidth(
                                    props.configuration,
                                    event.currentTarget.value,
                                )
                            }
                        />
                        <span class="leading-4 text-gray-9">
                            Width in pixels when the explorer is expanded.
                        </span>
                    </label>
                    <div>
                        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-9">
                            Explorer Sections
                        </h3>
                        <div class="grid grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-2">
                            <For each={EXPLORER_SECTION_SETTINGS}>
                                {(setting) => (
                                    <label class="flex items-center gap-2 text-sm text-gray-12">
                                        <input
                                            type="checkbox"
                                            checked={
                                                props.configuration.workbenchConfig()
                                                    .expandedExplorerSections[setting.key]
                                            }
                                            onChange={(event) =>
                                                setExplorerSectionExpanded(
                                                    props.configuration,
                                                    setting.key,
                                                    event.currentTarget.checked,
                                                )
                                            }
                                        />
                                        <span>{setting.label}</span>
                                    </label>
                                )}
                            </For>
                        </div>
                    </div>
                    <div>
                        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-9">
                            Toolbar Groups
                        </h3>
                        <div class="grid grid-cols-[repeat(auto-fit,minmax(17rem,1fr))] gap-3">
                            <For each={TOOLBAR_GROUP_SETTINGS}>
                                {(setting) => (
                                    <label class="flex items-start gap-3 rounded border border-gray-4 bg-gray-2 px-3 py-2 text-sm text-gray-12">
                                        <input
                                            class="mt-1"
                                            type="checkbox"
                                            checked={
                                                props.configuration.workbenchConfig()
                                                    .visibleToolbarGroups[setting.key]
                                            }
                                            onChange={(event) =>
                                                setToolbarGroupVisible(
                                                    props.configuration,
                                                    setting.key,
                                                    event.currentTarget.checked,
                                                )
                                            }
                                        />
                                        <span>
                                            <span class="block font-medium">
                                                {setting.label}
                                            </span>
                                            <span class="block text-xs leading-5 text-gray-9">
                                                {setting.description}
                                            </span>
                                        </span>
                                    </label>
                                )}
                            </For>
                        </div>
                    </div>
                    <div>
                        <button
                            class="rounded border border-gray-5 bg-gray-2 px-3 py-1.5 text-sm text-gray-12 hover:bg-gray-3"
                            onClick={props.configuration.resetWorkbenchConfig}
                        >
                            Reset Workbench
                        </button>
                    </div>
                </div>
            </section>

            <section class="grid grid-cols-[14rem_minmax(0,1fr)] gap-8 border-b border-gray-4 pb-6">
                <div>
                    <h2 class="text-sm font-semibold text-gray-12">Simulation</h2>
                    <p class="mt-2 text-xs leading-5 text-gray-10">
                        Sets the default simulation cadence for the active workspace.
                    </p>
                </div>
                <label class="flex max-w-xs flex-col gap-1 text-xs text-gray-10">
                    Tick rate
                    <select
                        class="rounded border border-gray-5 bg-gray-2 px-2 py-1.5 text-sm text-gray-12"
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
                </label>
            </section>

            <section class="grid grid-cols-[14rem_minmax(0,1fr)] gap-8 border-b border-gray-4 pb-6">
                <div>
                    <h2 class="text-sm font-semibold text-gray-12">Routing</h2>
                    <p class="mt-2 text-xs leading-5 text-gray-10">
                        Deterministic geometry constraints for auto-layout and optimized circuits.
                    </p>
                </div>
                <div class="grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-4">
                    <For each={ROUTING_SETTINGS}>
                        {(setting) => (
                            <label class="grid gap-1 text-xs text-gray-10">
                                <span class="font-medium text-gray-11">{setting.label}</span>
                                <input
                                    class="rounded border border-gray-5 bg-gray-2 px-2 py-1.5 text-sm text-gray-12"
                                    type="number"
                                    min={setting.min}
                                    max={setting.max}
                                    step={setting.step}
                                    value={props.configuration.routingConfig()[setting.key]}
                                    onInput={(event) =>
                                        setRoutingDistance(
                                            props.configuration,
                                            setting.key,
                                            event.currentTarget.value,
                                        )
                                    }
                                />
                                <span class="leading-4 text-gray-9">{setting.description}</span>
                            </label>
                        )}
                    </For>
                </div>
                <div class="col-start-2">
                    <button
                        class="rounded border border-gray-5 bg-gray-2 px-3 py-1.5 text-sm text-gray-12 hover:bg-gray-3"
                        onClick={props.configuration.resetRoutingConfig}
                    >
                        Reset Routing
                    </button>
                </div>
            </section>

            <section class="grid grid-cols-[14rem_minmax(0,1fr)] gap-8 pb-8">
                <div>
                    <h2 class="text-sm font-semibold text-gray-12">Signal Colors</h2>
                    <p class="mt-2 text-xs leading-5 text-gray-10">
                        Visual signal state colors used on rendered paths.
                    </p>
                </div>
                <div class="flex flex-wrap gap-4">
                    <For each={SIGNAL_PATH_COLOR_SETTINGS}>
                        {(setting) => (
                            <label class="flex items-center gap-3 text-xs text-gray-10">
                                <span class="w-20 font-medium text-gray-11">{setting.label}</span>
                                <input
                                    class="h-8 w-12 rounded border border-gray-5 bg-gray-2 p-1"
                                    type="color"
                                    value={props.configuration.signalPathColors()[setting.key]}
                                    onInput={(event) =>
                                        setSignalPathColor(
                                            props.configuration,
                                            setting.key,
                                            event.currentTarget.value,
                                        )
                                    }
                                />
                                <span class="font-mono text-[11px] text-gray-10">
                                    {props.configuration.signalPathColors()[setting.key]}
                                </span>
                            </label>
                        )}
                    </For>
                    <button
                        class="rounded border border-gray-5 bg-gray-2 px-3 py-1.5 text-sm text-gray-12 hover:bg-gray-3"
                        onClick={props.configuration.resetSignalPathColors}
                    >
                        Reset Signals
                    </button>
                </div>
            </section>
        </div>
    </div>
);
