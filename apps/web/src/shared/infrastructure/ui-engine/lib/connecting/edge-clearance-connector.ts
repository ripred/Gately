import type { Node } from "@antv/x6";
import type { EdgeView } from "@antv/x6/lib/view";
import type { PointLike } from "@antv/x6/lib/geometry";
import type { ConnectorBaseOptions, ConnectorDefinition } from "@antv/x6/lib/registry";
import { GRID_SIZE } from "../../model";

type PortSide = "left" | "right" | "top" | "bottom";
type Point = { x: number; y: number };

const toPoint = (point: PointLike): Point => ({
    x: point.x,
    y: point.y,
});

const samePoint = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;

const compactPoints = (points: Point[]): Point[] =>
    points.filter((point, index) => index === 0 || !samePoint(points[index - 1], point));

const stubPoint = (point: Point, side: PortSide, clearance: number): Point => {
    switch (side) {
        case "left":
            return { x: point.x - clearance, y: point.y };
        case "right":
            return { x: point.x + clearance, y: point.y };
        case "top":
            return { x: point.x, y: point.y - clearance };
        case "bottom":
            return { x: point.x, y: point.y + clearance };
    }
};

const serializePolyline = (points: Point[]): string =>
    compactPoints(points)
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
        .join(" ");

const portSide = (edgeView: EdgeView, terminal: "source" | "target"): PortSide => {
    const edge = edgeView.cell;
    const cell = terminal === "source" ? edge.getSourceCell() : edge.getTargetCell();
    const portId = terminal === "source" ? edge.getSourcePortId() : edge.getTargetPortId();
    if (!cell || typeof cell.isNode !== "function" || !cell.isNode() || !portId) {
        return terminal === "source" ? "right" : "left";
    }

    const node = cell as Node;
    const group = node.getPort(portId)?.group;
    if (group === "left" || group === "right" || group === "top" || group === "bottom") {
        return group;
    }

    return terminal === "source" ? "right" : "left";
};

export interface EdgeClearanceConnectorOptions extends ConnectorBaseOptions {
    clearance?: number;
}

export const edgeClearanceConnector: ConnectorDefinition<EdgeClearanceConnectorOptions> = (
    sourcePoint,
    targetPoint,
    routePoints,
    options = {},
    edgeView,
) => {
    const clearance = options.clearance ?? GRID_SIZE;
    const source = toPoint(sourcePoint);
    const target = toPoint(targetPoint);
    const sourceExit = stubPoint(source, portSide(edgeView, "source"), clearance);
    const targetEntry = stubPoint(target, portSide(edgeView, "target"), clearance);
    const route = routePoints.map(toPoint);
    const points: Point[] = [source, sourceExit];

    if (route.length > 0) {
        const first = route[0];
        if (sourceExit.x !== first.x && sourceExit.y !== first.y) {
            points.push({ x: sourceExit.x, y: first.y });
        }

        points.push(...route);

        const last = route[route.length - 1];
        if (last.x !== targetEntry.x && last.y !== targetEntry.y) {
            points.push({ x: targetEntry.x, y: last.y });
        }
    } else if (sourceExit.x !== targetEntry.x && sourceExit.y !== targetEntry.y) {
        points.push({ x: sourceExit.x, y: targetEntry.y });
    }

    points.push(targetEntry, target);
    return serializePolyline(points);
};
