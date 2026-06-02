import type { Node } from "@antv/x6";
import type { ApiLinkSingleItem_Result } from "@cnbn/engine";
import type { CinabonoClient } from "@cnbn/engine-worker";
import { encodePortId, mkEdge } from "@gately/shared/infrastructure/ui-engine/lib";
import { GRID_SIZE, NODE_INSET, type NodeHashes } from "@gately/shared/infrastructure/ui-engine/model";
import type { UIEnginePublicApi } from "@gately/shared/infrastructure/ui-engine/public";
import {
    buildOptimizedEdgeRoutes,
    buildRoutableCircuitLinkPlans,
    estimateOptimizedNodeSize,
    getOptimizedIncomingCounts,
    type OptimizedCircuitPoint,
    type OptimizedCircuitRect,
    type RoutableCircuitLink,
    type RoutableCircuitNode,
} from "./optimizedCircuitLayout";

type SourceCircuitNode = RoutableCircuitNode & {
    hash: NodeHashes;
};

type SourceCircuitLink = RoutableCircuitLink & {
    fromPin?: string;
    targetPin: string;
};

type SourceCircuitNetlist = {
    nodes: SourceCircuitNode[];
    links: SourceCircuitLink[];
    gateCount?: number;
};

type CreateSourceCircuitDeps = {
    logicEngine: CinabonoClient;
    uiEngine: Pick<UIEnginePublicApi, "commands" | "debug">;
    getActiveTabId: () => string | undefined;
};

const PORT_OFFSET_Y = GRID_SIZE + NODE_INSET;
const SOURCE_ROW_GAP = 48;
const LAYER_GAP = 192;
const LAYER_NODE_GAP = 32;

const waitForWorkspaceSwitch = (): Promise<void> =>
    new Promise((resolve) => {
        window.setTimeout(resolve, 0);
    });

const average = (values: number[]): number =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const rectForNode = (synthId: string, node: Node): OptimizedCircuitRect => {
    const bbox = node.getBBox();
    return {
        id: synthId,
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
    };
};

const topologicalLayers = (netlist: SourceCircuitNetlist): Map<string, number> => {
    const nodesById = new Map(netlist.nodes.map((node) => [node.id, node]));
    const incomingByTarget = new Map<string, SourceCircuitLink[]>();
    netlist.links.forEach((link) => {
        incomingByTarget.set(link.to, [...(incomingByTarget.get(link.to) ?? []), link]);
    });

    const layers = new Map<string, number>();
    const visiting = new Set<string>();

    const visit = (nodeId: string): number => {
        const existing = layers.get(nodeId);
        if (existing !== undefined) return existing;
        if (!nodesById.has(nodeId)) throw new Error(`Unknown source circuit node "${nodeId}".`);
        if (visiting.has(nodeId)) throw new Error("Source demo circuits must be acyclic.");

        visiting.add(nodeId);
        const incoming = incomingByTarget.get(nodeId) ?? [];
        const layer =
            incoming.length === 0 ? 0 : Math.max(...incoming.map((link) => visit(link.from))) + 1;
        visiting.delete(nodeId);
        layers.set(nodeId, layer);
        return layer;
    };

    netlist.nodes.forEach((node) => visit(node.id));
    return layers;
};

export const buildSourceCircuitLayout = (
    netlist: SourceCircuitNetlist,
    options: { baseX: number; baseY: number },
): Map<string, OptimizedCircuitPoint> => {
    const layersByNode = topologicalLayers(netlist);
    const incomingCounts = getOptimizedIncomingCounts(netlist.links);
    const incomingByTarget = new Map<string, SourceCircuitLink[]>();
    const netlistOrderById = new Map(netlist.nodes.map((node, index) => [node.id, index]));
    const sourcePortYByNode = new Map<string, number>();
    const positions = new Map<string, OptimizedCircuitPoint>();
    const layers = [...new Set([...layersByNode.values()])].sort((a, b) => a - b);

    netlist.links.forEach((link) => {
        incomingByTarget.set(link.to, [...(incomingByTarget.get(link.to) ?? []), link]);
    });

    layers.forEach((layer) => {
        let nextAvailableTop = options.baseY - PORT_OFFSET_Y;
        const layerNodes = netlist.nodes
            .filter((node) => layersByNode.get(node.id) === layer)
            .map((node, index) => {
                const incoming = incomingByTarget.get(node.id) ?? [];
                const inputCount = node.inputCount ?? Math.max(1, incoming.length);
                const size = estimateOptimizedNodeSize(node, incomingCounts.get(node.id) ?? 0);
                const sourceRowTop = options.baseY + index * SOURCE_ROW_GAP - PORT_OFFSET_Y;
                const incomingCenterY = average(
                    incoming.map((link) => sourcePortYByNode.get(link.from) ?? options.baseY),
                );
                const targetBandCenterOffset =
                    PORT_OFFSET_Y + (Math.max(1, inputCount) - 1) * GRID_SIZE * 0.5;
                const desiredTop =
                    layer === 0 ? sourceRowTop : incomingCenterY - targetBandCenterOffset;

                return {
                    node,
                    size,
                    desiredTop,
                    order: netlistOrderById.get(node.id) ?? 0,
                };
            })
            .sort((a, b) => a.desiredTop - b.desiredTop || a.order - b.order);

        layerNodes.forEach(({ node, size, desiredTop }) => {
            const y = Math.round(Math.max(desiredTop, nextAvailableTop));
            const position = {
                x: options.baseX + layer * LAYER_GAP,
                y,
            };

            positions.set(node.id, position);
            sourcePortYByNode.set(node.id, y + PORT_OFFSET_Y);
            nextAvailableTop = y + size.height + LAYER_NODE_GAP;
        });
    });

    return positions;
};

export const buildOptimizerDemoSourceNetlist = (): SourceCircuitNetlist => ({
    nodes: [
        { id: "A", kind: "TOGGLE", hash: "TOGGLE", label: "A" },
        { id: "B", kind: "TOGGLE", hash: "TOGGLE", label: "B" },
        { id: "C", kind: "TOGGLE", hash: "TOGGLE", label: "C" },
        { id: "D", kind: "TOGGLE", hash: "TOGGLE", label: "D" },
        { id: "E", kind: "TOGGLE", hash: "TOGGLE", label: "E" },
        { id: "F", kind: "TOGGLE", hash: "TOGGLE", label: "F" },
        { id: "G", kind: "TOGGLE", hash: "TOGGLE", label: "G" },
        { id: "H", kind: "TOGGLE", hash: "TOGGLE", label: "H" },
        { id: "andAB", kind: "AND", hash: "AND", label: "AND AB", inputCount: 2 },
        { id: "notAB1", kind: "NOT", hash: "NOT", label: "NOT AB 1", inputCount: 1 },
        { id: "notAB2", kind: "NOT", hash: "NOT", label: "NOT AB 2", inputCount: 1 },
        { id: "nandCD", kind: "NAND", hash: "NAND", label: "NAND CD", inputCount: 2 },
        { id: "notNandCD", kind: "NOT", hash: "NOT", label: "NOT NAND CD", inputCount: 1 },
        { id: "xorEF", kind: "XOR", hash: "XOR", label: "XOR EF", inputCount: 2 },
        { id: "notXor1", kind: "NOT", hash: "NOT", label: "NOT XOR 1", inputCount: 1 },
        { id: "notXor2", kind: "NOT", hash: "NOT", label: "NOT XOR 2", inputCount: 1 },
        { id: "norGH", kind: "NOR", hash: "NOR", label: "NOR GH", inputCount: 2 },
        { id: "notNorGH", kind: "NOT", hash: "NOT", label: "NOT NOR GH", inputCount: 1 },
        { id: "orUpper", kind: "OR", hash: "OR", label: "Upper OR", inputCount: 2 },
        { id: "orLower", kind: "OR", hash: "OR", label: "Lower OR", inputCount: 2 },
        { id: "orFinal", kind: "OR", hash: "OR", label: "Final OR", inputCount: 2 },
        { id: "lamp", kind: "LAMP", hash: "LAMP", label: "Output", inputCount: 1 },
    ],
    links: [
        { from: "A", to: "andAB", targetPin: "0" },
        { from: "B", to: "andAB", targetPin: "1" },
        { from: "andAB", to: "notAB1", targetPin: "0" },
        { from: "notAB1", to: "notAB2", targetPin: "0" },
        { from: "C", to: "nandCD", targetPin: "0" },
        { from: "D", to: "nandCD", targetPin: "1" },
        { from: "nandCD", to: "notNandCD", targetPin: "0" },
        { from: "E", to: "xorEF", targetPin: "0" },
        { from: "F", to: "xorEF", targetPin: "1" },
        { from: "xorEF", to: "notXor1", targetPin: "0" },
        { from: "notXor1", to: "notXor2", targetPin: "0" },
        { from: "G", to: "norGH", targetPin: "0" },
        { from: "H", to: "norGH", targetPin: "1" },
        { from: "norGH", to: "notNorGH", targetPin: "0" },
        { from: "notAB2", to: "orUpper", targetPin: "0" },
        { from: "notNandCD", to: "orUpper", targetPin: "1" },
        { from: "notXor2", to: "orLower", targetPin: "0" },
        { from: "notNorGH", to: "orLower", targetPin: "1" },
        { from: "orUpper", to: "orFinal", targetPin: "0" },
        { from: "orLower", to: "orFinal", targetPin: "1" },
        { from: "orFinal", to: "lamp", targetPin: "0" },
    ],
});

export const createSourceCircuitFromNetlist = async (
    deps: CreateSourceCircuitDeps,
    netlist: SourceCircuitNetlist,
    options: { baseX: number; baseY: number; inNewTab?: boolean; tabName?: string },
): Promise<void> => {
    const currentTabId = deps.getActiveTabId();
    if (!currentTabId) return;

    const tabId = options.inNewTab
        ? (
              await deps.uiEngine.commands.createTab({
                  name: options.tabName ?? "Source Circuit",
                  options: { setActive: true },
              })
          ).tabId
        : currentTabId;

    if (options.inNewTab) {
        await waitForWorkspaceSwitch();
        await waitForWorkspaceSwitch();
    }

    const graph = deps.uiEngine.debug.graph();
    if (!graph) throw new Error("Could not access the active circuit graph.");

    const positionsBySynthId = buildSourceCircuitLayout(netlist, {
        baseX: options.baseX,
        baseY: options.baseY,
    });
    const createdNodesBySynthId = new Map<string, Node>();
    const nodesBySynthId = new Map<string, string>();

    for (const node of netlist.nodes) {
        const position = positionsBySynthId.get(node.id) ?? {
            x: options.baseX,
            y: options.baseY,
        };
        const created = await deps.uiEngine.commands.addNode({
            hash: node.hash,
            meta: node.inputCount && node.inputCount > 2 ? { numOfInputs: node.inputCount } : undefined,
            position,
        });

        if (!created) throw new Error(`Could not create source node ${node.label}.`);
        nodesBySynthId.set(node.id, created.id);
        createdNodesBySynthId.set(node.id, created);
    }

    const rectsBySynthId = new Map<string, OptimizedCircuitRect>();
    for (const [synthId, node] of createdNodesBySynthId) {
        rectsBySynthId.set(synthId, rectForNode(synthId, node));
    }

    const linkPlans = buildRoutableCircuitLinkPlans(netlist.links);
    const edgeRoutesByLinkIndex = buildOptimizedEdgeRoutes({
        linkPlans,
        netlist,
        rectsBySynthId,
    });

    for (const linkPlan of linkPlans) {
        const fromItemId = nodesBySynthId.get(linkPlan.link.from);
        const toItemId = nodesBySynthId.get(linkPlan.link.to);
        if (!fromItemId || !toItemId) continue;

        const res = (await deps.logicEngine.call("/item/link", {
            tabId,
            link: {
                fromItemId,
                fromPin: linkPlan.link.fromPin ?? "0",
                toItemId,
                toPin: linkPlan.targetPin,
            },
        })) as ApiLinkSingleItem_Result;
        const edge = mkEdge();
        edge.setSource({
            cell: fromItemId,
            port: encodePortId({ side: "right", id: linkPlan.link.fromPin ?? "0" }),
        });
        edge.setTarget({
            cell: toItemId,
            port: encodePortId({ side: "left", id: linkPlan.targetPin }),
        });
        edge.setRouter("normal");
        edge.setConnector("normal");
        edge.setVertices(edgeRoutesByLinkIndex.get(linkPlan.index) ?? []);
        edge.setData({ linkId: res.linkId });

        const graphWithSilent = graph as unknown as { __bridgeSilent?: boolean };
        graphWithSilent.__bridgeSilent = true;
        try {
            graph.addEdge(edge);
        } finally {
            graphWithSilent.__bridgeSilent = false;
        }
    }
};

export const createOptimizerDemoSourceCircuit = (deps: CreateSourceCircuitDeps): Promise<void> =>
    createSourceCircuitFromNetlist(deps, buildOptimizerDemoSourceNetlist(), {
        baseX: 96,
        baseY: 280,
        inNewTab: true,
        tabName: "Unoptimized Demo Circuit",
    });
