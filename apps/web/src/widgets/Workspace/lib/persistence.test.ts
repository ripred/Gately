import { describe, expect, it, vi } from "vitest";
import { seedLinkedInputValues } from "./persistence";

describe("workspace persistence", () => {
    it("seeds loaded signal values only from generator-driven links", async () => {
        const call = vi.fn(async () => undefined);
        const deps = {
            logicEngine: { call },
        };
        const tab = {
            id: "tab",
            items: [
                [
                    "toggle",
                    {
                        id: "toggle",
                        hash: "TOGGLE",
                        name: "toggle",
                        kind: "base:generator",
                        path: ["tab"],
                        outputPins: { 0: { value: "0" } },
                    },
                ],
                [
                    "inner_not",
                    {
                        id: "inner_not",
                        hash: "NOT",
                        name: "inner_not",
                        kind: "base:logic",
                        path: ["tab", "custom"],
                        inputPins: { 0: { value: "X" } },
                        outputPins: { 0: { value: "X" } },
                    },
                ],
                [
                    "custom",
                    {
                        id: "custom",
                        hash: "CUSTOM_TEST",
                        name: "custom",
                        kind: "circuit:logic",
                        path: ["tab"],
                        inputPins: { 0: { value: "0", inputItems: [{ itemId: "inner_not", pin: "0" }] } },
                        outputPins: { 0: { value: "X", outputItem: { itemId: "inner_not", pin: "0" } } },
                    },
                ],
                [
                    "display",
                    {
                        id: "display",
                        hash: "LAMP",
                        name: "display",
                        kind: "base:display",
                        path: ["tab"],
                        inputPins: { 0: { value: "X" } },
                    },
                ],
            ],
            links: [
                [
                    "toggle:0:custom:0",
                    {
                        fromItemId: "toggle",
                        fromPin: "0",
                        toItemId: "custom",
                        toPin: "0",
                    },
                ],
                [
                    "inner_not:0:display:0",
                    {
                        fromItemId: "inner_not",
                        fromPin: "0",
                        toItemId: "display",
                        toPin: "0",
                    },
                ],
                [
                    "custom:0:display:0",
                    {
                        fromItemId: "custom",
                        fromPin: "0",
                        toItemId: "display",
                        toPin: "0",
                    },
                ],
            ],
        };

        await seedLinkedInputValues(deps as never, tab as never);

        expect(call).toHaveBeenCalledTimes(1);
        expect(call).toHaveBeenNthCalledWith(1, "/item/updateInput", {
            tabId: "tab",
            itemId: "custom",
            pin: "0",
            t: 0,
            value: "0",
        });
    });
});
