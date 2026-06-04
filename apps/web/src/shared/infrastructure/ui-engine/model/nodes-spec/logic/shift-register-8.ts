import { createVisualBinding } from "../../visual";
import { createBaseNodeMarkup } from "../base";

export const SHIFT_REGISTER_8_VISUAL = createVisualBinding({
    hash: "SHIFT_REGISTER_8",
    nodeName: "Shift Register 8",
    minWidth: 104,
    minHeight: 160,
    base: {
        markup: [
            ...createBaseNodeMarkup({
                afterIcon: [
                    {
                        tagName: "text",
                        selector: "label",
                    },
                    {
                        tagName: "text",
                        selector: "input-label",
                    },
                    {
                        tagName: "text",
                        selector: "output-label",
                    },
                ],
            }),
        ],
        attrs: {
            body: {
                fill: "var(--color-gray-1)",
            },
            icon: {
                d: "M-24 -22 H20 M20 -22 L12 -30 M20 -22 L12 -14 M-24 0 H20 M20 0 L12 -8 M20 0 L12 8 M-24 22 H20 M20 22 L12 14 M20 22 L12 30",
                stroke: "var(--color-gray-9)",
                "stroke-width": 2,
                "stroke-linecap": "round",
                "stroke-linejoin": "round",
                fill: "none",
            },
            label: {
                text: "SHIFT REG 8",
                ref: "body",
                refX: "50%",
                refY: "50%",
                y: -4,
                textAnchor: "middle",
                textVerticalAnchor: "middle",
                fontSize: 12,
                fontWeight: 700,
                fill: "var(--color-gray-12)",
                pointerEvents: "none",
            },
            "input-label": {
                text: "SER  CLK  UPD",
                ref: "body",
                refX: 8,
                refY: 18,
                textAnchor: "start",
                fontSize: 9,
                fontWeight: 600,
                fill: "var(--color-gray-10)",
                pointerEvents: "none",
            },
            "output-label": {
                text: "Q0-Q7 + C",
                ref: "body",
                refX: "50%",
                refY: "100%",
                y: -16,
                textAnchor: "middle",
                fontSize: 9,
                fontWeight: 600,
                fill: "var(--color-gray-10)",
                pointerEvents: "none",
            },
        },
    },
});
