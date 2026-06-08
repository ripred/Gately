import type {
    UIEngineScope,
    UIEngineTab,
} from "@gately/shared/infrastructure/ui-engine/model/types";
import type { CustomComponentRuntimeMeta } from "@cnbn/schema";

export type ProjectExplorerNodeKind =
    | "folder"
    | "circuit"
    | "component"
    | "status";

export type ProjectExplorerComponent = {
    hash: string;
    inputCount?: number;
    name: string;
    outputCount?: number;
    runtime?: CustomComponentRuntimeMeta;
};

export type ProjectExplorerNode = {
    children?: ProjectExplorerNode[];
    detail?: string;
    hash?: string;
    id: string;
    kind: ProjectExplorerNodeKind;
    label: string;
    scopeId?: string;
    tabId?: string;
};

type BuildProjectExplorerTreeInput = {
    components: ProjectExplorerComponent[];
    getScopeById: (scopeId: string) => UIEngineScope | undefined;
    getScopeChildrenById: (scopeId: string) => UIEngineScope[];
    tabs: UIEngineTab[];
};

const emptyStatusNode = (id: string, label: string): ProjectExplorerNode => ({
    id,
    kind: "status",
    label,
});

export const customComponentRuntimeStatus = (runtime?: CustomComponentRuntimeMeta): string => {
    switch (runtime?.mode) {
        case "baked-combinational":
            return "baked";
        case "expanded-stateful":
            return "stateful";
        case "expanded-unsupported":
        default:
            return "expanded";
    }
};

const buildScopeNode = (
    scope: UIEngineScope,
    tabId: string,
    getScopeChildrenById: (scopeId: string) => UIEngineScope[],
): ProjectExplorerNode => {
    const children = getScopeChildrenById(scope.id).map((childScope) =>
        buildScopeNode(childScope, tabId, getScopeChildrenById),
    );

    return {
        children,
        id: `scope:${scope.id}`,
        kind: "circuit",
        label: scope.name,
        scopeId: scope.id,
        tabId,
    };
};

export const buildProjectExplorerTree = ({
    components,
    getScopeById,
    getScopeChildrenById,
    tabs,
}: BuildProjectExplorerTreeInput): ProjectExplorerNode => {
    const circuitChildren = tabs
        .map((tab) => {
            const scope = getScopeById(tab.id);
            return scope ? buildScopeNode(scope, tab.id, getScopeChildrenById) : undefined;
        })
        .filter((node): node is ProjectExplorerNode => Boolean(node));

    const componentChildren = components.map<ProjectExplorerNode>((component) => ({
        detail:
            component.inputCount === undefined || component.outputCount === undefined
                ? undefined
                : `${component.inputCount} in, ${component.outputCount} out, ${customComponentRuntimeStatus(component.runtime)}`,
        hash: component.hash,
        id: `component:${component.hash}`,
        kind: "component",
        label: component.name,
    }));

    return {
        children: [
            {
                children:
                    circuitChildren.length > 0
                        ? circuitChildren
                        : [emptyStatusNode("status:no-circuits", "No open circuits")],
                id: "project:circuits",
                kind: "folder",
                label: "Circuits",
            },
            {
                children:
                    componentChildren.length > 0
                        ? componentChildren
                        : [emptyStatusNode("status:no-components", "No saved parts")],
                id: "project:components",
                kind: "folder",
                label: "Components",
            },
            {
                children: [
                    {
                        id: "project:workspace-storage",
                        kind: "status",
                        label: "Workspace file",
                    },
                ],
                id: "project:workbench",
                kind: "folder",
                label: "Workbench",
            },
        ],
        id: "project:gately-workspace",
        kind: "folder",
        label: "Gately Workspace",
    };
};
