import { describe, expect, it, vi } from "vitest";
import { GRID_SIZE } from "../../model";
import { createConnectingConfig } from "./createConnectingConfig";

vi.mock("@antv/x6", () => ({
    Graph: {
        registerConnector: vi.fn(),
    },
    Shape: {
        Edge: class MockEdge {
            connector: unknown;
            router: unknown;

            constructor(metadata: { connector: unknown; router: unknown }) {
                this.connector = metadata.connector;
                this.router = metadata.router;
            }
        },
    },
    routerPresets: {
        orth: "orth",
    },
}));

describe("createConnectingConfig", () => {
    it("anchors manual connections to ports and lets the clearance connector add endpoint padding", () => {
        const config = createConnectingConfig();

        expect(config.router).toMatchObject({ name: "normal" });
        expect(config.connectionPoint).toEqual({ name: "anchor" });
        expect(config.targetConnectionPoint).toEqual({ name: "anchor" });
        expect(config.connector).toEqual({
            name: "gately-edge-clearance",
            args: { clearance: GRID_SIZE },
        });

        const edge = config.createEdge?.();
        expect(edge?.connector).toEqual({
            name: "gately-edge-clearance",
            args: { clearance: GRID_SIZE },
        });
        expect(edge?.router).toEqual({ name: "normal" });
    });
});
