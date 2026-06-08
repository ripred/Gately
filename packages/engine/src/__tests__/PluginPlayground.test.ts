import { CinabonoBuilder } from "@engine/engine/builder";
import { definePlugin } from "@engine/plugins";
import { describe, expect, it } from "vitest";
import { SimpleApiPlugin } from "./plugin-examples/extend-api";
import { SimpleDepsPlugin } from "./plugin-examples/extend-deps";
import { SimpleEventLoggerPlugin } from "./plugin-examples/set-setup";

describe("engine plugins", () => {
    it("registers plugin deps, public API extensions, and setup hooks", async () => {
        const setupCalls: string[] = [];
        const SetupProbePlugin = definePlugin("SetupProbePlugin", {
            setup: () => {
                setupCalls.push("setup");
            },
        });

        const engine = await new CinabonoBuilder()
            .configure({
                ignoreErrorsSetup: true,
            })
            .use(SimpleApiPlugin, SimpleDepsPlugin, SimpleEventLoggerPlugin, SetupProbePlugin)
            .build();

        expect(engine.plugins.map((plugin) => plugin.name)).toEqual([
            "SimpleApiPlugin",
            "SimpleDepsPlugin",
            "SimpleEventLoggerPlugin",
            "SetupProbePlugin",
        ]);
        expect(setupCalls).toEqual(["setup"]);
        expect(engine.deps.plugins.simpleMessage).toBe("Hello from SimpleDepsPlugin!");
        expect(engine.api.plugins.sayHello()).toBe("Hello from SimpleDepsPlugin!");
    });
});
