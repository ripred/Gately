import { describe, expect, it } from "vitest";
import {
    CLOCK_MAX_DUTY_CYCLE,
    CLOCK_MAX_FREQUENCY_HZ,
    CLOCK_MIN_DUTY_CYCLE,
    DEFAULT_CLOCK_CONFIG,
    frequencyHzToPeriodMs,
    normalizeClockConfig,
    patchClockConfig,
    readClockConfig,
} from "./clock-config";

const createNode = (data: Record<string, unknown> = {}) => {
    let currentData = data;
    return {
        getData: () => currentData,
        setData: (next: Record<string, unknown>) => {
            currentData = next;
        },
    };
};

describe("clock config", () => {
    it("uses safe defaults for missing or invalid values", () => {
        expect(normalizeClockConfig()).toEqual(DEFAULT_CLOCK_CONFIG);
        expect(
            normalizeClockConfig({
                frequencyHz: Number.NaN,
                dutyCycle: Number.POSITIVE_INFINITY,
                enabled: true,
            }),
        ).toEqual(DEFAULT_CLOCK_CONFIG);
    });

    it("clamps rate and duty cycle to supported ranges", () => {
        expect(normalizeClockConfig({ frequencyHz: 999, dutyCycle: 2 })).toMatchObject({
            frequencyHz: CLOCK_MAX_FREQUENCY_HZ,
            dutyCycle: CLOCK_MAX_DUTY_CYCLE,
        });

        expect(normalizeClockConfig({ frequencyHz: -1, dutyCycle: -2 })).toMatchObject({
            frequencyHz: DEFAULT_CLOCK_CONFIG.frequencyHz,
            dutyCycle: CLOCK_MIN_DUTY_CYCLE,
        });
    });

    it("converts frequency to period using the normalized frequency", () => {
        expect(frequencyHzToPeriodMs(2)).toBe(500);
        expect(frequencyHzToPeriodMs(0)).toBe(1000);
    });

    it("stores only normalized config under persisted node ui data", () => {
        const node = createNode({ hash: "CLOCK" });
        patchClockConfig(node, {
            frequencyHz: 2,
            dutyCycle: 0.25,
            enabled: false,
        });

        const serialized = JSON.parse(JSON.stringify(node.getData()));
        const restored = createNode(serialized);

        expect(readClockConfig(restored)).toEqual({
            frequencyHz: 2,
            dutyCycle: 0.25,
            enabled: false,
        });
    });
});
