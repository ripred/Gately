import type { Id, PinIndex } from "@cnbn/schema";

export type BooleanBit = "0" | "1";
export type BooleanTermBit = BooleanBit | "-";

export type BooleanAnalysisIssueSeverity = "error" | "warning";

export type BooleanAnalysisIssue = {
    severity: BooleanAnalysisIssueSeverity;
    code: string;
    message: string;
    itemId?: Id;
    pin?: PinIndex;
};

export type BooleanVariable = {
    id: string;
    itemId: Id;
    pin: PinIndex;
    label: string;
    symbol: string;
};

export type BooleanOutput = {
    id: string;
    itemId: Id;
    pin: PinIndex;
    label: string;
};

export type BooleanTruthTableRow = {
    minterm: number;
    inputs: BooleanBit[];
    outputs: Record<string, BooleanBit>;
};

export type BooleanImplicant = {
    bits: BooleanTermBit[];
    minterms: number[];
};

export type BooleanExpression = {
    expression: string;
    terms: BooleanImplicant[];
    literalCount: number;
    gateCountEstimate: number;
    isConstant: boolean;
};

export type KarnaughMapCell = {
    minterm: number;
    bits: BooleanBit[];
    value: BooleanBit;
};

export type KarnaughMap = {
    outputId: string;
    rowVariables: string[];
    columnVariables: string[];
    rowLabels: string[];
    columnLabels: string[];
    cells: KarnaughMapCell[][];
};

export type BooleanOptimizedOutput = {
    output: BooleanOutput;
    minterms: number[];
    maxterms: number[];
    sop: BooleanExpression;
    pos: BooleanExpression;
    karnaughMap?: KarnaughMap;
};

export type BooleanSynthNodeKind = "INPUT" | "CONST" | "NOT" | "AND" | "OR" | "OUTPUT";

export type BooleanSynthNode = {
    id: string;
    kind: BooleanSynthNodeKind;
    label: string;
    sourceVariableId?: string;
    value?: BooleanBit;
};

export type BooleanSynthLink = {
    from: string;
    to: string;
};

export type BooleanSynthNetlist = {
    nodes: BooleanSynthNode[];
    links: BooleanSynthLink[];
    gateCount: number;
};

export type BooleanAnalysisResult = {
    tabId: Id;
    scopeId: Id;
    variables: BooleanVariable[];
    outputs: BooleanOutput[];
    truthTable: BooleanTruthTableRow[];
    optimizedOutputs: BooleanOptimizedOutput[];
    optimizedNetlist: BooleanSynthNetlist;
    originalGateCount: number;
    optimizedGateCount: number;
    issues: BooleanAnalysisIssue[];
};

export type BooleanAnalysisScopeInput = {
    tabId: Id;
    scopeId?: Id;
};
