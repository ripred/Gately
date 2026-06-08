import { describe, expect, it, vi } from "vitest";
import { edgeClearanceConnector } from "./edge-clearance-connector";

describe("edgeClearanceConnector", () => {
    it("renders a right-output to bottom-input connection with one-grid endpoint stubs", () => {
        const edgeView = {
            cell: {
                getSourceCell: () => ({
                    isNode: () => true,
                    getPort: vi.fn(() => ({ group: "right" })),
                }),
                getSourcePortId: () => "R:0",
                getTargetCell: () => ({
                    isNode: () => true,
                    getPort: vi.fn(() => ({ group: "bottom" })),
                }),
                getTargetPortId: () => "L:0",
            },
        };

        expect(
            edgeClearanceConnector(
                { x: 337, y: 179 },
                { x: 495, y: 209 },
                [],
                { clearance: 16 },
                edgeView as never,
            ),
        ).toBe("M 337 179 L 353 179 L 353 225 L 495 225 L 495 209");
    });
});
