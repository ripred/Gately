import { ApiFactories } from "../../api/index.js";
import { E } from "../../errors/index.js";
import { buildLinkId } from "@cnbn/helpers";
import { hasItemInputPins, hasItemOutputPins, isDisplayItem, isGeneratorItem, } from "@cnbn/schema";
import { uniqueId } from "@cnbn/utils";
import { recomputeCustomTemplateRuntimes } from "./templateRuntime.js";
const pinKey = (itemId, pin) => `${itemId}:${pin}`;
const isCustomTemplate = (template) => template.kind === "circuit:logic" && Boolean(template.meta?.custom);
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const summarizeTemplate = (template) => {
    const inputCount = "inputPins" in template && template.inputPins ? Object.keys(template.inputPins).length : 0;
    const outputCount = "outputPins" in template && template.outputPins
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
        runtime: template.kind === "circuit:logic" ? template.meta?.runtime : undefined,
        updatedAt: template.kind === "circuit:logic" ? template.meta?.updatedAt : undefined,
    };
};
const refreshTemplateRuntimes = (ctx) => {
    recomputeCustomTemplateRuntimes({
        bakeStore: ctx.deps.services.itemCompute.bakeStore,
        templateStore: ctx.deps.stores.template,
    });
};
const buildLinkBuckets = (links) => {
    const byInputItemPin = new Map();
    const byOutputItemPin = new Map();
    links.forEach((link) => {
        byInputItemPin.set(pinKey(link.toItemId, link.toPin), link);
        const outputKey = pinKey(link.fromItemId, link.fromPin);
        const existing = byOutputItemPin.get(outputKey) ?? [];
        existing.push(link);
        byOutputItemPin.set(outputKey, existing);
    });
    return { byInputItemPin, byOutputItemPin };
};
const itemInputPins = (item) => hasItemInputPins(item) ? Object.keys(item.inputPins ?? {}) : [];
const itemOutputPins = (item) => hasItemOutputPins(item) ? Object.keys(item.outputPins ?? {}) : [];
const itemInScope = (scope, item) => item.path[item.path.length - 1] === scope.id || scope.storedItems.has(item.id);
const copyInnerItem = (item, inputLinks, outputLinks) => {
    const inner = {
        hash: item.hash,
        kind: item.kind,
        name: item.name,
    };
    if (item.meta && Object.keys(item.meta).length)
        inner.meta = { ...item.meta };
    if (item.options && Object.keys(item.options).length)
        inner.options = { ...item.options };
    if (Object.keys(inputLinks).length)
        inner.inputLinks = inputLinks;
    if (Object.keys(outputLinks).length)
        inner.outputLinks = outputLinks;
    return inner;
};
const makeExternalInputPins = (inputs) => Object.fromEntries(inputs.map((items, index) => [String(index), { inputItems: items }]));
const makeExternalOutputPins = (outputs) => Object.fromEntries(outputs.map((outputItem, index) => [String(index), { outputItem }]));
const assertCustomTemplate = (template) => {
    if (template.kind !== "circuit:logic" || !template.meta?.custom) {
        throw new Error(`Template "${template.hash}" is not a user custom component.`);
    }
    return template;
};
const assertContiguousPinMap = (pins, label, options) => {
    const keys = Object.keys(pins);
    if (options.requirePins && keys.length === 0) {
        throw new Error(`Custom component ${label} must contain at least one pin.`);
    }
    const expected = keys.map((_, index) => String(index));
    const actual = [...keys].sort((left, right) => Number(left) - Number(right));
    if (actual.length !== expected.length ||
        actual.some((key, index) => key !== expected[index])) {
        throw new Error(`Custom component ${label} must use contiguous pins starting at 0.`);
    }
};
export const validateCustomTemplate = (template) => {
    const custom = assertCustomTemplate(template);
    if (!custom.hash.trim())
        throw new Error("Custom component hash is required.");
    if (!custom.name.trim())
        throw new Error("Custom component name is required.");
    if (!isRecord(custom.items) || Object.keys(custom.items).length === 0) {
        throw new Error(`Custom component "${custom.name}" must contain at least one item.`);
    }
    if (!isRecord(custom.inputPins)) {
        throw new Error(`Custom component "${custom.name}" input pins are invalid.`);
    }
    if (!isRecord(custom.outputPins)) {
        throw new Error(`Custom component "${custom.name}" output pins are invalid.`);
    }
    assertContiguousPinMap(custom.inputPins, "inputPins", { requirePins: false });
    assertContiguousPinMap(custom.outputPins, "outputPins", { requirePins: true });
    const itemIds = new Set(Object.keys(custom.items));
    Object.entries(custom.inputPins).forEach(([pin, input]) => {
        const inputItems = input.inputItems;
        if (!Array.isArray(inputItems) || inputItems.length === 0) {
            throw new Error(`Custom component input pin "${pin}" has no internal targets.`);
        }
        inputItems.forEach((inputItem) => {
            if (!itemIds.has(inputItem.itemId)) {
                throw new Error(`Custom component input pin "${pin}" references missing item "${inputItem.itemId}".`);
            }
            if (!inputItem.pin) {
                throw new Error(`Custom component input pin "${pin}" has an invalid target pin.`);
            }
        });
    });
    Object.entries(custom.outputPins).forEach(([pin, output]) => {
        const outputItem = output.outputItem;
        if (!outputItem) {
            throw new Error(`Custom component output pin "${pin}" has no internal source.`);
        }
        if (!itemIds.has(outputItem.itemId)) {
            throw new Error(`Custom component output pin "${pin}" references missing item "${outputItem.itemId}".`);
        }
        if (!outputItem.pin) {
            throw new Error(`Custom component output pin "${pin}" has an invalid source pin.`);
        }
    });
    return custom;
};
const findTemplateDependencies = (templates, hash) => {
    const dependents = new Set();
    templates.forEach(([templateHash, template]) => {
        if (templateHash === hash || template.kind !== "circuit:logic")
            return;
        if (!template.meta?.custom)
            return;
        Object.values(template.items ?? {}).forEach((item) => {
            if (item.hash === hash)
                dependents.add(templateHash);
        });
    });
    return Array.from(dependents);
};
const findTemplateUsages = (tabs, hash) => {
    const usages = new Set();
    tabs.forEach(([, tab]) => {
        tab.ctx.itemStore.export().forEach(([id, item]) => {
            if (item.hash === hash)
                usages.add(id);
        });
    });
    return Array.from(usages);
};
const buildTemplateFromSelection = (ctx) => {
    const name = ctx.payload.name.trim();
    if (!name)
        throw new Error("Custom component name is required.");
    const selected = new Set(ctx.payload.selectedItemIds);
    if (!selected.size)
        throw new Error("Select at least one component to save.");
    const scopedItems = ctx.items.filter((item) => itemInScope(ctx.scope, item));
    const scopedItemIds = new Set(scopedItems.map((item) => item.id));
    const scopedLinks = ctx.links.filter((link) => scopedItemIds.has(link.fromItemId) && scopedItemIds.has(link.toItemId));
    const itemsById = new Map(scopedItems.map((item) => [item.id, item]));
    const missingIds = Array.from(selected).filter((id) => !itemsById.has(id));
    if (missingIds.length) {
        throw new Error(`Selected item(s) were not found in the active scope: ${missingIds.join(", ")}.`);
    }
    const selectedItems = Array.from(selected, (id) => itemsById.get(id)).filter((item) => Boolean(item));
    if (!selectedItems.length)
        throw new Error("No selected engine items were found.");
    const links = scopedLinks;
    const buckets = buildLinkBuckets(links);
    const coreIds = new Set(selectedItems.map((item) => item.id));
    const boundaryInputGroups = [];
    const boundaryOutputs = [];
    const boundaryLinkIds = new Set();
    const addInputGroup = (items) => {
        const unique = new Map(items.map((item) => [pinKey(item.itemId, item.pin), item]));
        if (unique.size)
            boundaryInputGroups.push(Array.from(unique.values()));
    };
    const addOutput = (output) => {
        const key = pinKey(output.itemId, output.pin);
        if (boundaryOutputs.some((existing) => pinKey(existing.itemId, existing.pin) === key))
            return;
        boundaryOutputs.push(output);
    };
    selectedItems.forEach((item) => {
        if (!isGeneratorItem(item) || item.hash !== "TOGGLE")
            return;
        const targets = itemOutputPins(item).flatMap((pin) => {
            const outputLinks = buckets.byOutputItemPin.get(pinKey(item.id, pin)) ?? [];
            return outputLinks
                .filter((link) => selected.has(link.toItemId))
                .map((link) => {
                boundaryLinkIds.add(buildLinkId(link));
                return { itemId: link.toItemId, pin: link.toPin };
            });
        });
        if (!targets.length)
            return;
        coreIds.delete(item.id);
        addInputGroup(targets);
    });
    selectedItems.forEach((item) => {
        if (!isDisplayItem(item))
            return;
        const outputs = itemInputPins(item).flatMap((pin) => {
            const link = buckets.byInputItemPin.get(pinKey(item.id, pin));
            if (!link || !selected.has(link.fromItemId))
                return [];
            boundaryLinkIds.add(buildLinkId(link));
            return [{ itemId: link.fromItemId, pin: link.fromPin }];
        });
        if (!outputs.length)
            return;
        coreIds.delete(item.id);
        outputs.forEach(addOutput);
    });
    const coreItems = selectedItems.filter((item) => coreIds.has(item.id));
    if (!coreItems.length) {
        throw new Error("Select at least one non-boundary component for the custom component body.");
    }
    const coreItemIds = new Set(coreItems.map((item) => item.id));
    const internalLinks = links.filter((link) => coreItemIds.has(link.fromItemId) &&
        coreItemIds.has(link.toItemId) &&
        !boundaryLinkIds.has(buildLinkId(link)));
    const internalLinkIds = new Set(internalLinks.map(buildLinkId));
    const boundaryInputsByExternalDriver = new Map();
    coreItems.forEach((item) => {
        itemInputPins(item).forEach((pin) => {
            const inputKey = pinKey(item.id, pin);
            const incoming = buckets.byInputItemPin.get(inputKey);
            if (incoming && internalLinkIds.has(buildLinkId(incoming)))
                return;
            if (incoming && boundaryLinkIds.has(buildLinkId(incoming)))
                return;
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
    const innerItems = {};
    coreItems.forEach((item) => {
        const inputLinks = {};
        const outputLinks = {};
        internalLinks.forEach((link) => {
            const id = buildLinkId(link);
            if (link.toItemId === item.id)
                inputLinks[link.toPin] = id;
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
        const listTemplates = (() => ctx.deps.stores.template.export().map(([, template]) => summarizeTemplate(template)));
        return listTemplates;
    },
}));
export const getTemplateUC = ApiFactories.config((tokens) => ({
    token: tokens.template.get,
    factory: (ctx) => {
        const getTemplate = ((payload) => ctx.tools.global.getTemplate(payload.hash));
        return getTemplate;
    },
}));
export const saveTemplateUC = ApiFactories.config((tokens) => ({
    token: tokens.template.save,
    factory: (ctx) => {
        const saveTemplate = ((payload) => {
            const template = validateCustomTemplate(payload.template);
            ctx.tools.global.saveTemplate(template);
            refreshTemplateRuntimes(ctx);
            return summarizeTemplate(ctx.tools.global.getTemplate(template.hash));
        });
        return saveTemplate;
    },
}));
export const updateTemplateUC = ApiFactories.config((tokens) => ({
    token: tokens.template.update,
    factory: (ctx) => {
        const updateTemplate = ((payload) => {
            const existing = assertCustomTemplate(ctx.tools.global.getTemplate(payload.hash));
            const name = payload.name.trim();
            if (!name)
                throw new Error("Custom component name is required.");
            const updated = {
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
            refreshTemplateRuntimes(ctx);
            return summarizeTemplate(ctx.tools.global.getTemplate(updated.hash));
        });
        return updateTemplate;
    },
}));
export const removeTemplateUC = ApiFactories.config((tokens) => ({
    token: tokens.template.remove,
    factory: (ctx) => {
        const removeTemplate = ((payload) => {
            const existing = assertCustomTemplate(ctx.tools.global.getTemplate(payload.hash));
            const dependents = findTemplateDependencies(ctx.deps.stores.template.export(), payload.hash);
            if (dependents.length) {
                throw new Error(`Custom component "${existing.name}" is still used by custom template(s): ${dependents.join(", ")}.`);
            }
            const usages = findTemplateUsages(ctx.deps.stores.tab.export(), payload.hash);
            if (usages.length) {
                throw new Error(`Custom component "${existing.name}" is still used by ${usages.length} item(s): ${usages.join(", ")}.`);
            }
            ctx.tools.global.removeTemplate(payload.hash);
            ctx.deps.services.itemCompute.bakeStore.remove(payload.hash);
            refreshTemplateRuntimes(ctx);
            return { removed: true, template: summarizeTemplate(existing) };
        });
        return removeTemplate;
    },
}));
export const createTemplateFromSelectionUC = ApiFactories.config((tokens) => ({
    token: tokens.template.createFromSelection,
    factory: (ctx) => {
        const createTemplateFromSelection = ((payload) => {
            const tab = ctx.tools.global.getTab(payload.tabId);
            const scope = tab.ctx.scopeStore.get(payload.scopeId ?? payload.tabId) ??
                (() => {
                    throw E.scope.NotFound(payload.scopeId ?? payload.tabId);
                })();
            const template = validateCustomTemplate(buildTemplateFromSelection({
                payload,
                scope,
                items: tab.ctx.itemStore.export().map(([, item]) => item),
                links: tab.ctx.linkStore.export().map(([, link]) => link),
            }));
            if (ctx.deps.stores.template.get(template.hash)) {
                throw new Error(`Template "${template.hash}" already exists.`);
            }
            ctx.tools.global.saveTemplate(template);
            refreshTemplateRuntimes(ctx);
            const compiled = validateCustomTemplate(ctx.tools.global.getTemplate(template.hash));
            return {
                template: compiled,
                summary: summarizeTemplate(compiled),
            };
        });
        return createTemplateFromSelection;
    },
}));
