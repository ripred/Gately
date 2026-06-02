import { createSignal } from "solid-js";
import type {
    ApiLinkSingleItem_Result,
    ApiAnalyzeBoolean_Result,
    BooleanSynthNode,
} from "@cnbn/engine";
import { encodePortId, mkEdge } from "@gately/shared/infrastructure/ui-engine/lib";
import {
    buildOptimizedCircuitLayout,
    buildOptimizedEdgeRoutes,
    estimateOptimizedNodeSize,
    findRouteSetNonOrthogonalSegments,
    findRouteSetComponentCrossings,
    findUnnecessaryRouteWireCrossings,
    getOptimizedIncomingCounts,
    type OptimizedCircuitRect,
} from "./optimizedCircuitLayout";
import type { BooleanAnalysisController, BooleanAnalysisControllerDeps } from "./types";

type NodeHash = Parameters<BooleanAnalysisControllerDeps["uiEngine"]["commands"]["addNode"]>[0]["hash"];

const OPTIMIZED_CIRCUIT_BASE_Y = 184;

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === "object" && error && "error" in error) {
        const nested = (error as { error?: unknown }).error;
        if (nested instanceof Error) return nested.message;
    }
    return "Boolean analysis failed.";
};

const hashForSynthNode = (node: BooleanSynthNode): NodeHash => {
    if (node.kind === "INPUT") return "TOGGLE";
    if (node.kind === "OUTPUT") return "LAMP";
    if (node.kind === "CONST") return node.value === "1" ? "TRUE_CONSTANT" : "FALSE_CONSTANT";
    return node.kind;
};

const waitForWorkspaceSwitch = (): Promise<void> =>
    new Promise((resolve) => {
        window.setTimeout(resolve, 0);
    });

type NodeWithBBox = {
    getBBox: () => { x: number; y: number; width: number; height: number };
};

const rectForSynthNode = (synthId: string, node: NodeWithBBox): OptimizedCircuitRect => {
    const bbox = node.getBBox();
    return {
        id: synthId,
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
    };
};

type OptimizedRouteSet = Parameters<typeof findRouteSetComponentCrossings>[0];

const assertOptimizedRouteSetIsClean = (routeSet: OptimizedRouteSet): void => {
    const componentCrossings = findRouteSetComponentCrossings(routeSet);
    if (componentCrossings.length > 0) {
        throw new Error(
            `Optimized circuit routing crossed component geometry: ${componentCrossings.join(", ")}`,
        );
    }

    const nonOrthogonalSegments = findRouteSetNonOrthogonalSegments(routeSet);
    if (nonOrthogonalSegments.length > 0) {
        throw new Error(
            `Optimized circuit routing produced non-orthogonal segments: ${nonOrthogonalSegments.join(", ")}`,
        );
    }

    const unnecessaryWireCrossings = findUnnecessaryRouteWireCrossings(routeSet);
    if (unnecessaryWireCrossings.length > 0) {
        throw new Error(
            `Optimized circuit routing left avoidable wire crossings: ${unnecessaryWireCrossings.join(", ")}`,
        );
    }
};

export const useBooleanAnalysisController = (
    deps: BooleanAnalysisControllerDeps,
): BooleanAnalysisController => {
    const [isOpen, setIsOpen] = createSignal(false);
    const [isBusy, setIsBusy] = createSignal(false);
    const [isSynthesizing, setIsSynthesizing] = createSignal(false);
    const [result, setResult] = createSignal<ApiAnalyzeBoolean_Result | undefined>();
    const [error, setError] = createSignal<string | undefined>();

    const analyze = () => {
        const tabId = deps.getActiveTabId();
        const scopeId = deps.getActiveScopeId();
        if (!tabId) return;

        setIsOpen(true);
        setIsBusy(true);
        setError(undefined);

        void deps.logicEngine
            .call("/analysis/boolean", { tabId, scopeId })
            .then((nextResult) => {
                setResult(nextResult);
            })
            .catch((err) => {
                setError(getErrorMessage(err));
            })
            .finally(() => {
                setIsBusy(false);
            });
    };

    const createOptimizedCircuit = (options: { inNewTab?: boolean } = {}) => {
        const analysis = result();
        const currentTabId = deps.getActiveTabId();
        if (!analysis || !currentTabId) return;

        setIsSynthesizing(true);
        setError(undefined);

        void (async () => {
            const tabId = options.inNewTab
                ? (await deps.uiEngine.commands.createTab({
                      name: "Optimized Circuit",
                      options: { setActive: true },
                  })).tabId
                : currentTabId;

            if (options.inNewTab) {
                await waitForWorkspaceSwitch();
            }

            const graph = deps.uiEngine.debug.graph();
            if (!graph) throw new Error("Could not access the active circuit graph.");

            const incomingCounts = getOptimizedIncomingCounts(analysis.optimizedNetlist.links);
            const nodesBySynthId = new Map<string, string>();
            const createdNodesBySynthId = new Map<string, NodeWithBBox>();
            const existingNodes = graph.getNodes();
            const maxX = options.inNewTab
                ? 0
                : existingNodes.reduce((max, node) => Math.max(max, node.getBBox().right), 0);
            const baseX = options.inNewTab ? 120 : maxX + 160;
            const baseY = OPTIMIZED_CIRCUIT_BASE_Y;
            const layout = buildOptimizedCircuitLayout(analysis.optimizedNetlist, { baseX, baseY });
            const estimatedRectsBySynthId = new Map<string, OptimizedCircuitRect>();

            for (const node of analysis.optimizedNetlist.nodes) {
                const position = layout.positionsBySynthId.get(node.id) ?? { x: baseX, y: baseY };
                const size = estimateOptimizedNodeSize(
                    node,
                    incomingCounts.get(node.id) ?? 0,
                );
                estimatedRectsBySynthId.set(node.id, {
                    id: node.id,
                    x: position.x,
                    y: position.y,
                    width: size.width,
                    height: size.height,
                });
            }

            const preflightRoutesByLinkIndex = buildOptimizedEdgeRoutes({
                linkPlans: layout.linkPlans,
                netlist: analysis.optimizedNetlist,
                rectsBySynthId: estimatedRectsBySynthId,
            });
            assertOptimizedRouteSetIsClean({
                linkPlans: layout.linkPlans,
                netlist: analysis.optimizedNetlist,
                rectsBySynthId: estimatedRectsBySynthId,
                routesByLinkIndex: preflightRoutesByLinkIndex,
            });

            for (const node of analysis.optimizedNetlist.nodes) {
                const incomingCount = incomingCounts.get(node.id) ?? 0;
                const position = layout.positionsBySynthId.get(node.id) ?? { x: baseX, y: baseY };
                const created = await deps.uiEngine.commands.addNode({
                    hash: hashForSynthNode(node),
                    meta:
                        incomingCount > 2 && ["AND", "OR"].includes(node.kind)
                            ? { numOfInputs: incomingCount }
                            : undefined,
                    position,
                });

                if (!created) throw new Error(`Could not create optimized node ${node.label}.`);
                nodesBySynthId.set(node.id, created.id);
                createdNodesBySynthId.set(node.id, created);
            }

            const rectsBySynthId = new Map<string, OptimizedCircuitRect>();
            for (const [synthId, node] of createdNodesBySynthId) {
                rectsBySynthId.set(synthId, rectForSynthNode(synthId, node));
            }
            const edgeRoutesByLinkIndex = buildOptimizedEdgeRoutes({
                linkPlans: layout.linkPlans,
                netlist: analysis.optimizedNetlist,
                rectsBySynthId,
            });
            assertOptimizedRouteSetIsClean({
                linkPlans: layout.linkPlans,
                netlist: analysis.optimizedNetlist,
                rectsBySynthId,
                routesByLinkIndex: edgeRoutesByLinkIndex,
            });

            for (const linkPlan of layout.linkPlans) {
                const fromItemId = nodesBySynthId.get(linkPlan.link.from);
                const toItemId = nodesBySynthId.get(linkPlan.link.to);
                const targetPin = linkPlan.targetPin;

                if (!fromItemId || !toItemId) continue;

                const res = (await deps.logicEngine.call("/item/link", {
                    tabId,
                    link: {
                        fromItemId,
                        fromPin: "0",
                        toItemId,
                        toPin: targetPin,
                    },
                })) as ApiLinkSingleItem_Result;
                const edge = mkEdge();
                edge.setSource({
                    cell: fromItemId,
                    port: encodePortId({ side: "right", id: "0" }),
                });
                edge.setTarget({
                    cell: toItemId,
                    port: encodePortId({ side: "left", id: targetPin }),
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
        })()
            .catch((err) => setError(getErrorMessage(err)))
            .finally(() => setIsSynthesizing(false));
    };

    return {
        get isOpen() {
            return isOpen();
        },
        get isBusy() {
            return isBusy();
        },
        get isSynthesizing() {
            return isSynthesizing();
        },
        get result() {
            return result();
        },
        get error() {
            return error();
        },
        analyze,
        createOptimizedCircuit,
        close: () => setIsOpen(false),
        createOptimizedCircuitInNewTab: () => createOptimizedCircuit({ inNewTab: true }),
    };
};
