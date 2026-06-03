import type { UIEngineScope } from "@gately/shared/infrastructure/ui-engine/model/types";
import { describe, expect, it } from "vitest";
import { buildProjectExplorerTree } from "./projectExplorerTree";

const scope = (
    id: string,
    name: string,
    overrides: Partial<UIEngineScope> = {},
): UIEngineScope => ({
    _createdAt: 1,
    childrenIds: [],
    contentJson: "",
    id,
    kind: "circuit",
    name,
    path: [],
    viewport: { tx: 0, ty: 0, zoom: 1 },
    ...overrides,
});

describe("buildProjectExplorerTree", () => {
    it("builds an expandable workspace tree from tabs, scopes, parts, and storage state", () => {
        const scopes: Record<string, UIEngineScope> = {
            "tab-1": scope("tab-1", "Main", {
                childrenIds: ["child-1"],
                kind: "tab",
            }),
            "child-1": scope("child-1", "Nested Logic", {
                path: ["tab-1"],
            }),
        };

        const tree = buildProjectExplorerTree({
            components: [
                {
                    hash: "custom-hash",
                    inputCount: 2,
                    name: "Half Adder",
                    outputCount: 2,
                },
            ],
            getScopeById: (id) => scopes[id],
            getScopeChildrenById: (id) =>
                scopes[id]?.childrenIds.map((childId) => scopes[childId]).filter(Boolean) ?? [],
            hasSavedWorkspace: true,
            tabs: [{ id: "tab-1", name: "Main" }],
        });

        expect(tree.kind).toBe("folder");
        expect(tree.children?.map((node) => node.label)).toEqual([
            "Circuits",
            "Components",
            "Workbench",
        ]);

        const circuitsFolder = tree.children?.[0];
        expect(circuitsFolder?.children?.[0]).toMatchObject({
            id: "scope:tab-1",
            kind: "circuit",
            label: "Main",
            scopeId: "tab-1",
            tabId: "tab-1",
        });
        expect(circuitsFolder?.children?.[0].children?.[0]).toMatchObject({
            id: "scope:child-1",
            kind: "circuit",
            label: "Nested Logic",
            scopeId: "child-1",
            tabId: "tab-1",
        });

        expect(tree.children?.[1].children?.[0]).toMatchObject({
            detail: "2 in, 2 out",
            hash: "custom-hash",
            kind: "component",
            label: "Half Adder",
        });
        expect(tree.children?.[2].children?.[0]).toMatchObject({
            detail: "saved",
            kind: "status",
            label: "Browser workspace",
        });
    });

    it("uses status files for empty folders", () => {
        const tree = buildProjectExplorerTree({
            components: [],
            getScopeById: () => undefined,
            getScopeChildrenById: () => [],
            hasSavedWorkspace: false,
            tabs: [],
        });

        expect(tree.children?.[0].children?.[0]).toMatchObject({
            kind: "status",
            label: "No open circuits",
        });
        expect(tree.children?.[1].children?.[0]).toMatchObject({
            kind: "status",
            label: "No saved parts",
        });
        expect(tree.children?.[2].children?.[0]).toMatchObject({
            detail: "not saved",
            kind: "status",
        });
    });
});
