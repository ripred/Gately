import type {
    AppConfigurationController,
    SignalPathColorConfig,
} from "@gately/app/providers/AppConfigurationProvider";
import type { OptimizedCircuitRoutingConfig } from "@gately/features/boolean-analysis/model/optimizedCircuitLayout";
import type { WorkspaceSimulationMode } from "@gately/shared/types";

export const SIMULATION_MODE_OPTIONS: Array<{ value: WorkspaceSimulationMode; label: string }> = [
    { value: "instant", label: "instant" },
    { value: "0.5sec", label: "0.5 sec" },
];

export type RoutingSetting = {
    key: keyof OptimizedCircuitRoutingConfig;
    label: string;
    description: string;
    min: number;
    max: number;
    step: number;
};

export const ROUTING_SETTINGS: RoutingSetting[] = [
    { key: "minClearance", label: "Minimum clearance", description: "Base route spacing from nodes and reserved lanes.", min: 16, max: 160, step: 4 },
    { key: "sourceExitClearance", label: "Source exit", description: "Horizontal distance before a wire may turn after leaving an output.", min: 16, max: 192, step: 4 },
    { key: "targetGutter", label: "Input lane", description: "Preferred routing lane before entering a gate input edge.", min: 16, max: 192, step: 4 },
    { key: "targetGutterStep", label: "Lane step", description: "Per-pin offset for adjacent gate input lanes.", min: 0, max: 48, step: 2 },
    { key: "farTargetGutterOffset", label: "Far lane", description: "Alternate lane offset used when a near input path is blocked.", min: 0, max: 160, step: 4 },
    { key: "nearTargetGutterOffset", label: "Near lane", description: "Closer alternate lane offset for simple dogleg routes.", min: 0, max: 160, step: 4 },
    { key: "targetEdgeClearance", label: "Edge padding", description: "Protected area in front of component input edges.", min: 16, max: 160, step: 4 },
    { key: "sourceFanoutGutter", label: "Fanout lane", description: "Preferred vertical trunk distance for branches from one source.", min: 16, max: 192, step: 4 },
    { key: "detourGap", label: "Detour gap", description: "Clearance used for local top and bottom detours.", min: 16, max: 192, step: 4 },
    { key: "detourStep", label: "Detour step", description: "Increment used to separate repeated long detour lanes.", min: 0, max: 96, step: 4 },
    { key: "parallelRouteSpacing", label: "Route step", description: "Requested offset between generated parallel route lanes.", min: 0, max: 64, step: 1 },
    { key: "rectClearance", label: "Body padding", description: "Minimum wire distance from component bodies.", min: 0, max: 48, step: 1 },
    { key: "wireClearance", label: "Wire padding", description: "Minimum visual gap between separate parallel wires.", min: 0, max: 48, step: 1 },
    { key: "topRouteClearance", label: "Top padding", description: "Reserved clearance above the highest component for escape lanes.", min: 16, max: 192, step: 4 },
    { key: "searchMargin", label: "Search padding", description: "How far the deterministic router may expand around the circuit.", min: 16, max: 1024, step: 16 },
    { key: "searchMarginStep", label: "Search step", description: "Additional search expansion for later routes.", min: 0, max: 128, step: 4 },
    { key: "outputSinkTargetClearance", label: "Sink side", description: "Preferred side-approach clearance for lamp and output sinks.", min: 16, max: 192, step: 4 },
    { key: "outputSinkBottomClearance", label: "Sink lane", description: "Fallback bottom-approach clearance for output sinks.", min: 16, max: 192, step: 4 },
    { key: "outputSinkPreferredRise", label: "Sink rise", description: "Preferred vertical lift from the final source output to the sink port.", min: 0, max: 192, step: 4 },
];

export type SignalPathColorSetting = {
    key: keyof SignalPathColorConfig;
    label: string;
};

export const SIGNAL_PATH_COLOR_SETTINGS: SignalPathColorSetting[] = [
    { key: "high", label: "High signal" },
    { key: "low", label: "Low signal" },
];

export const setRoutingDistance = (
    configuration: AppConfigurationController,
    key: keyof OptimizedCircuitRoutingConfig,
    value: string,
): void => {
    configuration.setRoutingConfig({ [key]: Number(value) });
};

export const setSignalPathColor = (
    configuration: AppConfigurationController,
    key: keyof SignalPathColorConfig,
    value: string,
): void => {
    configuration.setSignalPathColors({ [key]: value });
};
