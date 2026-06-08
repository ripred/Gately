import { parseLinkId } from "@cnbn/helpers";
const BAKE_INPUT_LIMIT = 12;
const SUPPORTED_LOGIC = new Set(["BUFFER", "NOT", "AND", "OR", "NOR", "NAND", "XOR", "XNOR"]);
const FIXED_GENERATORS = new Map([
    ["FALSE_CONSTANT", "0"],
    ["TRUE_CONSTANT", "1"],
]);
const STATEFUL_GENERATORS = new Set(["TOGGLE", "PUSH_BUTTON", "CLOCK"]);
const STATEFUL_LOGIC = new Set(["SHIFT_REGISTER_8"]);
const isCustomTemplate = (template) => template.kind === "circuit:logic" && Boolean(template.meta?.custom);
const comparePin = (left, right) => {
    const a = Number(left);
    const b = Number(right);
    if (Number.isFinite(a) && Number.isFinite(b))
        return a - b;
    return left.localeCompare(right);
};
const pinKeys = (pins) => Object.keys(pins).sort(comparePin);
const outputKey = (itemId, pin) => `${itemId}:${pin}`;
const stableStringify = (value) => {
    if (Array.isArray(value))
        return `[${value.map(stableStringify).join(",")}]`;
    if (value && typeof value === "object") {
        const entries = Object.entries(value)
            .filter(([key]) => key !== "runtime" && key !== "baked")
            .sort(([left], [right]) => left.localeCompare(right));
        return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
    }
    return JSON.stringify(value);
};
const templateSignature = (template, dependencySignatures) => stableStringify({
    hash: template.hash,
    inputPins: template.inputPins,
    items: template.items,
    outputPins: template.outputPins,
    dependencySignatures,
});
const inputCountForLogic = (item) => {
    if (item.hash === "BUFFER" || item.hash === "NOT")
        return 1;
    return item.meta?.numOfInputs ?? 2;
};
const outputCountForLogic = (item) => item.meta?.numOfOutputs ?? 1;
const outputCountForGenerator = (item) => item.meta?.numOfOutputs ?? 1;
const inputCountForCircuit = (template) => pinKeys(template.inputPins).length;
const outputCountForCircuit = (template) => pinKeys(template.outputPins).length;
const collectLinks = (template) => {
    const links = new Map();
    Object.values(template.items).forEach((item) => {
        Object.values(item.inputLinks ?? {}).forEach((linkId) => {
            const link = parseLinkId(linkId);
            links.set(linkId, link);
        });
        Object.values(item.outputLinks ?? {}).forEach((linkIds) => {
            linkIds.forEach((linkId) => {
                const link = parseLinkId(linkId);
                links.set(linkId, link);
            });
        });
    });
    return Array.from(links.values());
};
const hasDirectedCycle = (template) => {
    const itemIds = new Set(Object.keys(template.items));
    const graph = new Map();
    itemIds.forEach((id) => graph.set(id, []));
    collectLinks(template).forEach((link) => {
        if (!itemIds.has(link.fromItemId) || !itemIds.has(link.toItemId))
            return;
        graph.get(link.fromItemId)?.push(link.toItemId);
    });
    const visiting = new Set();
    const visited = new Set();
    const visit = (id) => {
        if (visiting.has(id))
            return true;
        if (visited.has(id))
            return false;
        visiting.add(id);
        for (const next of graph.get(id) ?? []) {
            if (visit(next))
                return true;
        }
        visiting.delete(id);
        visited.add(id);
        return false;
    };
    return Array.from(itemIds).some(visit);
};
const buildFanout = (links) => {
    const fanout = new Map();
    links.forEach((link) => {
        const key = outputKey(link.fromItemId, link.fromPin);
        const targets = fanout.get(key) ?? [];
        targets.push({ itemId: link.toItemId, pin: link.toPin });
        fanout.set(key, targets);
    });
    return fanout;
};
const evalLogic = (hash, inputs) => {
    switch (hash) {
        case "BUFFER":
            return inputs[0];
        case "NOT":
            return inputs[0] === "1" ? "0" : "1";
        case "AND":
            return inputs.every((value) => value === "1") ? "1" : "0";
        case "OR":
            return inputs.some((value) => value === "1") ? "1" : "0";
        case "NAND":
            return inputs.every((value) => value === "1") ? "0" : "1";
        case "NOR":
            return inputs.some((value) => value === "1") ? "0" : "1";
        case "XOR":
            return inputs.filter((value) => value === "1").length % 2 === 1 ? "1" : "0";
        case "XNOR":
            return inputs.filter((value) => value === "1").length % 2 === 1 ? "0" : "1";
        default:
            return;
    }
};
class TemplateRuntimeCompiler {
    now;
    memo = new Map();
    templateMap;
    constructor(templates, now) {
        this.now = now;
        this.templateMap = new Map(templates);
    }
    compile(hash, stack = []) {
        const existing = this.memo.get(hash);
        if (existing)
            return existing;
        const template = this.templateMap.get(hash);
        if (!template || template.kind !== "circuit:logic")
            return;
        if (stack.includes(hash)) {
            return this.decorate(template, {
                dependencySignatures: {},
                mode: "expanded-stateful",
                reason: "recursive-custom-component",
            });
        }
        const analyzed = this.analyze(template, [...stack, hash]);
        const compiled = this.decorate(template, analyzed);
        this.memo.set(hash, compiled);
        return compiled;
    }
    decorate(template, analyzed) {
        const inputCount = inputCountForCircuit(template);
        const outputCount = outputCountForCircuit(template);
        const signature = templateSignature(template, analyzed.dependencySignatures);
        const previousRuntime = template.meta?.runtime;
        const rowCount = analyzed.bakeTable?.length;
        const unchanged = previousRuntime?.mode === analyzed.mode &&
            previousRuntime.reason === analyzed.reason &&
            previousRuntime.inputCount === inputCount &&
            previousRuntime.outputCount === outputCount &&
            previousRuntime.rowCount === rowCount &&
            previousRuntime.signature === signature;
        const runtime = {
            mode: analyzed.mode,
            reason: analyzed.reason,
            inputCount,
            outputCount,
            rowCount,
            signature,
            updatedAt: unchanged ? previousRuntime.updatedAt : this.now,
        };
        const options = { ...template.options };
        if (analyzed.mode === "baked-combinational")
            options.baked = true;
        else
            delete options.baked;
        return {
            bakeTable: analyzed.bakeTable,
            runtime,
            template: {
                ...template,
                meta: {
                    ...template.meta,
                    runtime,
                },
                options: Object.keys(options).length ? options : undefined,
            },
        };
    }
    analyze(template, stack) {
        const dependencySignatures = {};
        if (hasDirectedCycle(template)) {
            return {
                dependencySignatures,
                mode: "expanded-stateful",
                reason: "feedback-loop",
            };
        }
        const inputCount = inputCountForCircuit(template);
        if (inputCount > BAKE_INPUT_LIMIT) {
            return {
                dependencySignatures,
                mode: "expanded-unsupported",
                reason: "too-many-inputs",
            };
        }
        for (const item of Object.values(template.items)) {
            if (item.kind === "base:logic") {
                if (STATEFUL_LOGIC.has(item.hash)) {
                    return {
                        dependencySignatures,
                        mode: "expanded-stateful",
                        reason: "stateful-logic",
                    };
                }
                if (!SUPPORTED_LOGIC.has(item.hash)) {
                    return {
                        dependencySignatures,
                        mode: "expanded-unsupported",
                        reason: `unsupported-logic:${item.hash}`,
                    };
                }
            }
            else if (item.kind === "base:generator") {
                if (FIXED_GENERATORS.has(item.hash))
                    continue;
                if (STATEFUL_GENERATORS.has(item.hash)) {
                    return {
                        dependencySignatures,
                        mode: "expanded-stateful",
                        reason: "stateful-generator",
                    };
                }
                return {
                    dependencySignatures,
                    mode: "expanded-unsupported",
                    reason: `unsupported-generator:${item.hash}`,
                };
            }
            else if (item.kind === "base:display") {
                return {
                    dependencySignatures,
                    mode: "expanded-unsupported",
                    reason: "display-in-body",
                };
            }
            else if (item.kind === "circuit:logic") {
                const nested = this.compile(item.hash, stack);
                if (!nested) {
                    return {
                        dependencySignatures,
                        mode: "expanded-unsupported",
                        reason: `missing-template:${item.hash}`,
                    };
                }
                dependencySignatures[item.hash] = nested.runtime.signature;
                if (nested.runtime.mode === "expanded-stateful") {
                    return {
                        dependencySignatures,
                        mode: "expanded-stateful",
                        reason: `nested-stateful:${item.hash}`,
                    };
                }
                if (nested.runtime.mode === "expanded-unsupported") {
                    return {
                        dependencySignatures,
                        mode: "expanded-unsupported",
                        reason: `nested-unsupported:${item.hash}`,
                    };
                }
            }
        }
        const rowCount = 2 ** inputCount;
        const bakeTable = [];
        for (let row = 0; row < rowCount; row++) {
            const inputs = row
                .toString(2)
                .padStart(inputCount, "0")
                .split("");
            const evaluated = this.evaluate(template, inputs);
            if (evaluated.unresolved) {
                return {
                    dependencySignatures,
                    mode: "expanded-unsupported",
                    reason: evaluated.unresolved,
                };
            }
            bakeTable.push(evaluated.outputs);
        }
        return {
            bakeTable,
            dependencySignatures,
            mode: "baked-combinational",
        };
    }
    evaluate(template, assignment) {
        const links = collectLinks(template);
        const fanout = buildFanout(links);
        const inputValues = new Map();
        const outputValues = new Map();
        const setInput = (itemId, pin, value) => {
            const key = outputKey(itemId, pin);
            const existing = inputValues.get(key);
            if (existing !== undefined && existing !== value)
                return "conflicting-input-drivers";
            inputValues.set(key, value);
            return;
        };
        const propagate = (itemId, pin, value) => {
            const key = outputKey(itemId, pin);
            const existing = outputValues.get(key);
            if (existing === value)
                return;
            if (existing !== undefined && existing !== value)
                return "conflicting-output-drivers";
            outputValues.set(key, value);
            for (const target of fanout.get(key) ?? []) {
                const issue = setInput(target.itemId, target.pin, value);
                if (issue)
                    return issue;
            }
            return;
        };
        for (const [index, pin] of pinKeys(template.inputPins).entries()) {
            const value = assignment[index];
            for (const inputItem of template.inputPins[pin].inputItems ?? []) {
                const issue = setInput(inputItem.itemId, inputItem.pin, value);
                if (issue)
                    return { outputs: "", unresolved: issue };
            }
        }
        for (const [itemId, item] of Object.entries(template.items)) {
            if (item.kind !== "base:generator")
                continue;
            const generator = item;
            const fixedValue = FIXED_GENERATORS.get(generator.hash);
            if (!fixedValue)
                continue;
            for (let output = 0; output < outputCountForGenerator(generator); output++) {
                const issue = propagate(itemId, String(output), fixedValue);
                if (issue)
                    return { outputs: "", unresolved: issue };
            }
        }
        const maxPasses = Math.max(Object.keys(template.items).length * 2, 1);
        for (let pass = 0; pass < maxPasses; pass++) {
            let changed = false;
            for (const [itemId, item] of Object.entries(template.items)) {
                if (item.kind === "base:logic") {
                    const logic = item;
                    const values = [];
                    for (let input = 0; input < inputCountForLogic(logic); input++) {
                        const value = inputValues.get(outputKey(itemId, String(input)));
                        if (value === undefined) {
                            values.length = 0;
                            break;
                        }
                        values.push(value);
                    }
                    if (!values.length && inputCountForLogic(logic) > 0)
                        continue;
                    const result = evalLogic(logic.hash, values);
                    if (result === undefined)
                        continue;
                    for (let output = 0; output < outputCountForLogic(logic); output++) {
                        const before = outputValues.get(outputKey(itemId, String(output)));
                        const issue = propagate(itemId, String(output), result);
                        if (issue)
                            return { outputs: "", unresolved: issue };
                        if (before !== result)
                            changed = true;
                    }
                }
                else if (item.kind === "circuit:logic") {
                    const nested = this.compile(item.hash);
                    if (!nested?.bakeTable)
                        return { outputs: "", unresolved: "nested-not-baked" };
                    const inputPins = pinKeys(nested.template.inputPins);
                    const inputPattern = [];
                    for (const pin of inputPins) {
                        const value = inputValues.get(outputKey(itemId, pin));
                        if (value === undefined) {
                            inputPattern.length = 0;
                            break;
                        }
                        inputPattern.push(value);
                    }
                    if (inputPattern.length !== inputPins.length)
                        continue;
                    const rowIndex = parseInt(inputPattern.join(""), 2);
                    const outputPattern = nested.bakeTable[rowIndex];
                    if (outputPattern === undefined) {
                        return { outputs: "", unresolved: "nested-missing-row" };
                    }
                    for (const [outputIndex, pin] of pinKeys(nested.template.outputPins).entries()) {
                        const bit = outputPattern[outputIndex];
                        if (!bit)
                            return { outputs: "", unresolved: "nested-missing-output" };
                        const before = outputValues.get(outputKey(itemId, pin));
                        const issue = propagate(itemId, pin, bit);
                        if (issue)
                            return { outputs: "", unresolved: issue };
                        if (before !== bit)
                            changed = true;
                    }
                }
            }
            if (!changed)
                break;
        }
        const outputs = [];
        for (const pin of pinKeys(template.outputPins)) {
            const outputItem = template.outputPins[pin].outputItem;
            if (!outputItem)
                return { outputs: "", unresolved: "missing-output-source" };
            const value = outputValues.get(outputKey(outputItem.itemId, outputItem.pin));
            if (!value)
                return { outputs: "", unresolved: "unresolved-output" };
            outputs.push(value);
        }
        return { outputs: outputs.join("") };
    }
}
export const recomputeCustomTemplateRuntimes = (ctx) => {
    const compiler = new TemplateRuntimeCompiler(ctx.templateStore.export(), ctx.now ?? Date.now());
    const customHashes = ctx.templateStore
        .export()
        .filter(([, template]) => isCustomTemplate(template))
        .map(([hash]) => hash);
    customHashes.forEach((hash) => ctx.bakeStore.remove(hash));
    customHashes.forEach((hash) => {
        const compiled = compiler.compile(hash);
        if (!compiled)
            return;
        ctx.templateStore.insert(hash, compiled.template);
        if (compiled.bakeTable)
            ctx.bakeStore.insert(hash, compiled.bakeTable);
    });
};
export const compileCustomTemplateRuntimeForTest = (template, dependencies = [], now = Date.now()) => {
    const compiler = new TemplateRuntimeCompiler([[template.hash, template], ...dependencies], now);
    const compiled = compiler.compile(template.hash);
    if (!compiled)
        throw new Error(`Unable to compile template "${template.hash}".`);
    return compiled;
};
