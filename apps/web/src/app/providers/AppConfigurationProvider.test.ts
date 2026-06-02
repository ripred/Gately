import { describe, expect, it } from "vitest";
import {
    DEFAULT_SIGNAL_PATH_COLOR_CONFIG,
    DEFAULT_WORKBENCH_CONFIG,
    normalizeSignalPathColorConfig,
    normalizeWorkbenchConfig,
} from "./AppConfigurationProvider";

describe("normalizeSignalPathColorConfig", () => {
    it("keeps valid high and low path colors", () => {
        expect(
            normalizeSignalPathColorConfig({
                high: "#00AA11",
                low: "#223344",
            }),
        ).toEqual({
            high: "#00aa11",
            low: "#223344",
        });
    });

    it("falls back to defaults for non-hex CSS values", () => {
        expect(
            normalizeSignalPathColorConfig({
                high: "url(javascript:alert(1))",
                low: "var(--color-red)",
            }),
        ).toEqual(DEFAULT_SIGNAL_PATH_COLOR_CONFIG);
    });
});

describe("normalizeWorkbenchConfig", () => {
    it("keeps valid workbench chrome preferences", () => {
        expect(
            normalizeWorkbenchConfig({
                explorerCollapsed: true,
                visibleToolbarGroups: {
                    ...DEFAULT_WORKBENCH_CONFIG.visibleToolbarGroups,
                    canvas: false,
                    parts: false,
                },
            }),
        ).toEqual({
            explorerCollapsed: true,
            visibleToolbarGroups: {
                ...DEFAULT_WORKBENCH_CONFIG.visibleToolbarGroups,
                canvas: false,
                parts: false,
            },
        });
    });

    it("falls back to defaults for non-boolean workbench values", () => {
        expect(
            normalizeWorkbenchConfig({
                explorerCollapsed: "yes" as unknown as boolean,
                visibleToolbarGroups: {
                    simulation: "no" as unknown as boolean,
                    hardware: undefined as unknown as boolean,
                    workspace: true,
                    canvas: false,
                    parts: true,
                    customParts: false,
                },
            }),
        ).toEqual({
            explorerCollapsed: DEFAULT_WORKBENCH_CONFIG.explorerCollapsed,
            visibleToolbarGroups: {
                ...DEFAULT_WORKBENCH_CONFIG.visibleToolbarGroups,
                workspace: true,
                canvas: false,
                parts: true,
                customParts: false,
            },
        });
    });
});
