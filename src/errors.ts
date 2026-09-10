export type ErrorCode =
  | "INVALID_GRAPH"
  | "REVISION_CONFLICT"
  | "MODEL_INCOMPATIBLE"
  | "SCENE_AMBIGUOUS"
  | "ASSET_MISSING"
  | "ASSET_CHANGED"
  | "REQUEST_CONFLICT"
  | "SUBMIT_UNKNOWN"
  | "DOWNLOAD_FAILED"
  | "PROJECT_NOT_FOUND"
  | "SCHEMA_UNKNOWN"
  | "CAPABILITY_UNKNOWN"
  | "CAPABILITY_UNSUPPORTED"
  | "REMOTE_WORKFLOW_DOES_NOT_ACCEPT_IMAGE_OVERRIDES"
  | "PROVIDER_ERROR"
  | "REVIEW_PENDING"
  | "INVALID_CONFIGURATION";

export interface StructuredError {
  code: ErrorCode | "INTERNAL_ERROR";
  message: string;
  context?: Record<string, string>;
  recoverable: boolean;
  suggested_fix?: string;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly context: Record<string, string>;
  readonly recoverable: boolean;
  readonly suggestedFix?: string;

  constructor(
    code: ErrorCode,
    message: string,
    options: {
      context?: Record<string, string>;
      recoverable?: boolean;
      suggestedFix?: string;
    } = {},
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.context = options.context ?? {};
    this.recoverable = options.recoverable ?? false;
    this.suggestedFix = options.suggestedFix;
  }
}

export function toStructuredError(error: unknown): StructuredError {
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

export function jsonText(value: unknown): { type: "text"; text: string } {
  return { type: "text", text: JSON.stringify(value, null, 2) };
}

export function okResult<T>(data: T, warnings: string[] = []) {
  return { ok: true as const, data, warnings, error: null };
}

export function errorResult(error: unknown) {
  return { ok: false as const, data: null, warnings: [], error: toStructuredError(error) };
}
