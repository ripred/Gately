import {
    WORKBENCH_EXPLORER_WIDTH_LIMITS,
    type AppConfigurationController,
    type WorkbenchExplorerSectionKey,
} from "@gately/app/providers/AppConfigurationProvider";
import { useUIEngine, type UIEngineScope } from "@gately/shared/infrastructure";
import { Pusher } from "@gately/shared/ui";
import type { WorkspaceController } from "../lib/types";
import {
    buildProjectExplorerTree,
    type ProjectExplorerNode,
    type ProjectExplorerNodeKind,
} from "./projectExplorerTree";
import type { WorkspaceViewMode } from "./workbenchTypes";
import { Component, createMemo, createSignal, For, JSX, onCleanup, Show } from "solid-js";

type WorkspaceProjectSidebarProps = Pick<
    WorkspaceController,
    "customComponents" | "persistence"
> & {
    collapsed: boolean;
    configuration: AppConfigurationController;
    mode: WorkspaceViewMode;
    setMode: (mode: WorkspaceViewMode) => void;
    toggleCollapsed: () => void;
};

const treeLabelButtonClass =
    "flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-left text-xs";

const projectTreeLabelButtonClass =
    "flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-left text-xs";

const miniButtonClass =
    "rounded border border-gray-5 bg-gray-3 px-2 py-1 text-[11px] text-gray-12 hover:bg-gray-4 data-disabled:text-gray-8 data-disabled:hover:bg-gray-3";

const TreeChevron: Component<{ expanded?: boolean; visible: boolean }> = (props) => (
    <svg
        aria-hidden="true"
        class={[
            "h-3 w-3 text-gray-9 transition-transform",
            props.visible ? "" : "opacity-0",
            props.expanded ? "rotate-90" : "",
        ].join(" ")}
        viewBox="0 0 16 16"
    >
        <path
            d="M6 4l4 4-4 4"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.8"
        />
    </svg>
);

const TreeNodeIcon: Component<{ kind: ProjectExplorerNodeKind; expanded?: boolean }> = (props) => {
    const filePath = () => {
        switch (props.kind) {
            case "component":
                return "M5 3h5l3 3v7H5z M10 3v3h3";
            case "settings":
                return "M8 4.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z M8 2.5v2 M8 11.5v2 M2.5 8h2 M11.5 8h2 M3.75 3.75l1.4 1.4 M10.85 10.85l1.4 1.4 M12.25 3.75l-1.4 1.4 M5.15 10.85l-1.4 1.4";
            case "status":
                return "M4 3h8v10H4z M6 6h4 M6 9h3";
            default:
                return "M5 3h5l3 3v7H5z M10 3v3h3";
        }
    };

    return (
        <Show
            when={props.kind === "folder"}
            fallback={
                <svg
                    aria-hidden="true"
                    class="h-3.5 w-3.5 shrink-0 text-gray-9"
                    viewBox="0 0 16 16"
                >
                    <path
                        d={filePath()}
                        fill="none"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.35"
                    />
                </svg>
            }
        >
            <svg aria-hidden="true" class="h-3.5 w-3.5 shrink-0 text-gray-9" viewBox="0 0 16 16">
                <path
                    d={props.expanded ? "M2 6h12l-1 6H3z M2 5h4l1 1h7" : "M2 5h4l1 1h7v6H2z"}
                    fill="none"
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.35"
                />
            </svg>
        </Show>
    );
};

const ExplorerTreeSection: Component<{
    children?: JSX.Element;
    configuration: AppConfigurationController;
    sectionKey: WorkbenchExplorerSectionKey;
    title: string;
}> = (props) => {
    const expanded = () =>
        props.configuration.workbenchConfig().expandedExplorerSections[props.sectionKey];
    const toggleExpanded = () =>
        props.configuration.setWorkbenchConfig({
            expandedExplorerSections: {
                [props.sectionKey]: !expanded(),
            },
        });

    return (
        <section class="border-b border-gray-4 py-2">
            <button
                class="flex w-full items-center gap-2 px-3 pb-1 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-9 hover:text-gray-11"
                aria-expanded={expanded()}
                onClick={toggleExpanded}
            >
                <span class="w-3 text-center">{expanded() ? "v" : ">"}</span>
                <span>{props.title}</span>
            </button>
            <Show when={expanded()}>
                <div>{props.children}</div>
            </Show>
        </section>
    );
};

export const WorkspaceProjectSidebar: Component<WorkspaceProjectSidebarProps> = (props) => {
    const uiEngine = useUIEngine();
    const [collapsedScopeIds, setCollapsedScopeIds] = createSignal<Record<string, boolean>>(
        {},
    );
    const [collapsedProjectNodeIds, setCollapsedProjectNodeIds] = createSignal<
        Record<string, boolean>
    >({});
    const [resizePreviewWidth, setResizePreviewWidth] = createSignal<number>();
    let resizeStartX = 0;
    let resizeStartWidth = 0;
    const activeScopeId = () => uiEngine.state.activeScopeId();
    const activeTabId = () => uiEngine.state.activeTabId();
    const activeRootScope = () => {
        const tabId = activeTabId();
        return tabId ? uiEngine.state.getScopeById(tabId) : undefined;
    };
    const customComponents = () => props.customComponents.components();
    const scopeChildren = (scopeId: string) => uiEngine.state.getScopeChildrenById(scopeId);
    const projectTree = createMemo(() =>
        buildProjectExplorerTree({
            components: customComponents(),
            getScopeById: uiEngine.state.getScopeById,
            getScopeChildrenById: uiEngine.state.getScopeChildrenById,
            hasSavedWorkspace: props.persistence.hasSavedWorkspace(),
            tabs: uiEngine.state.tabs(),
        }),
    );
    const canCloseCircuit = (tabId: string) => uiEngine.commands.canCloseTab(tabId);
    const sidebarWidth = () =>
        resizePreviewWidth() ?? props.configuration.workbenchConfig().explorerWidth;
    const clampExplorerWidth = (width: number) =>
        Math.min(
            WORKBENCH_EXPLORER_WIDTH_LIMITS.max,
            Math.max(WORKBENCH_EXPLORER_WIDTH_LIMITS.min, width),
        );
    const scopeExpanded = (scope: UIEngineScope) =>
        scope.childrenIds.length > 0 && !collapsedScopeIds()[scope.id];
    const projectNodeExpanded = (node: ProjectExplorerNode) =>
        Boolean(node.children?.length) && !collapsedProjectNodeIds()[node.id];
    const toggleScopeExpanded = (scopeId: string) => {
        setCollapsedScopeIds((current) => ({
            ...current,
            [scopeId]: !current[scopeId],
        }));
    };
    const toggleProjectNodeExpanded = (nodeId: string) => {
        setCollapsedProjectNodeIds((current) => ({
            ...current,
            [nodeId]: !current[nodeId],
        }));
    };
    const openCircuit = (tabId: string) => {
        uiEngine.commands.openTab(tabId);
        props.setMode("circuit");
    };
    const openScope = (scopeId: string, tabId?: string) => {
        uiEngine.commands.openScope(scopeId, tabId);
        props.setMode("circuit");
    };
    const closeCircuit = async (tabId: string) => {
        try {
            await uiEngine.commands.closeTab(tabId);
            props.setMode("circuit");
        } catch (error) {
            window.alert(error instanceof Error ? error.message : "Unable to close circuit.");
        }
    };
    const handleSidebarResizeMove = (event: PointerEvent) => {
        const scaledDelta = (event.clientX - resizeStartX) / props.configuration.uiScale();
        const nextWidth = Math.round(resizeStartWidth + scaledDelta);
        setResizePreviewWidth(clampExplorerWidth(nextWidth));
    };
    const stopSidebarResize = (commit: boolean) => {
        window.removeEventListener("pointermove", handleSidebarResizeMove);
        window.removeEventListener("pointerup", handleSidebarResizeUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";

        if (commit) {
            props.configuration.setWorkbenchConfig({ explorerWidth: sidebarWidth() });
        }
        setResizePreviewWidth(undefined);
    };
    const handleSidebarResizeUp = () => stopSidebarResize(true);
    const startSidebarResize = (event: PointerEvent) => {
        if (props.collapsed) return;

        event.preventDefault();
        resizeStartX = event.clientX;
        resizeStartWidth = sidebarWidth();
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        window.addEventListener("pointermove", handleSidebarResizeMove);
        window.addEventListener("pointerup", handleSidebarResizeUp);
    };
    const resizeSidebarBy = (delta: number) => {
        props.configuration.setWorkbenchConfig({
            explorerWidth: clampExplorerWidth(sidebarWidth() + delta),
        });
    };
    const handleSidebarResizeKeyDown = (event: KeyboardEvent) => {
        switch (event.key) {
            case "ArrowLeft":
                event.preventDefault();
                resizeSidebarBy(-24);
                break;
            case "ArrowRight":
                event.preventDefault();
                resizeSidebarBy(24);
                break;
            case "Home":
                event.preventDefault();
                props.configuration.setWorkbenchConfig({
                    explorerWidth: WORKBENCH_EXPLORER_WIDTH_LIMITS.min,
                });
                break;
            case "End":
                event.preventDefault();
                props.configuration.setWorkbenchConfig({
                    explorerWidth: WORKBENCH_EXPLORER_WIDTH_LIMITS.max,
                });
                break;
        }
    };
    const openTreeScope = (scope: UIEngineScope, tabId?: string) => {
        if (scope.kind === "tab") {
            openCircuit(tabId ?? scope.id);
            return;
        }

        openScope(scope.id, tabId);
    };
    const activateProjectNode = (node: ProjectExplorerNode) => {
        if (node.scopeId) {
            if (node.scopeId === node.tabId) {
                openCircuit(node.tabId);
            } else {
                openScope(node.scopeId, node.tabId);
            }
            return;
        }

        if (node.kind === "settings") {
            props.setMode("settings");
            return;
        }

        if (node.kind === "component" && node.hash) {
            void props.customComponents.addComponent(node.hash);
            return;
        }

        if (node.children?.length) {
            toggleProjectNodeExpanded(node.id);
        }
    };
    const projectNodeIsActive = (node: ProjectExplorerNode) => {
        if (node.kind === "settings") return props.mode === "settings";
        if (!node.scopeId) return false;
        return props.mode === "circuit" && node.scopeId === activeScopeId();
    };

    const ScopeTreeNode: Component<{
        depth: number;
        forceDirectory?: boolean;
        scope: UIEngineScope;
        tabId?: string;
        withClose?: boolean;
    }> = (nodeProps) => {
        const children = () => scopeChildren(nodeProps.scope.id);
        const hasChildren = () => children().length > 0;
        const isDirectory = () =>
            Boolean(nodeProps.forceDirectory) || nodeProps.scope.kind === "tab" || hasChildren();
        const expanded = () => scopeExpanded(nodeProps.scope);
        const rowIsActive = () =>
            props.mode === "circuit" && nodeProps.scope.id === activeScopeId();

        return (
            <div>
                <div
                    role="treeitem"
                    aria-expanded={hasChildren() ? expanded() : undefined}
                    class={[
                        "group flex min-w-0 items-center hover:bg-gray-3",
                        rowIsActive() ? "bg-primary-3 text-primary-11" : "text-gray-11",
                    ].join(" ")}
                    style={{ "padding-left": `${10 + nodeProps.depth * 14}px` }}
                >
                    <button
                        class="flex h-7 w-5 shrink-0 items-center justify-center rounded text-gray-9 hover:bg-gray-4 hover:text-gray-12 disabled:hover:bg-transparent"
                        disabled={!hasChildren()}
                        onClick={() => toggleScopeExpanded(nodeProps.scope.id)}
                        title={hasChildren() ? "Expand or collapse" : undefined}
                    >
                        <TreeChevron visible={hasChildren()} expanded={expanded()} />
                    </button>
                    <button
                        class={treeLabelButtonClass}
                        onClick={() => openTreeScope(nodeProps.scope, nodeProps.tabId)}
                    >
                        <TreeNodeIcon kind={isDirectory() ? "folder" : "circuit"} expanded={expanded()} />
                        <span class="truncate">{nodeProps.scope.name}</span>
                    </button>
                    <Show when={nodeProps.withClose}>
                        <button
                            class="mx-1 rounded px-1.5 py-0.5 text-[11px] text-gray-9 hover:bg-gray-4 hover:text-gray-12 disabled:cursor-not-allowed disabled:text-gray-7 disabled:hover:bg-transparent"
                            disabled={!canCloseCircuit(nodeProps.scope.id)}
                            onClick={(event) => {
                                event.stopPropagation();
                                void closeCircuit(nodeProps.scope.id);
                            }}
                            title={
                                canCloseCircuit(nodeProps.scope.id)
                                    ? "Close circuit"
                                    : "Keep at least one circuit open"
                            }
                        >
                            X
                        </button>
                    </Show>
                </div>
                <Show when={hasChildren() && expanded()}>
                    <div role="group">
                        <For each={children()}>
                            {(child) => (
                                <ScopeTreeNode
                                    depth={nodeProps.depth + 1}
                                    scope={child}
                                    tabId={nodeProps.tabId ?? nodeProps.scope.id}
                                />
                            )}
                        </For>
                    </div>
                </Show>
            </div>
        );
    };

    const ProjectTreeNode: Component<{
        depth: number;
        node: ProjectExplorerNode;
    }> = (nodeProps) => {
        const children = () => nodeProps.node.children ?? [];
        const hasChildren = () => children().length > 0;
        const expanded = () => projectNodeExpanded(nodeProps.node);
        const rowIsActive = () => projectNodeIsActive(nodeProps.node);
        const isClosableTab = () =>
            Boolean(nodeProps.node.scopeId && nodeProps.node.scopeId === nodeProps.node.tabId);
        const closeTabId = () => nodeProps.node.tabId;

        return (
            <div>
                <div
                    role="treeitem"
                    aria-expanded={hasChildren() ? expanded() : undefined}
                    aria-selected={rowIsActive()}
                    class={[
                        "group flex min-w-0 items-center hover:bg-gray-3",
                        rowIsActive() ? "bg-primary-3 text-primary-11" : "text-gray-11",
                    ].join(" ")}
                    style={{ "padding-left": `${10 + nodeProps.depth * 14}px` }}
                >
                    <button
                        class="flex h-7 w-5 shrink-0 items-center justify-center rounded text-gray-9 hover:bg-gray-4 hover:text-gray-12 disabled:hover:bg-transparent"
                        disabled={!hasChildren()}
                        onClick={() => toggleProjectNodeExpanded(nodeProps.node.id)}
                        title={hasChildren() ? "Expand or collapse" : undefined}
                    >
                        <TreeChevron visible={hasChildren()} expanded={expanded()} />
                    </button>
                    <button
                        class={projectTreeLabelButtonClass}
                        disabled={nodeProps.node.kind === "status"}
                        onClick={() => activateProjectNode(nodeProps.node)}
                        title={nodeProps.node.detail}
                    >
                        <TreeNodeIcon kind={nodeProps.node.kind} expanded={expanded()} />
                        <span class="min-w-0 flex-1 truncate">{nodeProps.node.label}</span>
                        <Show when={nodeProps.node.detail}>
                            <span class="shrink-0 truncate text-[10px] text-gray-8">
                                {nodeProps.node.detail}
                            </span>
                        </Show>
                    </button>
                    <Show when={isClosableTab()}>
                        <button
                            class="mx-1 rounded px-1.5 py-0.5 text-[11px] text-gray-9 hover:bg-gray-4 hover:text-gray-12 disabled:cursor-not-allowed disabled:text-gray-7 disabled:hover:bg-transparent"
                            disabled={!canCloseCircuit(closeTabId()!)}
                            onClick={(event) => {
                                event.stopPropagation();
                                void closeCircuit(closeTabId()!);
                            }}
                            title={
                                canCloseCircuit(closeTabId()!)
                                    ? "Close circuit"
                                    : "Keep at least one circuit open"
                            }
                        >
                            X
                        </button>
                    </Show>
                </div>
                <Show when={hasChildren() && expanded()}>
                    <div role="group">
                        <For each={children()}>
                            {(child) => <ProjectTreeNode depth={nodeProps.depth + 1} node={child} />}
                        </For>
                    </div>
                </Show>
            </div>
        );
    };

    onCleanup(() => stopSidebarResize(false));

    return (
        <aside
            class={[
                "relative flex min-h-0 shrink-0 flex-col border-r border-gray-4 bg-gray-2 text-gray-12 transition-[width] duration-150",
                props.collapsed ? "w-12" : "",
            ].join(" ")}
            style={props.collapsed ? undefined : { width: `${sidebarWidth()}px` }}
            aria-label="Project explorer"
        >
            <Show when={!props.collapsed}>
                <button
                    aria-label="Resize project explorer"
                    aria-orientation="vertical"
                    aria-valuemax={WORKBENCH_EXPLORER_WIDTH_LIMITS.max}
                    aria-valuemin={WORKBENCH_EXPLORER_WIDTH_LIMITS.min}
                    aria-valuenow={sidebarWidth()}
                    class="absolute inset-y-0 right-[-3px] z-10 w-1.5 cursor-col-resize bg-transparent hover:bg-primary-6"
                    role="separator"
                    onKeyDown={handleSidebarResizeKeyDown}
                    onPointerDown={startSidebarResize}
                    title="Resize explorer"
                />
            </Show>
            <div class="flex h-9 items-center justify-between border-b border-gray-4 px-2">
                <Show when={!props.collapsed}>
                    <span class="text-xs font-semibold uppercase tracking-wide text-gray-10">
                        Explorer
                    </span>
                </Show>
                <button
                    class="rounded px-2 py-1 text-xs text-gray-11 hover:bg-gray-3 hover:text-gray-12"
                    onClick={props.toggleCollapsed}
                    title={props.collapsed ? "Expand explorer" : "Collapse explorer"}
                >
                    {props.collapsed ? ">" : "<"}
                </button>
            </div>

            <Show
                when={!props.collapsed}
                fallback={
                    <div class="flex flex-col items-center gap-2 py-3 text-[11px] text-gray-10">
                        <button
                            class="rounded px-2 py-1 hover:bg-gray-3"
                            onClick={() => props.setMode("circuit")}
                            title="Circuit"
                        >
                            C
                        </button>
                        <button
                            class="rounded px-2 py-1 hover:bg-gray-3"
                            onClick={() => props.setMode("settings")}
                            title="Settings"
                        >
                            S
                        </button>
                        <button
                            class="rounded px-2 py-1 hover:bg-gray-3"
                            onClick={props.persistence.createTab}
                            title="New circuit"
                        >
                            +
                        </button>
                    </div>
                }
            >
                <div class="min-h-0 flex-1 overflow-auto">
                    <ExplorerTreeSection
                        configuration={props.configuration}
                        sectionKey="project"
                        title="Project"
                    >
                        <div role="tree" aria-label="Project workspace tree">
                            <ProjectTreeNode depth={0} node={projectTree()} />
                        </div>
                        <div class="flex flex-wrap gap-1 px-3 pb-2">
                            <Pusher
                                class={miniButtonClass}
                                onClick={props.persistence.createTab}
                                disabled={props.persistence.isBusy}
                            >
                                New
                            </Pusher>
                            <Pusher
                                class={miniButtonClass}
                                onClick={props.persistence.saveWorkspace}
                                disabled={props.persistence.isBusy}
                            >
                                Save
                            </Pusher>
                            <Pusher
                                class={miniButtonClass}
                                onClick={props.persistence.loadWorkspace}
                                disabled={
                                    props.persistence.isBusy ||
                                    !props.persistence.hasSavedWorkspace()
                                }
                            >
                                Load
                            </Pusher>
                        </div>
                    </ExplorerTreeSection>

                    <ExplorerTreeSection
                        configuration={props.configuration}
                        sectionKey="circuits"
                        title="Open Circuits"
                    >
                        <Show
                            when={uiEngine.state.tabs().length > 0}
                            fallback={
                                <p class="px-3 py-2 text-xs text-gray-9">No open circuits.</p>
                            }
                        >
                            <For each={uiEngine.state.tabs()}>
                                {(tab) => (
                                    <Show when={uiEngine.state.getScopeById(tab.id)}>
                                        {(scope) => (
                                            <div role="tree" aria-label={`${tab.name} scope tree`}>
                                                <ScopeTreeNode
                                                    depth={0}
                                                    forceDirectory
                                                    scope={scope()}
                                                    tabId={tab.id}
                                                    withClose
                                                />
                                            </div>
                                        )}
                                    </Show>
                                )}
                            </For>
                        </Show>
                    </ExplorerTreeSection>

                    <ExplorerTreeSection
                        configuration={props.configuration}
                        sectionKey="navigation"
                        title="Current Circuit Tree"
                    >
                        <Show
                            when={activeRootScope()}
                            fallback={<p class="px-3 py-2 text-xs text-gray-9">No open circuit.</p>}
                        >
                            <div role="tree" aria-label="Current circuit scope tree">
                                <ScopeTreeNode
                                    depth={0}
                                    forceDirectory
                                    scope={activeRootScope()!}
                                    tabId={activeTabId()}
                                />
                            </div>
                        </Show>
                    </ExplorerTreeSection>

                    <ExplorerTreeSection
                        configuration={props.configuration}
                        sectionKey="components"
                        title="Components"
                    >
                        <Show
                            when={customComponents().length > 0}
                            fallback={<p class="px-3 py-2 text-xs text-gray-9">No saved parts.</p>}
                        >
                            <For each={customComponents()}>
                                {(component) => (
                                    <button
                                        class="flex w-full items-center gap-2 px-3 py-1 text-left text-xs text-gray-11 hover:bg-gray-3"
                                        onClick={() =>
                                            props.customComponents.addComponent(component.hash)
                                        }
                                    >
                                        <span class="text-gray-9">[]</span>
                                        <span class="truncate">{component.name}</span>
                                    </button>
                                )}
                            </For>
                        </Show>
                    </ExplorerTreeSection>

                    <ExplorerTreeSection
                        configuration={props.configuration}
                        sectionKey="workbench"
                        title="Workbench"
                    >
                        <button
                            class={[
                                "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-3",
                                props.mode === "settings" ? "bg-primary-3 text-primary-11" : "",
                            ].join(" ")}
                            onClick={() => props.setMode("settings")}
                        >
                            <span class="text-gray-9">-</span>
                            <span>Settings</span>
                        </button>
                    </ExplorerTreeSection>
                </div>

                <div class="border-t border-gray-4 p-2">
                    <Pusher
                        class="w-full rounded border border-gray-5 bg-gray-3 px-2 py-1 text-xs text-gray-12 hover:bg-gray-4"
                        onClick={props.persistence.createTab}
                        disabled={props.persistence.isBusy}
                    >
                        New Circuit
                    </Pusher>
                </div>
            </Show>
        </aside>
    );
};
