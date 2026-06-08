import { describe, expect, it, vi } from "vitest";
import { useEdgeService } from "./api";

const makeNode = (id: string, valueClass = "port port-output value-false") => ({
    id,
    getPortProp: vi.fn(() => valueClass),
    isNode: () => true,
});

const makeEdge = (
    sourceNode: ReturnType<typeof makeNode>,
    targetNode: ReturnType<typeof makeNode>,
) => ({
    getData: vi.fn(() => ({})),
    getSourceCell: vi.fn(() => sourceNode),
    getSourcePortId: vi.fn(() => "R:0"),
    getTargetCell: vi.fn(() => targetNode),
    getTargetPortId: vi.fn(() => "L:0"),
});

describe("useEdgeService", () => {
    it("propagates output visual values to outgoing edges and target ports", () => {
        const sourceNode = makeNode("source");
        const targetNode = makeNode("target", "port port-input value-hiz");
        const edge = makeEdge(sourceNode, targetNode);
        const edgeMap = { get: vi.fn(), remove: vi.fn(), save: vi.fn(), updateValue: vi.fn() };
        const portMap = {
            get: vi.fn(),
            removeLinkedEdge: vi.fn(),
            removeNodePorts: vi.fn(),
            removePort: vi.fn(),
            save: vi.fn(),
            updateEdge: vi.fn(),
            updateValue: vi.fn(),
        };
        const nodes = { getNode: vi.fn(() => sourceNode) };
        const service = useEdgeService(
            { getEdges: vi.fn(() => [edge]) } as never,
            { getService: vi.fn((name: string) => (name === "nodes" ? nodes : { edges: edgeMap, ports: portMap })) } as never,
        );

        service.setOutgoingPortValueClass("source", "R:0", "value-true");

        expect(portMap.updateValue).toHaveBeenCalledWith(sourceNode, "R:0", "value-true");
        expect(edgeMap.updateValue).toHaveBeenCalledWith(edge, "value-true");
        expect(portMap.updateValue).toHaveBeenCalledWith(targetNode, "L:0", "value-true");
    });

    it("propagates incoming visual values back to the source port of the incoming edge", () => {
        const sourceNode = makeNode("source");
        const targetNode = makeNode("target", "port port-input value-hiz");
        const edge = makeEdge(sourceNode, targetNode);
        const edgeMap = { get: vi.fn(), remove: vi.fn(), save: vi.fn(), updateValue: vi.fn() };
        const portMap = {
            get: vi.fn(() => ({ edge, lastValue: "value-hiz" })),
            removeLinkedEdge: vi.fn(),
            removeNodePorts: vi.fn(),
            removePort: vi.fn(),
            save: vi.fn(),
            updateEdge: vi.fn(),
            updateValue: vi.fn(),
        };
        const nodes = { getNode: vi.fn(() => targetNode) };
        const service = useEdgeService(
            { getEdges: vi.fn(() => [edge]) } as never,
            { getService: vi.fn((name: string) => (name === "nodes" ? nodes : { edges: edgeMap, ports: portMap })) } as never,
        );

        service.setIncomingPortValueClass("target", "L:0", "value-false");

        expect(edgeMap.updateValue).toHaveBeenCalledWith(edge, "value-false");
        expect(portMap.updateValue).toHaveBeenCalledWith(sourceNode, "R:0", "value-false");
    });
});
