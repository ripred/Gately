import {
    WORKBENCH_EXPLORER_WIDTH_LIMITS,
    type AppConfigurationController,
    type WorkbenchExplorerSectionKey,
} from "@gately/app/providers/AppConfigurationProvider";
import { useUIEngine, type UIEngineScope } from "@gately/shared/infrastructure";
import { Pusher } from "@gately/shared/ui";
import type { WorkspaceController } from "../lib/types";
import type { WorkspaceViewMode } from "./workbenchTypes";
import { Component, createSignal, For, JSX, onCleanup, Show } from "solid-js";

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

const miniButtonClass =
    "rounded border border-gray-5 bg-gray-3 px-2 py-1 text-[11px] text-gray-12 hover:bg-gray-4 data-disabled:text-gray-8 data-disabled:hover:bg-gray-3";

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
    const toggleScopeExpanded = (scopeId: string) => {
        setCollapsedScopeIds((current) => ({
            ...current,
            [scopeId]: !current[scopeId],
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
                        class="flex h-7 w-5 shrink-0 items-center justify-center rounded text-[11px] text-gray-9 hover:bg-gray-4 hover:text-gray-12 disabled:hover:bg-transparent"
                        disabled={!hasChildren()}
                        onClick={() => toggleScopeExpanded(nodeProps.scope.id)}
                        title={hasChildren() ? "Expand or collapse" : undefined}
                    >
                        <Show when={hasChildren()} fallback=" ">
                            {expanded() ? "v" : ">"}
                        </Show>
                    </button>
                    <button
                        class={treeLabelButtonClass}
                        onClick={() => openTreeScope(nodeProps.scope, nodeProps.tabId)}
                    >
                        <span class="w-8 shrink-0 rounded border border-gray-5 bg-gray-1 px-1 py-0.5 text-center text-[9px] font-semibold text-gray-9">
                            {isDirectory() ? "DIR" : "CKT"}
                        </span>
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
                        <button
                            class={[
                                "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-3",
                                props.mode === "circuit" ? "bg-primary-3 text-primary-11" : "",
                            ].join(" ")}
                            onClick={() => props.setMode("circuit")}
                        >
                            <span class="text-gray-9">v</span>
                            <span class="truncate">Gately Workspace</span>
                        </button>
                        <div class="px-3 py-2 text-xs leading-5 text-gray-9">
                            <div>Storage: browser local workspace</div>
                            <div>
                                Saved workspace:{" "}
                                {props.persistence.hasSavedWorkspace() ? "yes" : "no"}
                            </div>
                            <div>Open circuits: {uiEngine.state.tabs().length}</div>
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
