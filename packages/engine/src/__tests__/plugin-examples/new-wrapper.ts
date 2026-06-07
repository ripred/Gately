import { ApiFactories } from "@engine/api";

export const WrapperExample = ApiFactories.wrapper("example-wrapper", (ctx, next) => {
    return next();
});
