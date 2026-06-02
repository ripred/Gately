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

type StoredAppConfiguration = {
    version: typeof CONFIG_VERSION;
    uiScale: number;
    routingConfig?: Partial<OptimizedCircuitRoutingConfig>;
    signalPathColors?: Partial<SignalPathColorConfig>;
};

export type AppConfigurationController = {
    uiScale: () => number;
    uiScalePercent: () => number;
    routingConfig: () => OptimizedCircuitRoutingConfig;
    signalPathColors: () => SignalPathColorConfig;
    setUiScale: (scale: number) => void;
    setRoutingConfig: (config: Partial<OptimizedCircuitRoutingConfig>) => void;
    setSignalPathColors: (config: Partial<SignalPathColorConfig>) => void;
    uiZoomIn: () => void;
    uiZoomOut: () => void;
    resetUiZoom: () => void;
    resetRoutingConfig: () => void;
    resetSignalPathColors: () => void;
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

    createEffect(() => {
        const snapshot: StoredAppConfiguration = {
            version: CONFIG_VERSION,
            uiScale: uiScale(),
            routingConfig: routingConfig(),
            signalPathColors: signalPathColors(),
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
        setUiScale,
        setRoutingConfig,
        setSignalPathColors,
        uiZoomIn: () => setUiScale(uiScale() + UI_SCALE_STEP),
        uiZoomOut: () => setUiScale(uiScale() - UI_SCALE_STEP),
        resetUiZoom: () => setUiScale(1),
        resetRoutingConfig: () =>
            setRoutingConfigSignal(DEFAULT_OPTIMIZED_CIRCUIT_ROUTING_CONFIG),
        resetSignalPathColors: () =>
            setSignalPathColorsSignal(DEFAULT_SIGNAL_PATH_COLOR_CONFIG),
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
