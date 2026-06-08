import { describe, expect, it } from "vitest";
import packageJson from "../../../package.json";
import { APP_VERSION } from "./version";

describe("APP_VERSION", () => {
    it("uses the web package version as the singleton application version", () => {
        expect(APP_VERSION).toBe(packageJson.version);
    });
});
