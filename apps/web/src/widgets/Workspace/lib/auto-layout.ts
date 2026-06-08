import type { Cell, Edge, Graph, Node } from "@antv/x6";
import {
    GRID_SIZE,
    NODE_INSET,
} from "@gately/shared/infrastructure/ui-engine/model";
import { getDefaultClearedEdgeVertices } from "@gately/shared/infrastructure/ui-engine/lib/connecting/default-edge-clearance";
import {
    buildOptimizedEdgeRoutes,
    buildRouteSetJunctionDots,
    findRouteSetComponentCrossings,
    findRouteSetNonOrthogonalSegments,
    findRouteSetTargetApproachViolations,
    findRouteSetWireClearanceViolations,
    findUnnecessaryRouteWireCrossings,
    type OptimizedCircuitPoint,
    type OptimizedCircuitRect,
    type OptimizedCircuitRoutingConfig,
    type RoutableCircuitLink,
    type RoutableCircuitNetlist,
    type RoutableCircuitNode,
} from "@gately/features/boolean-analysis/model/optimizedCircuitLayout";
import { setRouteJunctionDotLabels } from "@gately/features/boolean-analysis/model/routeJunctionLabels";
import { portIdToPinRef } from "@gately/shared/infrastructure/ui-engine/lib";
import type { NodeHashes } from "@gately/shared/infrastructure/ui-engine/model";
import type { WorkspaceUIEngine } from "./types";

const COLUMN_GAP = 168;
const ROW_GAP = 96;
const PORT_OFFSET_Y = GRID_SIZE + NODE_INSET;

export type WorkspaceAutoLayoutController = {
    applySelection: () => void;
    get isDisabled(): boolean;
};

type WorkspaceAutoLayoutDeps = {
    uiEngine: WorkspaceUIEngine;
    getSelectionCount: () => number;
    getRoutingConfig: () => OptimizedCircuitRoutingConfig;
};

type PlannedNode = {
    node: Node;
    currentRect: OptimizedCircuitRect;
    nextRect: OptimizedCircuitRect;
    layer: number;
};

const isNodeCell = (cell: Cell): cell is Node => cell.isNode();

const getNodeHash = (node: Node): NodeHashes => {
    const hash = node.getData<{ hash?: string }>()?.hash;
    return (hash ?? "BUFFER") as NodeHashes;
};

const rectForNode = (node: Node): OptimizedCircuitRect => {
    const bbox = node.getBBox();
    return {
        id: node.id,
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
    };
};

const inputCountForNode = (node: Node): number =>
    node
        .getPorts()
        .filter((port) => portIdToPinRef(port.id ?? "").side === "input").length;

const outputCountForNode = (node: Node): number =>
    node
        .getPorts()
        .filter((port) => portIdToPinRef(port.id ?? "").side === "output").length;

const sourceNodeId = (edge: Edge): string | undefined => edge.getSourceCell()?.id;

const targetNodeId = (edge: Edge): string | undefined => edge.getTargetCell()?.id;

const selectedNodes = (graph: Graph): Node[] =>
    (graph.getSelectedCells?.() ?? []).filter(isNodeCell);

const selectedInternalEdges = (graph: Graph, selectedIds: ReadonlySet<string>): Edge[] =>
    graph.getEdges().filter((edge) => {
        const sourceId = sourceNodeId(edge);
        const targetId = targetNodeId(edge);
        return Boolean(sourceId && targetId && selectedIds.has(sourceId) && selectedIds.has(targetId));
    });

const computeLayers = (nodes: Node[], edges: Edge[]): Map<string, number> => {
    const nodeIds = new Set(nodes.map((node) => node.id));
    const incoming = new Map<string, Set<string>>(nodes.map((node) => [node.id, new Set<string>()]));
    const outgoing = new Map<string, Set<string>>(nodes.map((node) => [node.id, new Set<string>()]));

    edges.forEach((edge) => {
        const sourceId = sourceNodeId(edge);
        const targetId = targetNodeId(edge);
        if (!sourceId || !targetId || !nodeIds.has(sourceId) || !nodeIds.has(targetId)) return;
        outgoing.get(sourceId)?.add(targetId);
        incoming.get(targetId)?.add(sourceId);
    });

    const queue = nodes
        .filter((node) => (incoming.get(node.id)?.size ?? 0) === 0)
        .sort((a, b) => a.getBBox().y - b.getBBox().y || a.getBBox().x - b.getBBox().x);
    const layers = new Map<string, number>(queue.map((node) => [node.id, 0]));

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const node = queue[cursor];
        const nextLayer = (layers.get(node.id) ?? 0) + 1;
        for (const targetId of outgoing.get(node.id) ?? []) {
            layers.set(targetId, Math.max(layers.get(targetId) ?? 0, nextLayer));
            const targetIncoming = incoming.get(targetId);
            targetIncoming?.delete(node.id);
            if (targetIncoming?.size === 0) {
                const target = nodes.find((candidate) => candidate.id === targetId);
                if (target) queue.push(target);
            }
        }
    }

    const minX = Math.min(...nodes.map((node) => node.getBBox().x));
    nodes.forEach((node) => {
        if (layers.has(node.id)) return;
        layers.set(node.id, Math.max(0, Math.round((node.getBBox().x - minX) / COLUMN_GAP)));
    });

    return layers;
};

const planNodePositions = (
    nodes: Node[],
    edges: Edge[],
    routingConfig: OptimizedCircuitRoutingConfig,
): PlannedNode[] => {
    const layers = computeLayers(nodes, edges);
    const minX = Math.min(...nodes.map((node) => node.getBBox().x));
    const minY = Math.min(...nodes.map((node) => node.getBBox().y));
    const nodesByLayer = new Map<number, Node[]>();

    nodes.forEach((node) => {
        const layer = layers.get(node.id) ?? 0;
        nodesByLayer.set(layer, [...(nodesByLayer.get(layer) ?? []), node]);
    });

    const planned: PlannedNode[] = [];
    [...nodesByLayer.entries()]
        .sort(([left], [right]) => left - right)
        .forEach(([layer, layerNodes]) => {
            layerNodes
                .sort((a, b) => a.getBBox().y - b.getBBox().y || a.getBBox().x - b.getBBox().x)
                .forEach((node, index) => {
                    const currentRect = rectForNode(node);
                    planned.push({
                        node,
                        currentRect,
                        layer,
                        nextRect: {
                            ...currentRect,
                            x: minX + layer * COLUMN_GAP,
                            y: minY + index * ROW_GAP,
                        },
                    });
                });
        });

    const plannedById = new Map(planned.map((node) => [node.node.id, node]));
    const incomingByTargetId = new Map<string, string[]>();
    edges.forEach((edge) => {
        const sourceId = sourceNodeId(edge);
        const targetId = targetNodeId(edge);
        if (!sourceId || !targetId) return;
        incomingByTargetId.set(targetId, [
            ...(incomingByTargetId.get(targetId) ?? []),
            sourceId,
        ]);
    });

    planned.forEach((plannedNode) => {
        if (getNodeHash(plannedNode.node) !== "LAMP") return;
        const sourceIds = incomingByTargetId.get(plannedNode.node.id) ?? [];
        if (sourceIds.length !== 1) return;
        const source = plannedById.get(sourceIds[0]);
        if (!source) return;

        plannedNode.nextRect.y = Math.round(
            source.nextRect.y +
                PORT_OFFSET_Y -
                routingConfig.outputSinkPreferredRise -
                plannedNode.nextRect.height +
                NODE_INSET,
        );
    });

    return planned;
};

const toRoutableNode = (node: Node): RoutableCircuitNode => ({
    id: node.id,
    kind: getNodeHash(node),
    label: node.id,
    inputCount: inputCountForNode(node),
    outputCount: outputCountForNode(node),
});

const toRoutableLink = (edge: Edge): RoutableCircuitLink | undefined => {
    const sourceId = sourceNodeId(edge);
    const targetId = targetNodeId(edge);
    const sourcePort = edge.getSourcePortId();
    const targetPort = edge.getTargetPortId();
    if (!sourceId || !targetId || !sourcePort || !targetPort) return;

    return {
        from: sourceId,
        to: targetId,
        fromPin: portIdToPinRef(sourcePort).index,
        targetPin: portIdToPinRef(targetPort).index,
    };
};

const assertRouteSetIsClean = (routeSet: {
    linkPlans: Array<{ link: RoutableCircuitLink; targetPin: string; index: number }>;
    netlist: RoutableCircuitNetlist;
    rectsBySynthId: Map<string, OptimizedCircuitRect>;
    routesByLinkIndex: Map<number, OptimizedCircuitPoint[]>;
    routingConfig: OptimizedCircuitRoutingConfig;
}): void => {
    const componentCrossings = findRouteSetComponentCrossings(routeSet);
    const nonOrthogonalSegments = findRouteSetNonOrthogonalSegments(routeSet);
    const targetApproachViolations = findRouteSetTargetApproachViolations(routeSet);
    const unnecessaryCrossings = findUnnecessaryRouteWireCrossings(routeSet);

    if (componentCrossings.length > 0) {
        throw new Error(`Routing would pass wires through components: ${componentCrossings.join(", ")}`);
    }
    if (nonOrthogonalSegments.length > 0) {
        throw new Error(`Routing produced non-orthogonal segments: ${nonOrthogonalSegments.join(", ")}`);
    }
    if (targetApproachViolations.length > 0) {
        throw new Error(`Routing crowded target component edges: ${targetApproachViolations.join(", ")}`);
    }
    const wireClearanceViolations = findRouteSetWireClearanceViolations(routeSet);
    if (wireClearanceViolations.length > 0) {
        throw new Error(`Routing placed parallel wires too close together: ${wireClearanceViolations.join(", ")}`);
    }
    if (unnecessaryCrossings.length > 0) {
        throw new Error(`Routing left avoidable wire crossings: ${unnecessaryCrossings.join(", ")}`);
    }
};

const applyEdgeRoutes = (
    edgeLinks: Array<{ edge: Edge; link: RoutableCircuitLink }>,
    routeSet: {
        linkPlans: Array<{ link: RoutableCircuitLink; targetPin: string; index: number }>;
        netlist: RoutableCircuitNetlist;
        rectsBySynthId: Map<string, OptimizedCircuitRect>;
        routesByLinkIndex: Map<number, OptimizedCircuitPoint[]>;
    },
): void => {
    const junctionDotsByLinkIndex = buildRouteSetJunctionDots(routeSet);

    edgeLinks.forEach(({ edge }, index) => {
        edge.setRouter("normal");
        edge.setConnector("normal");
        const routeVertices = routeSet.routesByLinkIndex.get(index) ?? ([] as OptimizedCircuitPoint[]);
        edge.setVertices(
            getDefaultClearedEdgeVertices(edge, GRID_SIZE, routeVertices) ?? routeVertices,
        );
        setRouteJunctionDotLabels(edge, junctionDotsByLinkIndex.get(index));
    });
};

export const rerouteWorkspaceEdges = (
    graph: Graph,
    routingConfig: OptimizedCircuitRoutingConfig,
): void => {
    const nodes = graph.getNodes();
    const edges = graph.getEdges();
    if (!nodes.length || !edges.length) return;

    const rectsBySynthId = new Map<string, OptimizedCircuitRect>(
        nodes.map((node) => [node.id, rectForNode(node)]),
    );
    const edgeLinks = edges.flatMap((edge) => {
        const link = toRoutableLink(edge);
        return link ? [{ edge, link }] : [];
    });
    const links = edgeLinks.map(({ link }) => link);
    const netlist: RoutableCircuitNetlist = {
        nodes: nodes.map(toRoutableNode),
        links,
    };
    const linkPlans = links.map((link, index) => ({
        link,
        targetPin: link.targetPin ?? "0",
        index,
    }));
    const routesByLinkIndex = buildOptimizedEdgeRoutes({
        linkPlans,
        netlist,
        rectsBySynthId,
        routingConfig,
    });
    const routeSet = { linkPlans, netlist, rectsBySynthId, routesByLinkIndex, routingConfig };

    assertRouteSetIsClean(routeSet);
    applyEdgeRoutes(edgeLinks, routeSet);
};

const applyLayout = (
    nodes: Node[],
    edges: Edge[],
    routingConfig: OptimizedCircuitRoutingConfig,
): void => {
    const plannedNodes = planNodePositions(nodes, edges, routingConfig);
    const rectsBySynthId = new Map<string, OptimizedCircuitRect>(
        plannedNodes.map((planned) => [planned.node.id, planned.nextRect]),
    );
    const edgeLinks = edges.flatMap((edge) => {
        const link = toRoutableLink(edge);
        return link ? [{ edge, link }] : [];
    });
    const links = edgeLinks.map(({ link }) => link);
    const netlist: RoutableCircuitNetlist = {
        nodes: nodes.map(toRoutableNode),
        links,
    };
    const linkPlans = links.map((link, index) => ({
        link,
        targetPin: link.targetPin ?? "0",
        index,
    }));
    const routesByLinkIndex = buildOptimizedEdgeRoutes({
        linkPlans,
        netlist,
        rectsBySynthId,
        routingConfig,
    });
    const routeSet = { linkPlans, netlist, rectsBySynthId, routesByLinkIndex, routingConfig };

    assertRouteSetIsClean(routeSet);

    plannedNodes.forEach((planned) => {
        planned.node.position(planned.nextRect.x, planned.nextRect.y);
    });

    applyEdgeRoutes(edgeLinks, routeSet);
};

export const createWorkspaceAutoLayout = (
    deps: WorkspaceAutoLayoutDeps,
): WorkspaceAutoLayoutController => {
    const applySelection = (): void => {
        const graph = deps.uiEngine.debug.graph();
        if (!graph) return;

        const nodes = selectedNodes(graph);
        if (nodes.length < 2) {
            window.alert("Select at least two connected components to auto-layout.");
            return;
        }

        const selectedIds = new Set(nodes.map((node) => node.id));
        const edges = selectedInternalEdges(graph, selectedIds);

        try {
            applyLayout(nodes, edges, deps.getRoutingConfig());
            graph.resetSelection(nodes);
        } catch (error) {
            window.alert(error instanceof Error ? error.message : "Unable to auto-layout selection.");
        }
    };

    return {
        applySelection,
        get isDisabled() {
            return deps.getSelectionCount() < 2;
        },
    };
};
