import type {
    BooleanBit,
    BooleanExpression,
    BooleanImplicant,
    BooleanTermBit,
} from "./types";

type WorkingTerm = {
    bits: BooleanTermBit[];
    minterms: Set<number>;
    used: boolean;
};

const ALL_BITS: BooleanBit[] = ["0", "1"];

const countOnes = (bits: BooleanTermBit[]): number => bits.filter((bit) => bit === "1").length;

const makeBits = (value: number, width: number): BooleanTermBit[] => {
    return value
        .toString(2)
        .padStart(width, "0")
        .split("") as BooleanTermBit[];
};

const termKey = (term: Pick<WorkingTerm, "bits">): string => term.bits.join("");

const sortNumbers = (values: Iterable<number>): number[] => [...values].sort((a, b) => a - b);

const createTerm = (bits: BooleanTermBit[], minterms: Iterable<number>): WorkingTerm => ({
    bits,
    minterms: new Set(minterms),
    used: false,
});

const mergeTerms = (left: WorkingTerm, right: WorkingTerm): WorkingTerm | undefined => {
    let diffCount = 0;
    const merged: BooleanTermBit[] = [];

    for (let i = 0; i < left.bits.length; i++) {
        const a = left.bits[i];
        const b = right.bits[i];

        if (a === b) {
            merged.push(a);
            continue;
        }

        if (a === "-" || b === "-") return;

        diffCount++;
        merged.push("-");
    }

    if (diffCount !== 1) return;

    left.used = true;
    right.used = true;
    return createTerm(merged, [...left.minterms, ...right.minterms]);
};

const groupTerms = (terms: WorkingTerm[]): Map<number, WorkingTerm[]> => {
    const groups = new Map<number, WorkingTerm[]>();

    for (const term of terms) {
        const key = countOnes(term.bits);
        groups.set(key, [...(groups.get(key) ?? []), term]);
    }

    return groups;
};

const uniqueTerms = (terms: WorkingTerm[]): WorkingTerm[] => {
    const byKey = new Map<string, WorkingTerm>();

    for (const term of terms) {
        const key = termKey(term);
        const existing = byKey.get(key);

        if (!existing) {
            byKey.set(key, createTerm(term.bits, term.minterms));
            continue;
        }

        term.minterms.forEach((minterm) => existing.minterms.add(minterm));
    }

    return [...byKey.values()];
};

const buildPrimeImplicants = (minterms: number[], variableCount: number): WorkingTerm[] => {
    let current = uniqueTerms(minterms.map((minterm) => createTerm(makeBits(minterm, variableCount), [minterm])));
    const primes: WorkingTerm[] = [];

    while (current.length) {
        const groups = groupTerms(current);
        const next: WorkingTerm[] = [];
        const groupKeys = [...groups.keys()].sort((a, b) => a - b);

        for (const groupKey of groupKeys) {
            const leftGroup = groups.get(groupKey) ?? [];
            const rightGroup = groups.get(groupKey + 1) ?? [];

            for (const left of leftGroup) {
                for (const right of rightGroup) {
                    const merged = mergeTerms(left, right);
                    if (merged) next.push(merged);
                }
            }
        }

        primes.push(...current.filter((term) => !term.used));
        current = uniqueTerms(next);
    }

    return uniqueTerms(primes);
};

const covers = (term: BooleanImplicant, minterm: number, variableCount: number): boolean => {
    const bits = makeBits(minterm, variableCount);
    return term.bits.every((bit, index) => bit === "-" || bit === bits[index]);
};

const literalCount = (term: Pick<BooleanImplicant, "bits">): number => {
    return term.bits.filter((bit) => bit !== "-").length;
};

const chooseCover = (targets: number[], primes: BooleanImplicant[], variableCount: number): BooleanImplicant[] => {
    const remaining = new Set(targets);
    const selected: BooleanImplicant[] = [];

    while (remaining.size) {
        const coverByTarget = new Map<number, BooleanImplicant[]>();

        for (const target of remaining) {
            coverByTarget.set(
                target,
                primes.filter((prime) => covers(prime, target, variableCount))
            );
        }

        const essentials = [...coverByTarget.entries()]
            .filter(([, terms]) => terms.length === 1)
            .map(([, terms]) => terms[0]);

        const next = essentials[0] ?? [...primes].sort((a, b) => {
            const aCovered = [...remaining].filter((target) => covers(a, target, variableCount)).length;
            const bCovered = [...remaining].filter((target) => covers(b, target, variableCount)).length;

            if (aCovered !== bCovered) return bCovered - aCovered;
            return literalCount(a) - literalCount(b);
        })[0];

        if (!next) break;
        if (!selected.some((term) => termKey(term) === termKey(next))) selected.push(next);

        for (const target of [...remaining]) {
            if (covers(next, target, variableCount)) remaining.delete(target);
        }
    }

    return selected;
};

const allMinterms = (variableCount: number): number[] => {
    return Array.from({ length: 2 ** variableCount }, (_, index) => index);
};

export const minimizeMinterms = (
    minterms: number[],
    variableCount: number
): BooleanImplicant[] => {
    const uniqueMinterms = sortNumbers(new Set(minterms));

    if (variableCount === 0) {
        return uniqueMinterms.includes(0) ? [{ bits: [], minterms: [0] }] : [];
    }

    if (!uniqueMinterms.length) return [];
    if (uniqueMinterms.length === 2 ** variableCount) {
        return [{ bits: Array.from({ length: variableCount }, () => "-"), minterms: uniqueMinterms }];
    }

    const primes = buildPrimeImplicants(uniqueMinterms, variableCount).map((term) => ({
        bits: term.bits,
        minterms: sortNumbers(term.minterms),
    }));

    return chooseCover(uniqueMinterms, primes, variableCount);
};

const renderSopTerm = (term: BooleanImplicant, symbols: string[]): string => {
    const literals = term.bits.flatMap((bit, index) => {
        if (bit === "-") return [];
        return bit === "1" ? symbols[index] : `${symbols[index]}'`;
    });

    return literals.length ? literals.join("") : "1";
};

const renderPosTerm = (term: BooleanImplicant, symbols: string[]): string => {
    const literals = term.bits.flatMap((bit, index) => {
        if (bit === "-") return [];
        return bit === "0" ? symbols[index] : `${symbols[index]}'`;
    });

    return literals.length ? `(${literals.join(" + ")})` : "0";
};

const estimateSopGateCount = (terms: BooleanImplicant[]): number => {
    if (!terms.length) return 0;
    if (terms.length === 1 && literalCount(terms[0]) === 0) return 0;

    const notCount = new Set<string>();
    let andCount = 0;

    terms.forEach((term) => {
        term.bits.forEach((bit, index) => {
            if (bit === "0") notCount.add(String(index));
        });
        if (literalCount(term) > 1) andCount++;
    });

    const orCount = terms.length > 1 ? 1 : 0;
    return notCount.size + andCount + orCount;
};

const estimatePosGateCount = (terms: BooleanImplicant[]): number => {
    if (!terms.length) return 0;
    if (terms.length === 1 && literalCount(terms[0]) === 0) return 0;

    const notCount = new Set<string>();
    let orCount = 0;

    terms.forEach((term) => {
        term.bits.forEach((bit, index) => {
            if (bit === "1") notCount.add(String(index));
        });
        if (literalCount(term) > 1) orCount++;
    });

    const andCount = terms.length > 1 ? 1 : 0;
    return notCount.size + orCount + andCount;
};

export const buildSopExpression = (
    minterms: number[],
    variableSymbols: string[]
): BooleanExpression => {
    const variableCount = variableSymbols.length;
    const terms = minimizeMinterms(minterms, variableCount);

    if (!terms.length) {
        return {
            expression: "0",
            terms,
            literalCount: 0,
            gateCountEstimate: 0,
            isConstant: true,
        };
    }

    if (terms.length === 1 && literalCount(terms[0]) === 0) {
        return {
            expression: "1",
            terms,
            literalCount: 0,
            gateCountEstimate: 0,
            isConstant: true,
        };
    }

    return {
        expression: terms.map((term) => renderSopTerm(term, variableSymbols)).join(" + "),
        terms,
        literalCount: terms.reduce((total, term) => total + literalCount(term), 0),
        gateCountEstimate: estimateSopGateCount(terms),
        isConstant: false,
    };
};

export const buildPosExpression = (
    maxterms: number[],
    variableSymbols: string[]
): BooleanExpression => {
    const variableCount = variableSymbols.length;
    const terms = minimizeMinterms(maxterms, variableCount);

    if (!terms.length) {
        return {
            expression: "1",
            terms,
            literalCount: 0,
            gateCountEstimate: 0,
            isConstant: true,
        };
    }

    if (terms.length === 1 && literalCount(terms[0]) === 0) {
        return {
            expression: "0",
            terms,
            literalCount: 0,
            gateCountEstimate: 0,
            isConstant: true,
        };
    }

    return {
        expression: terms.map((term) => renderPosTerm(term, variableSymbols)).join(" * "),
        terms,
        literalCount: terms.reduce((total, term) => total + literalCount(term), 0),
        gateCountEstimate: estimatePosGateCount(terms),
        isConstant: false,
    };
};

export const enumerateMinterms = allMinterms;
export const booleanBits = ALL_BITS;
