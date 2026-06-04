import type { Edge, Graph } from "@antv/x6";
import { getSignalValueClassFromEdgeData } from "../../lib/logic-values";
import { resolveEdgeEndpoints } from "../../lib/connecting/edgeLink";
import type { EdgeRouterMode, LogicValueClass, UIEngineContext } from "../../model/types";

export type EdgeService = ReturnType<typeof useEdgeService>;

export const useEdgeService = (graph: Graph, ctx: UIEngineContext) => {
    const cache = ctx.getService("cache");
    const edgeMap = cache.edges;
    const portMap = cache.ports;

    const cacheRenderedEdge = (edge: Edge): boolean => {
        if (edgeMap.get(edge)) return true;

        const view = graph.findViewByCell?.(edge);
        const domPath = view?.container?.querySelector("path.connection");
        if (!domPath) return false;

        const edgeData = resolveEdgeEndpoints(edge);
        if (!edgeData?.to) return false;

        edgeMap.save(edge, domPath);
        portMap.updateEdge(edgeData.to.node, edgeData.to.portId, edge);
        return true;
    };

    const setIncomingPortValueClass = (
        nodeId: string,
        toPortId: string,
        valueClass: LogicValueClass,
    ): void => {
        const node = ctx.getService("nodes").getNode(nodeId);
        if (!node) return;

        const portState = cache.ports.get(node, toPortId);

        if (!portState || !portState.edge) return;

        edgeMap.updateValue(portState.edge, valueClass);
    };

    const setEdgeRouterMode = (mode: EdgeRouterMode) => {
        graph.options.connecting.router = { name: mode };
        graph.getEdges().forEach((edge) => edge.setRouter(mode));
    };

    const syncEdgeValueClasses = (): void => {
        graph.getEdges().forEach((edge) => {
            if (!cacheRenderedEdge(edge)) return;

            const edgeData = resolveEdgeEndpoints(edge);
            if (!edgeData) return;

            edgeMap.updateValue(edge, getSignalValueClassFromEdgeData(edgeData));
        });
    };

    return {
        setEdgeRouterMode,
        setIncomingPortValueClass,
        syncEdgeValueClasses,
    };
};
