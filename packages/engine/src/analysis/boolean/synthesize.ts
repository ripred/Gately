import type {
    BooleanImplicant,
    BooleanOptimizedOutput,
    BooleanSynthLink,
    BooleanSynthNetlist,
    BooleanSynthNode,
    BooleanVariable,
} from "./types";

const literalKey = (variableId: string, inverted: boolean): string => {
    return inverted ? `not:${variableId}` : `var:${variableId}`;
};

const countLiteralBits = (term: BooleanImplicant): number => {
    return term.bits.filter((bit) => bit !== "-").length;
};

export const buildOptimizedNetlist = (
    variables: BooleanVariable[],
    outputs: BooleanOptimizedOutput[]
): BooleanSynthNetlist => {
    const nodes: BooleanSynthNode[] = [];
    const links: BooleanSynthLink[] = [];
    const sourceByLiteral = new Map<string, string>();
    let syntheticId = 0;

    const nextId = (prefix: string): string => `${prefix}_${syntheticId++}`;

    const getInputSource = (variable: BooleanVariable): string => {
        const key = literalKey(variable.id, false);
        const existing = sourceByLiteral.get(key);
        if (existing) return existing;

        const nodeId = `input_${variable.id}`;
        nodes.push({
            id: nodeId,
            kind: "INPUT",
            label: variable.symbol,
            sourceVariableId: variable.id,
        });
        sourceByLiteral.set(key, nodeId);
        return nodeId;
    };

    const getLiteralSource = (variable: BooleanVariable, inverted: boolean): string => {
        if (!inverted) return getInputSource(variable);

        const key = literalKey(variable.id, inverted);
        const existing = sourceByLiteral.get(key);
        if (existing) return existing;

        const inputSource = getInputSource(variable);
        const notId = nextId("not");

        nodes.push({
            id: notId,
            kind: "NOT",
            label: `${variable.symbol}'`,
            sourceVariableId: variable.id,
        });

        links.push({ from: inputSource, to: notId });
        sourceByLiteral.set(key, notId);
        return notId;
    };

    const buildTermSource = (
        outputId: string,
        term: BooleanImplicant,
        termIndex: number
    ): string => {
        const literalSources = term.bits.flatMap((bit, index) => {
            if (bit === "-") return [];
            return [getLiteralSource(variables[index], bit === "0")];
        });

        if (literalSources.length === 0) {
            const constId = nextId(`const_${outputId}`);
            nodes.push({ id: constId, kind: "CONST", label: "1", value: "1" });
            return constId;
        }

        if (literalSources.length === 1) return literalSources[0];

        const andId = nextId(`and_${outputId}_${termIndex}`);
        nodes.push({ id: andId, kind: "AND", label: `AND ${termIndex + 1}` });
        literalSources.forEach((source) => links.push({ from: source, to: andId }));
        return andId;
    };

    outputs.forEach((outputData) => {
        const { output, sop } = outputData;
        let sourceId: string;

        if (sop.expression === "0") {
            sourceId = nextId(`const_${output.id}`);
            nodes.push({ id: sourceId, kind: "CONST", label: "0", value: "0" });
        } else {
            const termSources = sop.terms.map((term, index) =>
                buildTermSource(output.id, term, index)
            );

            if (termSources.length === 1) {
                sourceId = termSources[0];
            } else {
                sourceId = nextId(`or_${output.id}`);
                nodes.push({ id: sourceId, kind: "OR", label: `OR ${output.label}` });
                termSources.forEach((source) => links.push({ from: source, to: sourceId }));
            }
        }

        const outputNodeId = `output_${output.id}`;
        nodes.push({ id: outputNodeId, kind: "OUTPUT", label: output.label });
        links.push({ from: sourceId, to: outputNodeId });
    });

    return {
        nodes,
        links,
        gateCount: nodes.filter((node) => ["NOT", "AND", "OR"].includes(node.kind)).length,
    };
};

export const countOriginalLogicGates = (items: Array<{ kind: string }>): number => {
    return items.filter((item) => item.kind === "base:logic").length;
};

export const countOptimizedSopGates = (outputs: BooleanOptimizedOutput[]): number => {
    return outputs.reduce((total, output) => {
        if (output.sop.isConstant) return total;

        const nots = new Set<number>();
        let ands = 0;

        output.sop.terms.forEach((term) => {
            term.bits.forEach((bit, index) => {
                if (bit === "0") nots.add(index);
            });

            if (countLiteralBits(term) > 1) ands++;
        });

        const ors = output.sop.terms.length > 1 ? 1 : 0;
        return total + nots.size + ands + ors;
    }, 0);
};
