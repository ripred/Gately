import {
    WORKBENCH_EXPLORER_WIDTH_LIMITS,
    type AppConfigurationController,
} from "@gately/app/providers/AppConfigurationProvider";
import type { WorkspaceSimulationMode } from "@gately/shared/types";
import type { WorkspaceSimulationController } from "../lib/types";
import { Component, createMemo, createSignal, For, JSX, Show, type Accessor } from "solid-js";
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
    activeCategoryId: Accessor<SettingsCategoryId>;
    configuration: AppConfigurationController;
    onClose: () => void;
    setActiveCategoryId: (categoryId: SettingsCategoryId) => void;
    simulation: WorkspaceSimulationController;
};

export type SettingsCategoryId =
    | "accessibility"
    | "workbench"
    | "simulation"
    | "routing"
    | "signals";

type SettingsCategory = {
    description: string;
    id: SettingsCategoryId;
    keywords: string[];
    label: string;
    render: () => JSX.Element;
};

const buttonClass =
    "rounded border border-gray-5 bg-gray-2 px-3 py-1.5 text-sm text-gray-12 hover:bg-gray-3";

const inputClass =
    "rounded border border-gray-5 bg-gray-2 px-2 py-1.5 text-sm text-gray-12";

const normalizeSearch = (value: string): string => value.trim().toLowerCase();

export const WorkspaceSettingsPanel: Component<WorkspaceSettingsPanelProps> = (props) => {
    const [searchQuery, setSearchQuery] = createSignal("");
    const showAllToolbarGroups = () => {
        props.configuration.setWorkbenchConfig({
            visibleToolbarGroups: Object.fromEntries(
                TOOLBAR_GROUP_SETTINGS.map((setting) => [setting.key, true]),
            ),
        });
    };

    const categories: SettingsCategory[] = [
        {
            description: "Application chrome scale.",
            id: "accessibility",
            keywords: ["accessibility", "ui", "scale", "zoom", "chrome"],
            label: "Accessibility",
            render: () => (
                <div class="flex flex-wrap items-center gap-2">
                    <button class={buttonClass} onClick={props.configuration.uiZoomOut}>
                        UI -
                    </button>
                    <button class={buttonClass} onClick={props.configuration.resetUiZoom}>
                        UI {props.configuration.uiScalePercent()}%
                    </button>
                    <button class={buttonClass} onClick={props.configuration.uiZoomIn}>
                        UI +
                    </button>
                </div>
            ),
        },
        {
            description: "Explorer and toolbar preferences.",
            id: "workbench",
            keywords: [
                "workbench",
                "explorer",
                "project",
                "sidebar",
                "toolbar",
                "sections",
                ...EXPLORER_SECTION_SETTINGS.map((setting) => setting.label),
                ...TOOLBAR_GROUP_SETTINGS.map((setting) => setting.label),
            ],
            label: "Workbench",
            render: () => (
                <div class="grid gap-5">
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
                                Default project explorer state.
                            </span>
                        </span>
                    </label>
                    <label class="grid max-w-xs gap-1 text-xs text-gray-10">
                        <span class="font-medium text-gray-11">Explorer width</span>
                        <input
                            class={inputClass}
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
                        <span class="leading-4 text-gray-9">Expanded explorer width.</span>
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
                                    <label class="flex items-start gap-3 border border-gray-4 bg-gray-2 px-3 py-2 text-sm text-gray-12">
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
                                            <span class="block font-medium">{setting.label}</span>
                                            <span class="block text-xs leading-5 text-gray-9">
                                                {setting.description}
                                            </span>
                                        </span>
                                    </label>
                                )}
                            </For>
                        </div>
                        <button class={`${buttonClass} mt-3`} onClick={showAllToolbarGroups}>
                            Show All Toolbar Groups
                        </button>
                    </div>
                    <div>
                        <button
                            class={buttonClass}
                            onClick={props.configuration.resetWorkbenchConfig}
                        >
                            Reset Workbench
                        </button>
                    </div>
                </div>
            ),
        },
        {
            description: "Simulation tick cadence.",
            id: "simulation",
            keywords: ["simulation", "tick", "rate", "cadence", "instant", "pause", "step"],
            label: "Simulation",
            render: () => (
                <label class="flex max-w-xs flex-col gap-1 text-xs text-gray-10">
                    Tick rate
                    <select
                        class={inputClass}
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
            ),
        },
        {
            description: "Deterministic wire routing geometry.",
            id: "routing",
            keywords: [
                "routing",
                "auto layout",
                "wire",
                "clearance",
                "padding",
                ...ROUTING_SETTINGS.flatMap((setting) => [
                    setting.label,
                    setting.description,
                ]),
            ],
            label: "Routing",
            render: () => (
                <div class="grid gap-5">
                    <div class="grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-4">
                        <For each={ROUTING_SETTINGS}>
                            {(setting) => (
                                <label class="grid gap-1 text-xs text-gray-10">
                                    <span class="font-medium text-gray-11">{setting.label}</span>
                                    <input
                                        class={inputClass}
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
                                    <span class="leading-4 text-gray-9">
                                        {setting.description}
                                    </span>
                                </label>
                            )}
                        </For>
                    </div>
                    <div>
                        <button
                            class={buttonClass}
                            onClick={props.configuration.resetRoutingConfig}
                        >
                            Reset Routing
                        </button>
                    </div>
                </div>
            ),
        },
        {
            description: "Rendered signal state colors.",
            id: "signals",
            keywords: ["signal", "signals", "colors", "high", "low", "paths"],
            label: "Signal Colors",
            render: () => (
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
                        class={buttonClass}
                        onClick={props.configuration.resetSignalPathColors}
                    >
                        Reset Signals
                    </button>
                </div>
            ),
        },
    ];

    const visibleCategories = createMemo(() => {
        const query = normalizeSearch(searchQuery());
        if (!query) return categories;

        return categories.filter((category) =>
            normalizeSearch(
                [category.label, category.description, ...category.keywords].join(" "),
            ).includes(query),
        );
    });
    const activeCategory = createMemo(() => {
        const visible = visibleCategories();
        return (
            visible.find((category) => category.id === props.activeCategoryId()) ??
            visible[0]
        );
    });

    return (
        <div class="flex h-[min(44rem,calc(100vh-6rem))] w-[min(62rem,calc(100vw-4rem))] overflow-hidden rounded border border-gray-4 bg-gray-1 text-gray-12 shadow-[0_18px_42px_rgba(0,0,0,0.20)]">
            <div class="flex h-full min-h-0 flex-1 flex-col">
                <header class="shrink-0 border-b border-gray-4 px-6 py-4">
                    <div class="flex items-start justify-between gap-4">
                        <div>
                            <p class="text-xs font-bold uppercase tracking-wide text-gray-10">
                                Gately Preferences
                            </p>
                            <h1 class="mt-2 text-2xl font-semibold text-gray-12">Settings</h1>
                        </div>
                        <button
                            aria-label="Close settings"
                            class="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-gray-5 bg-gray-2 text-sm text-gray-12 hover:bg-gray-3"
                            onClick={props.onClose}
                            type="button"
                        >
                            <svg
                                aria-hidden="true"
                                class="h-4 w-4"
                                viewBox="0 0 16 16"
                            >
                                <path
                                    d="M4 4l8 8M12 4l-8 8"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-linecap="round"
                                    stroke-width="1.8"
                                />
                            </svg>
                        </button>
                    </div>
                    <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <label class="min-w-[16rem] flex-1 max-w-sm">
                            <span class="sr-only">Search settings</span>
                            <input
                                class="w-full rounded border border-gray-5 bg-gray-2 px-3 py-2 text-sm text-gray-12"
                                placeholder="Search settings"
                                type="search"
                                value={searchQuery()}
                                onInput={(event) => setSearchQuery(event.currentTarget.value)}
                            />
                        </label>
                    </div>
                </header>

                <div class="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)]">
                    <nav
                        aria-label="Settings categories"
                        class="min-h-0 overflow-auto border-r border-gray-4 bg-gray-2 py-2"
                        role="tablist"
                    >
                        <For each={visibleCategories()}>
                            {(category) => (
                                <button
                                    aria-controls={`settings-panel-${category.id}`}
                                    aria-selected={activeCategory()?.id === category.id}
                                    class={[
                                        "flex w-full flex-col gap-1 px-4 py-2 text-left hover:bg-gray-3",
                                        activeCategory()?.id === category.id
                                            ? "bg-primary-3 text-primary-11"
                                            : "text-gray-11",
                                    ].join(" ")}
                                    id={`settings-tab-${category.id}`}
                                    role="tab"
                                    onClick={() => props.setActiveCategoryId(category.id)}
                                >
                                    <span class="text-sm font-medium">{category.label}</span>
                                    <span class="text-xs leading-4 text-gray-9">
                                        {category.description}
                                    </span>
                                </button>
                            )}
                        </For>
                    </nav>

                    <main class="min-h-0 overflow-auto px-8 py-7">
                        <Show
                            when={activeCategory()}
                            fallback={
                                <div class="max-w-3xl border border-gray-4 bg-gray-2 p-5">
                                    <h2 class="text-lg font-semibold text-gray-12">
                                        No settings found
                                    </h2>
                                    <p class="mt-2 text-sm text-gray-9">
                                        No categories match the current search.
                                    </p>
                                </div>
                            }
                        >
                            {(category) => (
                                <section
                                    aria-labelledby={`settings-tab-${category().id}`}
                                    class="max-w-5xl"
                                    id={`settings-panel-${category().id}`}
                                    role="tabpanel"
                                >
                                    <header class="border-b border-gray-4 pb-4">
                                        <h2 class="text-xl font-semibold text-gray-12">
                                            {category().label}
                                        </h2>
                                        <p class="mt-1 text-sm text-gray-9">
                                            {category().description}
                                        </p>
                                    </header>
                                    <div class="pt-6">{category().render()}</div>
                                </section>
                            )}
                        </Show>
                    </main>
                </div>
            </div>
        </div>
    );
};
