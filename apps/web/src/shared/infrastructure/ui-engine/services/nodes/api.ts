import type { Graph, Node } from "@antv/x6";
import type { UIEngineContext, UIEngineNodeData, UIEngineNodeProps } from "../../model/types";
import { buildNodeProps } from "./lib/propsBuilder";
import { findDefaultNodePosition, type NodePlacementBox } from "./lib/defaultNodePosition";

export type NodeService = ReturnType<typeof useNodeService>;

export const useNodeService = (graph: Graph, _ctx: UIEngineContext) => {
    type BuildNodeInput = Parameters<typeof buildNodeProps>[0];
    type BuildNodeOptions = Parameters<typeof buildNodeProps>[2];

    const isBuildNodeInput = (value: unknown): value is BuildNodeInput => {
        return (
            typeof value === "object" &&
            value !== null &&
            "builtItem" in (value as Record<string, unknown>)
        );
    };

    const getOccupiedBoxes = (): NodePlacementBox[] =>
        graph.getNodes().map((node) => {
            const box = node.getBBox();
            return {
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height,
            };
        });

    function createNode(props: UIEngineNodeProps): Node;
    function createNode(result: BuildNodeInput, options?: BuildNodeOptions): Node;
    function createNode(arg0: UIEngineNodeProps | BuildNodeInput, arg1?: BuildNodeOptions): Node {
        let props = isBuildNodeInput(arg0)
            ? buildNodeProps(
                  arg0,
                  {
                      getVisualBinding: (hash) => _ctx.getService("node-visual").getPreset(hash),
                  },
                  arg1,
              )
            : (arg0 as UIEngineNodeProps);

        if (isBuildNodeInput(arg0) && !arg1?.position) {
            const position = findDefaultNodePosition(
                { width: props.width, height: props.height },
                getOccupiedBoxes(),
            );
            props = { ...props, x: position.x, y: position.y };
        }

        return graph.addNode(props);
    }

    const removeNode = (nodeId: string): void => {
        graph.removeNode(nodeId);
    };

    const getNode = (nodeId: string): Node | undefined => {
        const cell = graph.getCellById(nodeId);
        if (!cell || !cell.isNode?.()) return;
        return cell as Node;
    };

    const updateNodeData = (nodeId: string, patch: Partial<UIEngineNodeData>): void => {
        const node = getNode(nodeId);
        if (!node) return;
        const data = (node.getData() ?? {}) as UIEngineNodeData;
        Object.assign(data, patch);
        node.setData(data);
    };

    const getNodeHash = (node: Node): string | undefined => {
        const data = node.getData<Partial<UIEngineNodeData>>() ?? {};
        const hash = data.hash;
        return typeof hash === "string" ? hash : undefined;
    };

    return { createNode, removeNode, getNode, updateNodeData, getNodeHash };
};
