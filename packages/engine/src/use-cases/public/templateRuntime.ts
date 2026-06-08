import { parseLinkId } from "@cnbn/helpers";
import type {
    CustomComponentRuntimeMeta,
    CustomComponentRuntimeMode,
    Id,
    InnerItem,
    InnerItemInputLinks,
    InnerItemOutputLinks,
    ItemLink,
    PinIndex,
    TemplateOfKind,
} from "@cnbn/schema";
import type {
    BakeStoreContract,
    BakeTable,
    TemplateLibraryContract,
} from "@cnbn/modules-runtime";

type BooleanBit = "0" | "1";

type InnerItemWithLinks = InnerItem & {
    inputLinks?: InnerItemInputLinks;
    outputLinks?: InnerItemOutputLinks;
};

type CompileResult = {
    template: TemplateOfKind<"circuit:logic">;
    runtime: CustomComponentRuntimeMeta;
    bakeTable?: BakeTable;
};

type AnalyzeResult = {
    mode: CustomComponentRuntimeMode;
    reason?: string;
    bakeTable?: BakeTable;
    dependencySignatures: Record<string, string>;
};

type EvaluationResult = {
    outputs: string;
    unresolved?: string;
};

const BAKE_INPUT_LIMIT = 12;
const SUPPORTED_LOGIC = new Set(["BUFFER", "NOT", "AND", "OR", "NOR", "NAND", "XOR", "XNOR"]);
const FIXED_GENERATORS = new Map<string, BooleanBit>([
    ["FALSE_CONSTANT", "0"],
    ["TRUE_CONSTANT", "1"],
]);
const STATEFUL_GENERATORS = new Set(["TOGGLE", "PUSH_BUTTON", "CLOCK"]);
const STATEFUL_LOGIC = new Set(["SHIFT_REGISTER_8"]);

const isCustomTemplate = (template: TemplateOfKind): template is TemplateOfKind<"circuit:logic"> =>
    template.kind === "circuit:logic" && Boolean(template.meta?.custom);

const comparePin = (left: string, right: string): number => {
    const a = Number(left);
    const b = Number(right);

    if (Number.isFinite(a) && Number.isFinite(b)) return a - b;
    return left.localeCompare(right);
};

const pinKeys = (pins: Record<string, unknown>): string[] => Object.keys(pins).sort(comparePin);

const outputKey = (itemId: Id, pin: PinIndex): string => `${itemId}:${pin}`;

const stableStringify = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    if (value && typeof value === "object") {
        const entries = Object.entries(value as Record<string, unknown>)
            .filter(([key]) => key !== "runtime" && key !== "baked")
            .sort(([left], [right]) => left.localeCompare(right));

        return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
    }

    return JSON.stringify(value);
};

const templateSignature = (
    template: TemplateOfKind<"circuit:logic">,
    dependencySignatures: Record<string, string>,
): string =>
    stableStringify({
        hash: template.hash,
        inputPins: template.inputPins,
        items: template.items,
        outputPins: template.outputPins,
        dependencySignatures,
    });

const inputCountForLogic = (item: InnerItem<"base:logic">): number => {
    if (item.hash === "BUFFER" || item.hash === "NOT") return 1;
    return item.meta?.numOfInputs ?? 2;
};

const outputCountForLogic = (item: InnerItem<"base:logic">): number =>
    item.meta?.numOfOutputs ?? 1;

const outputCountForGenerator = (item: InnerItem<"base:generator">): number =>
    item.meta?.numOfOutputs ?? 1;

const inputCountForCircuit = (template: TemplateOfKind<"circuit:logic">): number =>
    pinKeys(template.inputPins).length;

const outputCountForCircuit = (template: TemplateOfKind<"circuit:logic">): number =>
    pinKeys(template.outputPins).length;

const collectLinks = (template: TemplateOfKind<"circuit:logic">): ItemLink[] => {
    const links = new Map<string, ItemLink>();

    Object.values(template.items as Record<string, InnerItemWithLinks>).forEach((item) => {
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

const hasDirectedCycle = (template: TemplateOfKind<"circuit:logic">): boolean => {
    const itemIds = new Set(Object.keys(template.items));
    const graph = new Map<string, string[]>();
    itemIds.forEach((id) => graph.set(id, []));

    collectLinks(template).forEach((link) => {
        if (!itemIds.has(link.fromItemId) || !itemIds.has(link.toItemId)) return;
        graph.get(link.fromItemId)?.push(link.toItemId);
    });

    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (id: string): boolean => {
        if (visiting.has(id)) return true;
        if (visited.has(id)) return false;

        visiting.add(id);
        for (const next of graph.get(id) ?? []) {
            if (visit(next)) return true;
        }
        visiting.delete(id);
        visited.add(id);
        return false;
    };

    return Array.from(itemIds).some(visit);
};

const buildFanout = (links: ItemLink[]): Map<string, Array<{ itemId: Id; pin: PinIndex }>> => {
    const fanout = new Map<string, Array<{ itemId: Id; pin: PinIndex }>>();

    links.forEach((link) => {
        const key = outputKey(link.fromItemId, link.fromPin);
        const targets = fanout.get(key) ?? [];
        targets.push({ itemId: link.toItemId, pin: link.toPin });
        fanout.set(key, targets);
    });

    return fanout;
};

const evalLogic = (hash: string, inputs: BooleanBit[]): BooleanBit | undefined => {
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
    private readonly memo = new Map<string, CompileResult>();
    private readonly templateMap: Map<string, TemplateOfKind>;

    constructor(
        templates: ReadonlyArray<readonly [string, TemplateOfKind]>,
        private readonly now: number,
    ) {
        this.templateMap = new Map(templates);
    }

    public compile(hash: string, stack: string[] = []): CompileResult | undefined {
        const existing = this.memo.get(hash);
        if (existing) return existing;

        const template = this.templateMap.get(hash);
        if (!template || template.kind !== "circuit:logic") return;

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

    private decorate(
        template: TemplateOfKind<"circuit:logic">,
        analyzed: AnalyzeResult,
    ): CompileResult {
        const inputCount = inputCountForCircuit(template);
        const outputCount = outputCountForCircuit(template);
        const signature = templateSignature(template, analyzed.dependencySignatures);
        const previousRuntime = template.meta?.runtime;
        const rowCount = analyzed.bakeTable?.length;
        const unchanged =
            previousRuntime?.mode === analyzed.mode &&
            previousRuntime.reason === analyzed.reason &&
            previousRuntime.inputCount === inputCount &&
            previousRuntime.outputCount === outputCount &&
            previousRuntime.rowCount === rowCount &&
            previousRuntime.signature === signature;
        const runtime: CustomComponentRuntimeMeta = {
            mode: analyzed.mode,
            reason: analyzed.reason,
            inputCount,
            outputCount,
            rowCount,
            signature,
            updatedAt: unchanged ? previousRuntime.updatedAt : this.now,
        };
        const options = { ...template.options };
        if (analyzed.mode === "baked-combinational") options.baked = true;
        else delete options.baked;

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

    private analyze(template: TemplateOfKind<"circuit:logic">, stack: string[]): AnalyzeResult {
        const dependencySignatures: Record<string, string> = {};

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
            } else if (item.kind === "base:generator") {
                if (FIXED_GENERATORS.has(item.hash)) continue;
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
            } else if (item.kind === "base:display") {
                return {
                    dependencySignatures,
                    mode: "expanded-unsupported",
                    reason: "display-in-body",
                };
            } else if (item.kind === "circuit:logic") {
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
        const bakeTable: BakeTable = [];
        for (let row = 0; row < rowCount; row++) {
            const inputs = row
                .toString(2)
                .padStart(inputCount, "0")
                .split("") as BooleanBit[];
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

    private evaluate(
        template: TemplateOfKind<"circuit:logic">,
        assignment: BooleanBit[],
    ): EvaluationResult {
        const links = collectLinks(template);
        const fanout = buildFanout(links);
        const inputValues = new Map<string, BooleanBit>();
        const outputValues = new Map<string, BooleanBit>();

        const setInput = (itemId: Id, pin: PinIndex, value: BooleanBit): string | undefined => {
            const key = outputKey(itemId, pin);
            const existing = inputValues.get(key);
            if (existing !== undefined && existing !== value) return "conflicting-input-drivers";
            inputValues.set(key, value);
            return;
        };

        const propagate = (itemId: Id, pin: PinIndex, value: BooleanBit): string | undefined => {
            const key = outputKey(itemId, pin);
            const existing = outputValues.get(key);
            if (existing === value) return;
            if (existing !== undefined && existing !== value) return "conflicting-output-drivers";

            outputValues.set(key, value);
            for (const target of fanout.get(key) ?? []) {
                const issue = setInput(target.itemId, target.pin, value);
                if (issue) return issue;
            }
            return;
        };

        for (const [index, pin] of pinKeys(template.inputPins).entries()) {
            const value = assignment[index];
            for (const inputItem of template.inputPins[pin].inputItems ?? []) {
                const issue = setInput(inputItem.itemId, inputItem.pin, value);
                if (issue) return { outputs: "", unresolved: issue };
            }
        }

        for (const [itemId, item] of Object.entries(template.items)) {
            if (item.kind !== "base:generator") continue;
            const generator = item as InnerItem<"base:generator">;
            const fixedValue = FIXED_GENERATORS.get(generator.hash);
            if (!fixedValue) continue;

            for (let output = 0; output < outputCountForGenerator(generator); output++) {
                const issue = propagate(itemId, String(output), fixedValue);
                if (issue) return { outputs: "", unresolved: issue };
            }
        }

        const maxPasses = Math.max(Object.keys(template.items).length * 2, 1);
        for (let pass = 0; pass < maxPasses; pass++) {
            let changed = false;

            for (const [itemId, item] of Object.entries(template.items)) {
                if (item.kind === "base:logic") {
                    const logic = item as InnerItem<"base:logic">;
                    const values: BooleanBit[] = [];
                    for (let input = 0; input < inputCountForLogic(logic); input++) {
                        const value = inputValues.get(outputKey(itemId, String(input)));
                        if (value === undefined) {
                            values.length = 0;
                            break;
                        }
                        values.push(value);
                    }
                    if (!values.length && inputCountForLogic(logic) > 0) continue;

                    const result = evalLogic(logic.hash, values);
                    if (result === undefined) continue;

                    for (let output = 0; output < outputCountForLogic(logic); output++) {
                        const before = outputValues.get(outputKey(itemId, String(output)));
                        const issue = propagate(itemId, String(output), result);
                        if (issue) return { outputs: "", unresolved: issue };
                        if (before !== result) changed = true;
                    }
                } else if (item.kind === "circuit:logic") {
                    const nested = this.compile(item.hash);
                    if (!nested?.bakeTable) return { outputs: "", unresolved: "nested-not-baked" };

                    const inputPins = pinKeys(nested.template.inputPins);
                    const inputPattern: BooleanBit[] = [];
                    for (const pin of inputPins) {
                        const value = inputValues.get(outputKey(itemId, pin));
                        if (value === undefined) {
                            inputPattern.length = 0;
                            break;
                        }
                        inputPattern.push(value);
                    }
                    if (inputPattern.length !== inputPins.length) continue;

                    const rowIndex = parseInt(inputPattern.join(""), 2);
                    const outputPattern = nested.bakeTable[rowIndex];
                    if (outputPattern === undefined) {
                        return { outputs: "", unresolved: "nested-missing-row" };
                    }

                    for (const [outputIndex, pin] of pinKeys(nested.template.outputPins).entries()) {
                        const bit = outputPattern[outputIndex] as BooleanBit | undefined;
                        if (!bit) return { outputs: "", unresolved: "nested-missing-output" };

                        const before = outputValues.get(outputKey(itemId, pin));
                        const issue = propagate(itemId, pin, bit);
                        if (issue) return { outputs: "", unresolved: issue };
                        if (before !== bit) changed = true;
                    }
                }
            }

            if (!changed) break;
        }

        const outputs: BooleanBit[] = [];
        for (const pin of pinKeys(template.outputPins)) {
            const outputItem = template.outputPins[pin].outputItem;
            if (!outputItem) return { outputs: "", unresolved: "missing-output-source" };

            const value = outputValues.get(outputKey(outputItem.itemId, outputItem.pin));
            if (!value) return { outputs: "", unresolved: "unresolved-output" };
            outputs.push(value);
        }

        return { outputs: outputs.join("") };
    }
}

export const recomputeCustomTemplateRuntimes = (ctx: {
    bakeStore: BakeStoreContract;
    templateStore: TemplateLibraryContract;
    now?: number;
}): void => {
    const compiler = new TemplateRuntimeCompiler(ctx.templateStore.export(), ctx.now ?? Date.now());
    const customHashes = ctx.templateStore
        .export()
        .filter(([, template]) => isCustomTemplate(template))
        .map(([hash]) => hash);

    customHashes.forEach((hash) => ctx.bakeStore.remove(hash));

    customHashes.forEach((hash) => {
        const compiled = compiler.compile(hash);
        if (!compiled) return;

        ctx.templateStore.insert(hash, compiled.template);
        if (compiled.bakeTable) ctx.bakeStore.insert(hash, compiled.bakeTable);
    });
};

export const compileCustomTemplateRuntimeForTest = (
    template: TemplateOfKind<"circuit:logic">,
    dependencies: ReadonlyArray<readonly [string, TemplateOfKind]> = [],
    now = Date.now(),
): CompileResult => {
    const compiler = new TemplateRuntimeCompiler([[template.hash, template], ...dependencies], now);
    const compiled = compiler.compile(template.hash);
    if (!compiled) throw new Error(`Unable to compile template "${template.hash}".`);
    return compiled;
};
