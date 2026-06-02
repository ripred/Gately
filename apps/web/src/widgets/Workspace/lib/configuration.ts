import { createEffect, createSignal } from "solid-js";

const STORAGE_KEY = "gately.workspace.configuration.v1";
const CONFIG_VERSION = 1;
const UI_SCALE_MIN = 0.75;
const UI_SCALE_MAX = 1.5;
const UI_SCALE_STEP = 0.1;

type StoredWorkspaceConfiguration = {
    version: typeof CONFIG_VERSION;
    uiScale: number;
};

export type WorkspaceConfigurationController = {
    uiScale: () => number;
    uiScalePercent: () => number;
    setUiScale: (scale: number) => void;
    uiZoomIn: () => void;
    uiZoomOut: () => void;
    resetUiZoom: () => void;
};

const clampUiScale = (scale: number): number =>
    Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, scale));

const normalizeUiScale = (scale: number): number => {
    if (!Number.isFinite(scale)) return 1;
    return Number(clampUiScale(scale).toFixed(2));
};

const readStoredConfiguration = (): StoredWorkspaceConfiguration | undefined => {
    let raw: string | null;
    try {
        raw = window.localStorage.getItem(STORAGE_KEY);
    } catch {
        return;
    }
    if (!raw) return;

    try {
        const parsed = JSON.parse(raw) as Partial<StoredWorkspaceConfiguration>;
        if (parsed.version !== CONFIG_VERSION || typeof parsed.uiScale !== "number") return;
        return {
            version: CONFIG_VERSION,
            uiScale: normalizeUiScale(parsed.uiScale),
        };
    } catch {
        return;
    }
};

export const createWorkspaceConfiguration = (): WorkspaceConfigurationController => {
    const stored = readStoredConfiguration();
    const [uiScale, setUiScaleSignal] = createSignal(stored?.uiScale ?? 1);

    const setUiScale = (scale: number) => {
        setUiScaleSignal(normalizeUiScale(scale));
    };

    createEffect(() => {
        const snapshot: StoredWorkspaceConfiguration = {
            version: CONFIG_VERSION,
            uiScale: uiScale(),
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
        setUiScale,
        uiZoomIn: () => setUiScale(uiScale() + UI_SCALE_STEP),
        uiZoomOut: () => setUiScale(uiScale() - UI_SCALE_STEP),
        resetUiZoom: () => setUiScale(1),
    };
};
