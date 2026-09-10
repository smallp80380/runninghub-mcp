import type { ModelDefinition, ModelParam } from "./types.js";
export declare function validatePayload(model: ModelDefinition, payload: Record<string, unknown>): {
    valid: boolean;
    errors: string[];
    warnings: string[];
};
export declare function isMediaParam(param: ModelParam): boolean;
export declare function getOptionValues(param: ModelParam): string[];
export declare function isMissing(value: unknown): boolean;
