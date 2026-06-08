import { createVisualBinding } from "../visual";
import type { CustomComponentRuntimeMeta } from "@cnbn/schema";

export type CustomComponentVisualInput = {
    hash: string;
    name: string;
    label?: string;
    inputCount?: number;
    outputCount?: number;
    runtime?: CustomComponentRuntimeMeta;
};

const sanitizeNodeName = (hash: string): string =>
    `CUSTOM_COMPONENT_${hash.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

export const createCustomComponentVisualBinding = (input: CustomComponentVisualInput) => {
    const label = (input.label ?? input.name ?? input.hash).trim() || input.hash;
    const pinCount = Math.max(input.inputCount ?? 0, input.outputCount ?? 0);
    const minWidth = Math.max(80, label.length * 8 + 28);
    const minHeight = Math.max(48, 16 + pinCount * 16);

    return createVisualBinding({
        hash: input.hash,
        nodeName: sanitizeNodeName(input.hash),
        minWidth,
        minHeight,
        base: {
            markup: [
                {
                    tagName: "g",
                    className: "base-node custom-component-node",
                    children: [
                        { tagName: "rect", selector: "body" },
                        { tagName: "text", selector: "label" },
                    ],
                },
            ],
            attrs: {
                label: {
                    text: label,
                    ref: "body",
                    refX: "50%",
                    refY: "50%",
                    textAnchor: "middle",
                    textVerticalAnchor: "middle",
                    fontSize: 12,
                    fontWeight: 600,
                    fill: "var(--color-gray-12)",
                    pointerEvents: "none",
                },
            },
        },
    });
};
