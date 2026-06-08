import { describe, expect, it } from "vitest";
import { GRID_SIZE } from "../../../model";
import { DEFAULT_NODE_POSITION, findDefaultNodePosition } from "./defaultNodePosition";

describe("findDefaultNodePosition", () => {
    const size = { width: 81, height: 49 };

    it("uses the historical default position when the canvas is empty", () => {
        expect(findDefaultNodePosition(size, [])).toEqual(DEFAULT_NODE_POSITION);
    });

    it("moves to the next grid slot when the default position is occupied", () => {
        const position = findDefaultNodePosition(size, [
            { ...DEFAULT_NODE_POSITION, ...size },
        ]);

        expect(position).toEqual({
            x: DEFAULT_NODE_POSITION.x + GRID_SIZE * 8,
            y: DEFAULT_NODE_POSITION.y,
        });
    });

    it("moves to a later row when the first row is occupied", () => {
        const occupied = Array.from({ length: 6 }, (_, index) => ({
            x: DEFAULT_NODE_POSITION.x + index * GRID_SIZE * 8,
            y: DEFAULT_NODE_POSITION.y,
            ...size,
        }));

        expect(findDefaultNodePosition(size, occupied)).toEqual({
            x: DEFAULT_NODE_POSITION.x,
            y: DEFAULT_NODE_POSITION.y + GRID_SIZE * 6,
        });
    });
});
