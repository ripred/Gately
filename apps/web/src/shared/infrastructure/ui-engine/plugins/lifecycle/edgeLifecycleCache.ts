/* eslint-disable @typescript-eslint/no-explicit-any */
import { getEdgeData, resolveEdgeEndpoints } from "../../lib/connecting/edgeLink";
import { getSignalValueClassFromEdgeData } from "../../lib/logic-values";
import type { EdgeData, UIEnginePlugin } from "../../model/types";

export const edgeLifecycleCachePlugin: UIEnginePlugin = {
    name: "tools:edgeLifecycleCachePlugin",
    apply(graph, ctx) {
        const cache = ctx.getService("cache");
        const edgeMap = cache.edges;
        const portMap = cache.ports;

        const cacheRenderedEdge = (data: any): boolean => {
            const edge = data.edge;
            if (!edge) return false;

            const view = data.view ?? graph.findViewByCell?.(edge);
            const domPath = view?.container?.querySelector("path.connection");
            if (!domPath) return false;

            const edgeData = resolveEdgeEndpoints(edge);
            if (!edgeData?.to) return false;

            edge.setData({
                ...getEdgeData(edge),
                ...edgeData,
            });
            edgeMap.save(edge, domPath);
            portMap.updateEdge(edgeData.to.node, edgeData.to.portId, edge);
            edgeMap.updateValue(edge, getSignalValueClassFromEdgeData(edgeData));

            return true;
        };

        const defer = (callback: () => void) => {
            if (typeof requestAnimationFrame === "function") {
                requestAnimationFrame(callback);
                return;
            }

            setTimeout(callback, 0);
        };

        const onEdgeConnected = (data: any) => {
            cacheRenderedEdge(data);
        };

        const onEdgeAdded = (data: any) => {
            if (cacheRenderedEdge(data)) return;
            defer(() => {
                cacheRenderedEdge(data);
                ctx.getService("edges").syncEdgeValueClasses();
            });
        };

        const onEdgeRemoved = (data: any) => {
            const edgeData = resolveEdgeEndpoints(data.edge) ?? getEdgeData<EdgeData>(data.edge);

            if (edgeData?.to) {
                portMap.updateValue(edgeData.to.node, edgeData.to.portId, "value-hiz");
                portMap.removeLinkedEdge(edgeData.to.node, edgeData.to.portId);
            }
            edgeMap.remove(data.edge);
        };

        graph.on("edge:added", onEdgeAdded);
        graph.on("edge:connected", onEdgeConnected);
        graph.on("edge:removed", onEdgeRemoved);

        return () => {
            graph.off("edge:added", onEdgeAdded);
            graph.off("edge:connected", onEdgeConnected);
            graph.off("edge:removed", onEdgeRemoved);
        };
    },
};
