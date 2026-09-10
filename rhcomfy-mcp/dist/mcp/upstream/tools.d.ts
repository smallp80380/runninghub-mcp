import { z } from "zod";
import type { RunningHubData } from "./types.js";
export declare const searchModelsSchema: {
    query: z.ZodOptional<z.ZodString>;
    output_type: z.ZodOptional<z.ZodEnum<["image", "video", "audio", "3d", "string"]>>;
    has_media_input: z.ZodOptional<z.ZodBoolean>;
    max_price: z.ZodOptional<z.ZodNumber>;
    limit: z.ZodOptional<z.ZodNumber>;
};
export declare const endpointSchema: {
    endpoint: z.ZodString;
};
export declare const estimatePriceSchema: {
    endpoint: z.ZodString;
    payload: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
};
export declare const validatePayloadSchema: {
    endpoint: z.ZodString;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
};
export declare const integrationGuideSchema: {
    topic: z.ZodOptional<z.ZodEnum<["all", "auth", "upload", "submit", "poll", "result_parsing", "retry", "errors", "pricing"]>>;
};
export declare const buildExamplePayloadSchema: {
    endpoint: z.ZodString;
    mode: z.ZodOptional<z.ZodEnum<["minimal", "with_optional_defaults"]>>;
};
export declare function createToolHandlers(data: RunningHubData): {
    rh_search_models: (input: z.infer<z.ZodObject<typeof searchModelsSchema>>) => {
        content: {
            type: "text";
            text: string;
        }[];
    };
    rh_get_model_schema: (input: z.infer<z.ZodObject<typeof endpointSchema>>) => {
        content: {
            type: "text";
            text: string;
        }[];
    };
    rh_estimate_price: (input: z.infer<z.ZodObject<typeof estimatePriceSchema>>) => {
        content: {
            type: "text";
            text: string;
        }[];
    };
    rh_validate_payload: (input: z.infer<z.ZodObject<typeof validatePayloadSchema>>) => {
        content: {
            type: "text";
            text: string;
        }[];
    };
    rh_get_integration_guide: (input: z.infer<z.ZodObject<typeof integrationGuideSchema>>) => {
        content: {
            type: "text";
            text: string;
        }[];
    };
    rh_build_example_payload: (input: z.infer<z.ZodObject<typeof buildExamplePayloadSchema>>) => {
        content: {
            type: "text";
            text: string;
        }[];
    };
};
