import { describe, expect, it } from "vitest";
import { GRID_SIZE } from "@gately/shared/infrastructure/ui-engine/model";
import {
    buildDefaultClearedVertices,
    buildDefaultClearedVerticesForPorts,
} from "@gately/shared/infrastructure/ui-engine/lib/connecting/default-edge-clearance";

describe("buildDefaultClearedVertices", () => {
    it("forces a one-grid horizontal exit before a wire may turn away from an output port", () => {
        const source = { x: 385, y: 331 };
        const target = { x: 546, y: 361 };

        expect(buildDefaultClearedVertices(source, target)).toEqual([
            { x: source.x + GRID_SIZE, y: source.y },
            { x: source.x + GRID_SIZE, y: target.y },
            { x: target.x - GRID_SIZE, y: target.y },
        ]);
    });

    it("keeps aligned ports as a straight padded connection", () => {
        const source = { x: 145, y: 331 };
        const target = { x: 321, y: 331 };

        expect(buildDefaultClearedVertices(source, target)).toEqual([
            { x: source.x + GRID_SIZE, y: source.y },
            { x: target.x - GRID_SIZE, y: target.y },
        ]);
    });

    it("does not emit duplicate vertices when the source exit and target entry coincide", () => {
        const source = { x: 100, y: 50 };
        const target = { x: 100 + GRID_SIZE * 2, y: 50 };

        expect(buildDefaultClearedVertices(source, target)).toEqual([
            { x: source.x + GRID_SIZE, y: source.y },
        ]);
    });

    it("uses the actual target port side, including bottom-mounted lamp inputs", () => {
        const source = { x: 386, y: 332, side: "right" as const };
        const target = { x: 547, y: 363, side: "bottom" as const };

        expect(buildDefaultClearedVerticesForPorts(source, target)).toEqual([
            { x: source.x + GRID_SIZE, y: source.y },
            { x: source.x + GRID_SIZE, y: target.y + GRID_SIZE },
            { x: target.x, y: target.y + GRID_SIZE },
        ]);
    });

    it("wraps existing deterministic routes with source and target clearance stubs", () => {
        const source = { x: 386, y: 332, side: "right" as const };
        const target = { x: 547, y: 363, side: "bottom" as const };

        expect(
            buildDefaultClearedVerticesForPorts(source, target, GRID_SIZE, [
                { x: 386, y: 363 },
            ]),
        ).toEqual([
            { x: source.x + GRID_SIZE, y: source.y },
            { x: source.x + GRID_SIZE, y: 363 },
            { x: 386, y: 363 },
            { x: target.x, y: 363 },
            { x: target.x, y: target.y + GRID_SIZE },
        ]);
    });
});
