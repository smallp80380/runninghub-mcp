import type { ModelDefinition } from "./types.js";
export declare function buildExamplePayload(model: ModelDefinition, mode?: "minimal" | "with_optional_defaults"): {
    endpoint: string;
    output_type: string;
    payload: Record<string, unknown>;
    local_files: Record<string, string[]>;
    notes: string[];
};
