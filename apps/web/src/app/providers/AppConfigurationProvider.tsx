import {
    createContext,
    createSignal,
    ParentComponent,
    useContext,
} from "solid-js";
import {
    DEFAULT_OPTIMIZED_CIRCUIT_ROUTING_CONFIG,
    normalizeOptimizedCircuitRoutingConfig,
    type OptimizedCircuitRoutingConfig,
} from "@gately/features/boolean-analysis/model/optimizedCircuitLayout";

const CONFIG_VERSION = 1;
const UI_SCALE_MIN = 0.75;
const UI_SCALE_MAX = 1.5;
const UI_SCALE_STEP = 0.1;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const EXPLORER_WIDTH_MIN = 220;
const EXPLORER_WIDTH_MAX = 520;
const EXPLORER_WIDTH_DEFAULT = 288;

export const WORKBENCH_EXPLORER_WIDTH_LIMITS = {
    min: EXPLORER_WIDTH_MIN,
    max: EXPLORER_WIDTH_MAX,
} as const;

export type SignalPathColorConfig = {
    high: string;
    low: string;
};

export const DEFAULT_SIGNAL_PATH_COLOR_CONFIG: SignalPathColorConfig = {
    high: "#14f2b3",
    low: "#a4b7d2",
};

export type WorkbenchToolbarGroupKey =
    | "simulation"
    | "hardware"
    | "workspace"
    | "canvas"
    | "parts"
    | "customParts";

export type WorkbenchExplorerSectionKey =
    | "project"
    | "circuits"
    | "navigation"
    | "components"
    | "workbench";

export type WorkbenchConfig = {
    explorerCollapsed: boolean;
    explorerWidth: number;
    expandedExplorerSections: Record<WorkbenchExplorerSectionKey, boolean>;
    visibleToolbarGroups: Record<WorkbenchToolbarGroupKey, boolean>;
};

export type WorkbenchConfigPatch = {
    explorerCollapsed?: boolean;
    explorerWidth?: number;
    expandedExplorerSections?: Partial<Record<WorkbenchExplorerSectionKey, boolean>>;
    visibleToolbarGroups?: Partial<Record<WorkbenchToolbarGroupKey, boolean>>;
};

export const DEFAULT_WORKBENCH_CONFIG: WorkbenchConfig = {
    explorerCollapsed: false,
    explorerWidth: EXPLORER_WIDTH_DEFAULT,
    expandedExplorerSections: {
        project: true,
        circuits: true,
        navigation: true,
        components: true,
        workbench: true,
    },
    visibleToolbarGroups: {
        simulation: true,
        hardware: true,
        workspace: true,
        canvas: true,
        parts: true,
        customParts: true,
    },
};

export type AppConfigurationSnapshot = {
    version: typeof CONFIG_VERSION;
    uiScale: number;
    routingConfig: OptimizedCircuitRoutingConfig;
    signalPathColors: SignalPathColorConfig;
    workbenchConfig: WorkbenchConfig;
};

export type AppConfigurationController = {
    uiScale: () => number;
    uiScalePercent: () => number;
    routingConfig: () => OptimizedCircuitRoutingConfig;
    signalPathColors: () => SignalPathColorConfig;
    workbenchConfig: () => WorkbenchConfig;
    setUiScale: (scale: number) => void;
    setRoutingConfig: (config: Partial<OptimizedCircuitRoutingConfig>) => void;
    setSignalPathColors: (config: Partial<SignalPathColorConfig>) => void;
    setWorkbenchConfig: (config: WorkbenchConfigPatch) => void;
    uiZoomIn: () => void;
    uiZoomOut: () => void;
    resetUiZoom: () => void;
    resetRoutingConfig: () => void;
    resetSignalPathColors: () => void;
    resetWorkbenchConfig: () => void;
    exportSnapshot: () => AppConfigurationSnapshot;
    importSnapshot: (snapshot?: Partial<AppConfigurationSnapshot>) => void;
};

const AppConfigurationContext = createContext<AppConfigurationController>();

const clampUiScale = (scale: number): number =>
    Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, scale));

const normalizeUiScale = (scale: number): number => {
    if (!Number.isFinite(scale)) return 1;
    return Number(clampUiScale(scale).toFixed(2));
};

const normalizeHexColor = (color: unknown, fallback: string): string => {
    if (typeof color !== "string") return fallback;
    const trimmed = color.trim();
    return HEX_COLOR_PATTERN.test(trimmed) ? trimmed.toLowerCase() : fallback;
};

export const normalizeSignalPathColorConfig = (
    config?: Partial<SignalPathColorConfig>,
): SignalPathColorConfig => ({
    high: normalizeHexColor(config?.high, DEFAULT_SIGNAL_PATH_COLOR_CONFIG.high),
    low: normalizeHexColor(config?.low, DEFAULT_SIGNAL_PATH_COLOR_CONFIG.low),
});

const normalizeBoolean = (value: unknown, fallback: boolean): boolean =>
    typeof value === "boolean" ? value : fallback;

const normalizeExplorerWidth = (width: unknown): number => {
    if (typeof width !== "number" || !Number.isFinite(width)) {
        return DEFAULT_WORKBENCH_CONFIG.explorerWidth;
    }

    return Math.round(
        Math.min(EXPLORER_WIDTH_MAX, Math.max(EXPLORER_WIDTH_MIN, width)),
    );
};

export const normalizeWorkbenchConfig = (
    config?: WorkbenchConfigPatch,
): WorkbenchConfig => ({
    explorerCollapsed: normalizeBoolean(
        config?.explorerCollapsed,
        DEFAULT_WORKBENCH_CONFIG.explorerCollapsed,
    ),
    explorerWidth: normalizeExplorerWidth(config?.explorerWidth),
    expandedExplorerSections: {
        project: normalizeBoolean(
            config?.expandedExplorerSections?.project,
            DEFAULT_WORKBENCH_CONFIG.expandedExplorerSections.project,
        ),
        circuits: normalizeBoolean(
            config?.expandedExplorerSections?.circuits,
            DEFAULT_WORKBENCH_CONFIG.expandedExplorerSections.circuits,
        ),
        navigation: normalizeBoolean(
            config?.expandedExplorerSections?.navigation,
            DEFAULT_WORKBENCH_CONFIG.expandedExplorerSections.navigation,
        ),
        components: normalizeBoolean(
            config?.expandedExplorerSections?.components,
            DEFAULT_WORKBENCH_CONFIG.expandedExplorerSections.components,
        ),
        workbench: normalizeBoolean(
            config?.expandedExplorerSections?.workbench,
            DEFAULT_WORKBENCH_CONFIG.expandedExplorerSections.workbench,
        ),
    },
    visibleToolbarGroups: {
        simulation: normalizeBoolean(
            config?.visibleToolbarGroups?.simulation,
            DEFAULT_WORKBENCH_CONFIG.visibleToolbarGroups.simulation,
        ),
        hardware: normalizeBoolean(
            config?.visibleToolbarGroups?.hardware,
            DEFAULT_WORKBENCH_CONFIG.visibleToolbarGroups.hardware,
        ),
        workspace: normalizeBoolean(
            config?.visibleToolbarGroups?.workspace,
            DEFAULT_WORKBENCH_CONFIG.visibleToolbarGroups.workspace,
        ),
        canvas: normalizeBoolean(
            config?.visibleToolbarGroups?.canvas,
            DEFAULT_WORKBENCH_CONFIG.visibleToolbarGroups.canvas,
        ),
        parts: normalizeBoolean(
            config?.visibleToolbarGroups?.parts,
            DEFAULT_WORKBENCH_CONFIG.visibleToolbarGroups.parts,
        ),
        customParts: normalizeBoolean(
            config?.visibleToolbarGroups?.customParts,
            DEFAULT_WORKBENCH_CONFIG.visibleToolbarGroups.customParts,
        ),
    },
});

export const normalizeAppConfigurationSnapshot = (
    snapshot?: Partial<AppConfigurationSnapshot>,
): AppConfigurationSnapshot => ({
    version: CONFIG_VERSION,
    uiScale: normalizeUiScale(snapshot?.uiScale ?? 1),
    routingConfig: normalizeOptimizedCircuitRoutingConfig(snapshot?.routingConfig),
    signalPathColors: normalizeSignalPathColorConfig(snapshot?.signalPathColors),
    workbenchConfig: normalizeWorkbenchConfig(snapshot?.workbenchConfig),
});

const createAppConfiguration = (): AppConfigurationController => {
    const initial = normalizeAppConfigurationSnapshot();
    const [uiScale, setUiScaleSignal] = createSignal(initial.uiScale);
    const [routingConfig, setRoutingConfigSignal] =
        createSignal<OptimizedCircuitRoutingConfig>(
            normalizeOptimizedCircuitRoutingConfig(initial.routingConfig),
        );
    const [signalPathColors, setSignalPathColorsSignal] =
        createSignal<SignalPathColorConfig>(
            normalizeSignalPathColorConfig(initial.signalPathColors),
        );
    const [workbenchConfig, setWorkbenchConfigSignal] = createSignal<WorkbenchConfig>(
        normalizeWorkbenchConfig(initial.workbenchConfig),
    );

    const setUiScale = (scale: number) => {
        setUiScaleSignal(normalizeUiScale(scale));
    };
    const setRoutingConfig = (config: Partial<OptimizedCircuitRoutingConfig>) => {
        setRoutingConfigSignal((current) =>
            normalizeOptimizedCircuitRoutingConfig({
                ...current,
                ...config,
            }),
        );
    };
    const setSignalPathColors = (config: Partial<SignalPathColorConfig>) => {
        setSignalPathColorsSignal((current) =>
            normalizeSignalPathColorConfig({
                ...current,
                ...config,
            }),
        );
    };
    const setWorkbenchConfig = (config: WorkbenchConfigPatch) => {
        setWorkbenchConfigSignal((current) =>
            normalizeWorkbenchConfig({
                ...current,
                ...config,
                expandedExplorerSections: {
                    ...current.expandedExplorerSections,
                    ...config.expandedExplorerSections,
                },
                visibleToolbarGroups: {
                    ...current.visibleToolbarGroups,
                    ...config.visibleToolbarGroups,
                },
            }),
        );
    };

    const exportSnapshot = (): AppConfigurationSnapshot => ({
        version: CONFIG_VERSION,
        uiScale: uiScale(),
        routingConfig: routingConfig(),
        signalPathColors: signalPathColors(),
        workbenchConfig: workbenchConfig(),
    });

    const importSnapshot = (snapshot?: Partial<AppConfigurationSnapshot>) => {
        const normalized = normalizeAppConfigurationSnapshot(snapshot);
        setUiScaleSignal(normalized.uiScale);
        setRoutingConfigSignal(normalized.routingConfig);
        setSignalPathColorsSignal(normalized.signalPathColors);
        setWorkbenchConfigSignal(normalized.workbenchConfig);
    };

    return {
        uiScale,
        uiScalePercent: () => Math.round(uiScale() * 100),
        routingConfig,
        signalPathColors,
        workbenchConfig,
        setUiScale,
        setRoutingConfig,
        setSignalPathColors,
        setWorkbenchConfig,
        uiZoomIn: () => setUiScale(uiScale() + UI_SCALE_STEP),
        uiZoomOut: () => setUiScale(uiScale() - UI_SCALE_STEP),
        resetUiZoom: () => setUiScale(1),
        resetRoutingConfig: () =>
            setRoutingConfigSignal(DEFAULT_OPTIMIZED_CIRCUIT_ROUTING_CONFIG),
        resetSignalPathColors: () =>
            setSignalPathColorsSignal(DEFAULT_SIGNAL_PATH_COLOR_CONFIG),
        resetWorkbenchConfig: () => setWorkbenchConfigSignal(DEFAULT_WORKBENCH_CONFIG),
        exportSnapshot,
        importSnapshot,
    };
};

export const AppConfigurationProvider: ParentComponent = (props) => {
    const configuration = createAppConfiguration();
    return (
        <AppConfigurationContext.Provider value={configuration}>
            {props.children}
        </AppConfigurationContext.Provider>
    );
};

export const useAppConfiguration = (): AppConfigurationController => {
    const configuration = useContext(AppConfigurationContext);
    if (!configuration) {
        throw new Error("useAppConfiguration must be used within AppConfigurationProvider");
    }
    return configuration;
};
