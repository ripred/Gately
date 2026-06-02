import type { BooleanAnalysisController } from "../model/types";
import type {
    ApiAnalyzeBoolean_Result,
    BooleanBit,
    BooleanImplicant,
    BooleanOptimizedOutput,
    BooleanTruthTableRow,
    KarnaughMap,
} from "@cnbn/engine";
import { Component, createSignal, For, JSX, onCleanup, Show } from "solid-js";

type BooleanAnalysisPanelProps = {
    controller: BooleanAnalysisController;
};

type OutputTableProps = {
    analysis: ApiAnalyzeBoolean_Result;
    output: BooleanOptimizedOutput;
    title: string;
    valueLabel: string;
    getValue: (row: BooleanTruthTableRow) => BooleanBit;
    highlightTerms?: BooleanImplicant[];
};

type PanelPosition = {
    x: number;
    y: number;
};

type OptimizerTabId = "overview" | "current" | "karnaugh" | "optimized";

type OptimizerTab = {
    id: OptimizerTabId;
    label: string;
};

type KMapRegionCellState = {
    groupIndices: number[];
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
};

type KMapRegionGroup = {
    term: BooleanImplicant;
    index: number;
};

const PANEL_MARGIN = 12;
const REGION_BORDER_COLOR = "#dc2626";

const OPTIMIZER_TABS: OptimizerTab[] = [
    { id: "overview", label: "Overview" },
    { id: "current", label: "Current Table" },
    { id: "karnaugh", label: "Karnaugh Regions" },
    { id: "optimized", label: "Optimized Table" },
];

const clamp = (value: number, min: number, max: number): number =>
    Math.min(Math.max(value, min), max);

const termCoversInputs = (term: BooleanImplicant, inputs: BooleanBit[]): boolean =>
    term.bits.every((bit, index) => bit === "-" || bit === inputs[index]);

const termLabel = (term: BooleanImplicant, symbols: string[]): string => {
    const literals = term.bits.flatMap((bit, index) => {
        if (bit === "-") return [];
        return bit === "1" ? symbols[index] : `${symbols[index]}'`;
    });

    return literals.length ? literals.join("") : "1";
};

const termCubeLabel = (term: BooleanImplicant): string => term.bits.join("") || "1";

const termRegionSize = (term: BooleanImplicant): number =>
    2 ** term.bits.filter((bit) => bit === "-").length;

const isPowerOfTwo = (value: number): boolean => value > 0 && (value & (value - 1)) === 0;

const isHighlightableGroup = (term: BooleanImplicant): boolean =>
    termRegionSize(term) >= 2 &&
    isPowerOfTwo(termRegionSize(term)) &&
    term.minterms.length === termRegionSize(term);

const kMapRegionGroups = (terms: BooleanImplicant[]): KMapRegionGroup[] =>
    terms
        .map((term, index) => ({ term, index }))
        .filter(({ term }) => isHighlightableGroup(term));

const termIndexForMinterm = (
    terms: BooleanImplicant[] | undefined,
    minterm: number,
    value: BooleanBit,
): number =>
    value === "1"
        ? (terms?.findIndex(
              (term) => isHighlightableGroup(term) && term.minterms.includes(minterm),
          ) ?? -1)
        : -1;

const evaluateSop = (terms: BooleanImplicant[], row: BooleanTruthTableRow): BooleanBit =>
    terms.some((term) => termCoversInputs(term, row.inputs)) ? "1" : "0";

const bitClass = (value: BooleanBit): string =>
    value === "1" ? "font-semibold text-green-11" : "text-gray-10";

const cellClass = (value: BooleanBit, groupIndex: number): string => {
    if (groupIndex >= 0) return "text-red-12";
    if (value === "1") return "border-green-6 bg-green-2 text-green-12";
    return "border-gray-5 text-gray-10";
};

const groupHighlightStyle = (groupIndex: number) =>
    groupIndex >= 0
        ? {
              "background-color": "rgba(239, 68, 68, 0.18)",
              "border-color": REGION_BORDER_COLOR,
              "box-shadow": `inset 0 0 0 2px ${REGION_BORDER_COLOR}`,
          }
        : undefined;

const kMapRegionCellState = (
    map: KarnaughMap,
    terms: BooleanImplicant[],
    rowIndex: number,
    columnIndex: number,
    selectedGroupIndex?: number,
): KMapRegionCellState => {
    const cell = map.cells[rowIndex][columnIndex];
    const allGroupIndices =
        cell.value === "1"
            ? terms.flatMap((term, index) =>
                  isHighlightableGroup(term) && term.minterms.includes(cell.minterm)
                      ? [index]
                      : [],
              )
            : [];
    const groupIndices =
        selectedGroupIndex === undefined
            ? allGroupIndices
            : allGroupIndices.filter((groupIndex) => groupIndex === selectedGroupIndex);

    if (!groupIndices.length) {
        return {
            groupIndices,
            top: false,
            right: false,
            bottom: false,
            left: false,
        };
    }

    const rowCount = map.cells.length;
    const columnCount = map.cells[0]?.length ?? 0;
    const neighborCovered = (
        term: BooleanImplicant,
        nextRowIndex: number,
        nextColumnIndex: number,
    ): boolean => {
        const nextCell = map.cells[nextRowIndex]?.[nextColumnIndex];

        return Boolean(
            nextCell && nextCell.value === "1" && term.minterms.includes(nextCell.minterm),
        );
    };
    const sides = groupIndices.reduce(
        (result, groupIndex) => {
            const term = terms[groupIndex];

            return {
                top:
                    result.top ||
                    !neighborCovered(term, (rowIndex - 1 + rowCount) % rowCount, columnIndex),
                right:
                    result.right ||
                    !neighborCovered(term, rowIndex, (columnIndex + 1) % columnCount),
                bottom:
                    result.bottom ||
                    !neighborCovered(term, (rowIndex + 1) % rowCount, columnIndex),
                left:
                    result.left ||
                    !neighborCovered(term, rowIndex, (columnIndex - 1 + columnCount) % columnCount),
            };
        },
        { top: false, right: false, bottom: false, left: false },
    );

    return {
        groupIndices,
        ...sides,
    };
};

const kMapRegionStyle = (state: KMapRegionCellState): JSX.CSSProperties | undefined => {
    if (!state.groupIndices.length) return;

    const shadows = [
        state.top ? `inset 0 2px 0 ${REGION_BORDER_COLOR}` : undefined,
        state.right ? `inset -2px 0 0 ${REGION_BORDER_COLOR}` : undefined,
        state.bottom ? `inset 0 -2px 0 ${REGION_BORDER_COLOR}` : undefined,
        state.left ? `inset 2px 0 0 ${REGION_BORDER_COLOR}` : undefined,
    ].filter(Boolean);

    return {
        "background-color": "rgba(239, 68, 68, 0.18)",
        "border-color": "rgba(220, 38, 38, 0.35)",
        "box-shadow": shadows.join(", "),
    };
};

const formatGroupLabels = (groupIndices: number[]): string =>
    groupIndices.map((groupIndex) => `G${groupIndex + 1}`).join(" ");

const KarnaughRegionSummary: Component<{
    terms: BooleanImplicant[];
    symbols: string[];
    selectedGroupIndex?: number;
    setSelectedGroupIndex: (groupIndex: number | undefined) => void;
}> = (props) => {
    const groups = () => kMapRegionGroups(props.terms);
    const groupButtonClass = (active: boolean): string =>
        [
            "rounded px-2 py-1 text-xs font-semibold",
            active ? "bg-gray-12 text-gray-1" : "bg-gray-3 text-gray-11 hover:bg-gray-4",
        ].join(" ");

    return (
        <Show when={groups().length}>
            <div class="space-y-2">
                <div class="flex flex-wrap gap-1">
                    <button
                        class={groupButtonClass(props.selectedGroupIndex === undefined)}
                        type="button"
                        onClick={() => props.setSelectedGroupIndex(undefined)}
                    >
                        All
                    </button>
                    <For each={groups()}>
                        {({ index }) => (
                            <button
                                class={groupButtonClass(props.selectedGroupIndex === index)}
                                type="button"
                                onClick={() => props.setSelectedGroupIndex(index)}
                            >
                                G{index + 1}
                            </button>
                        )}
                    </For>
                </div>
                <div class="rounded border border-gray-5 text-[11px]">
                    <div class="grid grid-cols-[42px_1fr_72px_88px] gap-2 border-b border-gray-5 bg-gray-3 px-2 py-1 font-semibold text-gray-11">
                        <div>Group</div>
                        <div>Term</div>
                        <div>Cells</div>
                        <div>Cube</div>
                    </div>
                    <For each={groups()}>
                        {({ term, index }) => (
                            <button
                                class={`grid w-full grid-cols-[42px_1fr_72px_88px] gap-2 border-t border-gray-4 px-2 py-1 text-left font-mono ${
                                    props.selectedGroupIndex === index ? "bg-red-2" : "hover:bg-gray-2"
                                }`}
                                type="button"
                                onClick={() => props.setSelectedGroupIndex(index)}
                            >
                                <div class="font-semibold text-red-12">G{index + 1}</div>
                                <div>{termLabel(term, props.symbols)}</div>
                                <div>{termRegionSize(term)}</div>
                                <div>{termCubeLabel(term)}</div>
                            </button>
                        )}
                    </For>
                </div>
            </div>
        </Show>
    );
};

const tabButtonClass = (active: boolean): string =>
    [
        "flex-1 rounded px-2 py-1.5 text-center text-xs font-semibold transition-colors",
        active
            ? "bg-gray-12 text-gray-1 shadow-sm"
            : "bg-gray-3 text-gray-11 hover:bg-gray-4",
    ].join(" ");

const KMapGrid: Component<{
    map: KarnaughMap;
    terms: BooleanImplicant[];
    selectedGroupIndex?: number;
}> = (props) => {
    const columnCount = () => props.map.columnLabels.length + 1;

    return (
        <div class="overflow-auto rounded border border-gray-5">
            <div
                class="grid min-w-max text-center text-[11px]"
                style={{
                    "grid-template-columns": `minmax(48px, max-content) repeat(${columnCount() - 1}, minmax(34px, max-content))`,
                }}
            >
                <div class="sticky left-0 top-0 z-20 bg-gray-3 px-2 py-1 text-gray-10">
                    {props.map.rowVariables.join("") || "-"} /{" "}
                    {props.map.columnVariables.join("") || "-"}
                </div>
                <For each={props.map.columnLabels}>
                    {(label) => <div class="sticky top-0 z-10 bg-gray-3 px-2 py-1 text-gray-10">{label}</div>}
                </For>
                <For each={props.map.cells}>
                    {(row, rowIndex) => (
                        <>
                            <div class="sticky left-0 z-10 bg-gray-3 px-2 py-1 text-gray-10">
                                {props.map.rowLabels[rowIndex()]}
                            </div>
                            <For each={row}>
                                {(cell, columnIndex) => {
                                    const regionState = () =>
                                        kMapRegionCellState(
                                            props.map,
                                            props.terms,
                                            rowIndex(),
                                            columnIndex(),
                                            props.selectedGroupIndex,
                                        );
                                    return (
                                        <div
                                            class={`border px-2 py-1 ${cellClass(
                                                cell.value,
                                                regionState().groupIndices.length ? 0 : -1,
                                            )}`}
                                            data-kmap-cell={cell.minterm}
                                            data-kmap-groups={
                                                regionState().groupIndices.length
                                                    ? formatGroupLabels(regionState().groupIndices)
                                                    : undefined
                                            }
                                            data-kmap-value={cell.value}
                                            style={kMapRegionStyle(regionState())}
                                            title={
                                                regionState().groupIndices.length
                                                    ? formatGroupLabels(regionState().groupIndices)
                                                    : undefined
                                            }
                                        >
                                            <div class="font-mono text-sm">{cell.value}</div>
                                            <div class="text-[9px]">m{cell.minterm}</div>
                                        </div>
                                    );
                                }}
                            </For>
                        </>
                    )}
                </For>
            </div>
        </div>
    );
};

const OutputTruthTable: Component<OutputTableProps> = (props) => (
    <section class="space-y-2 rounded border border-gray-5 p-2">
        <div class="flex items-center justify-between gap-2">
            <div class="font-semibold">{props.title}</div>
            <div class="text-xs text-gray-10">{props.analysis.truthTable.length} rows</div>
        </div>
        <div class="max-h-64 overflow-auto rounded border border-gray-5">
            <table class="min-w-full border-collapse font-mono text-[11px]">
                <thead class="sticky top-0 z-10 bg-gray-3 text-gray-11">
                    <tr>
                        <th class="border-b border-gray-5 px-2 py-1 text-right">m</th>
                        <For each={props.analysis.variables}>
                            {(variable) => (
                                <th class="border-b border-l border-gray-5 px-2 py-1 text-center">
                                    {variable.symbol}
                                </th>
                            )}
                        </For>
                        <th class="border-b border-l border-gray-5 px-2 py-1 text-center">
                            {props.valueLabel}
                        </th>
                        <Show when={props.highlightTerms}>
                            <th class="border-b border-l border-gray-5 px-2 py-1 text-center">
                                group
                            </th>
                        </Show>
                    </tr>
                </thead>
                <tbody>
                    <For each={props.analysis.truthTable}>
                        {(row) => {
                            const value = () => props.getValue(row);
                            const groupIndex = () =>
                                termIndexForMinterm(props.highlightTerms, row.minterm, value());

                            return (
                                <tr>
                                    <td class="border-t border-gray-5 px-2 py-1 text-right text-gray-10">
                                        {row.minterm}
                                    </td>
                                    <For each={row.inputs}>
                                        {(input) => (
                                            <td class="border-l border-t border-gray-5 px-2 py-1 text-center">
                                                {input}
                                            </td>
                                        )}
                                    </For>
                                    <td
                                        class={`border-l border-t border-gray-5 px-2 py-1 text-center ${
                                            groupIndex() >= 0
                                                ? "font-semibold text-red-12"
                                                : bitClass(value())
                                        }`}
                                        style={groupHighlightStyle(groupIndex())}
                                    >
                                        {value()}
                                    </td>
                                    <Show when={props.highlightTerms}>
                                        <td class="border-l border-t border-gray-5 px-2 py-1 text-center text-gray-10">
                                            <Show when={groupIndex() >= 0}>G{groupIndex() + 1}</Show>
                                        </td>
                                    </Show>
                                </tr>
                            );
                        }}
                    </For>
                </tbody>
            </table>
        </div>
    </section>
);

const KarnaughRegionView: Component<{
    analysis: ApiAnalyzeBoolean_Result;
    output: BooleanOptimizedOutput;
}> = (props) => {
    const [selectedGroupIndex, setSelectedGroupIndex] = createSignal<number | undefined>();

    return (
        <section class="space-y-2 rounded border border-gray-5 p-2">
            <div class="font-semibold">Karnaugh Regions</div>
            <KarnaughRegionSummary
                terms={props.output.sop.terms}
                symbols={props.analysis.variables.map((variable) => variable.symbol)}
                selectedGroupIndex={selectedGroupIndex()}
                setSelectedGroupIndex={setSelectedGroupIndex}
            />
            <Show
                when={props.output.karnaughMap}
                fallback={
                    <div class="rounded border border-gray-5 p-2 text-xs text-gray-10">
                        Expanded K-map grid omitted for this input count; compressed regions above
                        remain the optimizer source of truth.
                    </div>
                }
            >
                {(map) => (
                    <KMapGrid
                        map={map()}
                        terms={props.output.sop.terms}
                        selectedGroupIndex={selectedGroupIndex()}
                    />
                )}
            </Show>
        </section>
    );
};

const OutputSummary: Component<{ output: BooleanOptimizedOutput }> = (props) => (
    <section class="space-y-2 rounded border border-gray-5 p-2">
        <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
                <div class="font-semibold">{props.output.output.label}</div>
                <div class="break-words text-xs text-gray-10">
                    SOP <code>{props.output.sop.expression}</code>; POS{" "}
                    <code>{props.output.pos.expression}</code>
                </div>
            </div>
            <div class="text-right text-xs text-gray-10">
                <div>{props.output.sop.terms.length} groups</div>
                <div>{props.output.sop.literalCount} literals</div>
            </div>
        </div>
    </section>
);

const OptimizerTabList: Component<{
    activeTab: OptimizerTabId;
    setActiveTab: (tab: OptimizerTabId) => void;
}> = (props) => (
    <div
        aria-label="Boolean optimizer sections"
        class="grid grid-cols-4 gap-1 rounded border border-gray-5 bg-gray-2 p-1"
        role="tablist"
    >
        <For each={OPTIMIZER_TABS}>
            {(tab) => (
                <button
                    aria-selected={props.activeTab === tab.id}
                    class={tabButtonClass(props.activeTab === tab.id)}
                    role="tab"
                    type="button"
                    onClick={() => props.setActiveTab(tab.id)}
                >
                    {tab.label}
                </button>
            )}
        </For>
    </div>
);

const OverviewTab: Component<{
    analysis: ApiAnalyzeBoolean_Result;
    controller: BooleanAnalysisController;
}> = (props) => (
    <div class="space-y-3">
        <button
            class="w-full rounded bg-gray-3 px-3 py-2 text-sm font-semibold hover:bg-gray-4 disabled:bg-gray-2 disabled:text-gray-8"
            type="button"
            disabled={props.controller.isSynthesizing}
            onClick={props.controller.createOptimizedCircuitInNewTab}
        >
            Create Optimized Circuit in New Tab
        </button>

        <section class="rounded border border-gray-5 p-2 text-xs">
            <div class="mb-1 font-semibold">Variables</div>
            <For each={props.analysis.variables}>
                {(variable) => (
                    <div class="flex justify-between gap-2">
                        <span>{variable.symbol}</span>
                        <span class="truncate text-gray-10">{variable.label}</span>
                    </div>
                )}
            </For>
        </section>

        <For each={props.analysis.optimizedOutputs}>
            {(output) => <OutputSummary output={output} />}
        </For>
    </div>
);

const CurrentTruthTableTab: Component<{ analysis: ApiAnalyzeBoolean_Result }> = (props) => (
    <div class="space-y-3">
        <For each={props.analysis.optimizedOutputs}>
            {(output) => (
                <OutputTruthTable
                    analysis={props.analysis}
                    output={output}
                    title="Current Truth Table"
                    valueLabel={output.output.label}
                    getValue={(row) => row.outputs[output.output.id] ?? "0"}
                />
            )}
        </For>
    </div>
);

const KarnaughRegionsTab: Component<{ analysis: ApiAnalyzeBoolean_Result }> = (props) => (
    <div class="space-y-3">
        <For each={props.analysis.optimizedOutputs}>
            {(output) => <KarnaughRegionView analysis={props.analysis} output={output} />}
        </For>
    </div>
);

const OptimizedTruthTableTab: Component<{ analysis: ApiAnalyzeBoolean_Result }> = (props) => (
    <div class="space-y-3">
        <For each={props.analysis.optimizedOutputs}>
            {(output) => (
                <OutputTruthTable
                    analysis={props.analysis}
                    output={output}
                    title="Optimized Truth Table"
                    valueLabel="optimized"
                    getValue={(row) => evaluateSop(output.sop.terms, row)}
                />
            )}
        </For>
    </div>
);

const OptimizerTabContent: Component<{
    activeTab: OptimizerTabId;
    analysis: ApiAnalyzeBoolean_Result;
    controller: BooleanAnalysisController;
}> = (props) => (
    <div class="min-h-0 overflow-auto pr-1">
        <Show when={props.activeTab === "overview"}>
            <OverviewTab analysis={props.analysis} controller={props.controller} />
        </Show>
        <Show when={props.activeTab === "current"}>
            <CurrentTruthTableTab analysis={props.analysis} />
        </Show>
        <Show when={props.activeTab === "karnaugh"}>
            <KarnaughRegionsTab analysis={props.analysis} />
        </Show>
        <Show when={props.activeTab === "optimized"}>
            <OptimizedTruthTableTab analysis={props.analysis} />
        </Show>
    </div>
);

export const BooleanAnalysisPanel: Component<BooleanAnalysisPanelProps> = (props) => {
    const result = () => props.controller.result;
    const issues = () => result()?.issues ?? [];
    const hasErrors = () => issues().some((issue) => issue.severity === "error");
    const [activeTab, setActiveTab] = createSignal<OptimizerTabId>("overview");
    const [panelPosition, setPanelPosition] = createSignal<PanelPosition>();
    const [isDragging, setIsDragging] = createSignal(false);
    let panelRef: HTMLElement | undefined;
    let dragState:
        | {
              offsetX: number;
              offsetY: number;
              pointerId: number;
          }
        | undefined;
    let pendingPosition: PanelPosition | undefined;
    let dragFrame: number | undefined;
    let dragHandle: HTMLDivElement | undefined;

    const clampPanelPosition = (position: PanelPosition): PanelPosition => {
        const panel = panelRef;
        const parent = panel?.parentElement;
        const parentRect = parent?.getBoundingClientRect();
        const panelWidth = panel?.offsetWidth ?? 560;
        const panelHeight = panel?.offsetHeight ?? 0;
        const parentWidth = parentRect?.width ?? window.innerWidth;
        const parentHeight = parentRect?.height ?? window.innerHeight;

        return {
            x: clamp(
                position.x,
                PANEL_MARGIN,
                Math.max(PANEL_MARGIN, parentWidth - panelWidth - PANEL_MARGIN),
            ),
            y: clamp(
                position.y,
                PANEL_MARGIN,
                Math.max(PANEL_MARGIN, parentHeight - panelHeight - PANEL_MARGIN),
            ),
        };
    };

    const schedulePanelPosition = (position: PanelPosition) => {
        pendingPosition = position;

        if (dragFrame !== undefined) return;

        dragFrame = window.requestAnimationFrame(() => {
            dragFrame = undefined;
            const nextPosition = pendingPosition;
            pendingPosition = undefined;
            if (nextPosition) setPanelPosition(nextPosition);
        });
    };

    const getPositionFromPointer = (
        event: Pick<MouseEvent | PointerEvent, "clientX" | "clientY">,
    ): PanelPosition | undefined => {
        if (!panelRef || !dragState) return undefined;

        const parentRect = panelRef.parentElement?.getBoundingClientRect();
        const originX = parentRect?.left ?? 0;
        const originY = parentRect?.top ?? 0;

        return clampPanelPosition({
            x: event.clientX - originX - dragState.offsetX,
            y: event.clientY - originY - dragState.offsetY,
        });
    };

    const onWindowDragMove = (event: MouseEvent | PointerEvent) => {
        if (!dragState) return;
        if ("pointerId" in event && event.pointerId !== dragState.pointerId) return;

        const nextPosition = getPositionFromPointer(event);
        if (nextPosition) schedulePanelPosition(nextPosition);
        event.preventDefault();
    };

    const endDragAtPosition = (event?: MouseEvent | PointerEvent) => {
        if (!dragState) return;

        const nextPosition = event ? getPositionFromPointer(event) : pendingPosition;
        if (dragFrame !== undefined) {
            window.cancelAnimationFrame(dragFrame);
            dragFrame = undefined;
        }
        pendingPosition = undefined;
        if (nextPosition) setPanelPosition(nextPosition);

        if (dragHandle) {
            try {
                dragHandle.releasePointerCapture(dragState.pointerId);
            } catch {
                // Pointer capture may already be released when the drag is cancelled.
            }
        }

        window.removeEventListener("pointermove", onWindowDragMove);
        window.removeEventListener("pointerup", onWindowDragEnd);
        window.removeEventListener("pointercancel", onWindowDragEnd);
        window.removeEventListener("mousemove", onWindowDragMove);
        window.removeEventListener("mouseup", onWindowDragEnd);

        dragState = undefined;
        setIsDragging(false);
    };

    const onWindowDragEnd = (event: MouseEvent | PointerEvent) => {
        if ("pointerId" in event && dragState && event.pointerId !== dragState.pointerId) return;
        endDragAtPosition(event);
    };

    const onDragPointerDown: JSX.EventHandlerUnion<HTMLDivElement, PointerEvent> = (event) => {
        if (event.button !== 0 || !panelRef) return;

        const panelRect = panelRef.getBoundingClientRect();
        const parentRect = panelRef.parentElement?.getBoundingClientRect();
        const originX = parentRect?.left ?? 0;
        const originY = parentRect?.top ?? 0;

        dragState = {
            offsetX: event.clientX - panelRect.left,
            offsetY: event.clientY - panelRect.top,
            pointerId: event.pointerId,
        };

        setPanelPosition(
            clampPanelPosition({
                x: panelRect.left - originX,
                y: panelRect.top - originY,
            }),
        );
        setIsDragging(true);
        dragHandle = event.currentTarget;
        event.currentTarget.setPointerCapture(event.pointerId);
        window.addEventListener("pointermove", onWindowDragMove);
        window.addEventListener("pointerup", onWindowDragEnd);
        window.addEventListener("pointercancel", onWindowDragEnd);
        window.addEventListener("mousemove", onWindowDragMove);
        window.addEventListener("mouseup", onWindowDragEnd);
        event.preventDefault();
    };

    const onDragPointerMove: JSX.EventHandlerUnion<HTMLDivElement, PointerEvent> = (event) => {
        if (!dragState || event.pointerId !== dragState.pointerId) return;

        const nextPosition = getPositionFromPointer(event);
        if (nextPosition) schedulePanelPosition(nextPosition);
    };

    const endDrag: JSX.EventHandlerUnion<HTMLDivElement, PointerEvent> = (event) => {
        if (!dragState || event.pointerId !== dragState.pointerId) return;
        endDragAtPosition(event);
    };

    const panelStyle = (): JSX.CSSProperties => {
        const position = panelPosition();

        if (!position) {
            return {
                right: `${PANEL_MARGIN}px`,
                top: `${PANEL_MARGIN}px`,
            };
        }

        return {
            left: `${position.x}px`,
            right: "auto",
            top: `${position.y}px`,
        };
    };

    const onWindowResize = () => {
        const position = panelPosition();
        if (position) setPanelPosition(clampPanelPosition(position));
    };

    window.addEventListener("resize", onWindowResize);

    onCleanup(() => {
        window.removeEventListener("resize", onWindowResize);
        endDragAtPosition();
        if (dragFrame !== undefined) window.cancelAnimationFrame(dragFrame);
    });

    return (
        <Show when={props.controller.isOpen}>
            <aside
                ref={panelRef}
                class="absolute z-20 flex max-h-[calc(100%-1.5rem)] w-[560px] flex-col gap-3 overflow-hidden rounded-md border border-gray-5 bg-gray-1/95 p-3 text-gray-12 shadow-xl"
                style={panelStyle()}
            >
                <div class="flex items-center justify-between gap-2">
                    <div
                        aria-label="Drag Boolean optimizer panel"
                        class={`-m-1 min-w-0 flex-1 select-none rounded p-1 ${
                            isDragging() ? "cursor-grabbing" : "cursor-grab"
                        }`}
                        onPointerCancel={endDrag}
                        onPointerDown={onDragPointerDown}
                        onPointerMove={onDragPointerMove}
                        onPointerUp={endDrag}
                        title="Drag to move the Boolean optimizer panel"
                    >
                        <h2 class="text-sm font-semibold">Boolean optimizer</h2>
                        <p class="text-xs text-gray-10">
                            {props.controller.isBusy
                                ? "Analyzing active scope..."
                                : props.controller.isSynthesizing
                                  ? "Creating optimized circuit..."
                                  : "Active scope analysis"}
                        </p>
                    </div>
                    <button
                        class="rounded bg-gray-3 px-2 py-1 text-xs hover:bg-gray-4"
                        type="button"
                        onClick={props.controller.close}
                    >
                        Close
                    </button>
                </div>

                <div class="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
                    <Show when={props.controller.error}>
                        {(error) => (
                            <div class="rounded border border-red-6 bg-red-2 px-3 py-2 text-sm text-red-11">
                                {error()}
                            </div>
                        )}
                    </Show>

                    <Show when={result()}>
                        {(analysis) => (
                            <>
                                <div class="grid grid-cols-3 gap-2 text-xs">
                                    <div class="rounded border border-gray-5 p-2">
                                        <div class="text-gray-10">Inputs</div>
                                        <div class="text-base font-semibold">
                                            {analysis().variables.length}
                                        </div>
                                    </div>
                                    <div class="rounded border border-gray-5 p-2">
                                        <div class="text-gray-10">Outputs</div>
                                        <div class="text-base font-semibold">
                                            {analysis().outputs.length}
                                        </div>
                                    </div>
                                    <div class="rounded border border-gray-5 p-2">
                                        <div class="text-gray-10">Gates</div>
                                        <div class="text-base font-semibold">
                                            {analysis().originalGateCount} {"->"}{" "}
                                            {analysis().optimizedGateCount}
                                        </div>
                                    </div>
                                </div>

                                <Show when={issues().length}>
                                    <div class="space-y-1">
                                        <For each={issues()}>
                                            {(issue) => (
                                                <div
                                                    class={`rounded border px-2 py-1 text-xs ${
                                                        issue.severity === "error"
                                                            ? "border-red-6 bg-red-2 text-red-11"
                                                            : "border-yellow-6 bg-yellow-2 text-yellow-11"
                                                    }`}
                                                >
                                                    {issue.message}
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </Show>

                                <Show when={!hasErrors()}>
                                    <div class="flex min-h-0 flex-col gap-3">
                                        <OptimizerTabList
                                            activeTab={activeTab()}
                                            setActiveTab={setActiveTab}
                                        />
                                        <OptimizerTabContent
                                            activeTab={activeTab()}
                                            analysis={analysis()}
                                            controller={props.controller}
                                        />
                                    </div>
                                </Show>
                            </>
                        )}
                    </Show>
                </div>
            </aside>
        </Show>
    );
};
