import type { ModelDefinition, RunningHubData } from "./types.js";
export declare function loadRunningHubData(kitRoot?: string): RunningHubData;
export declare function getModelOrThrow(data: RunningHubData, endpoint: string): ModelDefinition;
export declare function jsonToolResult(value: unknown): {
    content: {
        type: "text";
        text: string;
    }[];
};
