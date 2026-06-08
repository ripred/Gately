import { CinabonoBuilder } from "@engine/engine/builder";
import { buildLinkId } from "@cnbn/helpers";
import { describe, expect, it } from "vitest";

/**
 * Create tab, create two buffer items and link them together.
 */
describe("buffer item linking", () => {
    it("creates two buffers in a tab and stores their link in the tab context", async () => {
        const engine = await new CinabonoBuilder()
            .configure({
                ignoreErrorsSetup: true,
            })
            .build();

        const tabResult = engine.api.tab.create({ id: "tab" });

        const itemsResult = engine.api.item.create([
            { id: "BUFFER_A", kind: "base:logic", path: [tabResult.tabId], hash: "BUFFER" },
            { id: "BUFFER_B", kind: "base:logic", path: [tabResult.tabId], hash: "BUFFER" },
        ]);
        const link = {
            fromItemId: "BUFFER_A",
            fromPin: "0",
            toItemId: "BUFFER_B",
            toPin: "0",
        } as const;
        const linkId = buildLinkId(link);

        const linkResult = engine.api.item.link({
            link,
            tabId: tabResult.tabId,
        });

        const tabContext = engine.deps.stores.tab.get(tabResult.tabId)?.ctx;
        const { itemStore, linkStore, scopeStore } = tabContext!;

        expect(itemsResult.map((result) => result.builtItem.id)).toEqual([
            "BUFFER_A",
            "BUFFER_B",
        ]);
        expect(linkResult).toMatchObject({ linkId, tabId: "tab" });
        expect(linkResult.inputEvents).toEqual([
            expect.objectContaining({
                itemId: "BUFFER_B",
                kind: "input",
                pin: "0",
                value: "X",
            }),
        ]);

        expect(itemStore.export().map(([id]) => id).sort()).toEqual(["BUFFER_A", "BUFFER_B"]);
        expect(linkStore.export()).toEqual([[linkId, link]]);

        const [scopeId, tabScope] = scopeStore.export()[0];
        expect(scopeId).toBe("tab");
        expect(tabScope.kind).toBe("tab");
        expect(Array.from(tabScope.storedScopes)).toEqual([]);
        expect(Array.from(tabScope.storedItems.entries())).toEqual([
            ["BUFFER_A", { outputLinks: { "0": [linkId] } }],
            ["BUFFER_B", { inputLinks: { "0": linkId } }],
        ]);
    });
});
