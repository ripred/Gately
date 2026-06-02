import { describe, expect, it } from "vitest";
import {
    DEFAULT_SIGNAL_PATH_COLOR_CONFIG,
    normalizeSignalPathColorConfig,
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
