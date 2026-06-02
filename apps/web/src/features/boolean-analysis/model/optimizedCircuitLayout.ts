import type {
    BooleanSynthLink,
    BooleanSynthNetlist,
    BooleanSynthNode,
    BooleanSynthNodeKind,
} from "@cnbn/engine";
import {
    GRID_SIZE,
    NODE_INSET,
    STROKE_WIDTH,
} from "@gately/shared/infrastructure/ui-engine/model";
import { getLogicVisualPreset } from "@gately/shared/infrastructure/ui-engine/model/nodes-spec";
import type { NodeHashes } from "@gately/shared/infrastructure/ui-engine/model/nodes-spec";
import { calcNodeSize } from "@gately/shared/infrastructure/ui-engine/services/nodes/lib/calcNodeSize";

export type OptimizedCircuitPoint = { x: number; y: number };

export type RoutableCircuitNodeKind = BooleanSynthNodeKind | NodeHashes;

export type RoutableCircuitNode = Omit<BooleanSynthNode, "kind"> & {
    kind: RoutableCircuitNodeKind;
    inputCount?: number;
    outputCount?: number;
};

export type RoutableCircuitLink = BooleanSynthLink & {
    fromPin?: string;
    targetPin?: string;
};

export type RoutableCircuitNetlist = {
    nodes: RoutableCircuitNode[];
    links: RoutableCircuitLink[];
    gateCount?: number;
};

export type OptimizedCircuitRect = OptimizedCircuitPoint & {
    id: string;
    width: number;
    height: number;
};

export type OptimizedCircuitLayout = {
    positionsBySynthId: Map<string, OptimizedCircuitPoint>;
    linkPlans: OptimizedCircuitLinkPlan[];
};

export type OptimizedCircuitLinkPlan = {
    link: RoutableCircuitLink;
    targetPin: string;
    index: number;
    sourceLaneY?: number;
};

export type RouteJunctionDot = {
    point: OptimizedCircuitPoint;
    distance: number;
};

type OutputGroup = {
    outputId: string;
    sourceId?: string;
    orId?: string;
    termSourceIds: string[];
};

type BuildLayoutOptions = {
    baseX: number;
    baseY: number;
    routingConfig?: Partial<OptimizedCircuitRoutingConfig>;
};

type BuildRouteOptions = {
    linkPlan: OptimizedCircuitLinkPlan;
    netlist: RoutableCircuitNetlist;
    rectsBySynthId: Map<string, OptimizedCircuitRect>;
    routedSegments?: RouteSegment[];
    routingConfig?: Partial<OptimizedCircuitRoutingConfig>;
};

type BuildRoutesOptions = {
    linkPlans: OptimizedCircuitLinkPlan[];
    netlist: RoutableCircuitNetlist;
    rectsBySynthId: Map<string, OptimizedCircuitRect>;
    routingConfig?: Partial<OptimizedCircuitRoutingConfig>;
};

type RouteCandidate = {
    name: string;
    vertices: OptimizedCircuitPoint[];
};

type RouteSearchResult = {
    vertices: OptimizedCircuitPoint[];
    crossingCount: number;
};

type RouteSegment = {
    from: OptimizedCircuitPoint;
    to: OptimizedCircuitPoint;
    linkIndex: number;
    sourceSynthId: string;
    targetSynthId: string;
};

type TermPlacement = {
    sourceId: string;
    targetId: string;
    node?: BooleanSynthNode;
    desiredPortY: number;
    height: number;
};

export type OptimizedCircuitRoutingConfig = {
    minClearance: number;
    sourceExitClearance: number;
    targetGutter: number;
    targetGutterStep: number;
    farTargetGutterOffset: number;
    nearTargetGutterOffset: number;
    targetEdgeClearance: number;
    sourceFanoutGutter: number;
    detourGap: number;
    detourStep: number;
    parallelRouteSpacing: number;
    rectClearance: number;
    wireClearance: number;
    topRouteClearance: number;
    searchMargin: number;
    searchMarginStep: number;
    outputSinkTargetClearance: number;
    outputSinkBottomClearance: number;
    outputSinkPreferredRise: number;
};

const PORT_OFFSET_Y = GRID_SIZE + NODE_INSET;
const PIN_GAP = GRID_SIZE;
const SOURCE_ROW_GAP = 104;
const SOURCE_TO_TERMS_GAP = 96;
const TERM_ROW_GAP = 56;
const OUTPUT_GROUP_GAP = 96;
const MIN_TERM_HEIGHT = 48;
const MAX_GRID_ROUTE_EXPANSIONS = 12_000;
const STAGE_SPACING_STEP = GRID_SIZE * 4;
export const DEFAULT_OPTIMIZED_CIRCUIT_ROUTING_CONFIG: OptimizedCircuitRoutingConfig = {
    minClearance: 24,
    sourceExitClearance: 32,
    targetGutter: 56,
    targetGutterStep: 8,
    farTargetGutterOffset: 40,
    nearTargetGutterOffset: 32,
    targetEdgeClearance: 40,
    sourceFanoutGutter: 56,
    detourGap: 64,
    detourStep: 24,
    parallelRouteSpacing: 4,
    rectClearance: 4,
    wireClearance: 8,
    topRouteClearance: GRID_SIZE * 2,
    searchMargin: 160,
    searchMarginStep: 16,
    outputSinkTargetClearance: 48,
    outputSinkBottomClearance: 32,
    outputSinkPreferredRise: 32,
};

const clampRoutingDistance = (
    value: number | undefined,
    fallback: number,
    min = 0,
    max = 512,
): number => {
    if (value === undefined || !Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, Math.round(value)));
};

export const normalizeOptimizedCircuitRoutingConfig = (
    config?: Partial<OptimizedCircuitRoutingConfig>,
): OptimizedCircuitRoutingConfig => ({
    minClearance: clampRoutingDistance(
        config?.minClearance,
        DEFAULT_OPTIMIZED_CIRCUIT_ROUTING_CONFIG.minClearance,
        GRID_SIZE,
    ),
    targetGutter: clampRoutingDistance(
        config?.targetGutter,
        DEFAULT_OPTIMIZED_CIRCUIT_ROUTING_CONFIG.targetGutter,
        GRID_SIZE,
    ),
    sourceExitClearance: clampRoutingDistance(
        config?.sourceExitClearance,
        DEFAULT_OPTIMIZED_CIRCUIT_ROUTING_CONFIG.sourceExitClearance,
        GRID_SIZE,
    ),
    targetGutterStep: clampRoutingDistance(
        config?.targetGutterStep,
        DEFAULT_OPTIMIZED_CIRCUIT_ROUTING_CONFIG.targetGutterStep,
        0,
        64,
    ),
    farTargetGutterOffset: clampRoutingDistance(
        config?.farTargetGutterOffset,
        DEFAULT_OPTIMIZED_CIRCUIT_ROUTING_CONFIG.farTargetGutterOffset,
        0,
    ),
    nearTargetGutterOffset: clampRoutingDistance(
        config?.nearTargetGutterOffset,
        DEFAULT_OPTIMIZED_CIRCUIT_ROUTING_CONFIG.nearTargetGutterOffset,
        0,
    ),
    targetEdgeClearance: clampRoutingDistance(
        config?.targetEdgeClearance,
        DEFAULT_OPTIMIZED_CIRCUIT_ROUTING_CONFIG.targetEdgeClearance,
        GRID_SIZE,
    ),
    sourceFanoutGutter: clampRoutingDistance(
        config?.sourceFanoutGutter,
        DEFAULT_OPTIMIZED_CIRCUIT_ROUTING_CONFIG.sourceFanoutGutter,
        GRID_SIZE,
    ),
    detourGap: clampRoutingDistance(
        config?.detourGap,
        DEFAULT_OPTIMIZED_CIRCUIT_ROUTING_CONFIG.detourGap,
        GRID_SIZE,
    ),
    detourStep: clampRoutingDistance(
        config?.detourStep,
        DEFAULT_OPTIMIZED_CIRCUIT_ROUTING_CONFIG.detourStep,
        0,
        128,
    ),
    parallelRouteSpacing: clampRoutingDistance(
        config?.parallelRouteSpacing,
        DEFAULT_OPTIMIZED_CIRCUIT_ROUTING_CONFIG.parallelRouteSpacing,
        0,
        64,
    ),
    rectClearance: clampRoutingDistance(
        config?.rectClearance,
        DEFAULT_OPTIMIZED_CIRCUIT_ROUTING_CONFIG.rectClearance,
        0,
        64,
    ),
    wireClearance: clampRoutingDistance(
        config?.wireClearance,
        DEFAULT_OPTIMIZED_CIRCUIT_ROUTING_CONFIG.wireClearance,
        0,
        64,
    ),
    topRouteClearance: clampRoutingDistance(
        config?.topRouteClearance,
        DEFAULT_OPTIMIZED_CIRCUIT_ROUTING_CONFIG.topRouteClearance,
        GRID_SIZE,
    ),
    searchMargin: clampRoutingDistance(
        config?.searchMargin,
        DEFAULT_OPTIMIZED_CIRCUIT_ROUTING_CONFIG.searchMargin,
        GRID_SIZE,
        1024,
    ),
    searchMarginStep: clampRoutingDistance(
        config?.searchMarginStep,
        DEFAULT_OPTIMIZED_CIRCUIT_ROUTING_CONFIG.searchMarginStep,
        0,
        128,
    ),
    outputSinkTargetClearance: clampRoutingDistance(
        config?.outputSinkTargetClearance,
        DEFAULT_OPTIMIZED_CIRCUIT_ROUTING_CONFIG.outputSinkTargetClearance,
        GRID_SIZE,
    ),
    outputSinkBottomClearance: clampRoutingDistance(
        config?.outputSinkBottomClearance,
        DEFAULT_OPTIMIZED_CIRCUIT_ROUTING_CONFIG.outputSinkBottomClearance,
        GRID_SIZE,
    ),
    outputSinkPreferredRise: clampRoutingDistance(
        config?.outputSinkPreferredRise,
        DEFAULT_OPTIMIZED_CIRCUIT_ROUTING_CONFIG.outputSinkPreferredRise,
        0,
    ),
});

const effectiveParallelRouteSpacing = (routingConfig: OptimizedCircuitRoutingConfig): number =>
    Math.max(routingConfig.parallelRouteSpacing, routingConfig.wireClearance);

const COLUMN_OFFSET_BY_KIND: Record<BooleanSynthNodeKind, number> = {
    INPUT: 0,
    CONST: 408 + STAGE_SPACING_STEP,
    NOT: 168,
    AND: 408 + STAGE_SPACING_STEP,
    OR: 680 + STAGE_SPACING_STEP * 2,
    OUTPUT: 888 + STAGE_SPACING_STEP * 3,
};

const rectRight = (rect: OptimizedCircuitRect): number => rect.x + rect.width;
const rectBottom = (rect: OptimizedCircuitRect): number => rect.y + rect.height;

const roundPoint = (point: OptimizedCircuitPoint): OptimizedCircuitPoint => ({
    x: Math.round(point.x),
    y: Math.round(point.y),
});

const isOutputSinkNode = (node: RoutableCircuitNode): boolean =>
    node.kind === "OUTPUT" || node.kind === "LAMP";

const visualHashForSynthNode = (node: RoutableCircuitNode): string => {
    if (node.kind === "INPUT" || node.kind === "TOGGLE") return "TOGGLE";
    if (isOutputSinkNode(node)) return "LAMP";
    if (node.kind === "TRUE_CONSTANT" || node.kind === "FALSE_CONSTANT") return node.kind;
    if (node.kind === "CONST") return node.value === "1" ? "TRUE_CONSTANT" : "FALSE_CONSTANT";
    return node.kind;
};

const optimizedNodePinCount = (node: RoutableCircuitNode, incomingCount: number): number => {
    if (node.inputCount !== undefined) return node.inputCount;
    if (node.kind === "INPUT" || node.kind === "TOGGLE") return node.outputCount ?? 1;
    if (
        node.kind === "AND" ||
        node.kind === "OR" ||
        node.kind === "NAND" ||
        node.kind === "NOR" ||
        node.kind === "XOR" ||
        node.kind === "XNOR"
    ) {
        return Math.max(1, incomingCount);
    }

    return 1;
};

const computeIncomingCounts = (links: BooleanSynthLink[]): Map<string, number> => {
    const counts = new Map<string, number>();
    links.forEach((link) => counts.set(link.to, (counts.get(link.to) ?? 0) + 1));
    return counts;
};

const groupLinksByTarget = (links: BooleanSynthLink[]): Map<string, BooleanSynthLink[]> => {
    const grouped = new Map<string, BooleanSynthLink[]>();
    links.forEach((link) => {
        grouped.set(link.to, [...(grouped.get(link.to) ?? []), link]);
    });
    return grouped;
};

export const buildRoutableCircuitLinkPlans = (
    links: RoutableCircuitLink[],
): OptimizedCircuitLinkPlan[] => {
    const nextTargetPinByNode = new Map<string, number>();

    return links.map((link, index) => {
        const nextPin = nextTargetPinByNode.get(link.to) ?? 0;
        const targetPin = link.targetPin ?? String(nextPin);
        nextTargetPinByNode.set(link.to, Math.max(nextPin, Number(targetPin) + 1));

        return {
            link,
            targetPin,
            index,
        };
    });
};

const buildOutputGroups = (
    netlist: BooleanSynthNetlist,
    nodesById: Map<string, BooleanSynthNode>,
    linksByTarget: Map<string, BooleanSynthLink[]>,
): OutputGroup[] =>
    netlist.nodes
        .filter((node) => node.kind === "OUTPUT")
        .map((outputNode) => {
            const sourceId = linksByTarget.get(outputNode.id)?.[0]?.from;
            const source = sourceId ? nodesById.get(sourceId) : undefined;
            const orId = source?.kind === "OR" ? source.id : undefined;
            const termSourceIds = orId
                ? (linksByTarget.get(orId) ?? []).map((link) => link.from)
                : sourceId
                  ? [sourceId]
                  : [];

            return { outputId: outputNode.id, sourceId, orId, termSourceIds };
        });

const inputRowTop = (baseY: number, index: number): number => baseY + index * SOURCE_ROW_GAP;

const fallbackSourceRowTop = (baseY: number, inputCount: number, index: number): number =>
    inputRowTop(baseY, inputCount + index);

const sourcePortY = (rect: OptimizedCircuitRect): number => rect.y + PORT_OFFSET_Y;

const targetPortY = (
    node: RoutableCircuitNode,
    rect: OptimizedCircuitRect,
    targetPin: string,
): number => {
    if (isOutputSinkNode(node)) return rectBottom(rect) - NODE_INSET;
    return rect.y + PORT_OFFSET_Y + Number(targetPin) * PIN_GAP;
};

const sourcePortPoint = (
    _node: RoutableCircuitNode,
    rect: OptimizedCircuitRect,
): OptimizedCircuitPoint => ({
    x: rectRight(rect) - NODE_INSET,
    y: sourcePortY(rect),
});

const targetPortPoint = (
    node: RoutableCircuitNode,
    rect: OptimizedCircuitRect,
    targetPin: string,
): OptimizedCircuitPoint => ({
    x: isOutputSinkNode(node) ? rect.x + rect.width / 2 : rect.x + NODE_INSET,
    y: targetPortY(node, rect, targetPin),
});

const normalizeVertices = (vertices: OptimizedCircuitPoint[]): OptimizedCircuitPoint[] => {
    const rounded = vertices.map(roundPoint);
    const unique = rounded.filter((point, index) => {
        const previous = rounded[index - 1];
        return !previous || previous.x !== point.x || previous.y !== point.y;
    });

    return unique.filter((point, index) => {
        const previous = unique[index - 1];
        const next = unique[index + 1];
        if (!previous || !next) return true;
        return !(
            (previous.x === point.x && point.x === next.x) ||
            (previous.y === point.y && point.y === next.y)
        );
    });
};

const routePoints = (
    source: OptimizedCircuitPoint,
    vertices: OptimizedCircuitPoint[],
    target: OptimizedCircuitPoint,
): OptimizedCircuitPoint[] => [source, ...vertices, target];

const routeSegments = (
    source: OptimizedCircuitPoint,
    vertices: OptimizedCircuitPoint[],
    target: OptimizedCircuitPoint,
    linkIndex: number,
    sourceSynthId: string,
    targetSynthId: string,
): RouteSegment[] => {
    const points = routePoints(source, vertices, target);
    const segments: RouteSegment[] = [];

    for (let index = 0; index < points.length - 1; index += 1) {
        const from = points[index];
        const to = points[index + 1];
        if (from.x === to.x && from.y === to.y) continue;
        segments.push({ from, to, linkIndex, sourceSynthId, targetSynthId });
    }

    return segments;
};

const routeLength = (
    source: OptimizedCircuitPoint,
    vertices: OptimizedCircuitPoint[],
    target: OptimizedCircuitPoint,
): number => {
    const points = routePoints(source, vertices, target);
    let length = 0;

    for (let index = 0; index < points.length - 1; index += 1) {
        length +=
            Math.abs(points[index].x - points[index + 1].x) +
            Math.abs(points[index].y - points[index + 1].y);
    }

    return length;
};

const pointOnSegment = (point: OptimizedCircuitPoint, segment: RouteSegment): boolean => {
    if (isHorizontal(segment)) {
        return point.y === segment.from.y && betweenInclusive(point.x, segment.from.x, segment.to.x);
    }
    if (isVertical(segment)) {
        return point.x === segment.from.x && betweenInclusive(point.y, segment.from.y, segment.to.y);
    }
    return false;
};

const pointOnSegmentInterior = (
    point: OptimizedCircuitPoint,
    segment: RouteSegment,
): boolean =>
    pointOnSegment(point, segment) &&
    !(
        (point.x === segment.from.x && point.y === segment.from.y) ||
        (point.x === segment.to.x && point.y === segment.to.y)
    );

const distanceAlongRouteToPoint = (
    source: OptimizedCircuitPoint,
    vertices: OptimizedCircuitPoint[],
    target: OptimizedCircuitPoint,
    point: OptimizedCircuitPoint,
): number | undefined => {
    const points = routePoints(source, vertices, target);
    let distance = 0;

    for (let index = 0; index < points.length - 1; index += 1) {
        const from = points[index];
        const to = points[index + 1];
        const segment: RouteSegment = {
            from,
            to,
            linkIndex: -1,
            sourceSynthId: "",
            targetSynthId: "",
        };
        if (pointOnSegment(point, segment)) {
            return distance + Math.abs(point.x - from.x) + Math.abs(point.y - from.y);
        }
        distance += Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
    }

    return undefined;
};

const routeBendCount = (vertices: OptimizedCircuitPoint[]): number => vertices.length;

const routeUsesUpperDetour = (
    source: OptimizedCircuitPoint,
    vertices: OptimizedCircuitPoint[],
    target: OptimizedCircuitPoint,
    minPreferredY: number,
): boolean => routePoints(source, vertices, target).some((point) => point.y < minPreferredY);

const compareRouteSearchResults = (args: {
    sourcePoint: OptimizedCircuitPoint;
    targetPoint: OptimizedCircuitPoint;
    minPreferredY: number;
}): ((a: RouteSearchResult, b: RouteSearchResult) => number) => {
    const routeScore = (route: RouteSearchResult): number =>
        route.crossingCount * 100_000_000 +
        routeBendCount(route.vertices) * 1_000_000 +
        (routeUsesUpperDetour(
            args.sourcePoint,
            route.vertices,
            args.targetPoint,
            args.minPreferredY,
        )
            ? 100_000
            : 0) +
        routeLength(args.sourcePoint, route.vertices, args.targetPoint);

    return (a, b) => routeScore(a) - routeScore(b);
};

const isHorizontal = (segment: RouteSegment): boolean => segment.from.y === segment.to.y;
const isVertical = (segment: RouteSegment): boolean => segment.from.x === segment.to.x;

const isOrthogonalRoute = (
    source: OptimizedCircuitPoint,
    vertices: OptimizedCircuitPoint[],
    target: OptimizedCircuitPoint,
    linkIndex: number,
    sourceSynthId: string,
    targetSynthId: string,
): boolean =>
    routeSegments(source, vertices, target, linkIndex, sourceSynthId, targetSynthId).every(
        (segment) => isHorizontal(segment) || isVertical(segment),
    );

const betweenInclusive = (value: number, a: number, b: number): boolean =>
    value >= Math.min(a, b) && value <= Math.max(a, b);

const segmentsShareCircuitEndpoint = (a: RouteSegment, b: RouteSegment): boolean =>
    a.sourceSynthId === b.sourceSynthId;

const segmentsCross = (a: RouteSegment, b: RouteSegment): boolean => {
    if (a.linkIndex === b.linkIndex) return false;
    if (segmentsShareCircuitEndpoint(a, b)) return false;

    if (isHorizontal(a) && isVertical(b)) {
        const point = { x: b.from.x, y: a.from.y };
        return (
            betweenInclusive(point.x, a.from.x, a.to.x) &&
            betweenInclusive(point.y, b.from.y, b.to.y)
        );
    }

    if (isVertical(a) && isHorizontal(b)) {
        return segmentsCross(b, a);
    }

    return false;
};

const rangesOverlapInclusive = (a1: number, a2: number, b1: number, b2: number): boolean =>
    Math.max(Math.min(a1, a2), Math.min(b1, b2)) <=
    Math.min(Math.max(a1, a2), Math.max(b1, b2));

const segmentsOverlap = (a: RouteSegment, b: RouteSegment): boolean => {
    if (a.linkIndex === b.linkIndex) return false;
    if (segmentsShareCircuitEndpoint(a, b)) return false;
    if (isHorizontal(a) && isHorizontal(b) && a.from.y === b.from.y) {
        return rangesOverlapInclusive(a.from.x, a.to.x, b.from.x, b.to.x);
    }
    if (isVertical(a) && isVertical(b) && a.from.x === b.from.x) {
        return rangesOverlapInclusive(a.from.y, a.to.y, b.from.y, b.to.y);
    }
    return false;
};

const rangesOverlapWithLength = (a1: number, a2: number, b1: number, b2: number): boolean =>
    Math.max(Math.min(a1, a2), Math.min(b1, b2)) <
    Math.min(Math.max(a1, a2), Math.max(b1, b2));

const segmentsTooClose = (
    a: RouteSegment,
    b: RouteSegment,
    wireClearance: number,
): boolean => {
    if (wireClearance <= 0) return false;
    if (a.linkIndex === b.linkIndex) return false;
    if (segmentsShareCircuitEndpoint(a, b)) return false;

    if (isHorizontal(a) && isHorizontal(b)) {
        const delta = Math.abs(a.from.y - b.from.y);
        return (
            delta > 0 &&
            delta < wireClearance &&
            rangesOverlapWithLength(a.from.x, a.to.x, b.from.x, b.to.x)
        );
    }

    if (isVertical(a) && isVertical(b)) {
        const delta = Math.abs(a.from.x - b.from.x);
        return (
            delta > 0 &&
            delta < wireClearance &&
            rangesOverlapWithLength(a.from.y, a.to.y, b.from.y, b.to.y)
        );
    }

    return false;
};

const segmentsConflict = (
    a: RouteSegment,
    b: RouteSegment,
    wireClearance: number,
): boolean =>
    segmentsCross(a, b) ||
    segmentsOverlap(a, b) ||
    segmentsTooClose(a, b, wireClearance);

const segmentIntersectsRect = (
    from: OptimizedCircuitPoint,
    to: OptimizedCircuitPoint,
    rect: OptimizedCircuitRect,
    rectClearance = DEFAULT_OPTIMIZED_CIRCUIT_ROUTING_CONFIG.rectClearance,
): boolean => {
    const left = rect.x - rectClearance;
    const right = rectRight(rect) + rectClearance;
    const top = rect.y - rectClearance;
    const bottom = rectBottom(rect) + rectClearance;

    if (from.y === to.y) {
        const minX = Math.min(from.x, to.x);
        const maxX = Math.max(from.x, to.x);
        return from.y > top && from.y < bottom && maxX > left && minX < right;
    }

    if (from.x === to.x) {
        const minY = Math.min(from.y, to.y);
        const maxY = Math.max(from.y, to.y);
        return from.x > left && from.x < right && maxY > top && minY < bottom;
    }

    return true;
};

export const findRouteComponentCrossings = (args: {
    sourceSynthId: string;
    targetSynthId: string;
    sourcePoint: OptimizedCircuitPoint;
    targetPoint: OptimizedCircuitPoint;
    vertices: OptimizedCircuitPoint[];
    rectsBySynthId: Map<string, OptimizedCircuitRect>;
    routingConfig?: Partial<OptimizedCircuitRoutingConfig>;
}): string[] => {
    const points = routePoints(args.sourcePoint, args.vertices, args.targetPoint);
    const crossings = new Set<string>();
    const routingConfig = normalizeOptimizedCircuitRoutingConfig(args.routingConfig);

    for (let index = 0; index < points.length - 1; index += 1) {
        const from = points[index];
        const to = points[index + 1];
        for (const [synthId, rect] of args.rectsBySynthId) {
            if (synthId === args.sourceSynthId || synthId === args.targetSynthId) continue;
            if (segmentIntersectsRect(from, to, rect, routingConfig.rectClearance)) {
                crossings.add(synthId);
            }
        }
    }

    return [...crossings];
};

const findRouteEndpointComponentIntrusions = (args: {
    sourceSynthId: string;
    targetSynthId: string;
    sourcePoint: OptimizedCircuitPoint;
    targetPoint: OptimizedCircuitPoint;
    vertices: OptimizedCircuitPoint[];
    rectsBySynthId: Map<string, OptimizedCircuitRect>;
    routingConfig: OptimizedCircuitRoutingConfig;
}): string[] => {
    const points = routePoints(args.sourcePoint, args.vertices, args.targetPoint);
    const intrusions = new Set<string>();

    for (let index = 0; index < points.length - 1; index += 1) {
        const from = points[index];
        const to = points[index + 1];

        ([
            [args.sourceSynthId, index === 0],
            [args.targetSynthId, index === points.length - 2],
        ] as const).forEach(([synthId, isAllowedPortStub]) => {
            const rect = args.rectsBySynthId.get(synthId);
            if (!rect) return;
            if (!segmentIntersectsRect(from, to, rect, args.routingConfig.rectClearance)) return;
            if (isAllowedPortStub) return;
            intrusions.add(synthId);
        });
    }

    return [...intrusions];
};

const findUnsafeRouteComponentCrossings = (args: {
    sourceSynthId: string;
    targetSynthId: string;
    sourcePoint: OptimizedCircuitPoint;
    targetPoint: OptimizedCircuitPoint;
    vertices: OptimizedCircuitPoint[];
    rectsBySynthId: Map<string, OptimizedCircuitRect>;
    routingConfig: OptimizedCircuitRoutingConfig;
}): string[] => [
    ...findRouteComponentCrossings(args),
    ...findRouteEndpointComponentIntrusions(args),
];

const findRouteTargetApproachViolationsForVertices = (args: {
    targetNode: RoutableCircuitNode;
    targetRect: OptimizedCircuitRect;
    targetPoint: OptimizedCircuitPoint;
    sourcePoint: OptimizedCircuitPoint;
    vertices: OptimizedCircuitPoint[];
    routingConfig: OptimizedCircuitRoutingConfig;
}): string[] => {
    if (isOutputSinkNode(args.targetNode)) return [];

    const protectedApproachRect: OptimizedCircuitRect = {
        id: `${args.targetRect.id}:target-approach`,
        x: args.targetRect.x - args.routingConfig.targetEdgeClearance,
        y: args.targetRect.y,
        width: args.routingConfig.targetEdgeClearance + NODE_INSET,
        height: args.targetRect.height,
    };
    const points = routePoints(args.sourcePoint, args.vertices, args.targetPoint);
    const violations: string[] = [];

    for (let index = 0; index < points.length - 1; index += 1) {
        const from = points[index];
        const to = points[index + 1];
        const isFinalPortStub = index === points.length - 2;
        const isAllowedPortStub =
            isFinalPortStub &&
            from.y === args.targetPoint.y &&
            to.y === args.targetPoint.y &&
            to.x === args.targetPoint.x &&
            to.y === args.targetPoint.y;

        if (isAllowedPortStub) continue;
        if (
            segmentIntersectsRect(
                from,
                to,
                protectedApproachRect,
                args.routingConfig.rectClearance,
            )
        ) {
            violations.push(String(index));
        }
    }

    return violations;
};

const routeTargetApproachViolationsForVertices = (args: {
    targetNode: RoutableCircuitNode;
    targetPoint: OptimizedCircuitPoint;
    sourcePoint: OptimizedCircuitPoint;
    vertices: OptimizedCircuitPoint[];
    rectsBySynthId: Map<string, OptimizedCircuitRect>;
    routingConfig: OptimizedCircuitRoutingConfig;
}): string[] => {
    const targetRect = args.rectsBySynthId.get(args.targetNode.id);
    if (!targetRect) return [];

    return findRouteTargetApproachViolationsForVertices({
        targetNode: args.targetNode,
        targetRect,
        targetPoint: args.targetPoint,
        sourcePoint: args.sourcePoint,
        vertices: args.vertices,
        routingConfig: args.routingConfig,
    });
};

const findRouteWireConflicts = (args: {
    sourceSynthId: string;
    targetSynthId: string;
    sourcePoint: OptimizedCircuitPoint;
    targetPoint: OptimizedCircuitPoint;
    vertices: OptimizedCircuitPoint[];
    linkIndex: number;
    routedSegments: RouteSegment[];
    routingConfig: OptimizedCircuitRoutingConfig;
}): RouteSegment[] => {
    const candidateSegments = routeSegments(
        args.sourcePoint,
        args.vertices,
        args.targetPoint,
        args.linkIndex,
        args.sourceSynthId,
        args.targetSynthId,
    );
    const conflicts: RouteSegment[] = [];

    candidateSegments.forEach((candidate) => {
        args.routedSegments.forEach((existing) => {
            if (segmentsConflict(candidate, existing, args.routingConfig.wireClearance)) {
                conflicts.push(existing);
            }
        });
    });

    return conflicts;
};

const pointKey = (point: OptimizedCircuitPoint): string => `${point.x},${point.y}`;

const fromPointKey = (key: string): OptimizedCircuitPoint => {
    const [x, y] = key.split(",").map(Number);
    return { x, y };
};

const isSegmentBlocked = (args: {
    sourceSynthId: string;
    targetSynthId: string;
    from: OptimizedCircuitPoint;
    to: OptimizedCircuitPoint;
    linkIndex: number;
    rectsBySynthId: Map<string, OptimizedCircuitRect>;
    routedSegments: RouteSegment[];
    allowEndpointComponentBodies?: boolean;
    routingConfig: OptimizedCircuitRoutingConfig;
}): boolean => {
    if (args.from.x !== args.to.x && args.from.y !== args.to.y) return true;
    const segment: RouteSegment = {
        from: args.from,
        to: args.to,
        linkIndex: args.linkIndex,
        sourceSynthId: args.sourceSynthId,
        targetSynthId: args.targetSynthId,
    };

    for (const [synthId, rect] of args.rectsBySynthId) {
        if (
            args.allowEndpointComponentBodies &&
            (synthId === args.sourceSynthId || synthId === args.targetSynthId)
        ) {
            continue;
        }
        if (segmentIntersectsRect(args.from, args.to, rect, args.routingConfig.rectClearance)) {
            return true;
        }
    }

    return args.routedSegments.some(
        (existing) => segmentsCross(segment, existing) || segmentsOverlap(segment, existing),
    );
};

const countWireCrossings = (
    segment: RouteSegment,
    routedSegments: RouteSegment[],
    routingConfig: OptimizedCircuitRoutingConfig,
): number =>
    routedSegments.filter(
        (existing) => segmentsConflict(segment, existing, routingConfig.wireClearance),
    ).length;

type QueueItem = {
    key: string;
    cost: number;
};

class MinQueue {
    private items: QueueItem[] = [];

    get length(): number {
        return this.items.length;
    }

    push(item: QueueItem): void {
        this.items.push(item);
        this.bubbleUp(this.items.length - 1);
    }

    pop(): QueueItem | undefined {
        const first = this.items[0];
        const last = this.items.pop();
        if (!first || !last) return first;
        if (this.items.length > 0) {
            this.items[0] = last;
            this.bubbleDown(0);
        }
        return first;
    }

    private bubbleUp(index: number): void {
        let cursor = index;
        while (cursor > 0) {
            const parent = Math.floor((cursor - 1) / 2);
            if (this.items[parent].cost <= this.items[cursor].cost) break;
            [this.items[parent], this.items[cursor]] = [this.items[cursor], this.items[parent]];
            cursor = parent;
        }
    }

    private bubbleDown(index: number): void {
        let cursor = index;
        while (true) {
            const left = cursor * 2 + 1;
            const right = left + 1;
            let smallest = cursor;

            if (left < this.items.length && this.items[left].cost < this.items[smallest].cost) {
                smallest = left;
            }
            if (right < this.items.length && this.items[right].cost < this.items[smallest].cost) {
                smallest = right;
            }
            if (smallest === cursor) break;

            [this.items[cursor], this.items[smallest]] = [
                this.items[smallest],
                this.items[cursor],
            ];
            cursor = smallest;
        }
    }
}

const buildDeterministicGridRoute = (args: {
    sourceNode: RoutableCircuitNode;
    targetNode: RoutableCircuitNode;
    sourceRect: OptimizedCircuitRect;
    targetRect: OptimizedCircuitRect;
    sourcePoint: OptimizedCircuitPoint;
    targetPoint: OptimizedCircuitPoint;
    linkIndex: number;
    rectsBySynthId: Map<string, OptimizedCircuitRect>;
    routedSegments: RouteSegment[];
    allowWireCrossings?: boolean;
    wideSearch?: boolean;
    routingConfig: OptimizedCircuitRoutingConfig;
}): RouteSearchResult | undefined => {
    const routingConfig = args.routingConfig;
    const rects = [...args.rectsBySynthId.values()];
    const minRectX = Math.min(...rects.map((rect) => rect.x));
    const maxRectX = Math.max(...rects.map(rectRight));
    const minRectY = Math.min(...rects.map((rect) => rect.y));
    const maxRectY = Math.max(...rects.map(rectBottom));
    const margin =
        routingConfig.searchMargin + args.linkIndex * routingConfig.searchMarginStep;

    const sourceExit = roundPoint({
        x: args.sourcePoint.x + routingConfig.sourceExitClearance,
        y: args.sourcePoint.y,
    });
    const targetEntry = roundPoint(
        isOutputSinkNode(args.targetNode)
            ? {
                  x: args.targetPoint.x,
                  y: args.targetPoint.y + routingConfig.outputSinkBottomClearance,
              }
            : { x: args.targetPoint.x - routingConfig.targetGutter, y: args.targetPoint.y },
    );

    const rawMinX = minRectX - margin;
    const rawMaxX = maxRectX + margin;
    const routeMinX =
        args.wideSearch || isOutputSinkNode(args.targetNode)
            ? rawMinX
            : Math.max(rawMinX, Math.min(args.sourcePoint.x, args.targetPoint.x));
    const routeMaxX =
        args.wideSearch || isOutputSinkNode(args.targetNode)
            ? rawMaxX
            : Math.min(rawMaxX, Math.max(args.sourcePoint.x, args.targetPoint.x));
    const addX = (x: number): void => {
        const rounded = Math.round(x);
        if (rounded >= routeMinX && rounded <= routeMaxX) xValues.add(rounded);
    };
    const addY = (y: number): void => {
        yValues.add(Math.round(y));
    };

    const xValues = new Set<number>();
    const yValues = new Set<number>([args.sourcePoint.y, args.targetPoint.y, sourceExit.y, targetEntry.y]);
    [args.sourcePoint.x, args.targetPoint.x, sourceExit.x, targetEntry.x].forEach(addX);
    [routeMinX, routeMaxX, rawMinX, rawMaxX].forEach(addX);
    [minRectY - routingConfig.topRouteClearance, maxRectY + margin].forEach(addY);
    rects.forEach((rect) => {
        [
            rect.x - routingConfig.minClearance,
            rectRight(rect) + routingConfig.minClearance,
            rect.x,
            rectRight(rect),
        ].forEach(addX);
        [
            rect.y - routingConfig.minClearance,
            rectBottom(rect) + routingConfig.minClearance,
            rect.y,
            rectBottom(rect),
        ].forEach(addY);
    });
    args.routedSegments.forEach((segment) => {
        [
            segment.from.x,
            segment.to.x,
            segment.from.x - routingConfig.wireClearance,
            segment.from.x + routingConfig.wireClearance,
            segment.to.x - routingConfig.wireClearance,
            segment.to.x + routingConfig.wireClearance,
        ].forEach(addX);
        [
            segment.from.y,
            segment.to.y,
            segment.from.y - routingConfig.wireClearance,
            segment.from.y + routingConfig.wireClearance,
            segment.to.y - routingConfig.wireClearance,
            segment.to.y + routingConfig.wireClearance,
        ].forEach(addY);
        if (isVertical(segment)) {
            [
                segment.from.x - routingConfig.wireClearance,
                segment.from.x + routingConfig.wireClearance,
            ].forEach(addX);
        }
        if (isHorizontal(segment)) {
            [
                segment.from.y - routingConfig.wireClearance,
                segment.from.y + routingConfig.wireClearance,
            ].forEach(addY);
        }
    });

    const xs = [...xValues].sort((a, b) => a - b);
    const ys = [...yValues].sort((a, b) => a - b);
    const xIndexByValue = new Map(xs.map((value, index) => [value, index]));
    const yIndexByValue = new Map(ys.map((value, index) => [value, index]));
    const startKey = pointKey(sourceExit);
    const targetKey = pointKey(targetEntry);
    const startPriority =
        Math.abs(sourceExit.x - targetEntry.x) + Math.abs(sourceExit.y - targetEntry.y);
    const queue = new MinQueue();
    queue.push({
        key: startKey,
        cost: startPriority,
    });
    const scores = new Map<string, number>([[startKey, 0]]);
    const priorities = new Map<string, number>([[startKey, startPriority]]);
    const crossingsByKey = new Map<string, number>([[startKey, 0]]);
    const previous = new Map<string, string>();

    const neighbors = (key: string): Array<{ key: string; crossingCount: number; distance: number }> => {
        const point = fromPointKey(key);
        const xIndex = xIndexByValue.get(point.x);
        const yIndex = yIndexByValue.get(point.y);
        const candidates: OptimizedCircuitPoint[] = [];
        if (xIndex === undefined || yIndex === undefined) return [];
        if (xIndex > 0) candidates.push({ x: xs[xIndex - 1], y: point.y });
        if (xIndex < xs.length - 1) candidates.push({ x: xs[xIndex + 1], y: point.y });
        if (yIndex > 0) candidates.push({ x: point.x, y: ys[yIndex - 1] });
        if (yIndex < ys.length - 1) candidates.push({ x: point.x, y: ys[yIndex + 1] });

        return candidates
            .flatMap((candidate) => {
                const segment: RouteSegment = {
                    from: point,
                    to: candidate,
                    linkIndex: args.linkIndex,
                    sourceSynthId: args.sourceNode.id,
                    targetSynthId: args.targetNode.id,
                };
                const componentBlocked = isSegmentBlocked({
                    sourceSynthId: args.sourceNode.id,
                    targetSynthId: args.targetNode.id,
                    from: point,
                    to: candidate,
                    linkIndex: args.linkIndex,
                    rectsBySynthId: args.rectsBySynthId,
                    routedSegments: [],
                    routingConfig,
                });
                if (componentBlocked) return [];

                const crossingCount = countWireCrossings(
                    segment,
                    args.routedSegments,
                    routingConfig,
                );
                if (!args.allowWireCrossings && crossingCount > 0) return [];

                return [
                    {
                        key: pointKey(candidate),
                        crossingCount,
                        distance: Math.abs(point.x - candidate.x) + Math.abs(point.y - candidate.y),
                    },
                ];
            })
            .sort((a, b) => {
                const aPoint = fromPointKey(a.key);
                const bPoint = fromPointKey(b.key);
                const aDistance =
                    Math.abs(aPoint.x - targetEntry.x) + Math.abs(aPoint.y - targetEntry.y);
                const bDistance =
                    Math.abs(bPoint.x - targetEntry.x) + Math.abs(bPoint.y - targetEntry.y);
                return a.crossingCount - b.crossingCount || aDistance - bDistance || aPoint.x - bPoint.x || aPoint.y - bPoint.y;
            });
    };

    let expansionCount = 0;
    while (queue.length && expansionCount < MAX_GRID_ROUTE_EXPANSIONS) {
        const current = queue.pop();
        if (!current) break;
        if (current.cost !== priorities.get(current.key)) continue;
        expansionCount += 1;
        if (current.key === targetKey) break;
        for (const next of neighbors(current.key)) {
            const nextCrossings = (crossingsByKey.get(current.key) ?? 0) + next.crossingCount;
            const nextScore = (scores.get(current.key) ?? 0) + next.crossingCount * 1_000_000 + next.distance;
            const existing = scores.get(next.key);
            if (existing !== undefined && existing <= nextScore) continue;

            const nextPoint = fromPointKey(next.key);
            const heuristic =
                Math.abs(nextPoint.x - targetEntry.x) + Math.abs(nextPoint.y - targetEntry.y);
            const nextPriority = nextScore + heuristic;
            scores.set(next.key, nextScore);
            priorities.set(next.key, nextPriority);
            crossingsByKey.set(next.key, nextCrossings);
            previous.set(next.key, current.key);
            queue.push({ key: next.key, cost: nextPriority });
        }
    }

    if (!scores.has(targetKey)) return undefined;

    const path: OptimizedCircuitPoint[] = [];
    for (let key: string | undefined = targetKey; key; key = previous.get(key)) {
        path.push(fromPointKey(key));
        if (key === startKey) break;
    }
    path.reverse();

    const vertices = normalizeVertices([sourceExit, ...path.slice(1, -1), targetEntry]);
    const fullRouteSegments = routeSegments(
        args.sourcePoint,
        vertices,
        args.targetPoint,
        args.linkIndex,
        args.sourceNode.id,
        args.targetNode.id,
    );

    return {
        vertices,
        crossingCount: fullRouteSegments.reduce(
            (count, segment) =>
                count + countWireCrossings(segment, args.routedSegments, routingConfig),
            0,
        ),
    };
};

const termRouteKey = (sourceId: string, targetId: string): string => `${sourceId}->${targetId}`;

const layoutSourcePortY = (
    sourceId: string,
    positionsBySynthId: Map<string, OptimizedCircuitPoint>,
): number => (positionsBySynthId.get(sourceId)?.y ?? 0) + PORT_OFFSET_Y;

const linkSortY = (
    link: BooleanSynthLink,
    positionsBySynthId: Map<string, OptimizedCircuitPoint>,
    termLaneYByRouteKey: Map<string, number>,
): number =>
    termLaneYByRouteKey.get(termRouteKey(link.from, link.to)) ??
    layoutSourcePortY(link.from, positionsBySynthId);

const buildLinkPlans = (
    links: BooleanSynthLink[],
    nodesById: Map<string, BooleanSynthNode>,
    positionsBySynthId: Map<string, OptimizedCircuitPoint>,
    termLaneYByRouteKey: Map<string, number>,
): OptimizedCircuitLinkPlan[] => {
    const indexed = links.map((link, index) => ({ link, index }));
    const linksByTarget = new Map<string, Array<{ link: BooleanSynthLink; index: number }>>();
    indexed.forEach((linkData) => {
        linksByTarget.set(linkData.link.to, [...(linksByTarget.get(linkData.link.to) ?? []), linkData]);
    });

    const targetPinsByIndex = new Map<number, string>();
    for (const [targetId, targetLinks] of linksByTarget) {
        const target = nodesById.get(targetId);
        const ordered =
            target?.kind === "AND"
                ? [...targetLinks].sort((a, b) => {
                      const aSourceX = positionsBySynthId.get(a.link.from)?.x ?? 0;
                      const bSourceX = positionsBySynthId.get(b.link.from)?.x ?? 0;
                      const xDelta = bSourceX - aSourceX;
                      if (xDelta !== 0) return xDelta;

                      const yDelta =
                          linkSortY(a.link, positionsBySynthId, termLaneYByRouteKey) -
                          linkSortY(b.link, positionsBySynthId, termLaneYByRouteKey);
                      return yDelta || a.index - b.index;
                  })
                : target?.kind === "OR"
                ? [...targetLinks].sort((a, b) => {
                      const yDelta =
                          linkSortY(a.link, positionsBySynthId, termLaneYByRouteKey) -
                          linkSortY(b.link, positionsBySynthId, termLaneYByRouteKey);
                      return yDelta || a.index - b.index;
                  })
                : targetLinks;

        ordered.forEach((linkData, targetPin) => {
            targetPinsByIndex.set(linkData.index, String(targetPin));
        });
    }

    return indexed.map(({ link, index }) => ({
        link,
        index,
        targetPin: targetPinsByIndex.get(index) ?? "0",
        sourceLaneY: termLaneYByRouteKey.get(termRouteKey(link.from, link.to)),
    }));
};

const collectLiteralPortYs = (
    nodeId: string,
    linksByTarget: Map<string, BooleanSynthLink[]>,
    positionsBySynthId: Map<string, OptimizedCircuitPoint>,
): number[] => {
    const incoming = linksByTarget.get(nodeId) ?? [];
    if (incoming.length === 0) return [layoutSourcePortY(nodeId, positionsBySynthId)];

    return incoming.flatMap((link) => {
        const nested = linksByTarget.get(link.from);
        if (!nested?.length) return [layoutSourcePortY(link.from, positionsBySynthId)];
        return collectLiteralPortYs(link.from, linksByTarget, positionsBySynthId);
    });
};

const average = (values: number[]): number => {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const buildOptimizedCircuitLayout = (
    netlist: BooleanSynthNetlist,
    options: BuildLayoutOptions,
): OptimizedCircuitLayout => {
    const routingConfig = normalizeOptimizedCircuitRoutingConfig(options.routingConfig);
    const nodesById = new Map(netlist.nodes.map((node) => [node.id, node]));
    const incomingCounts = computeIncomingCounts(netlist.links);
    const linksByTarget = groupLinksByTarget(netlist.links);
    const outputGroups = buildOutputGroups(netlist, nodesById, linksByTarget);
    const positionsBySynthId = new Map<string, OptimizedCircuitPoint>();
    const termLaneYByRouteKey = new Map<string, number>();
    const inputRowsByVariable = new Map<string, number>();
    const unboundSourceRows = new Map<string, number>();
    let unboundSourceIndex = 0;

    const inputNodes = netlist.nodes.filter((node) => node.kind === "INPUT");
    inputNodes.forEach((node, index) => {
        const rowTop = inputRowTop(options.baseY, index);
        if (node.sourceVariableId) inputRowsByVariable.set(node.sourceVariableId, rowTop);
        positionsBySynthId.set(node.id, {
            x: options.baseX + COLUMN_OFFSET_BY_KIND.INPUT,
            y: rowTop,
        });
    });

    netlist.nodes
        .filter((node) => node.kind === "NOT")
        .forEach((node) => {
            let rowTop =
                node.sourceVariableId !== undefined
                    ? inputRowsByVariable.get(node.sourceVariableId)
                    : undefined;
            if (rowTop === undefined) {
                rowTop = fallbackSourceRowTop(
                    options.baseY,
                    inputNodes.length,
                    unboundSourceIndex,
                );
                unboundSourceRows.set(node.id, rowTop);
                unboundSourceIndex += 1;
            }

            positionsBySynthId.set(node.id, {
                x: options.baseX + COLUMN_OFFSET_BY_KIND.NOT,
                y: rowTop,
            });
        });

    const termPlacements: TermPlacement[] = [];
    outputGroups.forEach((group) => {
        group.termSourceIds.forEach((sourceId) => {
            const source = nodesById.get(sourceId);
            const targetId = group.orId ?? group.outputId;
            if (!source) return;
            const literalPortYs =
                source.kind === "CONST"
                    ? []
                    : collectLiteralPortYs(sourceId, linksByTarget, positionsBySynthId);
            const desiredPortY =
                source.kind === "CONST"
                    ? options.baseY +
                      Math.max(1, inputNodes.length + unboundSourceRows.size) * SOURCE_ROW_GAP +
                      SOURCE_TO_TERMS_GAP
                    : average(literalPortYs);
            termPlacements.push({
                sourceId,
                targetId,
                node: source.kind === "AND" || source.kind === "CONST" ? source : undefined,
                desiredPortY,
                height:
                    source.kind === "AND" || source.kind === "CONST"
                        ? estimateOptimizedNodeSize(
                              source,
                              incomingCounts.get(source.id) ?? 0,
                          ).height
                        : MIN_TERM_HEIGHT,
            });
        });
    });

    let nextAvailableTermTop = options.baseY;

    termPlacements
        .sort((a, b) => a.desiredPortY - b.desiredPortY || a.sourceId.localeCompare(b.sourceId))
        .forEach((placement) => {
            const desiredTop = placement.desiredPortY - PORT_OFFSET_Y;
            const y = Math.max(desiredTop, nextAvailableTermTop);
            const laneY = Math.round(y + PORT_OFFSET_Y);
            termLaneYByRouteKey.set(termRouteKey(placement.sourceId, placement.targetId), laneY);

            if (placement.node) {
                positionsBySynthId.set(placement.node.id, {
                    x:
                        options.baseX +
                        (placement.node.kind === "CONST"
                            ? COLUMN_OFFSET_BY_KIND.CONST
                            : COLUMN_OFFSET_BY_KIND.AND),
                    y: Math.round(y),
                });
            }

            nextAvailableTermTop =
                y + Math.max(MIN_TERM_HEIGHT, placement.height) + TERM_ROW_GAP;
        });

    const lowestSourceBottom =
        options.baseY +
        Math.max(1, inputNodes.length + unboundSourceRows.size) * SOURCE_ROW_GAP;
    let nextAvailableOutputBottom = options.baseY;

    outputGroups.forEach((group) => {
        const termPortYs = group.termSourceIds
            .map(
                (sourceId) =>
                    termLaneYByRouteKey.get(termRouteKey(sourceId, group.orId ?? group.outputId)) ??
                    layoutSourcePortY(sourceId, positionsBySynthId),
            )
            .sort((a, b) => a - b);

        const firstTermPortY = termPortYs[0] ?? lowestSourceBottom + PORT_OFFSET_Y;
        const lastTermPortY = termPortYs[termPortYs.length - 1] ?? firstTermPortY;
        const groupCenterY = Math.round((firstTermPortY + lastTermPortY) / 2);
        let outputPortY = groupCenterY;

        if (group.orId) {
            const orNode = nodesById.get(group.orId);
            if (orNode) {
                const inputCount = incomingCounts.get(orNode.id) ?? 1;
                const pinBandCenterOffset = PORT_OFFSET_Y + ((inputCount - 1) * PIN_GAP) / 2;
                const desiredY = Math.round(groupCenterY - pinBandCenterOffset);
                const y = Math.max(desiredY, nextAvailableOutputBottom + OUTPUT_GROUP_GAP);
                const orHeight = estimateOptimizedNodeSize(orNode, inputCount).height;
                positionsBySynthId.set(orNode.id, {
                    x: options.baseX + COLUMN_OFFSET_BY_KIND.OR,
                    y,
                });
                outputPortY = y + PORT_OFFSET_Y;
                nextAvailableOutputBottom = y + orHeight;
            }
        } else if (group.sourceId) {
            const sourcePosition = positionsBySynthId.get(group.sourceId);
            if (sourcePosition) outputPortY = sourcePosition.y + PORT_OFFSET_Y;
        }

        const outputNode = nodesById.get(group.outputId);
        const outputHeight = outputNode
            ? estimateOptimizedNodeSize(outputNode, incomingCounts.get(outputNode.id) ?? 0).height
            : 52;
        const outputTargetPortY = Math.round(
            outputPortY - routingConfig.outputSinkPreferredRise,
        );

        positionsBySynthId.set(group.outputId, {
            x: options.baseX + COLUMN_OFFSET_BY_KIND.OUTPUT,
            y: Math.round(outputTargetPortY - outputHeight + NODE_INSET),
        });
    });

    netlist.nodes.forEach((node, index) => {
        if (positionsBySynthId.has(node.id)) return;
        const columnOffset = COLUMN_OFFSET_BY_KIND[node.kind];
        positionsBySynthId.set(node.id, {
            x: options.baseX + columnOffset,
            y: options.baseY + index * SOURCE_ROW_GAP,
        });
    });

    return {
        positionsBySynthId,
        linkPlans: buildLinkPlans(
            netlist.links,
            nodesById,
            positionsBySynthId,
            termLaneYByRouteKey,
        ),
    };
};

const buildRouteCandidates = (args: {
    sourceNode: RoutableCircuitNode;
    targetNode: RoutableCircuitNode;
    sourceRect: OptimizedCircuitRect;
    targetRect: OptimizedCircuitRect;
    sourcePoint: OptimizedCircuitPoint;
    targetPoint: OptimizedCircuitPoint;
    targetPin: number;
    linkIndex: number;
    sourceLaneY?: number;
    rectsBySynthId: Map<string, OptimizedCircuitRect>;
    routingConfig: OptimizedCircuitRoutingConfig;
}): RouteCandidate[] => {
    const routingConfig = args.routingConfig;
    const parallelRouteSpacing = effectiveParallelRouteSpacing(routingConfig);
    if (isOutputSinkNode(args.targetNode)) {
        const minimumSinkEntryX = args.sourcePoint.x + routingConfig.minClearance;
        const maximumSinkEntryX = args.targetRect.x - routingConfig.minClearance;
        const preferredSinkEntryX = args.targetRect.x - routingConfig.outputSinkTargetClearance;
        const sinkEntryX =
            maximumSinkEntryX >= minimumSinkEntryX
                ? Math.min(
                      maximumSinkEntryX,
                      Math.max(minimumSinkEntryX, preferredSinkEntryX),
                  )
                : minimumSinkEntryX;
        const sourceExitX = args.sourcePoint.x + routingConfig.sourceExitClearance;
        const bottomEntryX = Math.max(minimumSinkEntryX, preferredSinkEntryX);
        const belowTargetY =
            rectBottom(args.targetRect) +
            routingConfig.outputSinkBottomClearance +
            args.linkIndex * parallelRouteSpacing;
        return [
            {
                name: "sink-direct-dogleg",
                vertices: normalizeVertices([
                    { x: sinkEntryX, y: args.sourcePoint.y },
                    { x: sinkEntryX, y: args.targetPoint.y },
                ]),
            },
            {
                name: "sink-source-exit-dogleg",
                vertices: normalizeVertices([
                    { x: sourceExitX, y: args.sourcePoint.y },
                    { x: sourceExitX, y: args.targetPoint.y },
                ]),
            },
            {
                name: "lamp-bottom-approach",
                vertices: normalizeVertices([
                    { x: bottomEntryX, y: args.sourcePoint.y },
                    { x: bottomEntryX, y: belowTargetY },
                    { x: args.targetPoint.x, y: belowTargetY },
                ]),
            },
        ];
    }

    const minimumTargetGutter = args.sourcePoint.x + routingConfig.minClearance;
    const targetGutter = Math.max(
        minimumTargetGutter,
            args.targetRect.x -
            routingConfig.targetGutter -
            args.targetPin * routingConfig.targetGutterStep,
    );
    const farTargetGutter = Math.max(
        minimumTargetGutter,
        targetGutter - routingConfig.farTargetGutterOffset,
    );
    const nearTargetGutter = Math.max(
        minimumTargetGutter,
        targetGutter + routingConfig.nearTargetGutterOffset,
    );
    const directDogleg = normalizeVertices([
        { x: targetGutter, y: args.sourcePoint.y },
        { x: targetGutter, y: args.targetPoint.y },
    ]);
    const nearTargetDogleg = normalizeVertices([
        { x: nearTargetGutter, y: args.sourcePoint.y },
        { x: nearTargetGutter, y: args.targetPoint.y },
    ]);
    const farTargetDogleg = normalizeVertices([
        { x: farTargetGutter, y: args.sourcePoint.y },
        { x: farTargetGutter, y: args.targetPoint.y },
    ]);
    const sourceFanoutX = Math.min(
        args.sourcePoint.x + routingConfig.sourceFanoutGutter,
        args.targetRect.x - routingConfig.minClearance,
    );
    const sourceFanout = normalizeVertices([
        { x: sourceFanoutX, y: args.sourcePoint.y },
        { x: sourceFanoutX, y: args.targetPoint.y },
    ]);
    const targetOffsetY =
        args.targetPoint.y +
        (args.sourcePoint.y >= args.targetPoint.y
            ? routingConfig.wireClearance
            : -routingConfig.wireClearance);
    const targetOffsetLane = normalizeVertices([
        { x: sourceFanoutX, y: args.sourcePoint.y },
        { x: sourceFanoutX, y: targetOffsetY },
        { x: targetGutter, y: targetOffsetY },
        { x: targetGutter, y: args.targetPoint.y },
    ]);
    const sourceLane = args.sourceLaneY;
    const sourceLaneDetour =
        sourceLane === undefined
            ? []
            : normalizeVertices([
                  { x: sourceFanoutX, y: args.sourcePoint.y },
                  { x: sourceFanoutX, y: sourceLane },
                  { x: targetGutter, y: sourceLane },
                  { x: targetGutter, y: args.targetPoint.y },
              ]);
    const minComponentY = Math.min(...[...args.rectsBySynthId.values()].map((rect) => rect.y));
    const localUpperY = Math.max(
        minComponentY - routingConfig.topRouteClearance,
        Math.min(args.sourcePoint.y, args.targetPoint.y) -
            routingConfig.detourGap -
            args.linkIndex * parallelRouteSpacing,
    );
    const localLowerY =
        Math.max(args.sourcePoint.y, args.targetPoint.y) +
        routingConfig.detourGap +
        args.linkIndex * parallelRouteSpacing;
    const upperDetour = normalizeVertices([
        { x: sourceFanoutX, y: args.sourcePoint.y },
        { x: sourceFanoutX, y: localUpperY },
        { x: targetGutter, y: localUpperY },
        { x: targetGutter, y: args.targetPoint.y },
    ]);
    const lowerLocalDetour = normalizeVertices([
        { x: sourceFanoutX, y: args.sourcePoint.y },
        { x: sourceFanoutX, y: localLowerY },
        { x: targetGutter, y: localLowerY },
        { x: targetGutter, y: args.targetPoint.y },
    ]);
    const maxBottom = Math.max(
        ...[...args.rectsBySynthId.values()].map((rect) => rectBottom(rect)),
        args.sourcePoint.y,
        args.targetPoint.y,
    );
    const detourY = maxBottom + routingConfig.detourGap + args.linkIndex * routingConfig.detourStep;
    const lowerDetour = normalizeVertices([
        { x: sourceFanoutX, y: args.sourcePoint.y },
        { x: sourceFanoutX, y: detourY },
        { x: targetGutter, y: detourY },
        { x: targetGutter, y: args.targetPoint.y },
    ]);
    const sourceEscapeX = args.sourcePoint.x + routingConfig.minClearance;
    const sourceLeftGutter = args.sourceRect.x - routingConfig.minClearance;
    const sourceTopEscapeY = args.sourceRect.y - routingConfig.minClearance;
    const sourceBottomEscapeY = rectBottom(args.sourceRect) + routingConfig.minClearance;
    const sourceLeftUpperDetour = normalizeVertices([
        { x: sourceEscapeX, y: args.sourcePoint.y },
        { x: sourceEscapeX, y: sourceTopEscapeY },
        { x: sourceLeftGutter, y: sourceTopEscapeY },
        { x: sourceLeftGutter, y: localUpperY },
        { x: targetGutter, y: localUpperY },
        { x: targetGutter, y: args.targetPoint.y },
    ]);
    const sourceLeftLowerDetour = normalizeVertices([
        { x: sourceEscapeX, y: args.sourcePoint.y },
        { x: sourceEscapeX, y: sourceBottomEscapeY },
        { x: sourceLeftGutter, y: sourceBottomEscapeY },
        { x: sourceLeftGutter, y: localLowerY },
        { x: targetGutter, y: localLowerY },
        { x: targetGutter, y: args.targetPoint.y },
    ]);
    const sourceLeftTargetRowDetour = normalizeVertices([
        { x: sourceEscapeX, y: args.sourcePoint.y },
        {
            x: sourceEscapeX,
            y:
                args.targetPoint.y >= args.sourcePoint.y
                    ? sourceBottomEscapeY
                    : sourceTopEscapeY,
        },
        {
            x: sourceLeftGutter,
            y:
                args.targetPoint.y >= args.sourcePoint.y
                    ? sourceBottomEscapeY
                    : sourceTopEscapeY,
        },
        { x: sourceLeftGutter, y: args.targetPoint.y },
    ]);

    const straight = normalizeVertices([]);
    const sourceLaneCandidates: RouteCandidate[] =
        sourceLane === undefined
            ? []
            : [
                  { name: "source-lane", vertices: sourceLaneDetour },
                  {
                      name: "source-lane-far-gutter",
                      vertices: normalizeVertices([
                          { x: sourceFanoutX, y: args.sourcePoint.y },
                          { x: sourceFanoutX, y: sourceLane },
                          { x: farTargetGutter, y: sourceLane },
                          { x: farTargetGutter, y: args.targetPoint.y },
                      ]),
                  },
                  {
                      name: "source-lane-near-gutter",
                      vertices: normalizeVertices([
                          { x: sourceFanoutX, y: args.sourcePoint.y },
                          { x: sourceFanoutX, y: sourceLane },
                          { x: nearTargetGutter, y: sourceLane },
                          { x: nearTargetGutter, y: args.targetPoint.y },
                      ]),
                  },
              ];

    return [
        ...sourceLaneCandidates,
        { name: "straight", vertices: straight },
        { name: "target-gutter", vertices: directDogleg },
        { name: "near-target-gutter", vertices: nearTargetDogleg },
        { name: "far-target-gutter", vertices: farTargetDogleg },
        { name: "source-fanout", vertices: sourceFanout },
        { name: "target-offset-lane", vertices: targetOffsetLane },
        { name: "upper-detour", vertices: upperDetour },
        { name: "lower-local-detour", vertices: lowerLocalDetour },
        { name: "source-left-target-row-detour", vertices: sourceLeftTargetRowDetour },
        { name: "source-left-upper-detour", vertices: sourceLeftUpperDetour },
        { name: "source-left-lower-detour", vertices: sourceLeftLowerDetour },
        { name: "lower-detour", vertices: lowerDetour },
    ];
};

const buildBoundaryDetourCandidates = (args: {
    targetNode: RoutableCircuitNode;
    sourcePoint: OptimizedCircuitPoint;
    targetPoint: OptimizedCircuitPoint;
    linkIndex: number;
    rectsBySynthId: Map<string, OptimizedCircuitRect>;
    routingConfig: OptimizedCircuitRoutingConfig;
}): RouteCandidate[] => {
    const routingConfig = args.routingConfig;
    const rects = [...args.rectsBySynthId.values()];
    const maxX = Math.max(...rects.map(rectRight));
    const minY = Math.min(...rects.map((rect) => rect.y));
    const maxY = Math.max(...rects.map(rectBottom));
    const margin =
        routingConfig.searchMargin + args.linkIndex * routingConfig.searchMarginStep;
    const sourceExit = {
        x: args.sourcePoint.x + routingConfig.sourceExitClearance,
        y: args.sourcePoint.y,
    };
    const targetEntry = isOutputSinkNode(args.targetNode)
        ? {
              x: args.targetPoint.x,
              y: args.targetPoint.y + routingConfig.minClearance,
          }
        : {
              x: args.targetPoint.x - routingConfig.targetGutter,
              y: args.targetPoint.y,
          };
    const topY = minY - routingConfig.topRouteClearance;
    const bottomY = maxY + margin;
    const rightX = maxX + margin;

    return [
        {
            name: "boundary-top",
            vertices: normalizeVertices([
                sourceExit,
                { x: sourceExit.x, y: topY },
                { x: targetEntry.x, y: topY },
                targetEntry,
            ]),
        },
        {
            name: "boundary-bottom",
            vertices: normalizeVertices([
                sourceExit,
                { x: sourceExit.x, y: bottomY },
                { x: targetEntry.x, y: bottomY },
                targetEntry,
            ]),
        },
        {
            name: "boundary-right",
            vertices: normalizeVertices([
                sourceExit,
                { x: rightX, y: sourceExit.y },
                { x: rightX, y: targetEntry.y },
                targetEntry,
            ]),
        },
        {
            name: "boundary-right-top",
            vertices: normalizeVertices([
                sourceExit,
                { x: rightX, y: sourceExit.y },
                { x: rightX, y: topY },
                { x: targetEntry.x, y: topY },
                targetEntry,
            ]),
        },
        {
            name: "boundary-right-bottom",
            vertices: normalizeVertices([
                sourceExit,
                { x: rightX, y: sourceExit.y },
                { x: rightX, y: bottomY },
                { x: targetEntry.x, y: bottomY },
                targetEntry,
            ]),
        },
    ];
};

const routeComponentCrossingsForVertices = (args: {
    sourceNode: RoutableCircuitNode;
    targetNode: RoutableCircuitNode;
    sourcePoint: OptimizedCircuitPoint;
    targetPoint: OptimizedCircuitPoint;
    vertices: OptimizedCircuitPoint[];
    rectsBySynthId: Map<string, OptimizedCircuitRect>;
    routingConfig: OptimizedCircuitRoutingConfig;
}): string[] =>
    findUnsafeRouteComponentCrossings({
        sourceSynthId: args.sourceNode.id,
        targetSynthId: args.targetNode.id,
        sourcePoint: args.sourcePoint,
        targetPoint: args.targetPoint,
        vertices: args.vertices,
        rectsBySynthId: args.rectsBySynthId,
        routingConfig: args.routingConfig,
    });

const routeWireCrossingCountForVertices = (args: {
    sourceNode: RoutableCircuitNode;
    targetNode: RoutableCircuitNode;
    sourcePoint: OptimizedCircuitPoint;
    targetPoint: OptimizedCircuitPoint;
    vertices: OptimizedCircuitPoint[];
    linkIndex: number;
    routedSegments: RouteSegment[];
    routingConfig: OptimizedCircuitRoutingConfig;
}): number =>
    findRouteWireConflicts({
        sourceSynthId: args.sourceNode.id,
        targetSynthId: args.targetNode.id,
        sourcePoint: args.sourcePoint,
        targetPoint: args.targetPoint,
        vertices: args.vertices,
        linkIndex: args.linkIndex,
        routedSegments: args.routedSegments,
        routingConfig: args.routingConfig,
    }).length;

const simplifySafeRouteVertices = (args: {
    sourceNode: RoutableCircuitNode;
    targetNode: RoutableCircuitNode;
    sourcePoint: OptimizedCircuitPoint;
    targetPoint: OptimizedCircuitPoint;
    vertices: OptimizedCircuitPoint[];
    linkIndex: number;
    rectsBySynthId: Map<string, OptimizedCircuitRect>;
    routedSegments: RouteSegment[];
    routingConfig: OptimizedCircuitRoutingConfig;
}): OptimizedCircuitPoint[] => {
    let vertices = normalizeVertices(args.vertices);
    let changed = true;

    while (changed) {
        changed = false;
        const points = routePoints(args.sourcePoint, vertices, args.targetPoint);
        const currentCrossingCount = routeWireCrossingCountForVertices({
            sourceNode: args.sourceNode,
            targetNode: args.targetNode,
            sourcePoint: args.sourcePoint,
            targetPoint: args.targetPoint,
            vertices,
            linkIndex: args.linkIndex,
            routedSegments: args.routedSegments,
            routingConfig: args.routingConfig,
        });

        for (let start = 0; start < points.length - 2 && !changed; start += 1) {
            for (let end = points.length - 1; end > start + 1; end -= 1) {
                const from = points[start];
                const to = points[end];
                if (from.x !== to.x && from.y !== to.y) continue;

                const candidatePoints = [
                    ...points.slice(0, start + 1),
                    to,
                    ...points.slice(end + 1),
                ];
                const candidateVertices = normalizeVertices(candidatePoints.slice(1, -1));
                if (candidateVertices.length >= vertices.length) continue;

                if (
                    !isOrthogonalRoute(
                        args.sourcePoint,
                        candidateVertices,
                        args.targetPoint,
                        args.linkIndex,
                        args.sourceNode.id,
                        args.targetNode.id,
                    )
                ) {
                    continue;
                }

                const componentCrossings = routeComponentCrossingsForVertices({
                    sourceNode: args.sourceNode,
                    targetNode: args.targetNode,
                    sourcePoint: args.sourcePoint,
                    targetPoint: args.targetPoint,
                    vertices: candidateVertices,
                    rectsBySynthId: args.rectsBySynthId,
                    routingConfig: args.routingConfig,
                });
                if (componentCrossings.length > 0) continue;
                if (
                    routeTargetApproachViolationsForVertices({
                        targetNode: args.targetNode,
                        sourcePoint: args.sourcePoint,
                        targetPoint: args.targetPoint,
                        vertices: candidateVertices,
                        rectsBySynthId: args.rectsBySynthId,
                        routingConfig: args.routingConfig,
                    }).length > 0
                ) {
                    continue;
                }

                const crossingCount = routeWireCrossingCountForVertices({
                    sourceNode: args.sourceNode,
                    targetNode: args.targetNode,
                    sourcePoint: args.sourcePoint,
                    targetPoint: args.targetPoint,
                    vertices: candidateVertices,
                    linkIndex: args.linkIndex,
                    routedSegments: args.routedSegments,
                    routingConfig: args.routingConfig,
                });
                if (crossingCount > currentCrossingCount) continue;

                vertices = candidateVertices;
                changed = true;
                break;
            }
        }

        for (let start = 0; start < points.length - 2 && !changed; start += 1) {
            for (let end = points.length - 1; end > start + 1; end -= 1) {
                const from = points[start];
                const to = points[end];
                if (from.x === to.x || from.y === to.y) continue;

                const bendCandidates = [
                    { x: to.x, y: from.y },
                    { x: from.x, y: to.y },
                ];

                for (const bend of bendCandidates) {
                    const candidatePoints = [
                        ...points.slice(0, start + 1),
                        bend,
                        ...points.slice(end),
                    ];
                    const candidateVertices = normalizeVertices(candidatePoints.slice(1, -1));
                    if (candidateVertices.length >= vertices.length) continue;

                    if (
                        !isOrthogonalRoute(
                            args.sourcePoint,
                            candidateVertices,
                            args.targetPoint,
                            args.linkIndex,
                            args.sourceNode.id,
                            args.targetNode.id,
                        )
                    ) {
                        continue;
                    }

                    const componentCrossings = routeComponentCrossingsForVertices({
                        sourceNode: args.sourceNode,
                        targetNode: args.targetNode,
                        sourcePoint: args.sourcePoint,
                        targetPoint: args.targetPoint,
                        vertices: candidateVertices,
                        rectsBySynthId: args.rectsBySynthId,
                        routingConfig: args.routingConfig,
                    });
                    if (componentCrossings.length > 0) continue;
                    if (
                        routeTargetApproachViolationsForVertices({
                            targetNode: args.targetNode,
                            sourcePoint: args.sourcePoint,
                            targetPoint: args.targetPoint,
                            vertices: candidateVertices,
                            rectsBySynthId: args.rectsBySynthId,
                            routingConfig: args.routingConfig,
                        }).length > 0
                    ) {
                        continue;
                    }

                    const crossingCount = routeWireCrossingCountForVertices({
                        sourceNode: args.sourceNode,
                        targetNode: args.targetNode,
                        sourcePoint: args.sourcePoint,
                        targetPoint: args.targetPoint,
                        vertices: candidateVertices,
                        linkIndex: args.linkIndex,
                        routedSegments: args.routedSegments,
                        routingConfig: args.routingConfig,
                    });
                    if (crossingCount > currentCrossingCount) continue;

                    vertices = candidateVertices;
                    changed = true;
                    break;
                }

                if (changed) break;
            }
        }
    }

    return vertices;
};

const componentSafeRouteCandidates = (args: {
    sourceNode: RoutableCircuitNode;
    targetNode: RoutableCircuitNode;
    sourcePoint: OptimizedCircuitPoint;
    targetPoint: OptimizedCircuitPoint;
    linkIndex: number;
    rectsBySynthId: Map<string, OptimizedCircuitRect>;
    routedSegments: RouteSegment[];
    candidates: RouteCandidate[];
    routingConfig: OptimizedCircuitRoutingConfig;
}): RouteSearchResult[] =>
    args.candidates.flatMap((candidate) => {
        if (
            !isOrthogonalRoute(
                args.sourcePoint,
                candidate.vertices,
                args.targetPoint,
                args.linkIndex,
                args.sourceNode.id,
                args.targetNode.id,
            )
        ) {
            return [];
        }

        const componentCrossings = routeComponentCrossingsForVertices({
            sourceNode: args.sourceNode,
            targetNode: args.targetNode,
            sourcePoint: args.sourcePoint,
            targetPoint: args.targetPoint,
            vertices: candidate.vertices,
            rectsBySynthId: args.rectsBySynthId,
            routingConfig: args.routingConfig,
        });
        if (componentCrossings.length > 0) return [];
        if (
            routeTargetApproachViolationsForVertices({
                targetNode: args.targetNode,
                sourcePoint: args.sourcePoint,
                targetPoint: args.targetPoint,
                vertices: candidate.vertices,
                rectsBySynthId: args.rectsBySynthId,
                routingConfig: args.routingConfig,
            }).length > 0
        ) {
            return [];
        }

        const vertices = simplifySafeRouteVertices({
            sourceNode: args.sourceNode,
            targetNode: args.targetNode,
            sourcePoint: args.sourcePoint,
            targetPoint: args.targetPoint,
            vertices: candidate.vertices,
            linkIndex: args.linkIndex,
            rectsBySynthId: args.rectsBySynthId,
            routedSegments: args.routedSegments,
            routingConfig: args.routingConfig,
        });
        if (
            routeTargetApproachViolationsForVertices({
                targetNode: args.targetNode,
                sourcePoint: args.sourcePoint,
                targetPoint: args.targetPoint,
                vertices,
                rectsBySynthId: args.rectsBySynthId,
                routingConfig: args.routingConfig,
            }).length > 0
        ) {
            return [];
        }

        return [
            {
                vertices,
                crossingCount: routeWireCrossingCountForVertices({
                    sourceNode: args.sourceNode,
                    targetNode: args.targetNode,
                    sourcePoint: args.sourcePoint,
                    targetPoint: args.targetPoint,
                    vertices,
                    linkIndex: args.linkIndex,
                    routedSegments: args.routedSegments,
                    routingConfig: args.routingConfig,
                }),
            },
        ];
    });

const buildZeroCrossingEdgeVertices = (
    options: BuildRouteOptions,
): OptimizedCircuitPoint[] | undefined => {
    const routingConfig = normalizeOptimizedCircuitRoutingConfig(options.routingConfig);
    const nodesById = new Map(options.netlist.nodes.map((node) => [node.id, node]));
    const sourceNode = nodesById.get(options.linkPlan.link.from);
    const targetNode = nodesById.get(options.linkPlan.link.to);
    const sourceRect = options.rectsBySynthId.get(options.linkPlan.link.from);
    const targetRect = options.rectsBySynthId.get(options.linkPlan.link.to);

    if (!sourceNode || !targetNode || !sourceRect || !targetRect) return [];

    const sourcePoint = roundPoint(sourcePortPoint(sourceNode, sourceRect));
    const targetPoint = roundPoint(
        targetPortPoint(targetNode, targetRect, options.linkPlan.targetPin),
    );
    const targetPin = Number(options.linkPlan.targetPin);
    const candidates = buildRouteCandidates({
        sourceNode,
        targetNode,
        sourceRect,
        targetRect,
        sourcePoint,
        targetPoint,
        targetPin,
        linkIndex: options.linkPlan.index,
        sourceLaneY: options.linkPlan.sourceLaneY,
        rectsBySynthId: options.rectsBySynthId,
        routingConfig,
    });
    const boundaryCandidates = buildBoundaryDetourCandidates({
        targetNode,
        sourcePoint,
        targetPoint,
        linkIndex: options.linkPlan.index,
        rectsBySynthId: options.rectsBySynthId,
        routingConfig,
    });
    const cheapRoutes = componentSafeRouteCandidates({
        sourceNode,
        targetNode,
        sourcePoint,
        targetPoint,
        linkIndex: options.linkPlan.index,
        rectsBySynthId: options.rectsBySynthId,
        routedSegments: options.routedSegments ?? [],
        candidates: [...candidates, ...boundaryCandidates],
        routingConfig,
    });
    const minPreferredY = Math.min(...[...options.rectsBySynthId.values()].map((rect) => rect.y));
    const routeComparator = compareRouteSearchResults({
        sourcePoint,
        targetPoint,
        minPreferredY,
    });
    const cheapZeroCrossingRoute = cheapRoutes
        .filter((route) => route.crossingCount === 0)
        .sort(routeComparator)[0];
    if (cheapZeroCrossingRoute) return cheapZeroCrossingRoute.vertices;

    const gridSearchOptions = {
        sourceNode,
        targetNode,
        sourceRect,
        targetRect,
        sourcePoint,
        targetPoint,
        linkIndex: options.linkPlan.index,
        rectsBySynthId: options.rectsBySynthId,
        routedSegments: options.routedSegments ?? [],
        routingConfig,
    };
    const zeroCrossingGridRoute =
        buildDeterministicGridRoute(gridSearchOptions) ??
        buildDeterministicGridRoute({ ...gridSearchOptions, wideSearch: true });
    if (!zeroCrossingGridRoute) return undefined;
    const zeroCrossingGridVertices = simplifySafeRouteVertices({
        sourceNode,
        targetNode,
        sourcePoint,
        targetPoint,
        vertices: zeroCrossingGridRoute.vertices,
        linkIndex: options.linkPlan.index,
        rectsBySynthId: options.rectsBySynthId,
        routedSegments: options.routedSegments ?? [],
        routingConfig,
    });

    const componentCrossings = routeComponentCrossingsForVertices({
        sourceNode,
        targetNode,
        sourcePoint,
        targetPoint,
        vertices: zeroCrossingGridVertices,
        rectsBySynthId: options.rectsBySynthId,
        routingConfig,
    });
    const wireCrossings = findRouteWireConflicts({
        sourceSynthId: sourceNode.id,
        targetSynthId: targetNode.id,
        sourcePoint,
        targetPoint,
        vertices: zeroCrossingGridVertices,
        linkIndex: options.linkPlan.index,
        routedSegments: options.routedSegments ?? [],
        routingConfig,
    });
    const targetApproachViolations = routeTargetApproachViolationsForVertices({
        targetNode,
        sourcePoint,
        targetPoint,
        vertices: zeroCrossingGridVertices,
        rectsBySynthId: options.rectsBySynthId,
        routingConfig,
    });

    return componentCrossings.length === 0 &&
        wireCrossings.length === 0 &&
        targetApproachViolations.length === 0
        ? zeroCrossingGridVertices
        : undefined;
};

export const buildOptimizedEdgeVertices = (
    options: BuildRouteOptions,
): OptimizedCircuitPoint[] => {
    const routingConfig = normalizeOptimizedCircuitRoutingConfig(options.routingConfig);
    const nodesById = new Map(options.netlist.nodes.map((node) => [node.id, node]));
    const sourceNode = nodesById.get(options.linkPlan.link.from);
    const targetNode = nodesById.get(options.linkPlan.link.to);
    const sourceRect = options.rectsBySynthId.get(options.linkPlan.link.from);
    const targetRect = options.rectsBySynthId.get(options.linkPlan.link.to);

    if (!sourceNode || !targetNode || !sourceRect || !targetRect) return [];

    const sourcePoint = roundPoint(sourcePortPoint(sourceNode, sourceRect));
    const targetPoint = roundPoint(
        targetPortPoint(targetNode, targetRect, options.linkPlan.targetPin),
    );
    const targetPin = Number(options.linkPlan.targetPin);
    const candidates = buildRouteCandidates({
        sourceNode,
        targetNode,
        sourceRect,
        targetRect,
        sourcePoint,
        targetPoint,
        targetPin,
        linkIndex: options.linkPlan.index,
        sourceLaneY: options.linkPlan.sourceLaneY,
        rectsBySynthId: options.rectsBySynthId,
        routingConfig,
    });
    const boundaryCandidates = buildBoundaryDetourCandidates({
        targetNode,
        sourcePoint,
        targetPoint,
        linkIndex: options.linkPlan.index,
        rectsBySynthId: options.rectsBySynthId,
        routingConfig,
    });
    const cheapRoutes = componentSafeRouteCandidates({
        sourceNode,
        targetNode,
        sourcePoint,
        targetPoint,
        linkIndex: options.linkPlan.index,
        rectsBySynthId: options.rectsBySynthId,
        routedSegments: options.routedSegments ?? [],
        candidates: [...candidates, ...boundaryCandidates],
        routingConfig,
    });
    const gridSearchOptions = {
        sourceNode,
        targetNode,
        sourceRect,
        targetRect,
        sourcePoint,
        targetPoint,
        linkIndex: options.linkPlan.index,
        rectsBySynthId: options.rectsBySynthId,
        routedSegments: options.routedSegments ?? [],
        routingConfig,
    };
    const minPreferredY = Math.min(...[...options.rectsBySynthId.values()].map((rect) => rect.y));
    const bestCandidate = cheapRoutes.sort(
        compareRouteSearchResults({ sourcePoint, targetPoint, minPreferredY }),
    )[0];

    const validGridRouteResults = (
        routes: Array<RouteSearchResult | undefined>,
    ): RouteSearchResult[] =>
        routes.flatMap((route) => {
            if (!route) return [];
            const vertices = simplifySafeRouteVertices({
                sourceNode,
                targetNode,
                sourcePoint,
                targetPoint,
                vertices: route.vertices,
                linkIndex: options.linkPlan.index,
                rectsBySynthId: options.rectsBySynthId,
                routedSegments: options.routedSegments ?? [],
                routingConfig,
            });
            const componentCrossings = routeComponentCrossingsForVertices({
                sourceNode,
                targetNode,
                sourcePoint,
                targetPoint,
                vertices,
                rectsBySynthId: options.rectsBySynthId,
                routingConfig,
            });
            const targetApproachViolations = routeTargetApproachViolationsForVertices({
                targetNode,
                sourcePoint,
                targetPoint,
                vertices,
                rectsBySynthId: options.rectsBySynthId,
                routingConfig,
            });

            return componentCrossings.length === 0 && targetApproachViolations.length === 0
                ? [
                      {
                          vertices,
                          crossingCount: routeWireCrossingCountForVertices({
                              sourceNode,
                              targetNode,
                              sourcePoint,
                              targetPoint,
                              vertices,
                              linkIndex: options.linkPlan.index,
                              routedSegments: options.routedSegments ?? [],
                              routingConfig,
                          }),
                      },
                  ]
                : [];
        });
    const strictGridFallbacks = validGridRouteResults([
        buildDeterministicGridRoute(gridSearchOptions),
        buildDeterministicGridRoute({ ...gridSearchOptions, wideSearch: true }),
    ]);
    const crossingFallbacks = validGridRouteResults([
        buildDeterministicGridRoute({ ...gridSearchOptions, allowWireCrossings: true }),
        buildDeterministicGridRoute({
            ...gridSearchOptions,
            allowWireCrossings: true,
            wideSearch: true,
        }),
    ]);
    const bestStrictGridFallback = strictGridFallbacks.sort(
        compareRouteSearchResults({ sourcePoint, targetPoint, minPreferredY }),
    )[0];
    const bestCrossingFallback = crossingFallbacks.sort(
        compareRouteSearchResults({ sourcePoint, targetPoint, minPreferredY }),
    )[0];

    const bestFallback = [bestCandidate, bestStrictGridFallback, bestCrossingFallback]
        .flatMap((route) => (route ? [route] : []))
        .sort(compareRouteSearchResults({ sourcePoint, targetPoint, minPreferredY }))[0];

    if (bestFallback) return bestFallback.vertices;

    return [];
};

export const buildOptimizedEdgeRoutes = (
    options: BuildRoutesOptions,
): Map<number, OptimizedCircuitPoint[]> => {
    const routingConfig = normalizeOptimizedCircuitRoutingConfig(options.routingConfig);
    const nodesById = new Map(options.netlist.nodes.map((node) => [node.id, node]));
    const routesByLinkIndex = new Map<number, OptimizedCircuitPoint[]>();
    const routedSegments: RouteSegment[] = [];
    const orderedLinkPlans = [...options.linkPlans].sort((a, b) => {
        const aSourceNode = nodesById.get(a.link.from);
        const aTargetNode = nodesById.get(a.link.to);
        const bSourceNode = nodesById.get(b.link.from);
        const bTargetNode = nodesById.get(b.link.to);
        const aSourceRect = options.rectsBySynthId.get(a.link.from);
        const aTargetRect = options.rectsBySynthId.get(a.link.to);
        const bSourceRect = options.rectsBySynthId.get(b.link.from);
        const bTargetRect = options.rectsBySynthId.get(b.link.to);
        if (!aSourceNode || !aTargetNode || !aSourceRect || !aTargetRect) return 1;
        if (!bSourceNode || !bTargetNode || !bSourceRect || !bTargetRect) return -1;

        const aSourcePoint = sourcePortPoint(aSourceNode, aSourceRect);
        const aTargetPoint = targetPortPoint(aTargetNode, aTargetRect, a.targetPin);
        const bSourcePoint = sourcePortPoint(bSourceNode, bSourceRect);
        const bTargetPoint = targetPortPoint(bTargetNode, bTargetRect, b.targetPin);
        const aChannelRight = Math.max(aSourcePoint.x, aTargetPoint.x);
        const bChannelRight = Math.max(bSourcePoint.x, bTargetPoint.x);
        const aChannelLeft = Math.min(aSourcePoint.x, aTargetPoint.x);
        const bChannelLeft = Math.min(bSourcePoint.x, bTargetPoint.x);
        const aHorizontalSpan = aChannelRight - aChannelLeft;
        const bHorizontalSpan = bChannelRight - bChannelLeft;
        const aSpan = Math.abs(aSourcePoint.y - aTargetPoint.y);
        const bSpan = Math.abs(bSourcePoint.y - bTargetPoint.y);
        const aPriority = aTargetNode.kind === "OR" ? 0 : isOutputSinkNode(aTargetNode) ? 2 : 1;
        const bPriority = bTargetNode.kind === "OR" ? 0 : isOutputSinkNode(bTargetNode) ? 2 : 1;

        if (aPriority !== bPriority) return aPriority - bPriority;

        if (a.link.to === b.link.to) {
            return (
                Number(a.targetPin) - Number(b.targetPin) ||
                aSpan - bSpan ||
                a.index - b.index
            );
        }

        return (
            aHorizontalSpan - bHorizontalSpan ||
            aSpan - bSpan ||
            aChannelRight - bChannelRight ||
            a.index - b.index
        );
    });

    for (const linkPlan of orderedLinkPlans) {
        const sourceNode = nodesById.get(linkPlan.link.from);
        const targetNode = nodesById.get(linkPlan.link.to);
        const sourceRect = options.rectsBySynthId.get(linkPlan.link.from);
        const targetRect = options.rectsBySynthId.get(linkPlan.link.to);
        if (!sourceNode || !targetNode || !sourceRect || !targetRect) continue;

        const vertices = buildOptimizedEdgeVertices({
            linkPlan,
            netlist: options.netlist,
            rectsBySynthId: options.rectsBySynthId,
            routedSegments,
            routingConfig,
        });
        routesByLinkIndex.set(linkPlan.index, vertices);
        routedSegments.push(
            ...routeSegments(
                roundPoint(sourcePortPoint(sourceNode, sourceRect)),
                vertices,
                roundPoint(targetPortPoint(targetNode, targetRect, linkPlan.targetPin)),
                linkPlan.index,
                sourceNode.id,
                targetNode.id,
            ),
        );
    }

    const rebuildSegments = (exceptLinkIndex?: number): RouteSegment[] => {
        const segments: RouteSegment[] = [];

        for (const linkPlan of options.linkPlans) {
            if (linkPlan.index === exceptLinkIndex) continue;
            const sourceNode = nodesById.get(linkPlan.link.from);
            const targetNode = nodesById.get(linkPlan.link.to);
            const sourceRect = options.rectsBySynthId.get(linkPlan.link.from);
            const targetRect = options.rectsBySynthId.get(linkPlan.link.to);
            if (!sourceNode || !targetNode || !sourceRect || !targetRect) continue;

            segments.push(
                ...routeSegments(
                    roundPoint(sourcePortPoint(sourceNode, sourceRect)),
                    routesByLinkIndex.get(linkPlan.index) ?? [],
                    roundPoint(targetPortPoint(targetNode, targetRect, linkPlan.targetPin)),
                    linkPlan.index,
                    sourceNode.id,
                    targetNode.id,
                ),
            );
        }

        return segments;
    };

    const crossingCount = (routes: Map<number, OptimizedCircuitPoint[]>): number =>
        findRouteSetWireCrossings({
            linkPlans: options.linkPlans,
            netlist: options.netlist,
            rectsBySynthId: options.rectsBySynthId,
            routesByLinkIndex: routes,
        }).length;

    for (let pass = 0; pass < options.linkPlans.length * 2; pass += 1) {
        const currentCrossings = findRouteSetWireCrossings({
            linkPlans: options.linkPlans,
            netlist: options.netlist,
            rectsBySynthId: options.rectsBySynthId,
            routesByLinkIndex,
        });
        if (currentCrossings.length === 0) break;

        const currentCount = currentCrossings.length;
        const crossingLinkIndexes = [
            ...new Set(
                currentCrossings.flatMap((crossing) =>
                    crossing.split(":").map((value) => Number(value)),
                ),
            ),
        ].sort((a, b) => a - b);
        let improved = false;

        for (const linkIndex of crossingLinkIndexes) {
            const linkPlan = options.linkPlans.find((candidate) => candidate.index === linkIndex);
            if (!linkPlan) continue;
            const sourceNode = nodesById.get(linkPlan.link.from);
            const targetNode = nodesById.get(linkPlan.link.to);
            const sourceRect = options.rectsBySynthId.get(linkPlan.link.from);
            const targetRect = options.rectsBySynthId.get(linkPlan.link.to);
            if (!sourceNode || !targetNode || !sourceRect || !targetRect) continue;

            const currentVertices = routesByLinkIndex.get(linkIndex) ?? [];
            const sourcePoint = roundPoint(sourcePortPoint(sourceNode, sourceRect));
            const targetPoint = roundPoint(
                targetPortPoint(targetNode, targetRect, linkPlan.targetPin),
            );
            const routedSegments = rebuildSegments(linkIndex);
            const candidateVertices = buildOptimizedEdgeVertices({
                linkPlan,
                netlist: options.netlist,
                rectsBySynthId: options.rectsBySynthId,
                routedSegments,
                routingConfig,
            });
            const candidateRoutes = new Map(routesByLinkIndex);
            candidateRoutes.set(linkIndex, candidateVertices);
            const nextCount = crossingCount(candidateRoutes);
            const comparator = compareRouteSearchResults({
                sourcePoint,
                targetPoint,
                minPreferredY: Math.min(
                    ...[...options.rectsBySynthId.values()].map((rect) => rect.y),
                ),
            });
            const currentRoute = {
                vertices: currentVertices,
                crossingCount: routeWireCrossingCountForVertices({
                    sourceNode,
                    targetNode,
                    sourcePoint,
                    targetPoint,
                    vertices: currentVertices,
                    linkIndex,
                    routedSegments,
                    routingConfig,
                }),
            };
            const candidateRoute = {
                vertices: candidateVertices,
                crossingCount: routeWireCrossingCountForVertices({
                    sourceNode,
                    targetNode,
                    sourcePoint,
                    targetPoint,
                    vertices: candidateVertices,
                    linkIndex,
                    routedSegments,
                    routingConfig,
                }),
            };

            if (nextCount >= currentCount) continue;
            if (comparator(candidateRoute, currentRoute) >= 0) continue;

            routesByLinkIndex.set(linkIndex, candidateVertices);
            improved = true;
            break;
        }

        if (!improved) break;
    }

    return routesByLinkIndex;
};

export const findRouteSetWireCrossings = (options: {
    linkPlans: OptimizedCircuitLinkPlan[];
    netlist: RoutableCircuitNetlist;
    rectsBySynthId: Map<string, OptimizedCircuitRect>;
    routesByLinkIndex: Map<number, OptimizedCircuitPoint[]>;
}): string[] => {
    const nodesById = new Map(options.netlist.nodes.map((node) => [node.id, node]));
    const segments: RouteSegment[] = [];
    const crossings: string[] = [];

    options.linkPlans.forEach((linkPlan) => {
        const sourceNode = nodesById.get(linkPlan.link.from);
        const targetNode = nodesById.get(linkPlan.link.to);
        const sourceRect = options.rectsBySynthId.get(linkPlan.link.from);
        const targetRect = options.rectsBySynthId.get(linkPlan.link.to);
        if (!sourceNode || !targetNode || !sourceRect || !targetRect) return;

        segments.push(
            ...routeSegments(
                roundPoint(sourcePortPoint(sourceNode, sourceRect)),
                options.routesByLinkIndex.get(linkPlan.index) ?? [],
                roundPoint(targetPortPoint(targetNode, targetRect, linkPlan.targetPin)),
                linkPlan.index,
                sourceNode.id,
                targetNode.id,
            ),
        );
    });

    segments.forEach((segment, index) => {
        segments.slice(index + 1).forEach((candidate) => {
            if (segmentsCross(segment, candidate) || segmentsOverlap(segment, candidate)) {
                crossings.push(`${segment.linkIndex}:${candidate.linkIndex}`);
            }
        });
    });

    return crossings;
};

export const findRouteSetWireClearanceViolations = (options: {
    linkPlans: OptimizedCircuitLinkPlan[];
    netlist: RoutableCircuitNetlist;
    rectsBySynthId: Map<string, OptimizedCircuitRect>;
    routesByLinkIndex: Map<number, OptimizedCircuitPoint[]>;
    routingConfig?: Partial<OptimizedCircuitRoutingConfig>;
}): string[] => {
    const nodesById = new Map(options.netlist.nodes.map((node) => [node.id, node]));
    const routingConfig = normalizeOptimizedCircuitRoutingConfig(options.routingConfig);
    const segments: RouteSegment[] = [];
    const violations: string[] = [];

    options.linkPlans.forEach((linkPlan) => {
        const sourceNode = nodesById.get(linkPlan.link.from);
        const targetNode = nodesById.get(linkPlan.link.to);
        const sourceRect = options.rectsBySynthId.get(linkPlan.link.from);
        const targetRect = options.rectsBySynthId.get(linkPlan.link.to);
        if (!sourceNode || !targetNode || !sourceRect || !targetRect) return;

        segments.push(
            ...routeSegments(
                roundPoint(sourcePortPoint(sourceNode, sourceRect)),
                options.routesByLinkIndex.get(linkPlan.index) ?? [],
                roundPoint(targetPortPoint(targetNode, targetRect, linkPlan.targetPin)),
                linkPlan.index,
                sourceNode.id,
                targetNode.id,
            ),
        );
    });

    segments.forEach((segment, index) => {
        segments.slice(index + 1).forEach((candidate) => {
            if (segmentsTooClose(segment, candidate, routingConfig.wireClearance)) {
                violations.push(`${segment.linkIndex}:${candidate.linkIndex}`);
            }
        });
    });

    return violations;
};

export const buildRouteSetJunctionDots = (options: {
    linkPlans: OptimizedCircuitLinkPlan[];
    netlist: RoutableCircuitNetlist;
    rectsBySynthId: Map<string, OptimizedCircuitRect>;
    routesByLinkIndex: Map<number, OptimizedCircuitPoint[]>;
}): Map<number, RouteJunctionDot[]> => {
    const nodesById = new Map(options.netlist.nodes.map((node) => [node.id, node]));
    const routeGeometries = options.linkPlans.flatMap((linkPlan) => {
        const sourceNode = nodesById.get(linkPlan.link.from);
        const targetNode = nodesById.get(linkPlan.link.to);
        const sourceRect = options.rectsBySynthId.get(linkPlan.link.from);
        const targetRect = options.rectsBySynthId.get(linkPlan.link.to);
        if (!sourceNode || !targetNode || !sourceRect || !targetRect) return [];

        const sourcePoint = roundPoint(sourcePortPoint(sourceNode, sourceRect));
        const targetPoint = roundPoint(targetPortPoint(targetNode, targetRect, linkPlan.targetPin));
        const vertices = options.routesByLinkIndex.get(linkPlan.index) ?? [];

        return [
            {
                linkPlan,
                sourcePoint,
                targetPoint,
                vertices,
                points: routePoints(sourcePoint, vertices, targetPoint),
                segments: routeSegments(
                    sourcePoint,
                    vertices,
                    targetPoint,
                    linkPlan.index,
                    sourceNode.id,
                    targetNode.id,
                ),
            },
        ];
    });
    const dotsByLinkIndex = new Map<number, RouteJunctionDot[]>();
    const seen = new Set<string>();

    routeGeometries.forEach((branch) => {
        const branchPoints = branch.points.slice(1, -1);
        branchPoints.forEach((point) => {
            routeGeometries.forEach((trunk) => {
                if (trunk.linkPlan.index === branch.linkPlan.index) return;
                if (trunk.linkPlan.link.from !== branch.linkPlan.link.from) return;
                if (!trunk.segments.some((segment) => pointOnSegmentInterior(point, segment))) {
                    return;
                }

                const distance = distanceAlongRouteToPoint(
                    trunk.sourcePoint,
                    trunk.vertices,
                    trunk.targetPoint,
                    point,
                );
                if (distance === undefined) return;

                const key = `${trunk.linkPlan.index}:${pointKey(point)}`;
                if (seen.has(key)) return;
                seen.add(key);
                dotsByLinkIndex.set(trunk.linkPlan.index, [
                    ...(dotsByLinkIndex.get(trunk.linkPlan.index) ?? []),
                    { point, distance },
                ]);
            });
        });
    });

    return dotsByLinkIndex;
};

export const findRouteSetComponentCrossings = (options: {
    linkPlans: OptimizedCircuitLinkPlan[];
    netlist: RoutableCircuitNetlist;
    rectsBySynthId: Map<string, OptimizedCircuitRect>;
    routesByLinkIndex: Map<number, OptimizedCircuitPoint[]>;
    routingConfig?: Partial<OptimizedCircuitRoutingConfig>;
}): string[] => {
    const nodesById = new Map(options.netlist.nodes.map((node) => [node.id, node]));
    const routingConfig = normalizeOptimizedCircuitRoutingConfig(options.routingConfig);
    const crossings: string[] = [];

    options.linkPlans.forEach((linkPlan) => {
        const sourceNode = nodesById.get(linkPlan.link.from);
        const targetNode = nodesById.get(linkPlan.link.to);
        const sourceRect = options.rectsBySynthId.get(linkPlan.link.from);
        const targetRect = options.rectsBySynthId.get(linkPlan.link.to);
        if (!sourceNode || !targetNode || !sourceRect || !targetRect) return;

        const crossedComponents = findUnsafeRouteComponentCrossings({
            sourceSynthId: sourceNode.id,
            targetSynthId: targetNode.id,
            sourcePoint: roundPoint(sourcePortPoint(sourceNode, sourceRect)),
            targetPoint: roundPoint(targetPortPoint(targetNode, targetRect, linkPlan.targetPin)),
            vertices: options.routesByLinkIndex.get(linkPlan.index) ?? [],
            rectsBySynthId: options.rectsBySynthId,
            routingConfig,
        });

        crossedComponents.forEach((componentId) => {
            crossings.push(`${linkPlan.index}:${componentId}`);
        });
    });

    return crossings;
};

export const findRouteSetNonOrthogonalSegments = (options: {
    linkPlans: OptimizedCircuitLinkPlan[];
    netlist: RoutableCircuitNetlist;
    rectsBySynthId: Map<string, OptimizedCircuitRect>;
    routesByLinkIndex: Map<number, OptimizedCircuitPoint[]>;
}): string[] => {
    const nodesById = new Map(options.netlist.nodes.map((node) => [node.id, node]));
    const violations: string[] = [];

    options.linkPlans.forEach((linkPlan) => {
        const sourceNode = nodesById.get(linkPlan.link.from);
        const targetNode = nodesById.get(linkPlan.link.to);
        const sourceRect = options.rectsBySynthId.get(linkPlan.link.from);
        const targetRect = options.rectsBySynthId.get(linkPlan.link.to);
        if (!sourceNode || !targetNode || !sourceRect || !targetRect) return;

        const segments = routeSegments(
            roundPoint(sourcePortPoint(sourceNode, sourceRect)),
            options.routesByLinkIndex.get(linkPlan.index) ?? [],
            roundPoint(targetPortPoint(targetNode, targetRect, linkPlan.targetPin)),
            linkPlan.index,
            sourceNode.id,
            targetNode.id,
        );

        segments.forEach((segment, segmentIndex) => {
            if (!isHorizontal(segment) && !isVertical(segment)) {
                violations.push(`${linkPlan.index}:${segmentIndex}`);
            }
        });
    });

    return violations;
};

export const findRouteSetTargetApproachViolations = (options: {
    linkPlans: OptimizedCircuitLinkPlan[];
    netlist: RoutableCircuitNetlist;
    rectsBySynthId: Map<string, OptimizedCircuitRect>;
    routesByLinkIndex: Map<number, OptimizedCircuitPoint[]>;
    routingConfig?: Partial<OptimizedCircuitRoutingConfig>;
}): string[] => {
    const nodesById = new Map(options.netlist.nodes.map((node) => [node.id, node]));
    const routingConfig = normalizeOptimizedCircuitRoutingConfig(options.routingConfig);
    const violations: string[] = [];

    options.linkPlans.forEach((linkPlan) => {
        const sourceNode = nodesById.get(linkPlan.link.from);
        const targetNode = nodesById.get(linkPlan.link.to);
        const sourceRect = options.rectsBySynthId.get(linkPlan.link.from);
        const targetRect = options.rectsBySynthId.get(linkPlan.link.to);
        if (!sourceNode || !targetNode || !sourceRect || !targetRect) return;

        const targetViolations = routeTargetApproachViolationsForVertices({
            targetNode,
            sourcePoint: roundPoint(sourcePortPoint(sourceNode, sourceRect)),
            targetPoint: roundPoint(targetPortPoint(targetNode, targetRect, linkPlan.targetPin)),
            vertices: options.routesByLinkIndex.get(linkPlan.index) ?? [],
            rectsBySynthId: options.rectsBySynthId,
            routingConfig,
        });

        targetViolations.forEach((segmentIndex) => {
            violations.push(`${linkPlan.index}:${segmentIndex}`);
        });
    });

    return violations;
};

export const findUnnecessaryRouteWireCrossings = (options: {
    linkPlans: OptimizedCircuitLinkPlan[];
    netlist: RoutableCircuitNetlist;
    rectsBySynthId: Map<string, OptimizedCircuitRect>;
    routesByLinkIndex: Map<number, OptimizedCircuitPoint[]>;
    routingConfig?: Partial<OptimizedCircuitRoutingConfig>;
}): string[] => {
    const nodesById = new Map(options.netlist.nodes.map((node) => [node.id, node]));
    const routingConfig = normalizeOptimizedCircuitRoutingConfig(options.routingConfig);
    const currentCrossings = findRouteSetWireCrossings(options);
    const unnecessary = new Set<string>();

    const segmentsExcept = (exceptLinkIndex: number): RouteSegment[] => {
        const segments: RouteSegment[] = [];

        options.linkPlans.forEach((linkPlan) => {
            if (linkPlan.index === exceptLinkIndex) return;
            const sourceNode = nodesById.get(linkPlan.link.from);
            const targetNode = nodesById.get(linkPlan.link.to);
            const sourceRect = options.rectsBySynthId.get(linkPlan.link.from);
            const targetRect = options.rectsBySynthId.get(linkPlan.link.to);
            if (!sourceNode || !targetNode || !sourceRect || !targetRect) return;

            segments.push(
                ...routeSegments(
                    roundPoint(sourcePortPoint(sourceNode, sourceRect)),
                    options.routesByLinkIndex.get(linkPlan.index) ?? [],
                    roundPoint(targetPortPoint(targetNode, targetRect, linkPlan.targetPin)),
                    linkPlan.index,
                    sourceNode.id,
                    targetNode.id,
                ),
            );
        });

        return segments;
    };

    currentCrossings.forEach((crossing) => {
        crossing
            .split(":")
            .map((value) => Number(value))
            .forEach((linkIndex) => {
                const linkPlan = options.linkPlans.find(
                    (candidate) => candidate.index === linkIndex,
                );
                if (!linkPlan) return;

                const sourceNode = nodesById.get(linkPlan.link.from);
                const targetNode = nodesById.get(linkPlan.link.to);
                const sourceRect = options.rectsBySynthId.get(linkPlan.link.from);
                const targetRect = options.rectsBySynthId.get(linkPlan.link.to);
                if (!sourceNode || !targetNode || !sourceRect || !targetRect) return;

                const routedSegments = segmentsExcept(linkIndex);
                const alternateVertices = buildZeroCrossingEdgeVertices({
                    linkPlan,
                    netlist: options.netlist,
                    rectsBySynthId: options.rectsBySynthId,
                    routedSegments,
                    routingConfig,
                });
                if (alternateVertices === undefined) return;

                const sourcePoint = roundPoint(sourcePortPoint(sourceNode, sourceRect));
                const targetPoint = roundPoint(
                    targetPortPoint(targetNode, targetRect, linkPlan.targetPin),
                );
                const currentVertices = options.routesByLinkIndex.get(linkIndex) ?? [];
                const currentCrossingCount = routeWireCrossingCountForVertices({
                    sourceNode,
                    targetNode,
                    sourcePoint,
                    targetPoint,
                    vertices: currentVertices,
                    linkIndex,
                    routedSegments,
                    routingConfig,
                });
                const wireCrossings = findRouteWireConflicts({
                    sourceSynthId: sourceNode.id,
                    targetSynthId: targetNode.id,
                    sourcePoint,
                    targetPoint,
                    vertices: alternateVertices,
                    linkIndex,
                    routedSegments,
                    routingConfig,
                });
                const comparator = compareRouteSearchResults({
                    sourcePoint,
                    targetPoint,
                    minPreferredY: Math.min(
                        ...[...options.rectsBySynthId.values()].map((rect) => rect.y),
                    ),
                });

                if (
                    wireCrossings.length === 0 &&
                    comparator(
                        { vertices: alternateVertices, crossingCount: 0 },
                        { vertices: currentVertices, crossingCount: currentCrossingCount },
                    ) < 0
                ) {
                    unnecessary.add(String(linkIndex));
                }
            });
    });

    return [...unnecessary].sort((a, b) => Number(a) - Number(b));
};

export const estimateOptimizedNodeSize = (
    node: RoutableCircuitNode,
    incomingCount: number,
): { width: number; height: number } => {
    const visualPreset = getLogicVisualPreset(visualHashForSynthNode(node))?.preset;
    if (!visualPreset) throw new Error(`Missing visual preset for ${node.kind}.`);

    const size = calcNodeSize({
        minWidth: visualPreset.minWidth,
        minHeight: visualPreset.minHeight,
        pinCount: optimizedNodePinCount(node, incomingCount),
    });

    return {
        width: size.width + STROKE_WIDTH,
        height: size.height + STROKE_WIDTH,
    };
};

export const getOptimizedIncomingCounts = computeIncomingCounts;
