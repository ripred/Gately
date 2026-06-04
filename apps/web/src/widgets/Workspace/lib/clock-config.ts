import type { Node } from "@antv/x6";

export type ClockConfig = {
    frequencyHz: number;
    dutyCycle: number;
    enabled: boolean;
};

export type ClockRuntimeData = {
    clockConfig?: Partial<ClockConfig>;
};

type ClockNodeData = {
    __ui?: ClockRuntimeData & Record<string, unknown>;
};

export const DEFAULT_CLOCK_CONFIG: ClockConfig = {
    frequencyHz: 1,
    dutyCycle: 0.5,
    enabled: true,
};

export const CLOCK_MIN_PERIOD_MS = 50;
export const CLOCK_MAX_PERIOD_MS = 60_000;
export const CLOCK_MIN_FREQUENCY_HZ = 1 / CLOCK_MAX_PERIOD_MS * 1000;
export const CLOCK_MAX_FREQUENCY_HZ = 1 / CLOCK_MIN_PERIOD_MS * 1000;
export const CLOCK_MIN_DUTY_CYCLE = 0.05;
export const CLOCK_MAX_DUTY_CYCLE = 0.95;

const asFiniteNumber = (value: unknown): number | undefined => {
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
};

export const clampClockFrequency = (value: unknown): number => {
    const numeric = asFiniteNumber(value);
    if (numeric === undefined || numeric <= 0) return DEFAULT_CLOCK_CONFIG.frequencyHz;

    return Math.min(CLOCK_MAX_FREQUENCY_HZ, Math.max(CLOCK_MIN_FREQUENCY_HZ, numeric));
};

export const clampClockDutyCycle = (value: unknown): number => {
    const numeric = asFiniteNumber(value);
    if (numeric === undefined) return DEFAULT_CLOCK_CONFIG.dutyCycle;

    return Math.min(CLOCK_MAX_DUTY_CYCLE, Math.max(CLOCK_MIN_DUTY_CYCLE, numeric));
};

export const periodMsToFrequencyHz = (periodMs: unknown): number => {
    const numeric = asFiniteNumber(periodMs);
    if (numeric === undefined || numeric <= 0) return DEFAULT_CLOCK_CONFIG.frequencyHz;

    const clampedPeriod = Math.min(CLOCK_MAX_PERIOD_MS, Math.max(CLOCK_MIN_PERIOD_MS, numeric));
    return 1000 / clampedPeriod;
};

export const frequencyHzToPeriodMs = (frequencyHz: unknown): number =>
    1000 / clampClockFrequency(frequencyHz);

export const normalizeClockConfig = (input?: Partial<ClockConfig> | null): ClockConfig => ({
    frequencyHz: clampClockFrequency(input?.frequencyHz),
    dutyCycle: clampClockDutyCycle(input?.dutyCycle),
    enabled: input?.enabled !== false,
});

export const readClockConfig = (node: Pick<Node, "getData">): ClockConfig => {
    const data = (node.getData?.() ?? {}) as ClockNodeData;
    return normalizeClockConfig(data.__ui?.clockConfig);
};

export const writeClockConfig = (node: Pick<Node, "getData" | "setData">, config: ClockConfig): void => {
    const data = (node.getData?.() ?? {}) as ClockNodeData;
    node.setData({
        ...data,
        __ui: {
            ...(data.__ui ?? {}),
            clockConfig: normalizeClockConfig(config),
        },
    });
};

export const patchClockConfig = (
    node: Pick<Node, "getData" | "setData">,
    patch: Partial<ClockConfig>,
): ClockConfig => {
    const next = normalizeClockConfig({
        ...readClockConfig(node),
        ...patch,
    });
    writeClockConfig(node, next);
    return next;
};
