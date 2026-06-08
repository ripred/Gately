import {
    WORKBENCH_EXPLORER_WIDTH_LIMITS,
    type AppConfigurationController,
    type WorkbenchExplorerSectionKey,
} from "@gately/app/providers/AppConfigurationProvider";
import { useUIEngine, type UIEngineScope } from "@gately/shared/infrastructure";
import { EditableText } from "@gately/shared/ui";
import { contextMenuStyles } from "@gately/shared/ui/ContextMenu/styles";
import type { WorkspaceController } from "../lib/types";
import {
    buildProjectExplorerTree,
    customComponentRuntimeStatus,
    type ProjectExplorerNode,
    type ProjectExplorerNodeKind,
} from "./projectExplorerTree";
import {
    Component,
    createMemo,
    createSignal,
    For,
    JSX,
    onCleanup,
    onMount,
    Show,
    type Setter,
} from "solid-js";

type WorkspaceProjectSidebarProps = Pick<
    WorkspaceController,
    "customComponents" | "persistence"
> & {
    collapsed: boolean;
    configuration: AppConfigurationController;
    onDirty: () => void;
    toggleCollapsed: () => void;
};

const treeLabelButtonClass =
    "flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-left text-xs";

const projectTreeLabelButtonClass =
    "flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-left text-xs";

type EntryMenuItem = {
    disabled?: boolean;
    label: string;
    onSelect?: () => void;
    separatorBefore?: boolean;
};

type EntryMenuState = {
    items: EntryMenuItem[];
    x: number;
    y: number;
};

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
                <TreeChevron expanded={expanded()} visible />
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
    const [renamingScopeId, setRenamingScopeId] = createSignal<string>();
    const [selectedExplorerEntryId, setSelectedExplorerEntryId] = createSignal<string>();
    const [entryMenu, setEntryMenu] = createSignal<EntryMenuState>();
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
            tabs: uiEngine.state.tabs(),
        }),
    );
    const canCloseCircuit = (tabId: string) => uiEngine.commands.canCloseTab(tabId);
    const isRenamingScope = (scopeId: string) => renamingScopeId() === scopeId;
    const renameScope = (scopeId: string, name: string) => {
        uiEngine.commands.renameScope(scopeId, name);
        props.onDirty();
    };
    const setScopeRenaming =
        (scopeId: string): Setter<boolean> =>
        (value) => {
            const current = isRenamingScope(scopeId);
            const next = typeof value === "function" ? value(current) : value;
            setRenamingScopeId(next ? scopeId : undefined);
            return next;
        };
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
    const scopeExplorerEntryId = (scopeId: string) => `scope:${scopeId}`;
    const componentExplorerEntryId = (hash: string) => `component:${hash}`;
    const explorerSelectionIsActive = (entryId: string) => {
        const selectedEntryId = selectedExplorerEntryId();
        return selectedEntryId ? selectedEntryId === entryId : false;
    };
    const selectScopeEntry = (scopeId: string) => {
        setSelectedExplorerEntryId(scopeExplorerEntryId(scopeId));
    };
    const selectProjectEntry = (nodeId: string) => {
        setSelectedExplorerEntryId(nodeId);
        if (nodeId.startsWith("component:")) {
            props.customComponents.setSelectedHash(nodeId.slice("component:".length));
        }
    };
    const selectComponentEntry = (hash: string) => {
        props.customComponents.setSelectedHash(hash);
        setSelectedExplorerEntryId(componentExplorerEntryId(hash));
    };
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
        selectScopeEntry(tabId);
        uiEngine.commands.openTab(tabId);
    };
    const openScope = (scopeId: string, tabId?: string) => {
        selectScopeEntry(scopeId);
        uiEngine.commands.openScope(scopeId, tabId);
    };
    const closeCircuit = async (tabId: string) => {
        try {
            const closed = await uiEngine.commands.closeTab(tabId);
            if (closed) props.onDirty();
        } catch (error) {
            window.alert(error instanceof Error ? error.message : "Unable to close circuit.");
        }
    };
    const closeEntryMenu = () => setEntryMenu(undefined);
    const isLeftMouseButton = (event: MouseEvent | PointerEvent) => event.button === 0;
    const openEntryMenu = (
        event: MouseEvent | PointerEvent,
        selectEntry: () => void,
        items: EntryMenuItem[],
    ) => {
        if (event.type !== "contextmenu") return;

        event.preventDefault();
        event.stopPropagation();
        selectEntry();
        if (!items.length) {
            closeEntryMenu();
            return;
        }
        setEntryMenu({
            items,
            x: event.clientX,
            y: event.clientY,
        });
    };
    const handleEntryMenuKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") closeEntryMenu();
    };
    onMount(() => window.addEventListener("keydown", handleEntryMenuKeyDown));
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
        selectProjectEntry(node.id);

        if (node.scopeId) {
            if (node.scopeId === node.tabId) {
                openCircuit(node.tabId);
            } else {
                openScope(node.scopeId, node.tabId);
            }
            return;
        }

        if (node.id === "project:workspace-storage") {
            void props.persistence.loadWorkspace();
            return;
        }

        if (node.kind === "component" && node.hash) {
            void props.customComponents.addComponent(node.hash);
            return;
        }

        // Folder expansion is handled by single-click on folder rows.
    };
    const projectNodeIsActive = (node: ProjectExplorerNode) => {
        const selectedEntryId = selectedExplorerEntryId();
        if (selectedEntryId) return selectedEntryId === node.id;

        if (!node.scopeId) return false;
        return node.scopeId === activeScopeId();
    };

    const ScopeNameCell: Component<{
        name: string;
        scopeId: string;
    }> = (cellProps) => {
        const startRename = (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            setRenamingScopeId(cellProps.scopeId);
        };

        return (
            <Show
                when={isRenamingScope(cellProps.scopeId)}
                fallback={
                    <span
                        class="min-w-0 flex-1 truncate"
                        onDblClick={startRename}
                        title="Double-click to rename"
                    >
                        {cellProps.name}
                    </span>
                }
            >
                <span
                    class="min-w-0 flex-1"
                    onClick={(event) => event.stopPropagation()}
                    onDblClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                >
                    <EditableText
                        inputClass="min-w-0 rounded bg-gray-1 px-1 text-xs text-gray-12 ring-1 ring-primary-7"
                        isEditing={() => isRenamingScope(cellProps.scopeId)}
                        setIsEditing={setScopeRenaming(cellProps.scopeId)}
                        title={() => cellProps.name}
                        updateTitle={(name) => renameScope(cellProps.scopeId, name)}
                    />
                </span>
            </Show>
        );
    };

    const scopeEntryMenuItems = (
        scope: UIEngineScope,
        tabId: string | undefined,
        hasChildren: boolean,
        expanded: boolean,
        withClose?: boolean,
    ): EntryMenuItem[] => {
        const items: EntryMenuItem[] = [
            {
                label: "Open",
                onSelect: () => openTreeScope(scope, tabId),
            },
            {
                label: "Rename",
                onSelect: () => setRenamingScopeId(scope.id),
            },
        ];

        if (hasChildren) {
            items.push({
                label: expanded ? "Collapse" : "Expand",
                onSelect: () => toggleScopeExpanded(scope.id),
                separatorBefore: true,
            });
        }

        if (withClose && canCloseCircuit(scope.id)) {
            items.push({
                label: "Close Circuit",
                onSelect: () => void closeCircuit(scope.id),
                separatorBefore: true,
            });
        }

        return items;
    };

    const projectEntryMenuItems = (
        node: ProjectExplorerNode,
        hasChildren: boolean,
        expanded: boolean,
    ): EntryMenuItem[] => {
        const items: EntryMenuItem[] = [];
        const isWorkspaceRoot = node.id === "project:gately-workspace";
        const isCircuitsFolder = node.id === "project:circuits";
        const isWorkspaceStorage = node.id === "project:workspace-storage";

        if ((isWorkspaceRoot || isCircuitsFolder) && !props.persistence.isBusy) {
            items.push({
                label: "New Circuit",
                onSelect: () => props.persistence.createTab(),
            });
        }

        if ((isWorkspaceRoot || isWorkspaceStorage) && !props.persistence.isBusy) {
            items.push({
                label: "Save Workspace",
                onSelect: () => void props.persistence.saveWorkspace(),
                separatorBefore: items.length > 0,
            });

            items.push({
                label: "Load Workspace",
                onSelect: () => void props.persistence.loadWorkspace(),
            });
        }

        if (node.scopeId) {
            items.push(
                {
                    label: "Open",
                    onSelect: () => activateProjectNode(node),
                    separatorBefore: items.length > 0,
                },
                {
                    label: "Rename",
                    onSelect: () => setRenamingScopeId(node.scopeId),
                },
            );
        }

        if (node.kind === "component" && node.hash) {
            items.push({
                label: "Insert Component",
                onSelect: () => {
                    if (node.hash) void props.customComponents.addComponent(node.hash);
                },
                separatorBefore: items.length > 0,
            });
        }

        if (hasChildren) {
            items.push({
                label: expanded ? "Collapse" : "Expand",
                onSelect: () => toggleProjectNodeExpanded(node.id),
                separatorBefore: items.length > 0,
            });
        }

        const tabId = node.tabId;
        if (node.scopeId && node.scopeId === tabId && tabId && canCloseCircuit(tabId)) {
            items.push({
                label: "Close Circuit",
                onSelect: () => void closeCircuit(tabId),
                separatorBefore: true,
            });
        }

        return items;
    };

    const componentEntryMenuItems = (component: {
        hash: string;
        name: string;
    }): EntryMenuItem[] => {
        if (props.customComponents.isBusy) return [];

        return [
            {
                label: "Insert Component",
                onSelect: () => {
                    selectComponentEntry(component.hash);
                    void props.customComponents.addComponent(component.hash);
                },
            },
            {
                label: "Rename Component",
                onSelect: () => {
                    selectComponentEntry(component.hash);
                    void props.customComponents.renameSelected();
                },
                separatorBefore: true,
            },
            {
                label: "Delete Component",
                onSelect: () => {
                    selectComponentEntry(component.hash);
                    void props.customComponents.removeSelected();
                },
            },
        ];
    };

    const ScopeTreeNode: Component<{
        depth: number;
        scope: UIEngineScope;
        tabId?: string;
        withClose?: boolean;
    }> = (nodeProps) => {
        const children = () => scopeChildren(nodeProps.scope.id);
        const hasChildren = () => children().length > 0;
        const expanded = () => scopeExpanded(nodeProps.scope);
        const rowIsActive = () => {
            const entryId = scopeExplorerEntryId(nodeProps.scope.id);
            if (selectedExplorerEntryId()) return explorerSelectionIsActive(entryId);

            return nodeProps.scope.id === activeScopeId();
        };
        const openScopeRowMenu = (event: MouseEvent | PointerEvent) =>
            openEntryMenu(
                event,
                () => selectScopeEntry(nodeProps.scope.id),
                scopeEntryMenuItems(
                    nodeProps.scope,
                    nodeProps.tabId,
                    hasChildren(),
                    expanded(),
                    nodeProps.withClose,
                ),
            );
        const handleScopeRowKeyDown = (event: KeyboardEvent) => {
            switch (event.key) {
                case "Enter":
                    event.preventDefault();
                    openTreeScope(nodeProps.scope, nodeProps.tabId);
                    break;
                case "ArrowRight":
                    if (hasChildren() && !expanded()) {
                        event.preventDefault();
                        toggleScopeExpanded(nodeProps.scope.id);
                    }
                    break;
                case "ArrowLeft":
                    if (hasChildren() && expanded()) {
                        event.preventDefault();
                        toggleScopeExpanded(nodeProps.scope.id);
                    }
                    break;
                case "F2":
                    event.preventDefault();
                    setRenamingScopeId(nodeProps.scope.id);
                    break;
            }
        };

        return (
            <div>
                <div
                    role="treeitem"
                    aria-expanded={hasChildren() ? expanded() : undefined}
                    aria-level={nodeProps.depth + 1}
                    aria-selected={rowIsActive()}
                    class={[
                        "group flex min-w-0 items-center hover:bg-gray-3",
                        rowIsActive() ? "bg-primary-3 text-primary-11" : "text-gray-11",
                    ].join(" ")}
                    onClick={(event) => {
                        if (isLeftMouseButton(event)) selectScopeEntry(nodeProps.scope.id);
                    }}
                    onContextMenu={openScopeRowMenu}
                    onKeyDown={handleScopeRowKeyDown}
                    style={{ "padding-left": `${10 + nodeProps.depth * 14}px` }}
                    tabIndex={0}
                >
                    <button
                        class="flex h-7 w-5 shrink-0 items-center justify-center rounded text-gray-9 hover:bg-gray-4 hover:text-gray-12 disabled:hover:bg-transparent"
                        disabled={!hasChildren()}
                        onClick={() => toggleScopeExpanded(nodeProps.scope.id)}
                        title={hasChildren() ? "Expand or collapse" : undefined}
                    >
                        <TreeChevron visible={hasChildren()} expanded={expanded()} />
                    </button>
                    <Show
                        when={isRenamingScope(nodeProps.scope.id)}
                        fallback={
                            <button
                                class={treeLabelButtonClass}
                                onContextMenu={openScopeRowMenu}
                                onDblClick={() => openTreeScope(nodeProps.scope, nodeProps.tabId)}
                            >
                                <TreeNodeIcon
                                    kind="circuit"
                                    expanded={expanded()}
                                />
                                <ScopeNameCell
                                    name={nodeProps.scope.name}
                                    scopeId={nodeProps.scope.id}
                                />
                            </button>
                        }
                    >
                        <div class={treeLabelButtonClass}>
                            <TreeNodeIcon
                                kind="circuit"
                                expanded={expanded()}
                            />
                            <ScopeNameCell name={nodeProps.scope.name} scopeId={nodeProps.scope.id} />
                        </div>
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
        const nodeIsRenaming = () =>
            Boolean(nodeProps.node.scopeId && isRenamingScope(nodeProps.node.scopeId));
        const menuItems = () =>
            projectEntryMenuItems(nodeProps.node, hasChildren(), expanded());
        const hasMenuActions = () => menuItems().some((item) => !item.disabled);
        const openProjectRowMenu = (event: MouseEvent | PointerEvent) =>
            openEntryMenu(
                event,
                () => selectProjectEntry(nodeProps.node.id),
                menuItems(),
            );
        const handleProjectRowKeyDown = (event: KeyboardEvent) => {
            switch (event.key) {
                case "Enter":
                    event.preventDefault();
                    activateProjectNode(nodeProps.node);
                    break;
                case "ArrowRight":
                    if (hasChildren() && !expanded()) {
                        event.preventDefault();
                        toggleProjectNodeExpanded(nodeProps.node.id);
                    }
                    break;
                case "ArrowLeft":
                    if (hasChildren() && expanded()) {
                        event.preventDefault();
                        toggleProjectNodeExpanded(nodeProps.node.id);
                    }
                    break;
                case "F2":
                    if (nodeProps.node.scopeId) {
                        event.preventDefault();
                        setRenamingScopeId(nodeProps.node.scopeId);
                    }
                    break;
            }
        };

        const ProjectNodeLabel: Component = () => (
            <>
                <TreeNodeIcon kind={nodeProps.node.kind} expanded={expanded()} />
                <Show
                    when={nodeProps.node.scopeId}
                    fallback={<span class="min-w-0 flex-1 truncate">{nodeProps.node.label}</span>}
                >
                    {(scopeId) => (
                        <ScopeNameCell name={nodeProps.node.label} scopeId={scopeId()} />
                    )}
                </Show>
                <Show when={nodeProps.node.detail}>
                    <span class="shrink-0 truncate text-[10px] text-gray-8">
                        {nodeProps.node.detail}
                    </span>
                </Show>
            </>
        );

        return (
            <div>
                <div
                    role="treeitem"
                    aria-expanded={hasChildren() ? expanded() : undefined}
                    aria-level={nodeProps.depth + 1}
                    aria-selected={rowIsActive()}
                    class={[
                        "group flex min-w-0 items-center hover:bg-gray-3",
                        rowIsActive() ? "bg-primary-3 text-primary-11" : "text-gray-11",
                    ].join(" ")}
                    onClick={(event) => {
                        if (!isLeftMouseButton(event)) return;

                        selectProjectEntry(nodeProps.node.id);
                        if (hasChildren()) {
                            toggleProjectNodeExpanded(nodeProps.node.id);
                        }
                    }}
                    onContextMenu={openProjectRowMenu}
                    onKeyDown={handleProjectRowKeyDown}
                    style={{ "padding-left": `${10 + nodeProps.depth * 14}px` }}
                    tabIndex={0}
                >
                    <button
                        class="flex h-7 w-5 shrink-0 items-center justify-center rounded text-gray-9 hover:bg-gray-4 hover:text-gray-12 disabled:hover:bg-transparent"
                        disabled={!hasChildren()}
                        onClick={(event) => {
                            event.stopPropagation();
                            toggleProjectNodeExpanded(nodeProps.node.id);
                        }}
                        title={hasChildren() ? "Expand or collapse" : undefined}
                    >
                        <TreeChevron visible={hasChildren()} expanded={expanded()} />
                    </button>
                    <Show
                        when={nodeIsRenaming()}
                        fallback={
                            <button
                                class={projectTreeLabelButtonClass}
                                disabled={!hasMenuActions() && nodeProps.node.kind === "status"}
                                onContextMenu={openProjectRowMenu}
                                onDblClick={() => {
                                    if (!hasChildren()) activateProjectNode(nodeProps.node);
                                }}
                                title={nodeProps.node.detail}
                            >
                                <ProjectNodeLabel />
                            </button>
                        }
                    >
                        <div class={projectTreeLabelButtonClass}>
                            <ProjectNodeLabel />
                        </div>
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

    onCleanup(() => {
        stopSidebarResize(false);
        window.removeEventListener("keydown", handleEntryMenuKeyDown);
    });

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
                            <div role="tree" aria-label="Saved component tree">
                                <For each={customComponents()}>
                                    {(component) => {
                                        const entryId = () =>
                                            componentExplorerEntryId(component.hash);
                                        const rowIsActive = () =>
                                            explorerSelectionIsActive(entryId());
                                        const openComponentMenu = (
                                            event: MouseEvent | PointerEvent,
                                        ) =>
                                            openEntryMenu(
                                                event,
                                                () => selectComponentEntry(component.hash),
                                                componentEntryMenuItems(component),
                                            );

                                        return (
                                            <div
                                                role="treeitem"
                                                aria-selected={rowIsActive()}
                                                class={[
                                                    "flex min-w-0 items-center gap-2 px-3 py-1 text-xs hover:bg-gray-3",
                                                    rowIsActive()
                                                        ? "bg-primary-3 text-primary-11"
                                                        : "text-gray-11",
                                                ].join(" ")}
                                                onClick={(event) => {
                                                    if (isLeftMouseButton(event)) {
                                                        selectComponentEntry(component.hash);
                                                    }
                                                }}
                                                onContextMenu={openComponentMenu}
                                                tabIndex={0}
                                                title={component.name}
                                            >
                                                <span class="shrink-0 text-gray-9">[]</span>
                                                <span class="min-w-0 flex-1 truncate">
                                                    {component.name}
                                                </span>
                                                <Show
                                                    when={
                                                        component.inputCount !== undefined &&
                                                        component.outputCount !== undefined
                                                    }
                                                >
                                                    <span class="shrink-0 text-[10px] text-gray-8">
                                                        {component.inputCount} in,{" "}
                                                        {component.outputCount} out,{" "}
                                                        {customComponentRuntimeStatus(component.runtime)}
                                                    </span>
                                                </Show>
                                            </div>
                                        );
                                    }}
                                </For>
                            </div>
                        </Show>
                    </ExplorerTreeSection>

                </div>

            </Show>
            <Show when={entryMenu()}>
                {(menu) => (
                    <div
                        class="fixed inset-0 z-[100]"
                        onClick={closeEntryMenu}
                        onContextMenu={(event) => {
                            event.preventDefault();
                            closeEntryMenu();
                        }}
                    >
                        <div
                            class={contextMenuStyles.content()}
                            onClick={(event) => event.stopPropagation()}
                            style={{
                                left: `${menu().x}px`,
                                position: "fixed",
                                top: `${menu().y}px`,
                            }}
                        >
                            <For each={menu().items}>
                                {(item) => (
                                    <>
                                        <Show when={item.separatorBefore}>
                                            <div class={contextMenuStyles.separator()} />
                                        </Show>
                                        <button
                                            class={`${contextMenuStyles.item()} w-full`}
                                            disabled={item.disabled}
                                            onClick={() => {
                                                if (item.disabled) return;
                                                closeEntryMenu();
                                                item.onSelect?.();
                                            }}
                                            type="button"
                                        >
                                            <span class={contextMenuStyles.itemLabel()}>
                                                {item.label}
                                            </span>
                                        </button>
                                    </>
                                )}
                            </For>
                        </div>
                    </div>
                )}
            </Show>
        </aside>
    );
};
