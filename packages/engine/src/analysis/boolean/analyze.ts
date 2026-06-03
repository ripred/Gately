import {
    hasItemInputPins,
    hasItemOutputPins,
    Id,
    isDisplayItem,
    isGeneratorItem,
    isLogicItem,
    ItemLink,
    ItemOfKind,
    PinIndex,
    Scope,
} from "@cnbn/schema";
import type {
    BooleanAnalysisIssue,
    BooleanAnalysisResult,
    BooleanBit,
    BooleanOutput,
    BooleanTruthTableRow,
    BooleanVariable,
} from "./types";
import { buildPosExpression, buildSopExpression, enumerateMinterms } from "./minimize";
import { buildKarnaughMap } from "./kmap";
import {
    buildOptimizedNetlist,
    countOptimizedSopGates,
    countOriginalLogicGates,
} from "./synthesize";

type AnalyzeScopeArgs = {
    tabId: Id;
    scope: Scope;
    items: ItemOfKind[];
    links: ItemLink[];
};

type EvaluationResult = {
    outputs: Record<string, BooleanBit>;
    issues: BooleanAnalysisIssue[];
};

type WireTarget = {
    itemId: Id;
    pin: PinIndex;
};

const VARIABLE_GENERATORS = new Set(["TOGGLE", "PUSH_BUTTON"]);
const FIXED_GENERATORS = new Map<string, BooleanBit>([
    ["TRUE_CONSTANT", "1"],
    ["FALSE_CONSTANT", "0"],
]);
const SUPPORTED_LOGIC = new Set(["BUFFER", "NOT", "AND", "OR", "NOR", "NAND", "XOR", "XNOR"]);
const SYMBOLS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const buildOutputId = (itemId: Id, pin: PinIndex): string => `${itemId}:${pin}`;

const labelFor = (item: ItemOfKind, pin: PinIndex): string => {
    const name = item.name || item.hash || item.id;
    return `${name}.${pin}`;
};

const makeVariableSymbol = (index: number): string => {
    return SYMBOLS[index] ?? `I${index + 1}`;
};

const comparePin = (left: string, right: string): number => {
    const a = Number(left);
    const b = Number(right);

    if (Number.isFinite(a) && Number.isFinite(b)) return a - b;
    return left.localeCompare(right);
};

const itemInScope = (scope: Scope, item: ItemOfKind): boolean => {
    return item.path[item.path.length - 1] === scope.id || scope.storedItems.has(item.id);
};

const collectVariables = (items: ItemOfKind[]): BooleanVariable[] => {
    return items
        .filter(isGeneratorItem)
        .filter((item) => VARIABLE_GENERATORS.has(item.hash))
        .flatMap((item) => {
            if (!hasItemOutputPins(item)) return [];

            return Object.keys(item.outputPins)
                .sort(comparePin)
                .map((pin) => ({
                    id: buildOutputId(item.id, pin),
                    itemId: item.id,
                    pin,
                    label: labelFor(item, pin),
                    symbol: "",
                }));
        })
        .sort((a, b) => a.itemId.localeCompare(b.itemId) || comparePin(a.pin, b.pin))
        .map((variable, index) => ({ ...variable, symbol: makeVariableSymbol(index) }));
};

const collectOutputs = (items: ItemOfKind[]): BooleanOutput[] => {
    return items
        .filter(isDisplayItem)
        .flatMap((item) => {
            if (!hasItemInputPins(item)) return [];

            return Object.keys(item.inputPins)
                .sort(comparePin)
                .map((pin) => ({
                    id: buildOutputId(item.id, pin),
                    itemId: item.id,
                    pin,
                    label: labelFor(item, pin),
                }));
        })
        .sort((a, b) => a.itemId.localeCompare(b.itemId) || comparePin(a.pin, b.pin));
};

const buildFanout = (links: ItemLink[]): Map<string, WireTarget[]> => {
    const fanout = new Map<string, WireTarget[]>();

    links.forEach((link) => {
        const key = buildOutputId(link.fromItemId, link.fromPin);
        fanout.set(key, [...(fanout.get(key) ?? []), { itemId: link.toItemId, pin: link.toPin }]);
    });

    return fanout;
};

const buildIncoming = (links: ItemLink[]): Map<string, ItemLink[]> => {
    const incoming = new Map<string, ItemLink[]>();

    links.forEach((link) => {
        const key = buildOutputId(link.toItemId, link.toPin);
        incoming.set(key, [...(incoming.get(key) ?? []), link]);
    });

    return incoming;
};

const setInputValue = (
    inputs: Map<string, BooleanBit>,
    target: WireTarget,
    value: BooleanBit,
    issues: BooleanAnalysisIssue[]
): boolean => {
    const key = buildOutputId(target.itemId, target.pin);
    const existing = inputs.get(key);

    if (existing !== undefined && existing !== value) {
        issues.push({
            severity: "error",
            code: "conflicting-input-drivers",
            message: `Input ${key} receives conflicting values.`,
            itemId: target.itemId,
            pin: target.pin,
        });
        return false;
    }

    if (existing === value) return false;
    inputs.set(key, value);
    return true;
};

const readGateInputs = (
    item: ItemOfKind,
    inputs: Map<string, BooleanBit>
): BooleanBit[] | undefined => {
    if (!hasItemInputPins(item)) return [];
    const values: BooleanBit[] = [];

    for (const pin of Object.keys(item.inputPins).sort(comparePin)) {
        const value = inputs.get(buildOutputId(item.id, pin));
        if (value === undefined) return;
        values.push(value);
    }

    return values;
};

const evalLogicGate = (hash: string, inputs: BooleanBit[]): BooleanBit | undefined => {
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

const evaluateAssignment = (
    items: ItemOfKind[],
    links: ItemLink[],
    variables: BooleanVariable[],
    outputs: BooleanOutput[],
    assignment: BooleanBit[]
): EvaluationResult => {
    const issues: BooleanAnalysisIssue[] = [];
    const fanout = buildFanout(links);
    const incoming = buildIncoming(links);
    const outputValues = new Map<string, BooleanBit>();
    const inputValues = new Map<string, BooleanBit>();

    const propagate = (itemId: Id, pin: PinIndex, value: BooleanBit): boolean => {
        const key = buildOutputId(itemId, pin);
        const existing = outputValues.get(key);

        if (existing === value) return false;
        outputValues.set(key, value);

        let changed = false;
        for (const target of fanout.get(key) ?? []) {
            changed = setInputValue(inputValues, target, value, issues) || changed;
        }
        return changed;
    };

    variables.forEach((variable, index) => {
        propagate(variable.itemId, variable.pin, assignment[index]);
    });

    items.filter(isGeneratorItem).forEach((item) => {
        const fixedValue = FIXED_GENERATORS.get(item.hash);
        if (!fixedValue || !hasItemOutputPins(item)) return;

        Object.keys(item.outputPins).forEach((pin) => {
            propagate(item.id, pin, fixedValue);
        });
    });

    const unsupported = items.filter((item) => {
        if (isLogicItem(item)) return !SUPPORTED_LOGIC.has(item.hash);
        if (isGeneratorItem(item)) return !VARIABLE_GENERATORS.has(item.hash) && !FIXED_GENERATORS.has(item.hash);
        return false;
    });

    unsupported.forEach((item) => {
        issues.push({
            severity: "error",
            code: "unsupported-item",
            message: `Unsupported item "${item.name}" (${item.hash}) in Boolean analysis.`,
            itemId: item.id,
        });
    });

    const maxPasses = Math.max(items.length * 2, 1);

    for (let pass = 0; pass < maxPasses; pass++) {
        let changed = false;

        for (const item of items.filter(isLogicItem)) {
            if (!SUPPORTED_LOGIC.has(item.hash) || !hasItemOutputPins(item)) continue;

            const values = readGateInputs(item, inputValues);
            if (!values) continue;

            const result = evalLogicGate(item.hash, values);
            if (result === undefined) continue;

            Object.keys(item.outputPins).forEach((pin) => {
                changed = propagate(item.id, pin, result) || changed;
            });
        }

        if (!changed) break;
    }

    const resolvedOutputs: Record<string, BooleanBit> = {};

    outputs.forEach((output) => {
        const targetKey = buildOutputId(output.itemId, output.pin);
        const drivers = incoming.get(targetKey) ?? [];

        if (drivers.length !== 1) {
            issues.push({
                severity: "error",
                code: "unresolved-output",
                message: `Output ${output.label} must have exactly one driver.`,
                itemId: output.itemId,
                pin: output.pin,
            });
            return;
        }

        const driver = drivers[0];
        const value = outputValues.get(buildOutputId(driver.fromItemId, driver.fromPin));

        if (!value) {
            issues.push({
                severity: "error",
                code: "unresolved-output-value",
                message: `Could not resolve a binary value for output ${output.label}.`,
                itemId: output.itemId,
                pin: output.pin,
            });
            return;
        }

        resolvedOutputs[output.id] = value;
    });

    items.forEach((item) => {
        if (!hasItemInputPins(item) || isDisplayItem(item)) return;

        Object.keys(item.inputPins).forEach((pin) => {
            const key = buildOutputId(item.id, pin);
            if (inputValues.has(key)) return;

            issues.push({
                severity: "error",
                code: "floating-input",
                message: `Input ${item.name}.${pin} is not driven by a binary signal.`,
                itemId: item.id,
                pin,
            });
        });
    });

    return { outputs: resolvedOutputs, issues };
};

const hasErrors = (issues: BooleanAnalysisIssue[]): boolean => {
    return issues.some((issue) => issue.severity === "error");
};

export const analyzeBooleanScope = ({
    tabId,
    scope,
    items,
    links,
}: AnalyzeScopeArgs): BooleanAnalysisResult => {
    const scopedItems = items.filter((item) => itemInScope(scope, item));
    const scopedItemIds = new Set(scopedItems.map((item) => item.id));
    const scopedLinks = links.filter(
        (link) => scopedItemIds.has(link.fromItemId) && scopedItemIds.has(link.toItemId)
    );
    const variables = collectVariables(scopedItems);
    const outputs = collectOutputs(scopedItems);
    const issues: BooleanAnalysisIssue[] = [];

    if (!variables.length) {
        issues.push({
            severity: "error",
            code: "no-inputs",
            message: "Boolean analysis needs at least one TOGGLE or PUSH_BUTTON input.",
        });
    }

    if (!outputs.length) {
        issues.push({
            severity: "error",
            code: "no-outputs",
            message: "Boolean analysis needs at least one LAMP or display output.",
        });
    }

    if (variables.length > 8) {
        issues.push({
            severity: "error",
            code: "too-many-inputs",
            message: "Boolean analysis is capped at 8 inputs to avoid exponential work.",
        });
    }

    const truthTable: BooleanTruthTableRow[] = [];

    if (!hasErrors(issues)) {
        for (const minterm of enumerateMinterms(variables.length)) {
            const inputs = minterm
                .toString(2)
                .padStart(variables.length, "0")
                .split("") as BooleanBit[];
            const evaluated = evaluateAssignment(scopedItems, scopedLinks, variables, outputs, inputs);
            issues.push(...evaluated.issues);

            truthTable.push({
                minterm,
                inputs,
                outputs: evaluated.outputs,
            });
        }
    }

    const outputIds = outputs.map((output) => output.id);
    const variableSymbols = variables.map((variable) => variable.symbol);
    const optimizedOutputs = outputIds.map((outputId) => {
        const output = outputs.find((candidate) => candidate.id === outputId)!;
        const minterms = truthTable
            .filter((row) => row.outputs[outputId] === "1")
            .map((row) => row.minterm);
        const maxterms = truthTable
            .filter((row) => row.outputs[outputId] === "0")
            .map((row) => row.minterm);

        return {
            output,
            minterms,
            maxterms,
            sop: buildSopExpression(minterms, variableSymbols),
            pos: buildPosExpression(maxterms, variableSymbols),
            karnaughMap: buildKarnaughMap(outputId, variableSymbols, truthTable),
        };
    });
    const optimizedNetlist = buildOptimizedNetlist(variables, optimizedOutputs);
    const originalGateCount = countOriginalLogicGates(scopedItems);
    const optimizedGateCount = countOptimizedSopGates(optimizedOutputs);

    return {
        tabId,
        scopeId: scope.id,
        variables,
        outputs,
        truthTable,
        optimizedOutputs,
        optimizedNetlist,
        originalGateCount,
        optimizedGateCount,
        issues,
    };
};
