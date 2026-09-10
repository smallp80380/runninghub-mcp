import type { RunningHubData } from "./types.js";
export interface SearchModelsInput {
    query?: string;
    output_type?: string;
    has_media_input?: boolean;
    max_price?: number;
    limit?: number;
}
export declare function searchModels(data: RunningHubData, input: SearchModelsInput): {
    count: number;
    models: {
        endpoint: string;
        name_cn: string | undefined;
        name_en: string | undefined;
        output_type: string;
        category: string | undefined;
        pricing_summary: string;
        inputs: {
            fieldKey: string;
            type: string;
            required: boolean;
        }[];
    }[];
};
