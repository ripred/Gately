import { MockInstance } from "vitest";

export type WithDeepMocks<T> = {
	[K in keyof T]: T[K] extends (...args: infer Args) => infer Return
		? T[K] & MockInstance<(...args: Args) => Return>
		: T[K] extends object
			? WithDeepMocks<T[K]>
			: T[K];
};
