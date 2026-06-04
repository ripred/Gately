import { WithOf } from "../shared.js";
import { KindKey, PinDelay } from "./types.js";
export type WithOptions<K extends KindKey> = {
    options?: WithOf<K, OptionsMap> & {
        delay?: PinDelay;
        isEnable?: boolean;
    };
};
export type OptionsMap = {
    base: {
        generator: {};
        logic: {
            shiftRegister8?: {
                shift?: ("0" | "1")[];
                parallel?: ("0" | "1")[];
                prevClock?: "0" | "1";
                prevUpdate?: "0" | "1";
            };
        };
        display: {};
    };
    circuit: {
        logic: {
            baked?: boolean;
        };
    };
};
//# sourceMappingURL=options.d.ts.map