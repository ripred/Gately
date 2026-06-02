import type { Edge, EdgeLabel } from "@antv/x6";
import type { RouteJunctionDot } from "./optimizedCircuitLayout";

const JUNCTION_DOT_RADIUS = 4;

export const buildRouteJunctionDotLabels = (
    dots: RouteJunctionDot[] = [],
): EdgeLabel[] =>
    dots.map((dot) => ({
        markup: [{ tagName: "circle", selector: "junction" }],
        attrs: {
            junction: {
                class: "wire-junction-dot",
                r: JUNCTION_DOT_RADIUS,
                fill: "var(--color-gray-11)",
                stroke: "var(--color-gray-1)",
                strokeWidth: 1.5,
                pointerEvents: "none",
            },
        },
        position: {
            distance: dot.distance,
            options: {
                absoluteDistance: true,
                absoluteOffset: true,
            },
        },
    }));

export const setRouteJunctionDotLabels = (
    edge: Edge,
    dots: RouteJunctionDot[] | undefined,
): void => {
    edge.setLabels(buildRouteJunctionDotLabels(dots));
};
