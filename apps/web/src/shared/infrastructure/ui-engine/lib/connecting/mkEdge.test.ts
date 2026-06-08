import { describe, expect, it, vi } from "vitest";
import { GRID_SIZE } from "../../model";
import { mkEdge } from "./mkEdge";

vi.mock("@antv/x6", () => ({
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
}));

describe("mkEdge", () => {
    it("creates manually drawn edges with port-anchored clearance routing by default", () => {
        const edge = mkEdge();

        expect(edge.router).toEqual({ name: "normal" });
        expect(edge.connector).toEqual({
            name: "gately-edge-clearance",
            args: { clearance: GRID_SIZE },
        });
    });
});
