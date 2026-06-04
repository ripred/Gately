import { describe, expect, it, vi } from "vitest";
import { edgeLifecycleCachePlugin } from "./edgeLifecycleCache";

describe("edgeLifecycleCachePlugin", () => {
    it("caches programmatically added rendered edges and applies the source signal class", () => {
        const handlers = new Map<string, (payload: unknown) => void>();
        const edgeMap = {
            remove: vi.fn(),
            save: vi.fn(),
            updateValue: vi.fn(),
        };
        const portMap = {
            get: vi.fn(),
            removeLinkedEdge: vi.fn(),
            removeNodePorts: vi.fn(),
            removePort: vi.fn(),
            save: vi.fn(),
            updateEdge: vi.fn(),
            updateValue: vi.fn(),
        };
        const graph = {
            findViewByCell: vi.fn(),
            on: vi.fn((name: string, handler: (payload: unknown) => void) => {
                handlers.set(name, handler);
            }),
            off: vi.fn(),
        };
        const ctx = {
            getService: vi.fn(() => ({
                edges: edgeMap,
                ports: portMap,
            })),
        };
        const sourceNode = {
            id: "node-out",
            getPortProp: vi.fn(() => "port port-output value-false"),
            isNode: () => true,
        };
        const targetNode = {
            id: "node-in",
            isNode: () => true,
        };
        const edge = {
            getData: () => ({ linkId: "link-1" }),
            getSourceCell: () => sourceNode,
            getSourcePortId: () => "R:out",
            getTargetCell: () => targetNode,
            getTargetPortId: () => "L:in",
            setData: vi.fn(),
        };
        const domPath = { className: "connection" };
        const view = {
            container: {
                querySelector: vi.fn(() => domPath),
            },
        };

        edgeLifecycleCachePlugin.apply(graph as never, ctx as never);
        handlers.get("edge:added")?.({ edge, view });

        expect(edge.setData).toHaveBeenCalledWith(
            expect.objectContaining({
                linkId: "link-1",
                from: expect.objectContaining({
                    node: sourceNode,
                    portId: "R:out",
                    pin: "out",
                }),
                to: expect.objectContaining({
                    node: targetNode,
                    portId: "L:in",
                    pin: "in",
                }),
            }),
        );
        expect(edgeMap.save).toHaveBeenCalledWith(edge, domPath);
        expect(portMap.updateEdge).toHaveBeenCalledWith(targetNode, "L:in", edge);
        expect(edgeMap.updateValue).toHaveBeenCalledWith(edge, "value-false");
    });

    it("falls back to the target port signal when the source has no driven value", () => {
        const handlers = new Map<string, (payload: unknown) => void>();
        const edgeMap = {
            remove: vi.fn(),
            save: vi.fn(),
            updateValue: vi.fn(),
        };
        const portMap = {
            get: vi.fn(),
            removeLinkedEdge: vi.fn(),
            removeNodePorts: vi.fn(),
            removePort: vi.fn(),
            save: vi.fn(),
            updateEdge: vi.fn(),
            updateValue: vi.fn(),
        };
        const graph = {
            findViewByCell: vi.fn(),
            on: vi.fn((name: string, handler: (payload: unknown) => void) => {
                handlers.set(name, handler);
            }),
            off: vi.fn(),
        };
        const ctx = {
            getService: vi.fn(() => ({
                edges: edgeMap,
                ports: portMap,
            })),
        };
        const sourceNode = {
            id: "node-out",
            getPortProp: vi.fn(() => "port port-output"),
            isNode: () => true,
        };
        const targetNode = {
            id: "node-in",
            getPortProp: vi.fn(() => "port port-input value-true"),
            isNode: () => true,
        };
        const edge = {
            getData: () => ({ linkId: "link-1" }),
            getSourceCell: () => sourceNode,
            getSourcePortId: () => "R:out",
            getTargetCell: () => targetNode,
            getTargetPortId: () => "L:in",
            setData: vi.fn(),
        };
        const domPath = { className: "connection" };
        const view = {
            container: {
                querySelector: vi.fn(() => domPath),
            },
        };

        edgeLifecycleCachePlugin.apply(graph as never, ctx as never);
        handlers.get("edge:added")?.({ edge, view });

        expect(edgeMap.updateValue).toHaveBeenCalledWith(edge, "value-true");
    });

    it("resets incoming port to high-Z when edge is removed", () => {
        const handlers = new Map<string, (payload: unknown) => void>();
        const edgeMap = {
            remove: vi.fn(),
            save: vi.fn(),
            updateValue: vi.fn(),
        };
        const portMap = {
            get: vi.fn(),
            removeLinkedEdge: vi.fn(),
            removeNodePorts: vi.fn(),
            removePort: vi.fn(),
            save: vi.fn(),
            updateEdge: vi.fn(),
            updateValue: vi.fn(),
        };
        const graph = {
            on: vi.fn((name: string, handler: (payload: unknown) => void) => {
                handlers.set(name, handler);
            }),
            off: vi.fn(),
        };
        const ctx = {
            getService: vi.fn(() => ({
                edges: edgeMap,
                ports: portMap,
            })),
        };
        const node = { id: "node-in" };
        const edge = {
            getData: () => ({
                to: {
                    node,
                    portId: "L:in",
                },
            }),
            getSourceCell: () => null,
            getSourcePortId: () => undefined,
        };

        edgeLifecycleCachePlugin.apply(graph as never, ctx as never);
        handlers.get("edge:removed")?.({ edge });

        expect(portMap.updateValue).toHaveBeenCalledWith(node, "L:in", "value-hiz");
        expect(portMap.removeLinkedEdge).toHaveBeenCalledWith(node, "L:in");
        expect(edgeMap.remove).toHaveBeenCalledWith(edge);
    });
});
