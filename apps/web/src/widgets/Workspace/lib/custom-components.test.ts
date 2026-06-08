import { createRoot } from "solid-js";
import { describe, expect, it } from "vitest";
import { createWorkspaceCustomComponents } from "./custom-components";
import type { WorkspaceUIEngine } from "./types";

type GraphHandler = () => void;

describe("createWorkspaceCustomComponents", () => {
    it("updates selected node count when the graph emits node selection events", async () => {
        let selectedCells: Array<{ id: string; isNode: () => boolean }> = [];
        const handlers = new Map<string, GraphHandler>();
        const graph = {
            getSelectedCells: () => selectedCells,
            on: (event: string, handler: GraphHandler) => {
                handlers.set(event, handler);
            },
            off: (event: string, handler: GraphHandler) => {
                if (handlers.get(event) === handler) handlers.delete(event);
            },
        };
        const logicEngine = {
            call: async () => [],
        };
        const uiEngine = {
            commands: {
                registerCustomComponents: () => undefined,
            },
            debug: {
                graph: () => graph,
            },
        } as unknown as WorkspaceUIEngine;

        createRoot((dispose) => {
            const controller = createWorkspaceCustomComponents({
                logicEngine: logicEngine as never,
                uiEngine,
                getActiveTabId: () => "tab",
                getActiveScopeId: () => "tab",
            });

            expect(controller.selectedNodeCount()).toBe(0);

            selectedCells = [{ id: "AND_0", isNode: () => true }];
            handlers.get("node:selected")?.();

            expect(controller.selectedNodeCount()).toBe(1);

            selectedCells = [];
            handlers.get("node:unselected")?.();

            expect(controller.selectedNodeCount()).toBe(0);
            dispose();
        });
    });
});
