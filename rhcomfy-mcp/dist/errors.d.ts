export type ErrorCode = "INVALID_GRAPH" | "REVISION_CONFLICT" | "MODEL_INCOMPATIBLE" | "SCENE_AMBIGUOUS" | "ASSET_MISSING" | "ASSET_CHANGED" | "REQUEST_CONFLICT" | "SUBMIT_UNKNOWN" | "DOWNLOAD_FAILED" | "PROJECT_NOT_FOUND" | "SCHEMA_UNKNOWN" | "CAPABILITY_UNKNOWN" | "CAPABILITY_UNSUPPORTED" | "REMOTE_WORKFLOW_DOES_NOT_ACCEPT_IMAGE_OVERRIDES" | "PROVIDER_ERROR" | "REVIEW_PENDING" | "INVALID_CONFIGURATION";
export interface StructuredError {
    code: ErrorCode | "INTERNAL_ERROR";
    message: string;
    context?: Record<string, string>;
    recoverable: boolean;
    suggested_fix?: string;
}
export declare class AppError extends Error {
    readonly code: ErrorCode;
    readonly context: Record<string, string>;
    readonly recoverable: boolean;
    readonly suggestedFix?: string;
    constructor(code: ErrorCode, message: string, options?: {
        context?: Record<string, string>;
        recoverable?: boolean;
        suggestedFix?: string;
    });
}
export declare function toStructuredError(error: unknown): StructuredError;
export declare function jsonText(value: unknown): {
    type: "text";
    text: string;
};
export declare function okResult<T>(data: T, warnings?: string[]): {
    ok: true;
    data: T;
    warnings: string[];
    error: null;
};
export declare function errorResult(error: unknown): {
    ok: false;
    data: null;
    warnings: never[];
    error: StructuredError;
};
