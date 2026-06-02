import { ApiFactories } from "@engine/api";
import { E } from "@engine/errors";
import { buildLinkId } from "@cnbn/helpers";
import {
    CircuitPins,
    hasItemInputPins,
    hasItemOutputPins,
    Id,
    InnerInOutItem,
    InnerItem,
    InnerItemInputLinks,
    InnerItemOutputLinks,
    isDisplayItem,
    isGeneratorItem,
    ItemLink,
    ItemOfKind,
    PinIndex,
    Scope,
    TemplateOfKind,
} from "@cnbn/schema";
import { uniqueId } from "@cnbn/utils";

export type ApiTemplateSummary = {
    hash: string;
    name: string;
    kind: TemplateOfKind["kind"];
    custom: boolean;
    inputCount: number;
    outputCount: number;
    label?: string;
    createdAt?: number;
    updatedAt?: number;
};

export type ApiCreateTemplateFromSelectionPayload = {
    tabId: Id;
    scopeId?: Id;
    selectedItemIds: Id[];
    name: string;
    hash?: string;
};

export type ApiCreateTemplateFromSelectionResult = {
    template: TemplateOfKind<"circuit:logic">;
    summary: ApiTemplateSummary;
};

export type ApiSaveTemplatePayload = {
    template: TemplateOfKind;
};

export type ApiUpdateTemplatePayload = {
    hash: string;
    name: string;
};

export type ApiRemoveTemplatePayload = {
    hash: string;
};

export interface ApiListTemplates_Fn {
    (): ApiTemplateSummary[];
}

export interface ApiSaveTemplate_Fn {
    (payload: ApiSaveTemplatePayload): ApiTemplateSummary;
}

export interface ApiUpdateTemplate_Fn {
    (payload: ApiUpdateTemplatePayload): ApiTemplateSummary;
}

export interface ApiRemoveTemplate_Fn {
    (payload: ApiRemoveTemplatePayload): { removed: boolean; template?: ApiTemplateSummary };
}

export interface ApiCreateTemplateFromSelection_Fn {
    (payload: ApiCreateTemplateFromSelectionPayload): ApiCreateTemplateFromSelectionResult;
}

type LinkBuckets = {
    byInputItemPin: Map<string, ItemLink>;
    byOutputItemPin: Map<string, ItemLink[]>;
};

type InnerItemWithLinks = InnerItem & {
    inputLinks?: InnerItemInputLinks;
    outputLinks?: InnerItemOutputLinks;
};

const pinKey = (itemId: Id, pin: PinIndex): string => `${itemId}:${pin}`;

const isCustomTemplate = (template: TemplateOfKind): boolean =>
    template.kind === "circuit:logic" && Boolean(template.meta?.custom);

const summarizeTemplate = (template: TemplateOfKind): ApiTemplateSummary => {
    const inputCount =
        "inputPins" in template && template.inputPins ? Object.keys(template.inputPins).length : 0;
    const outputCount =
        "outputPins" in template && template.outputPins
            ? Object.keys(template.outputPins).length
            : 0;

    return {
        hash: template.hash,
        name: template.name,
        kind: template.kind,
        custom: isCustomTemplate(template),
        inputCount,
        outputCount,
        label: template.kind === "circuit:logic" ? template.meta?.label : undefined,
        createdAt: template.kind === "circuit:logic" ? template.meta?.createdAt : undefined,
        updatedAt: template.kind === "circuit:logic" ? template.meta?.updatedAt : undefined,
    };
};

const buildLinkBuckets = (links: ItemLink[]): LinkBuckets => {
    const byInputItemPin = new Map<string, ItemLink>();
    const byOutputItemPin = new Map<string, ItemLink[]>();

    links.forEach((link) => {
        byInputItemPin.set(pinKey(link.toItemId, link.toPin), link);
        const outputKey = pinKey(link.fromItemId, link.fromPin);
        const existing = byOutputItemPin.get(outputKey) ?? [];
        existing.push(link);
        byOutputItemPin.set(outputKey, existing);
    });

    return { byInputItemPin, byOutputItemPin };
};

const itemInputPins = (item: ItemOfKind): PinIndex[] =>
    hasItemInputPins(item) ? Object.keys(item.inputPins ?? {}) : [];

const itemOutputPins = (item: ItemOfKind): PinIndex[] =>
    hasItemOutputPins(item) ? Object.keys(item.outputPins ?? {}) : [];

const itemInScope = (scope: Scope, item: ItemOfKind): boolean =>
    item.path[item.path.length - 1] === scope.id || scope.storedItems.has(item.id);

const copyInnerItem = (
    item: ItemOfKind,
    inputLinks: InnerItemInputLinks,
    outputLinks: InnerItemOutputLinks,
): InnerItem => {
    const inner: InnerItemWithLinks = {
        hash: item.hash,
        kind: item.kind,
        name: item.name,
    } as InnerItemWithLinks;

    if (item.meta && Object.keys(item.meta).length) inner.meta = { ...item.meta };
    if (item.options && Object.keys(item.options).length) inner.options = { ...item.options };
    if (Object.keys(inputLinks).length) inner.inputLinks = inputLinks;
    if (Object.keys(outputLinks).length) inner.outputLinks = outputLinks;

    return inner as InnerItem;
};

const makeExternalInputPins = (
    inputs: InnerInOutItem[][],
): CircuitPins<"in", "template"> =>
    Object.fromEntries(inputs.map((items, index) => [String(index), { inputItems: items }]));

const makeExternalOutputPins = (
    outputs: InnerInOutItem[],
): CircuitPins<"out", "template"> =>
    Object.fromEntries(outputs.map((outputItem, index) => [String(index), { outputItem }]));

const assertCustomTemplate = (template: TemplateOfKind): TemplateOfKind<"circuit:logic"> => {
    if (template.kind !== "circuit:logic" || !template.meta?.custom) {
        throw new Error(`Template "${template.hash}" is not a user custom component.`);
    }

    return template as TemplateOfKind<"circuit:logic">;
};

const buildTemplateFromSelection = (ctx: {
    payload: ApiCreateTemplateFromSelectionPayload;
    scope: Scope;
    items: ItemOfKind[];
    links: ItemLink[];
}): TemplateOfKind<"circuit:logic"> => {
    const name = ctx.payload.name.trim();
    if (!name) throw new Error("Custom component name is required.");

    const selected = new Set(ctx.payload.selectedItemIds);
    if (!selected.size) throw new Error("Select at least one component to save.");

    const scopedItems = ctx.items.filter((item) => itemInScope(ctx.scope, item));
    const scopedItemIds = new Set(scopedItems.map((item) => item.id));
    const scopedLinks = ctx.links.filter(
        (link) => scopedItemIds.has(link.fromItemId) && scopedItemIds.has(link.toItemId),
    );

    const itemsById = new Map(scopedItems.map((item) => [item.id, item]));
    const selectedItems = Array.from(selected, (id) => itemsById.get(id)).filter(
        (item): item is ItemOfKind => Boolean(item),
    );
    if (!selectedItems.length) throw new Error("No selected engine items were found.");

    const links = scopedLinks;
    const buckets = buildLinkBuckets(links);
    const coreIds = new Set(selectedItems.map((item) => item.id));
    const boundaryInputGroups: InnerInOutItem[][] = [];
    const boundaryOutputs: InnerInOutItem[] = [];
    const boundaryLinkIds = new Set<string>();

    const addInputGroup = (items: InnerInOutItem[]): void => {
        const unique = new Map(items.map((item) => [pinKey(item.itemId, item.pin), item]));
        if (unique.size) boundaryInputGroups.push(Array.from(unique.values()));
    };

    const addOutput = (output: InnerInOutItem): void => {
        const key = pinKey(output.itemId, output.pin);
        if (boundaryOutputs.some((existing) => pinKey(existing.itemId, existing.pin) === key)) return;
        boundaryOutputs.push(output);
    };

    selectedItems.forEach((item) => {
        if (!isGeneratorItem(item) || item.hash !== "TOGGLE") return;

        const targets = itemOutputPins(item).flatMap((pin) => {
            const outputLinks = buckets.byOutputItemPin.get(pinKey(item.id, pin)) ?? [];
            return outputLinks
                .filter((link) => selected.has(link.toItemId))
                .map((link) => {
                    boundaryLinkIds.add(buildLinkId(link));
                    return { itemId: link.toItemId, pin: link.toPin };
                });
        });

        if (!targets.length) return;
        coreIds.delete(item.id);
        addInputGroup(targets);
    });

    selectedItems.forEach((item) => {
        if (!isDisplayItem(item)) return;

        const outputs = itemInputPins(item).flatMap((pin) => {
            const link = buckets.byInputItemPin.get(pinKey(item.id, pin));
            if (!link || !selected.has(link.fromItemId)) return [];

            boundaryLinkIds.add(buildLinkId(link));
            return [{ itemId: link.fromItemId, pin: link.fromPin }];
        });

        if (!outputs.length) return;
        coreIds.delete(item.id);
        outputs.forEach(addOutput);
    });

    const coreItems = selectedItems.filter((item) => coreIds.has(item.id));
    if (!coreItems.length) {
        throw new Error("Select at least one non-boundary component for the custom component body.");
    }

    const coreItemIds = new Set(coreItems.map((item) => item.id));
    const internalLinks = links.filter(
        (link) =>
            coreItemIds.has(link.fromItemId) &&
            coreItemIds.has(link.toItemId) &&
            !boundaryLinkIds.has(buildLinkId(link)),
    );
    const internalLinkIds = new Set(internalLinks.map(buildLinkId));

    const boundaryInputsByExternalDriver = new Map<string, InnerInOutItem[]>();
    coreItems.forEach((item) => {
        itemInputPins(item).forEach((pin) => {
            const inputKey = pinKey(item.id, pin);
            const incoming = buckets.byInputItemPin.get(inputKey);
            if (incoming && internalLinkIds.has(buildLinkId(incoming))) return;
            if (incoming && boundaryLinkIds.has(buildLinkId(incoming))) return;

            const groupKey = incoming
                ? `external:${incoming.fromItemId}:${incoming.fromPin}`
                : `dangling:${item.id}:${pin}`;
            const group = boundaryInputsByExternalDriver.get(groupKey) ?? [];
            group.push({ itemId: item.id, pin });
            boundaryInputsByExternalDriver.set(groupKey, group);
        });
    });
    Array.from(boundaryInputsByExternalDriver.values()).forEach(addInputGroup);

    coreItems.forEach((item) => {
        itemOutputPins(item).forEach((pin) => {
            const outputKey = pinKey(item.id, pin);
            const outgoing = buckets.byOutputItemPin.get(outputKey) ?? [];
            const realOutgoing = outgoing.filter((link) => !boundaryLinkIds.has(buildLinkId(link)));
            const hasInternal = realOutgoing.some((link) => coreItemIds.has(link.toItemId));
            const hasExternal = realOutgoing.some((link) => !coreItemIds.has(link.toItemId));

            if (hasExternal || (!hasInternal && realOutgoing.length === 0)) {
                addOutput({ itemId: item.id, pin });
            }
        });
    });

    if (!boundaryOutputs.length) {
        throw new Error("The selected component body must expose at least one output.");
    }

    const innerItems: Record<string, InnerItem> = {};
    coreItems.forEach((item) => {
        const inputLinks: InnerItemInputLinks = {};
        const outputLinks: InnerItemOutputLinks = {};

        internalLinks.forEach((link) => {
            const id = buildLinkId(link);
            if (link.toItemId === item.id) inputLinks[link.toPin] = id;
            if (link.fromItemId === item.id) {
                outputLinks[link.fromPin] ??= [];
                outputLinks[link.fromPin].push(id);
            }
        });

        innerItems[item.id] = copyInnerItem(item, inputLinks, outputLinks);
    });

    const now = Date.now();
    const hash = ctx.payload.hash?.trim() || `CUSTOM_${uniqueId()}`;

    return {
        hash,
        kind: "circuit:logic",
        name,
        meta: {
            custom: true,
            label: name,
            createdAt: now,
            updatedAt: now,
        },
        inputPins: makeExternalInputPins(boundaryInputGroups),
        outputPins: makeExternalOutputPins(boundaryOutputs),
        items: innerItems,
    };
};

export const listTemplatesUC = ApiFactories.config((tokens) => ({
    token: tokens.template.list,
    factory: (ctx) => {
        const listTemplates = (() =>
            ctx.deps.stores.template.export().map(([, template]) => summarizeTemplate(template))) as ApiListTemplates_Fn;

        return listTemplates;
    },
}));

export const saveTemplateUC = ApiFactories.config((tokens) => ({
    token: tokens.template.save,
    factory: (ctx) => {
        const saveTemplate = ((payload) => {
            const template = assertCustomTemplate(payload.template);
            ctx.tools.global.saveTemplate(template);
            return summarizeTemplate(template);
        }) as ApiSaveTemplate_Fn;

        return saveTemplate;
    },
}));

export const updateTemplateUC = ApiFactories.config((tokens) => ({
    token: tokens.template.update,
    factory: (ctx) => {
        const updateTemplate = ((payload) => {
            const existing = assertCustomTemplate(ctx.tools.global.getTemplate(payload.hash));
            const name = payload.name.trim();
            if (!name) throw new Error("Custom component name is required.");

            const updated: TemplateOfKind<"circuit:logic"> = {
                ...existing,
                name,
                meta: {
                    ...existing.meta,
                    custom: true,
                    label: name,
                    updatedAt: Date.now(),
                },
            };

            ctx.tools.global.saveTemplate(updated);
            return summarizeTemplate(updated);
        }) as ApiUpdateTemplate_Fn;

        return updateTemplate;
    },
}));

export const removeTemplateUC = ApiFactories.config((tokens) => ({
    token: tokens.template.remove,
    factory: (ctx) => {
        const removeTemplate = ((payload) => {
            const existing = assertCustomTemplate(ctx.tools.global.getTemplate(payload.hash));
            ctx.tools.global.removeTemplate(payload.hash);
            return { removed: true, template: summarizeTemplate(existing) };
        }) as ApiRemoveTemplate_Fn;

        return removeTemplate;
    },
}));

export const createTemplateFromSelectionUC = ApiFactories.config((tokens) => ({
    token: tokens.template.createFromSelection,
    factory: (ctx) => {
        const createTemplateFromSelection = ((payload) => {
            const tab = ctx.tools.global.getTab(payload.tabId);
            const scope =
                tab.ctx.scopeStore.get(payload.scopeId ?? payload.tabId) ??
                (() => {
                    throw E.scope.NotFound(payload.scopeId ?? payload.tabId);
                })();

            const template = buildTemplateFromSelection({
                payload,
                scope,
                items: tab.ctx.itemStore.export().map(([, item]) => item),
                links: tab.ctx.linkStore.export().map(([, link]) => link),
            });

            if (ctx.deps.stores.template.get(template.hash)) {
                throw new Error(`Template "${template.hash}" already exists.`);
            }

            ctx.tools.global.saveTemplate(template);

            return {
                template,
                summary: summarizeTemplate(template),
            };
        }) as ApiCreateTemplateFromSelection_Fn;

        return createTemplateFromSelection;
    },
}));
