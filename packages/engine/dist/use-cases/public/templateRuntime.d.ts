import type { CustomComponentRuntimeMeta, TemplateOfKind } from "@cnbn/schema";
import type { BakeStoreContract, BakeTable, TemplateLibraryContract } from "@cnbn/modules-runtime";
type CompileResult = {
    template: TemplateOfKind<"circuit:logic">;
    runtime: CustomComponentRuntimeMeta;
    bakeTable?: BakeTable;
};
export declare const recomputeCustomTemplateRuntimes: (ctx: {
    bakeStore: BakeStoreContract;
    templateStore: TemplateLibraryContract;
    now?: number;
}) => void;
export declare const compileCustomTemplateRuntimeForTest: (template: TemplateOfKind<"circuit:logic">, dependencies?: ReadonlyArray<readonly [string, TemplateOfKind]>, now?: number) => CompileResult;
export {};
//# sourceMappingURL=templateRuntime.d.ts.map