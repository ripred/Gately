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

type StoredAppConfiguration = {
    version: typeof CONFIG_VERSION;
    uiScale: number;
    routingConfig?: Partial<OptimizedCircuitRoutingConfig>;
};

export type AppConfigurationController = {
    uiScale: () => number;
    uiScalePercent: () => number;
    routingConfig: () => OptimizedCircuitRoutingConfig;
    setUiScale: (scale: number) => void;
    setRoutingConfig: (config: Partial<OptimizedCircuitRoutingConfig>) => void;
    uiZoomIn: () => void;
    uiZoomOut: () => void;
    resetUiZoom: () => void;
    resetRoutingConfig: () => void;
};

const AppConfigurationContext = createContext<AppConfigurationController>();

const clampUiScale = (scale: number): number =>
    Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, scale));

const normalizeUiScale = (scale: number): number => {
    if (!Number.isFinite(scale)) return 1;
    return Number(clampUiScale(scale).toFixed(2));
};

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

    createEffect(() => {
        const snapshot: StoredAppConfiguration = {
            version: CONFIG_VERSION,
            uiScale: uiScale(),
            routingConfig: routingConfig(),
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
        setUiScale,
        setRoutingConfig,
        uiZoomIn: () => setUiScale(uiScale() + UI_SCALE_STEP),
        uiZoomOut: () => setUiScale(uiScale() - UI_SCALE_STEP),
        resetUiZoom: () => setUiScale(1),
        resetRoutingConfig: () =>
            setRoutingConfigSignal(DEFAULT_OPTIMIZED_CIRCUIT_ROUTING_CONFIG),
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
