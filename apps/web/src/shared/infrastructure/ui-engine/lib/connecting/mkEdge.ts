import { Shape } from "@antv/x6";
import { GRID_SIZE } from "../../model";

export const mkEdge = () =>
    new Shape.Edge({
        connector: {
            name: "gately-edge-clearance",
            args: { clearance: GRID_SIZE },
        },
        router: {
            name: "normal",
        },
        attrs: {
            line: {
                class: "connection",
                strokeWidth: 2.5,
                targetMarker: false,
                sourceMarker: false,
            },
        },
        zIndex: 0,
    });
