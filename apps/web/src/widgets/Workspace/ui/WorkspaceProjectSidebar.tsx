import { useUIEngine } from "@gately/shared/infrastructure";
import { Pusher } from "@gately/shared/ui";
import type { WorkspaceController } from "../lib/types";
import type { WorkspaceViewMode } from "./workbenchTypes";
import { Component, For, JSX, Show } from "solid-js";

type WorkspaceProjectSidebarProps = Pick<
    WorkspaceController,
    "customComponents" | "persistence"
> & {
    collapsed: boolean;
    mode: WorkspaceViewMode;
    setMode: (mode: WorkspaceViewMode) => void;
    toggleCollapsed: () => void;
};

const ExplorerSection: Component<{ title: string; children?: JSX.Element }> = (
    props,
) => (
    <section class="border-b border-gray-4 py-2">
        <h2 class="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-9">
            {props.title}
        </h2>
        <div>{props.children}</div>
    </section>
);

export const WorkspaceProjectSidebar: Component<WorkspaceProjectSidebarProps> = (props) => {
    const uiEngine = useUIEngine();
    const currentScopes = () => uiEngine.state.activeNavigationScopes();
    const activeScopeId = () => uiEngine.state.activeScopeId();
    const customComponents = () => props.customComponents.components();

    return (
        <aside
            class={[
                "flex min-h-0 shrink-0 flex-col border-r border-gray-4 bg-gray-2 text-gray-12 transition-[width] duration-150",
                props.collapsed ? "w-12" : "w-64",
            ].join(" ")}
            aria-label="Project explorer"
        >
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
                    </div>
                }
            >
                <div class="min-h-0 flex-1 overflow-auto">
                    <ExplorerSection title="Project">
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
                        <For each={uiEngine.state.tabs()}>
                            {(tab) => (
                                <button
                                    class={[
                                        "flex w-full items-center gap-2 px-7 py-1 text-left text-xs hover:bg-gray-3",
                                        tab.id === uiEngine.state.activeTabId() &&
                                        props.mode === "circuit"
                                            ? "text-primary-11"
                                            : "text-gray-11",
                                    ].join(" ")}
                                    onClick={() => {
                                        uiEngine.commands.openTab(tab.id);
                                        props.setMode("circuit");
                                    }}
                                >
                                    <span class="text-gray-9">-</span>
                                    <span class="truncate">{tab.name}</span>
                                </button>
                            )}
                        </For>
                    </ExplorerSection>

                    <ExplorerSection title="Circuit Navigation">
                        <Show
                            when={currentScopes().length > 0}
                            fallback={<p class="px-3 py-2 text-xs text-gray-9">No open circuit.</p>}
                        >
                            <For each={currentScopes()}>
                                {(scope, index) => (
                                    <button
                                        class={[
                                            "flex w-full items-center gap-2 py-1 text-left text-xs hover:bg-gray-3",
                                            scope.id === activeScopeId()
                                                ? "text-primary-11"
                                                : "text-gray-11",
                                        ].join(" ")}
                                        style={{ "padding-left": `${12 + index() * 14}px` }}
                                        onClick={() => {
                                            uiEngine.commands.openScope(scope.id);
                                            props.setMode("circuit");
                                        }}
                                    >
                                        <span class="text-gray-9">
                                            {scope.childrenIds.length > 0 ? "v" : "-"}
                                        </span>
                                        <span class="truncate">{scope.name}</span>
                                    </button>
                                )}
                            </For>
                        </Show>
                    </ExplorerSection>

                    <ExplorerSection title="Components">
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
                    </ExplorerSection>

                    <ExplorerSection title="Workbench">
                        <button
                            class={[
                                "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-3",
                                props.mode === "settings" ? "bg-primary-3 text-primary-11" : "",
                            ].join(" ")}
                            onClick={() => props.setMode("settings")}
                        >
                            <span>Settings</span>
                        </button>
                        <div class="px-3 py-2 text-xs leading-5 text-gray-9">
                            <div>
                                Saved workspace:{" "}
                                {props.persistence.hasSavedWorkspace() ? "yes" : "no"}
                            </div>
                            <div>Custom parts: {customComponents().length}</div>
                        </div>
                    </ExplorerSection>
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
