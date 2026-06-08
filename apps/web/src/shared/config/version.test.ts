import { describe, expect, it } from "vitest";
import webPackageJson from "../../../package.json";
import rootPackageJson from "../../../../../package.json";
import { APP_VERSION } from "./version";

describe("APP_VERSION", () => {
    it("uses the root package version as the singleton application version", () => {
        expect(APP_VERSION).toBe(rootPackageJson.version);
    });

    it("keeps the web package metadata aligned with the root release version", () => {
        expect(webPackageJson.version).toBe(rootPackageJson.version);
    });
});
