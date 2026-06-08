import { definePlugin } from "@engine/plugins";
import { EngineEvents } from "@engine/eventBus";

export const SimpleEventLoggerPlugin = definePlugin("SimpleEventLoggerPlugin", {
    setup: ({ deps }) => {
        const bus = deps.core.bus;

        bus.on(EngineEvents.anyType.anyPhase, () => {});
    },
});
