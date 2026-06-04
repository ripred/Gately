import { Graph } from "@antv/x6";
import type { ItemBuilderResult } from "@cnbn/engine";
import { makeGraphOptions } from "../../graph-options/graphOptions";
import type { EngineSignalEvent } from "@gately/shared/types";
import { buildGraphServices } from "./services";
import { applyPlugins } from "../../plugins";
import type { UIEngineContext, PinUpdate, UIScopeSnapshot } from "../../model/types";
import type { CustomComponentVisualInput } from "../../model/nodes-spec";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 1.2;
const TOOLBAR_ZOOM_CENTER = { x: 0, y: 0 } as const;
const FIT_CONTENT_PADDING = 72;

const clampZoom = (zoom: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

export const createGraphRuntime = (container: HTMLDivElement, ctx: UIEngineContext) => {
    const graph = new Graph(makeGraphOptions(container, ctx));
    const services = buildGraphServices(graph, ctx);
    const disposers = applyPlugins(graph, ctx);
    const syncSignalPathValuesAfterPaint = () => {
        const sync = () => services.edges.syncEdgeValueClasses();

        if (typeof requestAnimationFrame === "function") {
            requestAnimationFrame(() => requestAnimationFrame(sync));
            return;
        }

        setTimeout(sync, 0);
    };

    const dispose = () => {
        disposers.reverse().forEach((fn) => {
            try {
                fn();
            } catch (err) {
                ctx.external.hooks?.onError?.({
                    label: "graph plugin",
                    stage: "dispose",
                    error: err,
                });
                console.error(`[UIEngine] plugin dispose failed`, err);
            }
        });

        try {
            graph.dispose();
        } catch (error) {
            ctx.external.hooks?.onError?.({
                label: "component",
                name: "graph-runtime",
                stage: "dispose",
                error,
            });
            throw error;
        }
    };

    return {
        createBuiltNode(result: ItemBuilderResult, options?: Parameters<typeof services.nodes.createNode>[1]) {
            return services.nodes.createNode(result, options);
        },
        exportScopeSnapshot(): UIScopeSnapshot {
            return services.snapshot.exportScopeSnapshot();
        },
        importScopeSnapshot(snapshot?: Partial<UIScopeSnapshot> | null): void {
            services.snapshot.importScopeSnapshot(snapshot);
            syncSignalPathValuesAfterPaint();
        },
        syncSignalPathValues(): void {
            services.edges.syncEdgeValueClasses();
        },
        applyPinPatch(patch: PinUpdate | PinUpdate[]): void {
            services.signals.applyPinPatch(patch);
        },
        applySignalEvents(events: EngineSignalEvent | EngineSignalEvent[]): void {
            services.signals.applyEvents(events);
        },
        registerCustomComponents(inputs: CustomComponentVisualInput[]): void {
            inputs.forEach((input) => services["node-visual"].registerCustomComponent(input));
        },
        zoomIn(): number {
            const nextZoom = clampZoom(graph.zoom() * ZOOM_STEP);
            graph.zoomTo(nextZoom, { center: TOOLBAR_ZOOM_CENTER });
            return nextZoom;
        },
        zoomOut(): number {
            const nextZoom = clampZoom(graph.zoom() / ZOOM_STEP);
            graph.zoomTo(nextZoom, { center: TOOLBAR_ZOOM_CENTER });
            return nextZoom;
        },
        resetZoom(): number {
            graph.zoomTo(1, { center: TOOLBAR_ZOOM_CENTER });
            return 1;
        },
        fitContent(options: { padding?: number; minScale?: number; maxScale?: number } = {}): number {
            graph.zoomToFit({
                padding: options.padding ?? FIT_CONTENT_PADDING,
                minScale: options.minScale ?? MIN_ZOOM,
                maxScale: options.maxScale ?? 1,
            });
            return graph.zoom();
        },
        getSelectionCount(): number {
            return graph.getSelectedCellCount?.() ?? 0;
        },
        graph(): Graph {
            return graph;
        },
        dispose,
    };
};
