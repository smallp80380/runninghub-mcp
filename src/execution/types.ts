export type ExecutionState = "READY" | "SUBMITTING" | "SUBMIT_UNKNOWN" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
export type ProviderState = "NOT_SUBMITTED" | "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "UNKNOWN";
export type ArtifactState = "NONE" | "PENDING" | "READY" | "FAILED";

export type ProviderAssetReference =
  | { readonly kind: "provider_file"; readonly value: string }
  | { readonly kind: "provider_url"; readonly value: string };

export type ProviderLoraReference = { readonly kind: "provider_lora"; readonly value: string };

export interface AssetBinding {
  readonly asset_id: string;
  readonly content_hash: string;
  readonly provider_ref?: ProviderAssetReference;
}

export interface ExecutionPlan {
  readonly id: string;
  readonly project_id: string;
  readonly work_item_id: string;
  readonly graph_revision_id: string;
  readonly graph_hash: string;
  readonly workflow_json: string;
  readonly asset_bindings: readonly AssetBinding[];
  readonly requirements_hash: string;
  readonly policy_hash: string;
  readonly backend_profile_id: string;
  readonly provider_workflow_id?: string;
  readonly output_contract: Readonly<Record<string, unknown>>;
  readonly mode: "production" | "capability_test";
}

export interface JobHandle {
  readonly id: string;
  readonly plan_id: string;
  readonly request_id: string;
  readonly execution_state: ExecutionState;
  readonly provider_state: ProviderState;
  readonly artifact_state: ArtifactState;
  readonly provider_task_id?: string;
  readonly submit_intent?: string;
  readonly attempts: number;
}

export interface ProviderStatus {
  readonly state: "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCEL";
  readonly task_id: string;
  readonly error_code?: string;
  readonly error_message?: string;
  readonly raw?: unknown;
}

export interface ProviderOutput {
  readonly outputs: readonly { id: string; url?: string; mime?: string; bytes?: Uint8Array }[];
  readonly raw?: unknown;
}

export interface ProviderUploadInput {
  readonly asset_id: string;
  readonly content_hash: string;
  readonly filename: string;
  readonly mime: string;
  readonly bytes: Uint8Array;
}

export interface ProviderLoraUploadInput {
  readonly asset_id: string;
  readonly content_hash: string;
  readonly filename: string;
  readonly mime: string;
  readonly bytes: Uint8Array;
}

export interface WorkflowBackend {
  readonly profile_id: string;
  readonly api_family: "workflow_api" | "comfy_proxy" | "synthetic";
  upload(input: ProviderUploadInput): Promise<ProviderAssetReference>;
  uploadLora?(input: ProviderLoraUploadInput): Promise<ProviderLoraReference>;
  submit(input: { readonly workflow_json: string; readonly plan_id: string; readonly workflow_id?: string }): Promise<{ task_id: string; raw?: unknown }>;
  status(taskId: string): Promise<ProviderStatus>;
  outputs(taskId: string): Promise<ProviderOutput>;
  cancel(taskId: string): Promise<ProviderStatus>;
}

export class SubmitUnknownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubmitUnknownError";
  }
}
