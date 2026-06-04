import {
    BinaryVisualState,
    createVisualBinding,
    resolveSingleBinaryOutputState,
} from "../../visual";
import { createBaseNodeMarkup } from "../base";

const CLOCK_HANDS_PATH = "M0 0 V-8 M0 0 L6 4";
const CLOCK_TICK_PATH = "M0 -12 V-9 M12 0 H9 M0 12 V9 M-12 0 H-9";

export const CLOCK_VISUAL = createVisualBinding<BinaryVisualState>({
    hash: "CLOCK",
    nodeName: "Clock",
    minWidth: 40,
    minHeight: 40,
    base: {
        markup: [
            ...createBaseNodeMarkup({
                beforeIcon: [
                    {
                        tagName: "circle",
                        selector: "clock-face",
                    },
                    {
                        tagName: "path",
                        selector: "clock-ticks",
                    },
                ],
            }),
        ],
        attrs: {
            body: {
                class: "clock-body",
                fill: "var(--color-gray-1)",
            },
            "clock-face": {
                r: 13,
                fill: "var(--color-gray-1)",
                stroke: "var(--color-gray-11)",
                "stroke-width": 2,
                ref: "body",
                refX: "50%",
                refY: "50%",
            },
            "clock-ticks": {
                d: CLOCK_TICK_PATH,
                stroke: "var(--color-gray-9)",
                "stroke-width": 1.5,
                "stroke-linecap": "round",
                fill: "none",
                ref: "body",
                refX: "50%",
                refY: "50%",
            },
            icon: {
                d: CLOCK_HANDS_PATH,
                stroke: "var(--color-gray-11)",
                "stroke-width": 2,
                "stroke-linecap": "round",
                fill: "none",
            },
        },
    },
    states: {
        on: {
            attrs: {
                "clock-face": {
                    fill: "var(--color-true)",
                    stroke: "var(--color-gray-11)",
                },
                icon: {
                    stroke: "var(--color-gray-1)",
                    transform: "rotate(90, 0 0)",
                },
                "clock-ticks": {
                    stroke: "var(--color-gray-1)",
                },
            },
        },
        off: {
            attrs: {
                "clock-face": {
                    fill: "var(--color-gray-1)",
                    stroke: "var(--color-gray-11)",
                },
                icon: {
                    stroke: "var(--color-gray-11)",
                    transform: "rotate(0, 0 0)",
                },
                "clock-ticks": {
                    stroke: "var(--color-gray-9)",
                },
            },
        },
    },
    resolveState: resolveSingleBinaryOutputState,
});
