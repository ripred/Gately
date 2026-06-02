import {
    createContext,
    createEffect,
    createSignal,
    ParentComponent,
    useContext,
} from "solid-js";
import {
    DEFAULT_OPTIMIZED_CIRCUIT_ROUTING_CONFIG,
    normalizeOptimizedCircuitRoutingConfig,
    type OptimizedCircuitRoutingConfig,
} from "@gately/features/boolean-analysis/model/optimizedCircuitLayout";

const STORAGE_KEY = "gately.app.configuration.v1";
const CONFIG_VERSION = 1;
const UI_SCALE_MIN = 0.75;
const UI_SCALE_MAX = 1.5;
const UI_SCALE_STEP = 0.1;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

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

export type WorkbenchConfig = {
    explorerCollapsed: boolean;
    visibleToolbarGroups: Record<WorkbenchToolbarGroupKey, boolean>;
};

export type WorkbenchConfigPatch = {
    explorerCollapsed?: boolean;
    visibleToolbarGroups?: Partial<Record<WorkbenchToolbarGroupKey, boolean>>;
};

export const DEFAULT_WORKBENCH_CONFIG: WorkbenchConfig = {
    explorerCollapsed: false,
    visibleToolbarGroups: {
        simulation: true,
        hardware: true,
        workspace: true,
        canvas: true,
        parts: true,
        customParts: true,
    },
};

type StoredAppConfiguration = {
    version: typeof CONFIG_VERSION;
    uiScale: number;
    routingConfig?: Partial<OptimizedCircuitRoutingConfig>;
    signalPathColors?: Partial<SignalPathColorConfig>;
    workbenchConfig?: WorkbenchConfigPatch;
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

export const normalizeWorkbenchConfig = (
    config?: WorkbenchConfigPatch,
): WorkbenchConfig => ({
    explorerCollapsed: normalizeBoolean(
        config?.explorerCollapsed,
        DEFAULT_WORKBENCH_CONFIG.explorerCollapsed,
    ),
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

const readStoredConfiguration = (): StoredAppConfiguration | undefined => {
    let raw: string | null;
    try {
        raw = window.localStorage.getItem(STORAGE_KEY);
    } catch {
        return;
    }
    if (!raw) return;

    try {
        const parsed = JSON.parse(raw) as Partial<StoredAppConfiguration>;
        if (parsed.version !== CONFIG_VERSION || typeof parsed.uiScale !== "number") return;
        return {
            version: CONFIG_VERSION,
            uiScale: normalizeUiScale(parsed.uiScale),
            routingConfig: normalizeOptimizedCircuitRoutingConfig(parsed.routingConfig),
            signalPathColors: normalizeSignalPathColorConfig(parsed.signalPathColors),
            workbenchConfig: normalizeWorkbenchConfig(parsed.workbenchConfig),
        };
    } catch {
        return;
    }
};

const createAppConfiguration = (): AppConfigurationController => {
    const stored = readStoredConfiguration();
    const [uiScale, setUiScaleSignal] = createSignal(stored?.uiScale ?? 1);
    const [routingConfig, setRoutingConfigSignal] =
        createSignal<OptimizedCircuitRoutingConfig>(
            normalizeOptimizedCircuitRoutingConfig(stored?.routingConfig),
        );
    const [signalPathColors, setSignalPathColorsSignal] =
        createSignal<SignalPathColorConfig>(
            normalizeSignalPathColorConfig(stored?.signalPathColors),
        );
    const [workbenchConfig, setWorkbenchConfigSignal] = createSignal<WorkbenchConfig>(
        normalizeWorkbenchConfig(stored?.workbenchConfig),
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
                visibleToolbarGroups: {
                    ...current.visibleToolbarGroups,
                    ...config.visibleToolbarGroups,
                },
            }),
        );
    };

    createEffect(() => {
        const snapshot: StoredAppConfiguration = {
            version: CONFIG_VERSION,
            uiScale: uiScale(),
            routingConfig: routingConfig(),
            signalPathColors: signalPathColors(),
            workbenchConfig: workbenchConfig(),
        };
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
        } catch {
            // UI scaling is an accessibility preference; storage failure should not break editing.
        }
    });

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
