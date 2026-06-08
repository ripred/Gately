import type { Edge, Node } from "@antv/x6";
import { GRID_SIZE } from "../../model";
import { resolveEdgeEndpoints } from "./edgeLink";

export type EdgeClearancePoint = { x: number; y: number };

type PortPositionNode = Pick<Node, "getBBox" | "getPort" | "getPortsPosition">;

type PortSide = "left" | "right" | "top" | "bottom";

type AbsolutePortPosition = EdgeClearancePoint & { side: PortSide };

const samePoint = (a: EdgeClearancePoint, b: EdgeClearancePoint): boolean =>
    a.x === b.x && a.y === b.y;

const compactPoints = (points: EdgeClearancePoint[]): EdgeClearancePoint[] =>
    points.filter((point, index) => index === 0 || !samePoint(points[index - 1], point));

const clearancePoint = (
    point: EdgeClearancePoint,
    side: PortSide,
    clearance: number,
): EdgeClearancePoint => {
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

export const buildDefaultClearedVertices = (
    sourcePort: EdgeClearancePoint,
    targetPort: EdgeClearancePoint,
    clearance: number = GRID_SIZE,
): EdgeClearancePoint[] => {
    const sourceExit = clearancePoint(sourcePort, "right", clearance);
    const targetEntry = clearancePoint(targetPort, "left", clearance);
    const route = [sourceExit];

    if (sourceExit.x !== targetEntry.x && sourceExit.y !== targetEntry.y) {
        route.push({ x: sourceExit.x, y: targetEntry.y });
    }

    route.push(targetEntry);
    return compactPoints(route);
};

export const buildDefaultClearedVerticesForPorts = (
    sourcePort: AbsolutePortPosition,
    targetPort: AbsolutePortPosition,
    clearance: number = GRID_SIZE,
    middleVertices: EdgeClearancePoint[] = [],
): EdgeClearancePoint[] => {
    const sourceExit = clearancePoint(sourcePort, sourcePort.side, clearance);
    const targetEntry = clearancePoint(targetPort, targetPort.side, clearance);

    if (middleVertices.length > 0) {
        const route = [sourceExit];
        const first = middleVertices[0];

        if (sourceExit.x !== first.x && sourceExit.y !== first.y) {
            route.push({ x: sourceExit.x, y: first.y });
        }

        route.push(...middleVertices);

        const last = middleVertices[middleVertices.length - 1];
        if (last.x !== targetEntry.x && last.y !== targetEntry.y) {
            route.push({ x: targetEntry.x, y: last.y });
        }

        route.push(targetEntry);
        return compactPoints(route);
    }

    const route = [sourceExit];

    if (sourceExit.x !== targetEntry.x && sourceExit.y !== targetEntry.y) {
        route.push({ x: sourceExit.x, y: targetEntry.y });
    }

    route.push(targetEntry);
    return compactPoints(route);
};

const getAbsolutePortPosition = (
    node: PortPositionNode,
    portId: string,
): AbsolutePortPosition | null => {
    const port = node.getPort(portId);
    if (!port?.group) return null;

    const portPosition = node.getPortsPosition(port.group)?.[portId]?.position;
    if (!portPosition) return null;

    const bbox = node.getBBox();
    return {
        x: bbox.x + portPosition.x,
        y: bbox.y + portPosition.y,
        side: port.group === "bottom" || port.group === "top" || port.group === "right"
            ? port.group
            : "left",
    };
};

export const getDefaultClearedEdgeVertices = (
    edge: Edge,
    clearance: number = GRID_SIZE,
    middleVertices: EdgeClearancePoint[] = [],
): EdgeClearancePoint[] | null => {
    const endpoints = resolveEdgeEndpoints(edge);
    if (!endpoints?.to) return null;

    const sourcePort = getAbsolutePortPosition(endpoints.from.node, endpoints.from.portId);
    const targetPort = getAbsolutePortPosition(endpoints.to.node, endpoints.to.portId);
    if (!sourcePort || !targetPort) return null;

    return buildDefaultClearedVerticesForPorts(sourcePort, targetPort, clearance, middleVertices);
};

export const applyDefaultEdgeClearance = (
    edge: Edge,
    clearance: number = GRID_SIZE,
): boolean => {
    const vertices = getDefaultClearedEdgeVertices(edge, clearance, edge.getVertices?.() ?? []);
    if (!vertices) return false;

    edge.setVertices(vertices);
    return true;
};
