import type { Graph, Node } from "@antv/x6";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceClockController } from "./clock-controller";
import { patchClockConfig } from "./clock-config";

type MockNode = Node & {
    setOutputClass: (valueClass: string) => void;
};

type MockGraph = Graph & {
    emitGraph: (eventName: string) => void;
    selectNode: (node: MockNode) => void;
};

const createClockNode = (id = "clock_1"): MockNode => {
    let data: Record<string, unknown> = { hash: "CLOCK" };
    let outputClass = "port port-output value-false";

    return {
        id,
        isNode: () => true,
        getData: () => data,
        setData: (next: Record<string, unknown>) => {
            data = next;
        },
        getPorts: () => [{ id: "R:0" }],
        getPortProp: () => outputClass,
        setOutputClass: (valueClass: string) => {
            outputClass = `port port-output ${valueClass}`;
        },
    } as unknown as MockNode;
};

const createGraph = (nodes: MockNode[]): MockGraph => {
    const handlers = new Map<string, Set<() => void>>();
    let selected: MockNode[] = [];

    return {
        getNodes: () => nodes,
        getCellById: (id: string) => nodes.find((node) => node.id === id),
        getSelectedCells: () => selected,
        selectNode: (node: MockNode) => {
            selected = [node];
        },
        on: (eventName: string, handler: () => void) => {
            const list = handlers.get(eventName) ?? new Set();
            list.add(handler);
            handlers.set(eventName, list);
        },
        off: (eventName: string, handler: () => void) => {
            handlers.get(eventName)?.delete(handler);
        },
        emitGraph: (eventName: string) => {
            handlers.get(eventName)?.forEach((handler) => handler());
        },
    } as unknown as MockGraph;
};

const createController = (args: { paused?: () => boolean; graph: MockGraph }) => {
    const applyPinPatch = vi.fn();
    const applySignalEvents = vi.fn();
    const requestSimulationNow = vi.fn();
    const engineCall = vi.fn(async (_command: string, payload: { value: "0" | "1" }) => ({
        tabId: "tab_1",
        outputEvents: [
            {
                itemId: "clock_1",
                kind: "output",
                pin: "0",
                value: payload.value,
            },
        ],
    }));

    const controller = createWorkspaceClockController({
        logicEngine: { call: engineCall } as never,
        uiEngine: {
            commands: {
                applyPinPatch,
                applySignalEvents,
            },
        } as never,
        getActiveTabId: () => "tab_1",
        isPaused: args.paused ?? (() => false),
        requestSimulationNow,
    });
    const dispose = controller.attachGraph(args.graph);

    return {
        applyPinPatch,
        applySignalEvents,
        controller,
        dispose,
        engineCall,
        requestSimulationNow,
    };
};

describe("workspace clock controller", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("toggles enabled clock outputs on the configured duty cycle", async () => {
        vi.useFakeTimers();
        const node = createClockNode();
        const graph = createGraph([node]);
        const { applyPinPatch, applySignalEvents, dispose, engineCall, requestSimulationNow } =
            createController({ graph });

        await vi.advanceTimersByTimeAsync(499);
        expect(engineCall).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        expect(engineCall).toHaveBeenLastCalledWith(
            "/item/updateOutput",
            expect.objectContaining({
                itemId: "clock_1",
                pin: "0",
                value: "1",
            }),
        );
        expect(applyPinPatch).toHaveBeenLastCalledWith([
            {
                elementId: "clock_1",
                pinRef: { side: "output", index: "0" },
                value: "1",
            },
        ]);
        expect(applySignalEvents).toHaveBeenCalledTimes(1);
        expect(requestSimulationNow).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(500);
        expect(engineCall).toHaveBeenLastCalledWith(
            "/item/updateOutput",
            expect.objectContaining({
                value: "0",
            }),
        );

        dispose();
    });

    it("stops ticking while paused and resumes from the existing output phase", async () => {
        vi.useFakeTimers();
        let paused = true;
        const node = createClockNode();
        const graph = createGraph([node]);
        const { controller, engineCall, dispose } = createController({
            graph,
            paused: () => paused,
        });

        await vi.advanceTimersByTimeAsync(2_000);
        expect(engineCall).not.toHaveBeenCalled();

        paused = false;
        controller.refresh();
        await vi.advanceTimersByTimeAsync(500);
        expect(engineCall).toHaveBeenCalledTimes(1);
        expect(engineCall).toHaveBeenLastCalledWith(
            "/item/updateOutput",
            expect.objectContaining({ value: "1" }),
        );

        paused = true;
        controller.refresh();
        await vi.advanceTimersByTimeAsync(2_000);
        expect(engineCall).toHaveBeenCalledTimes(1);

        dispose();
    });

    it("uses updated node config and exposes selected clock configuration", async () => {
        vi.useFakeTimers();
        const node = createClockNode();
        const graph = createGraph([node]);
        graph.selectNode(node);
        const { controller, engineCall, dispose } = createController({ graph });

        expect(controller.canConfigureSelectedClock).toBe(true);
        controller.openSelectedClockConfig();
        controller.updateEditingConfig({ frequencyHz: 2, dutyCycle: 0.25 });

        await vi.advanceTimersByTimeAsync(375);
        expect(engineCall).toHaveBeenCalledTimes(1);

        patchClockConfig(node, { enabled: false });
        graph.emitGraph("node:change:data");
        await vi.advanceTimersByTimeAsync(2_000);
        expect(engineCall).toHaveBeenCalledTimes(1);

        dispose();
    });
});
