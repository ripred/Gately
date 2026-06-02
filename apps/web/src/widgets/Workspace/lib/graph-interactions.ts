/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Graph } from "@antv/x6";
import type { OptimizedCircuitRoutingConfig } from "@gately/features/boolean-analysis/model/optimizedCircuitLayout";
import { rerouteWorkspaceEdges } from "./auto-layout";
import type { ContextTarget } from "./types";

type AttachWorkspaceGraphInteractionsOptions = {
    graph: Graph;
    openContextMenuAt: (x: number, y: number, target: ContextTarget) => void;
    closeContextMenu: () => void;
    setMenuTarget: (target: ContextTarget) => void;
    bumpSelection: () => void;
    getRoutingConfig: () => OptimizedCircuitRoutingConfig;
};

const EDGE_SELECTED_CLASS = "edge-selected";

const shouldIgnoreKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return false;
    const tag = target.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if (target.isContentEditable) return true;
    return false;
};

const addEdgeSelectedClass = (edge: any) => {
    const current = (edge?.getAttrByPath?.("line/class") ?? "") as string;
    const tokens = current.split(/\s+/).filter(Boolean);
    if (tokens.includes(EDGE_SELECTED_CLASS)) return;
    tokens.push(EDGE_SELECTED_CLASS);
    edge?.setAttrByPath?.("line/class", tokens.join(" ").trim());
};

const removeEdgeSelectedClass = (edge: any) => {
    const current = (edge?.getAttrByPath?.("line/class") ?? "") as string;
    const tokens = current.split(/\s+/).filter(Boolean);
    const next = tokens.filter((t) => t !== EDGE_SELECTED_CLASS);
    edge?.setAttrByPath?.("line/class", next.join(" ").trim());
};

const enforceNodePriority = (graph: Graph) => {
    const selected = graph.getSelectedCells?.() ?? [];
    const hasNode = selected.some((c) => c?.isNode?.());
    if (!hasNode) return;
    const edges = selected.filter((c) => c?.isEdge?.());
    if (!edges.length) return;
    graph.unselect(edges);
};

export const attachWorkspaceGraphInteractions = (
    opts: AttachWorkspaceGraphInteractionsOptions,
): (() => void) => {
    const { graph, openContextMenuAt, closeContextMenu, setMenuTarget, bumpSelection } = opts;
    let rerouteTimer: number | undefined;
    let isRerouting = false;

    const scheduleReroute = () => {
        if (isRerouting) return;
        if (rerouteTimer !== undefined) {
            window.clearTimeout(rerouteTimer);
        }
        rerouteTimer = window.setTimeout(() => {
            rerouteTimer = undefined;
            isRerouting = true;
            try {
                rerouteWorkspaceEdges(graph, opts.getRoutingConfig());
            } catch (error) {
                console.error("[workspace-routing] deterministic reroute failed", error);
            } finally {
                isRerouting = false;
            }
        }, 0);
    };

    const onCellContextMenu = ({ cell, e }: any) => {
        if (!cell || !e) return;
        if (!cell.isNode?.() && !cell.isEdge?.()) return;
        e.preventDefault();
        const additive = e?.shiftKey || e?.ctrlKey || e?.metaKey;
        if (graph.isSelected(cell)) {
            // keep current multi-selection
        } else if (additive) {
            if (!graph.isSelected(cell)) graph.select(cell);
        } else {
            graph.resetSelection(cell);
        }
        bumpSelection();
        enforceNodePriority(graph);
        openContextMenuAt(e.clientX, e.clientY, cell.isNode?.() ? "node" : "edge");
    };

    const onBlankContextMenu = ({ e }: any) => {
        e?.preventDefault?.();
        setMenuTarget("blank");
        bumpSelection();
        closeContextMenu();
    };

    const onKeyDown = (e: KeyboardEvent) => {
        if (shouldIgnoreKey(e)) return;
        if (e.key !== "Delete" && e.key !== "Backspace") return;
        const selected = graph.getSelectedCells?.() ?? [];
        if (!selected.length) return;
        e.preventDefault();
        graph.removeCells(selected);
    };

    const onEdgeSelected = ({ edge }: any) => {
        addEdgeSelectedClass(edge);
    };

    const onEdgeUnselected = ({ edge }: any) => {
        removeEdgeSelectedClass(edge);
    };

    const onSelectionChanged = () => {
        enforceNodePriority(graph);
        bumpSelection();
    };

    graph.on("cell:selected", bumpSelection);
    graph.on("cell:unselected", bumpSelection);
    graph.on("edge:selected", onEdgeSelected);
    graph.on("edge:unselected", onEdgeUnselected);
    graph.on("edge:connected", scheduleReroute);
    graph.on("edge:change:vertices", scheduleReroute);
    graph.on("node:moved", scheduleReroute);
    graph.on("node:change:position", scheduleReroute);
    graph.on("selection:changed", onSelectionChanged);
    graph.on("cell:contextmenu", onCellContextMenu);
    graph.on("blank:contextmenu", onBlankContextMenu);
    window.addEventListener("keydown", onKeyDown);

    return () => {
        graph.off("cell:selected", bumpSelection);
        graph.off("cell:unselected", bumpSelection);
        graph.off("edge:selected", onEdgeSelected);
        graph.off("edge:unselected", onEdgeUnselected);
        graph.off("edge:connected", scheduleReroute);
        graph.off("edge:change:vertices", scheduleReroute);
        graph.off("node:moved", scheduleReroute);
        graph.off("node:change:position", scheduleReroute);
        graph.off("selection:changed", onSelectionChanged);
        graph.off("cell:contextmenu", onCellContextMenu);
        graph.off("blank:contextmenu", onBlankContextMenu);
        if (rerouteTimer !== undefined) window.clearTimeout(rerouteTimer);
        window.removeEventListener("keydown", onKeyDown);
    };
};
