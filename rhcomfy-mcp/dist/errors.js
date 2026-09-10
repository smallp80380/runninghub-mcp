export class AppError extends Error {
    code;
    context;
    recoverable;
    suggestedFix;
    constructor(code, message, options = {}) {
        super(message);
        this.name = "AppError";
        this.code = code;
        this.context = options.context ?? {};
        this.recoverable = options.recoverable ?? false;
        this.suggestedFix = options.suggestedFix;
    }
}
export function toStructuredError(error) {
    if (error instanceof AppError) {
        return {
            code: error.code,
            message: error.message,
            ...(Object.keys(error.context).length ? { context: error.context } : {}),
            recoverable: error.recoverable,
            ...(error.suggestedFix ? { suggested_fix: error.suggestedFix } : {}),
        };
    }
    return {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Unknown internal error",
        recoverable: false,
        suggested_fix: "Inspect stderr diagnostics and retry only after correcting the reported condition.",
    };
}
export function jsonText(value) {
    return { type: "text", text: JSON.stringify(value, null, 2) };
}
export function okResult(data, warnings = []) {
    return { ok: true, data, warnings, error: null };
}
export function errorResult(error) {
    return { ok: false, data: null, warnings: [], error: toStructuredError(error) };
}
//# sourceMappingURL=errors.js.map