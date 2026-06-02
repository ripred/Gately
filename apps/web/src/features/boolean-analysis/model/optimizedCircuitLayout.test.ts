import { describe, expect, it } from "vitest";
import type { BooleanSynthNetlist } from "@cnbn/engine";
import {
    buildOptimizedEdgeRoutes,
    buildOptimizedCircuitLayout,
    buildOptimizedEdgeVertices,
    buildRoutableCircuitLinkPlans,
    estimateOptimizedNodeSize,
    findRouteComponentCrossings,
    findRouteSetWireCrossings,
    findRouteSetNonOrthogonalSegments,
    findRouteSetComponentCrossings,
    findUnnecessaryRouteWireCrossings,
    getOptimizedIncomingCounts,
    type OptimizedCircuitRect,
    type RoutableCircuitNetlist,
} from "./optimizedCircuitLayout";

const NODE_INSET = 1;
const PORT_OFFSET_Y = 17;
const PIN_GAP = 16;

type SopTermSpec = Array<{ variableIndex: number; inverted?: boolean }>;

type SopOutputSpec = {
    id: string;
    terms: SopTermSpec[];
};

const buildRects = (netlist: BooleanSynthNetlist): Map<string, OptimizedCircuitRect> => {
    const layout = buildOptimizedCircuitLayout(netlist, { baseX: 120, baseY: 120 });
    const incomingCounts = getOptimizedIncomingCounts(netlist.links);
    const rects = new Map<string, OptimizedCircuitRect>();

    netlist.nodes.forEach((node) => {
        const position = layout.positionsBySynthId.get(node.id);
        if (!position) throw new Error(`Missing position for ${node.id}`);
        const size = estimateOptimizedNodeSize(node, incomingCounts.get(node.id) ?? 0);
        rects.set(node.id, {
            id: node.id,
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
        });
    });

    return rects;
};

const buildRoutableRects = (
    netlist: RoutableCircuitNetlist,
    positionsById: Record<string, { x: number; y: number }>,
): Map<string, OptimizedCircuitRect> => {
    const incomingCounts = getOptimizedIncomingCounts(netlist.links);
    const rects = new Map<string, OptimizedCircuitRect>();

    netlist.nodes.forEach((node) => {
        const position = positionsById[node.id];
        if (!position) throw new Error(`Missing position for ${node.id}`);
        const size = estimateOptimizedNodeSize(node, incomingCounts.get(node.id) ?? 0);
        rects.set(node.id, {
            id: node.id,
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
        });
    });

    return rects;
};

const netlistWithTrueAndInvertedA: BooleanSynthNetlist = {
    gateCount: 4,
    nodes: [
        { id: "input_a", kind: "INPUT", label: "A", sourceVariableId: "a" },
        { id: "input_b", kind: "INPUT", label: "B", sourceVariableId: "b" },
        { id: "input_c", kind: "INPUT", label: "C", sourceVariableId: "c" },
        { id: "not_a", kind: "NOT", label: "A'", sourceVariableId: "a" },
        { id: "and_1", kind: "AND", label: "AND 1" },
        { id: "and_2", kind: "AND", label: "AND 2" },
        { id: "or_1", kind: "OR", label: "OR OUT" },
        { id: "output_lamp", kind: "OUTPUT", label: "LAMP.0" },
    ],
    links: [
        { from: "input_a", to: "not_a" },
        { from: "not_a", to: "and_1" },
        { from: "input_b", to: "and_1" },
        { from: "input_a", to: "and_2" },
        { from: "input_c", to: "and_2" },
        { from: "and_1", to: "or_1" },
        { from: "and_2", to: "or_1" },
        { from: "or_1", to: "output_lamp" },
    ],
};

const complexFanInNetlist: BooleanSynthNetlist = {
    gateCount: 7,
    nodes: [
        { id: "input_a", kind: "INPUT", label: "A", sourceVariableId: "a" },
        { id: "input_b", kind: "INPUT", label: "B", sourceVariableId: "b" },
        { id: "input_c", kind: "INPUT", label: "C", sourceVariableId: "c" },
        { id: "input_d", kind: "INPUT", label: "D", sourceVariableId: "d" },
        { id: "input_e", kind: "INPUT", label: "E", sourceVariableId: "e" },
        { id: "input_f", kind: "INPUT", label: "F", sourceVariableId: "f" },
        { id: "input_g", kind: "INPUT", label: "G", sourceVariableId: "g" },
        { id: "input_h", kind: "INPUT", label: "H", sourceVariableId: "h" },
        { id: "not_e", kind: "NOT", label: "E'", sourceVariableId: "e" },
        { id: "not_f", kind: "NOT", label: "F'", sourceVariableId: "f" },
        { id: "and_1", kind: "AND", label: "AND 1" },
        { id: "and_2", kind: "AND", label: "AND 2" },
        { id: "and_3", kind: "AND", label: "AND 3" },
        { id: "and_4", kind: "AND", label: "AND 4" },
        { id: "or_1", kind: "OR", label: "OR OUT" },
        { id: "output_lamp", kind: "OUTPUT", label: "LAMP.0" },
    ],
    links: [
        { from: "input_e", to: "not_e" },
        { from: "input_f", to: "not_f" },
        { from: "input_a", to: "and_1" },
        { from: "input_b", to: "and_1" },
        { from: "input_c", to: "and_1" },
        { from: "input_a", to: "and_2" },
        { from: "not_e", to: "and_2" },
        { from: "input_h", to: "and_2" },
        { from: "input_d", to: "and_3" },
        { from: "input_g", to: "and_3" },
        { from: "input_b", to: "and_4" },
        { from: "not_f", to: "and_4" },
        { from: "input_h", to: "and_4" },
        { from: "and_1", to: "or_1" },
        { from: "input_c", to: "or_1" },
        { from: "and_2", to: "or_1" },
        { from: "input_e", to: "or_1" },
        { from: "and_3", to: "or_1" },
        { from: "and_4", to: "or_1" },
        { from: "input_g", to: "or_1" },
        { from: "or_1", to: "output_lamp" },
    ],
};

const mixedGateSourceNetlist: RoutableCircuitNetlist = {
    nodes: [
        { id: "input_a", kind: "TOGGLE", label: "A" },
        { id: "input_b", kind: "TOGGLE", label: "B" },
        { id: "input_c", kind: "TOGGLE", label: "C" },
        { id: "input_d", kind: "TOGGLE", label: "D" },
        { id: "nand_ab", kind: "NAND", label: "NAND AB", inputCount: 2 },
        { id: "not_nand", kind: "NOT", label: "NOT NAND", inputCount: 1 },
        { id: "xor_cd", kind: "XOR", label: "XOR CD", inputCount: 2 },
        { id: "not_xor", kind: "NOT", label: "NOT XOR", inputCount: 1 },
        { id: "or_final", kind: "OR", label: "OR OUT", inputCount: 2 },
        { id: "lamp", kind: "LAMP", label: "OUT", inputCount: 1 },
    ],
    links: [
        { from: "input_a", to: "nand_ab", targetPin: "0" },
        { from: "input_b", to: "nand_ab", targetPin: "1" },
        { from: "nand_ab", to: "not_nand", targetPin: "0" },
        { from: "input_c", to: "xor_cd", targetPin: "0" },
        { from: "input_d", to: "xor_cd", targetPin: "1" },
        { from: "xor_cd", to: "not_xor", targetPin: "0" },
        { from: "not_nand", to: "or_final", targetPin: "0" },
        { from: "not_xor", to: "or_final", targetPin: "1" },
        { from: "or_final", to: "lamp", targetPin: "0" },
    ],
};

const buildSopShapedNetlist = (
    variableCount: number,
    outputs: SopOutputSpec[],
): BooleanSynthNetlist => {
    const nodes: BooleanSynthNetlist["nodes"] = Array.from(
        { length: variableCount },
        (_, index) => ({
            id: `input_${index}`,
            kind: "INPUT",
            label: String.fromCharCode("A".charCodeAt(0) + index),
            sourceVariableId: `v${index}`,
        }),
    );
    const links: BooleanSynthNetlist["links"] = [];
    const notByVariable = new Map<number, string>();
    let syntheticId = 0;

    const literalSource = (variableIndex: number, inverted?: boolean): string => {
        if (!inverted) return `input_${variableIndex}`;

        const existing = notByVariable.get(variableIndex);
        if (existing) return existing;

        const id = `not_${variableIndex}`;
        nodes.push({
            id,
            kind: "NOT",
            label: `${String.fromCharCode("A".charCodeAt(0) + variableIndex)}'`,
            sourceVariableId: `v${variableIndex}`,
        });
        links.push({ from: `input_${variableIndex}`, to: id });
        notByVariable.set(variableIndex, id);
        return id;
    };

    outputs.forEach((outputSpec) => {
        const termSources = outputSpec.terms.map((term, termIndex) => {
            const literalSources = term.map((literal) =>
                literalSource(literal.variableIndex, literal.inverted),
            );

            if (literalSources.length === 1) return literalSources[0];

            const andId = `and_${outputSpec.id}_${termIndex}_${syntheticId++}`;
            nodes.push({ id: andId, kind: "AND", label: `AND ${outputSpec.id}.${termIndex}` });
            literalSources.forEach((source) => links.push({ from: source, to: andId }));
            return andId;
        });
        const outputId = `output_${outputSpec.id}`;
        let outputSource: string;

        if (termSources.length === 1) {
            outputSource = termSources[0];
        } else {
            const orId = `or_${outputSpec.id}`;
            nodes.push({ id: orId, kind: "OR", label: `OR ${outputSpec.id}` });
            termSources.forEach((source) => links.push({ from: source, to: orId }));
            outputSource = orId;
        }

        nodes.push({ id: outputId, kind: "OUTPUT", label: `OUT ${outputSpec.id}` });
        links.push({ from: outputSource, to: outputId });
    });

    return {
        gateCount: nodes.filter((node) => ["NOT", "AND", "OR"].includes(node.kind)).length,
        nodes,
        links,
    };
};

const constantOutputsNetlist: BooleanSynthNetlist = {
    gateCount: 0,
    nodes: [
        { id: "const_true", kind: "CONST", label: "1", value: "1" },
        { id: "const_false", kind: "CONST", label: "0", value: "0" },
        { id: "output_true", kind: "OUTPUT", label: "TRUE OUT" },
        { id: "output_false", kind: "OUTPUT", label: "FALSE OUT" },
    ],
    links: [
        { from: "const_true", to: "output_true" },
        { from: "const_false", to: "output_false" },
    ],
};

const expectCleanRoutes = (netlist: BooleanSynthNetlist): void => {
    const layout = buildOptimizedCircuitLayout(netlist, {
        baseX: 120,
        baseY: 120,
    });
    const rectsBySynthId = buildRects(netlist);
    const routesByLinkIndex = buildOptimizedEdgeRoutes({
        linkPlans: layout.linkPlans,
        netlist,
        rectsBySynthId,
    });
    const routeSet = {
        linkPlans: layout.linkPlans,
        netlist,
        rectsBySynthId,
        routesByLinkIndex,
    };

    expect(routesByLinkIndex.size).toBe(netlist.links.length);
    expect(findRouteSetNonOrthogonalSegments(routeSet)).toEqual([]);
    expect(findRouteSetComponentCrossings(routeSet)).toEqual([]);
    expect(findUnnecessaryRouteWireCrossings(routeSet)).toEqual([]);
};

describe("optimized circuit layout", () => {
    it("routes generated edges without crossing non-endpoint components", () => {
        const layout = buildOptimizedCircuitLayout(netlistWithTrueAndInvertedA, {
            baseX: 120,
            baseY: 120,
        });
        const rectsBySynthId = buildRects(netlistWithTrueAndInvertedA);
        const nodesById = new Map(
            netlistWithTrueAndInvertedA.nodes.map((node) => [node.id, node]),
        );

        layout.linkPlans.forEach((linkPlan) => {
            const sourceNode = nodesById.get(linkPlan.link.from);
            const targetNode = nodesById.get(linkPlan.link.to);
            const sourceRect = rectsBySynthId.get(linkPlan.link.from);
            const targetRect = rectsBySynthId.get(linkPlan.link.to);
            expect(sourceNode).toBeDefined();
            expect(targetNode).toBeDefined();
            expect(sourceRect).toBeDefined();
            expect(targetRect).toBeDefined();

            const vertices = buildOptimizedEdgeVertices({
                linkPlan,
                netlist: netlistWithTrueAndInvertedA,
                rectsBySynthId,
            });
            const sourcePoint = {
                x: sourceRect!.x + sourceRect!.width - NODE_INSET,
                y: sourceRect!.y + PORT_OFFSET_Y,
            };
            const targetPoint = {
                x:
                    targetNode!.kind === "OUTPUT"
                        ? targetRect!.x + targetRect!.width / 2
                        : targetRect!.x + NODE_INSET,
                y:
                    targetNode!.kind === "OUTPUT"
                        ? targetRect!.y + targetRect!.height - NODE_INSET
                        : targetRect!.y + PORT_OFFSET_Y + Number(linkPlan.targetPin) * PIN_GAP,
            };

            expect(
                findRouteComponentCrossings({
                    sourceSynthId: sourceNode!.id,
                    targetSynthId: targetNode!.id,
                    sourcePoint,
                    targetPoint,
                    vertices,
                    rectsBySynthId,
                }),
            ).toEqual([]);
        });
    });

    it("builds a deterministic route set without unnecessary wire-wire crossings for complex fan-in", () => {
        const layout = buildOptimizedCircuitLayout(complexFanInNetlist, {
            baseX: 120,
            baseY: 120,
        });
        const rectsBySynthId = buildRects(complexFanInNetlist);
        const routesByLinkIndex = buildOptimizedEdgeRoutes({
            linkPlans: layout.linkPlans,
            netlist: complexFanInNetlist,
            rectsBySynthId,
        });
        const routeSet = {
            linkPlans: layout.linkPlans,
            netlist: complexFanInNetlist,
            rectsBySynthId,
            routesByLinkIndex,
        };

        expect(routesByLinkIndex.size).toBe(complexFanInNetlist.links.length);
        expect(findUnnecessaryRouteWireCrossings(routeSet)).toEqual([]);

        const nodesById = new Map(complexFanInNetlist.nodes.map((node) => [node.id, node]));
        layout.linkPlans.forEach((linkPlan) => {
            const sourceNode = nodesById.get(linkPlan.link.from);
            const targetNode = nodesById.get(linkPlan.link.to);
            const sourceRect = rectsBySynthId.get(linkPlan.link.from);
            const targetRect = rectsBySynthId.get(linkPlan.link.to);
            expect(sourceNode).toBeDefined();
            expect(targetNode).toBeDefined();
            expect(sourceRect).toBeDefined();
            expect(targetRect).toBeDefined();

            expect(
                findRouteComponentCrossings({
                    sourceSynthId: sourceNode!.id,
                    targetSynthId: targetNode!.id,
                    sourcePoint: {
                        x: sourceRect!.x + sourceRect!.width - NODE_INSET,
                        y: sourceRect!.y + PORT_OFFSET_Y,
                    },
                    targetPoint: {
                        x:
                            targetNode!.kind === "OUTPUT"
                                ? targetRect!.x + targetRect!.width / 2
                                : targetRect!.x + NODE_INSET,
                        y:
                            targetNode!.kind === "OUTPUT"
                                ? targetRect!.y + targetRect!.height - NODE_INSET
                                : targetRect!.y +
                                  PORT_OFFSET_Y +
                                  Number(linkPlan.targetPin) * PIN_GAP,
                    },
                    vertices: routesByLinkIndex.get(linkPlan.index) ?? [],
                    rectsBySynthId,
                }),
            ).toEqual([]);
        });
    }, 30000);

    it("keeps source columns ordered while placing terms near their contributing inputs", () => {
        const layout = buildOptimizedCircuitLayout(netlistWithTrueAndInvertedA, {
            baseX: 120,
            baseY: 120,
        });
        const firstInputY = layout.positionsBySynthId.get("input_a")!.y;
        const lastInputY = layout.positionsBySynthId.get("input_c")!.y;

        expect(layout.positionsBySynthId.get("not_a")?.y).toBe(
            layout.positionsBySynthId.get("input_a")?.y,
        );
        expect(layout.positionsBySynthId.get("and_1")!.y).toBeGreaterThanOrEqual(firstInputY);
        expect(layout.positionsBySynthId.get("and_1")!.y).toBeLessThanOrEqual(lastInputY + 48);
        expect(layout.positionsBySynthId.get("input_a")!.x).toBeLessThan(
            layout.positionsBySynthId.get("not_a")!.x,
        );
        expect(layout.positionsBySynthId.get("not_a")!.x).toBeLessThan(
            layout.positionsBySynthId.get("and_1")!.x,
        );
        expect(layout.positionsBySynthId.get("and_1")!.x).toBeLessThan(
            layout.positionsBySynthId.get("or_1")!.x,
        );
        expect(layout.positionsBySynthId.get("or_1")!.x).toBeLessThan(
            layout.positionsBySynthId.get("output_lamp")!.x,
        );
    });

    it("routes a source netlist with physical gate hashes through the deterministic router", () => {
        const rectsBySynthId = buildRoutableRects(mixedGateSourceNetlist, {
            input_a: { x: 120, y: 120 },
            input_b: { x: 120, y: 168 },
            input_c: { x: 120, y: 280 },
            input_d: { x: 120, y: 328 },
            nand_ab: { x: 312, y: 144 },
            not_nand: { x: 504, y: 144 },
            xor_cd: { x: 312, y: 304 },
            not_xor: { x: 504, y: 304 },
            or_final: { x: 696, y: 224 },
            lamp: { x: 888, y: 224 },
        });
        const linkPlans = buildRoutableCircuitLinkPlans(mixedGateSourceNetlist.links);
        const routesByLinkIndex = buildOptimizedEdgeRoutes({
            linkPlans,
            netlist: mixedGateSourceNetlist,
            rectsBySynthId,
        });
        const nodesById = new Map(mixedGateSourceNetlist.nodes.map((node) => [node.id, node]));

        expect(routesByLinkIndex.size).toBe(mixedGateSourceNetlist.links.length);

        linkPlans.forEach((linkPlan) => {
            const sourceNode = nodesById.get(linkPlan.link.from);
            const targetNode = nodesById.get(linkPlan.link.to);
            const sourceRect = rectsBySynthId.get(linkPlan.link.from);
            const targetRect = rectsBySynthId.get(linkPlan.link.to);
            expect(sourceNode).toBeDefined();
            expect(targetNode).toBeDefined();
            expect(sourceRect).toBeDefined();
            expect(targetRect).toBeDefined();

            expect(
                findRouteComponentCrossings({
                    sourceSynthId: sourceNode!.id,
                    targetSynthId: targetNode!.id,
                    sourcePoint: {
                        x: sourceRect!.x + sourceRect!.width - NODE_INSET,
                        y: sourceRect!.y + PORT_OFFSET_Y,
                    },
                    targetPoint: {
                        x:
                            targetNode!.kind === "LAMP"
                                ? targetRect!.x + targetRect!.width / 2
                                : targetRect!.x + NODE_INSET,
                        y:
                            targetNode!.kind === "LAMP"
                                ? targetRect!.y + targetRect!.height - NODE_INSET
                                : targetRect!.y +
                                  PORT_OFFSET_Y +
                                  Number(linkPlan.targetPin) * PIN_GAP,
                    },
                    vertices: routesByLinkIndex.get(linkPlan.index) ?? [],
                    rectsBySynthId,
                }),
            ).toEqual([]);
        });
    });

    it("routes varied generated SOP-shaped optimized netlists without critical violations", () => {
        const cases: BooleanSynthNetlist[] = [
            constantOutputsNetlist,
            buildSopShapedNetlist(3, [
                {
                    id: "direct",
                    terms: [[{ variableIndex: 1 }]],
                },
            ]),
            buildSopShapedNetlist(4, [
                {
                    id: "x",
                    terms: [
                        [{ variableIndex: 0 }, { variableIndex: 1 }],
                        [{ variableIndex: 0, inverted: true }, { variableIndex: 2 }],
                        [{ variableIndex: 3 }],
                    ],
                },
            ]),
            buildSopShapedNetlist(8, [
                {
                    id: "wide",
                    terms: [
                        [{ variableIndex: 0 }, { variableIndex: 1 }],
                        [{ variableIndex: 2, inverted: true }, { variableIndex: 5 }],
                        [{ variableIndex: 3 }, { variableIndex: 6 }],
                        [{ variableIndex: 4 }, { variableIndex: 7, inverted: true }],
                        [{ variableIndex: 0, inverted: true }, { variableIndex: 4 }],
                        [{ variableIndex: 1 }, { variableIndex: 5, inverted: true }],
                        [{ variableIndex: 6 }],
                    ],
                },
            ]),
            buildSopShapedNetlist(8, [
                {
                    id: "upper",
                    terms: [
                        [{ variableIndex: 0 }, { variableIndex: 2 }],
                        [{ variableIndex: 1, inverted: true }, { variableIndex: 3 }],
                        [{ variableIndex: 4 }],
                    ],
                },
                {
                    id: "lower",
                    terms: [
                        [{ variableIndex: 7, inverted: true }],
                        [{ variableIndex: 2 }, { variableIndex: 5 }],
                        [{ variableIndex: 0, inverted: true }, { variableIndex: 6 }],
                        [{ variableIndex: 3 }, { variableIndex: 4, inverted: true }],
                    ],
                },
            ]),
        ];

        cases.forEach(expectCleanRoutes);
    }, 30000);

    it("routes the optimizer demo result without visible wire-wire crossings", () => {
        const netlist = buildSopShapedNetlist(8, [
            {
                id: "demo",
                terms: [
                    [
                        { variableIndex: 6, inverted: true },
                        { variableIndex: 7 },
                    ],
                    [
                        { variableIndex: 6 },
                        { variableIndex: 7, inverted: true },
                    ],
                    [{ variableIndex: 5 }],
                    [{ variableIndex: 4 }],
                    [
                        { variableIndex: 2 },
                        { variableIndex: 3 },
                    ],
                    [
                        { variableIndex: 0 },
                        { variableIndex: 1 },
                    ],
                ],
            },
        ]);
        const layout = buildOptimizedCircuitLayout(netlist, {
            baseX: 120,
            baseY: 120,
        });
        const rectsBySynthId = buildRects(netlist);
        const routesByLinkIndex = buildOptimizedEdgeRoutes({
            linkPlans: layout.linkPlans,
            netlist,
            rectsBySynthId,
        });
        const routeSet = {
            linkPlans: layout.linkPlans,
            netlist,
            rectsBySynthId,
            routesByLinkIndex,
        };

        expect(findRouteSetNonOrthogonalSegments(routeSet)).toEqual([]);
        expect(findRouteSetComponentCrossings(routeSet)).toEqual([]);
        expect(findRouteSetWireCrossings(routeSet)).toEqual([]);
    }, 30000);

    it("routes the current optimizer demo expression without open-space stair-step detours", () => {
        const netlist = buildSopShapedNetlist(8, [
            {
                id: "demo",
                terms: [
                    [
                        { variableIndex: 6, inverted: true },
                        { variableIndex: 7 },
                    ],
                    [
                        { variableIndex: 6 },
                        { variableIndex: 7, inverted: true },
                    ],
                    [{ variableIndex: 4 }],
                    [
                        { variableIndex: 2 },
                        { variableIndex: 5 },
                    ],
                    [
                        { variableIndex: 1 },
                        { variableIndex: 3 },
                    ],
                    [{ variableIndex: 0 }],
                ],
            },
        ]);
        const layout = buildOptimizedCircuitLayout(netlist, {
            baseX: 120,
            baseY: 184,
        });
        const rectsBySynthId = buildRects(netlist);
        const routesByLinkIndex = buildOptimizedEdgeRoutes({
            linkPlans: layout.linkPlans,
            netlist,
            rectsBySynthId,
        });
        const routeSet = {
            linkPlans: layout.linkPlans,
            netlist,
            rectsBySynthId,
            routesByLinkIndex,
        };

        expect(findRouteSetNonOrthogonalSegments(routeSet)).toEqual([]);
        expect(findRouteSetComponentCrossings(routeSet)).toEqual([]);
        expect(findRouteSetWireCrossings(routeSet)).toEqual([]);
        expect(
            Math.max(...[...routesByLinkIndex.values()].map((vertices) => vertices.length)),
        ).toBeLessThanOrEqual(4);
    }, 30000);

    it("detects route sets that cross non-endpoint component geometry", () => {
        const rectsBySynthId = buildRoutableRects(mixedGateSourceNetlist, {
            input_a: { x: 120, y: 120 },
            input_b: { x: 120, y: 168 },
            input_c: { x: 120, y: 280 },
            input_d: { x: 120, y: 328 },
            nand_ab: { x: 312, y: 144 },
            not_nand: { x: 504, y: 144 },
            xor_cd: { x: 312, y: 304 },
            not_xor: { x: 504, y: 304 },
            or_final: { x: 696, y: 224 },
            lamp: { x: 888, y: 224 },
        });
        const linkPlans = buildRoutableCircuitLinkPlans(mixedGateSourceNetlist.links);
        const badRoutes = new Map<number, Array<{ x: number; y: number }>>();
        linkPlans.forEach((linkPlan) => badRoutes.set(linkPlan.index, []));

        const outputLink = linkPlans.find((linkPlan) => linkPlan.link.to === "lamp");
        expect(outputLink).toBeDefined();
        badRoutes.set(outputLink!.index, [
            { x: 760, y: 241 },
            { x: 760, y: 328 },
            { x: 345, y: 328 },
            { x: 345, y: 241 },
        ]);

        expect(
            findRouteSetComponentCrossings({
                linkPlans,
                netlist: mixedGateSourceNetlist,
                rectsBySynthId,
                routesByLinkIndex: badRoutes,
            }),
        ).toContain(`${outputLink!.index}:xor_cd`);
    });

    it("detects route sets that pass through an endpoint component body before the port stub", () => {
        const rectsBySynthId = buildRoutableRects(mixedGateSourceNetlist, {
            input_a: { x: 120, y: 120 },
            input_b: { x: 120, y: 168 },
            input_c: { x: 120, y: 280 },
            input_d: { x: 120, y: 328 },
            nand_ab: { x: 312, y: 144 },
            not_nand: { x: 504, y: 144 },
            xor_cd: { x: 312, y: 304 },
            not_xor: { x: 504, y: 304 },
            or_final: { x: 696, y: 224 },
            lamp: { x: 888, y: 224 },
        });
        const linkPlans = buildRoutableCircuitLinkPlans(mixedGateSourceNetlist.links);
        const badRoutes = new Map<number, Array<{ x: number; y: number }>>();
        linkPlans.forEach((linkPlan) => badRoutes.set(linkPlan.index, []));

        const inputToNand = linkPlans.find(
            (linkPlan) => linkPlan.link.from === "input_a" && linkPlan.link.to === "nand_ab",
        );
        const targetRect = rectsBySynthId.get("nand_ab");
        expect(inputToNand).toBeDefined();
        expect(targetRect).toBeDefined();

        badRoutes.set(inputToNand!.index, [
            {
                x: targetRect!.x + targetRect!.width / 2,
                y: targetRect!.y + targetRect!.height / 2,
            },
            { x: targetRect!.x - 24, y: targetRect!.y + targetRect!.height / 2 },
        ]);

        expect(
            findRouteSetComponentCrossings({
                linkPlans,
                netlist: mixedGateSourceNetlist,
                rectsBySynthId,
                routesByLinkIndex: badRoutes,
            }),
        ).toContain(`${inputToNand!.index}:nand_ab`);
    });

    it("detects route sets that would render as non-orthogonal edge segments", () => {
        const netlist = buildSopShapedNetlist(2, [
            {
                id: "direct",
                terms: [[{ variableIndex: 0 }]],
            },
        ]);
        const layout = buildOptimizedCircuitLayout(netlist, {
            baseX: 120,
            baseY: 120,
        });
        const rectsBySynthId = buildRects(netlist);
        const routesByLinkIndex = new Map<number, Array<{ x: number; y: number }>>();
        layout.linkPlans.forEach((linkPlan) => routesByLinkIndex.set(linkPlan.index, []));
        routesByLinkIndex.set(layout.linkPlans[0].index, [{ x: 333, y: 217 }]);

        expect(
            findRouteSetNonOrthogonalSegments({
                linkPlans: layout.linkPlans,
                netlist,
                rectsBySynthId,
                routesByLinkIndex,
            }),
        ).not.toEqual([]);
    });
});
