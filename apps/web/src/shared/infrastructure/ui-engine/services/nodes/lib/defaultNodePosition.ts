import { GRID_SIZE } from "../../../model";

export type NodePlacementBox = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type NodePlacementSize = {
    width: number;
    height: number;
};

export const DEFAULT_NODE_POSITION = { x: 122, y: 122 } as const;

const DEFAULT_COLUMNS = 6;
const MAX_SCAN_ROWS = 50;
const NODE_GAP = GRID_SIZE * 2;

const snapUpToGrid = (value: number): number =>
    Math.ceil(value / GRID_SIZE) * GRID_SIZE;

const overlaps = (
    a: NodePlacementBox,
    b: NodePlacementBox,
    gap: number = NODE_GAP,
): boolean =>
    !(
        a.x + a.width + gap <= b.x ||
        b.x + b.width + gap <= a.x ||
        a.y + a.height + gap <= b.y ||
        b.y + b.height + gap <= a.y
    );

export const findDefaultNodePosition = (
    size: NodePlacementSize,
    occupiedBoxes: NodePlacementBox[],
): { x: number; y: number } => {
    if (occupiedBoxes.length === 0) return { ...DEFAULT_NODE_POSITION };

    const stepX = snapUpToGrid(size.width + NODE_GAP);
    const stepY = snapUpToGrid(size.height + NODE_GAP);

    for (let row = 0; row < MAX_SCAN_ROWS; row += 1) {
        for (let col = 0; col < DEFAULT_COLUMNS; col += 1) {
            const candidate = {
                x: DEFAULT_NODE_POSITION.x + col * stepX,
                y: DEFAULT_NODE_POSITION.y + row * stepY,
                width: size.width,
                height: size.height,
            };

            if (!occupiedBoxes.some((box) => overlaps(candidate, box))) {
                return { x: candidate.x, y: candidate.y };
            }
        }
    }

    return {
        x: DEFAULT_NODE_POSITION.x,
        y: DEFAULT_NODE_POSITION.y + MAX_SCAN_ROWS * stepY,
    };
};
