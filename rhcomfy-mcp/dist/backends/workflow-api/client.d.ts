import { type NodeInfoOverride, type ProviderAssetReference, type ProviderLoraReference, type ProviderLoraUploadInput, type ProviderOutput, type ProviderStatus, type ProviderUploadInput, type WorkflowBackend, type WorkflowSubmitMode } from "../../execution/types.js";
export interface WorkflowApiRoutes {
    readonly submit: string;
    readonly submit_v2?: string;
    readonly workflow_json?: string;
    readonly status: string;
    readonly outputs: string;
    readonly upload?: string;
    readonly upload_legacy?: string;
    readonly upload_v2?: string;
    readonly lora_upload_url?: string;
    readonly cancel?: string;
}
export interface WorkflowApiClientOptions {
    readonly profile_id: string;
    readonly base_url: string;
    readonly api_key: string;
    readonly routes: WorkflowApiRoutes;
    readonly timeout_ms?: number;
    readonly fetch_impl?: typeof fetch;
    readonly logger?: (event: Record<string, unknown>) => void;
}
export declare class WorkflowApiClient implements WorkflowBackend {
    private readonly options;
    readonly api_family: "workflow_api";
    readonly profile_id: string;
    private readonly fetchImpl;
    constructor(options: WorkflowApiClientOptions);
    submit(input: {
        workflow_json: string;
        plan_id: string;
        workflow_id?: string;
        node_info_list?: readonly NodeInfoOverride[];
        submit_mode?: WorkflowSubmitMode;
    }): Promise<{
        task_id: string;
        raw?: unknown;
    }>;
    upload(input: ProviderUploadInput): Promise<ProviderAssetReference>;
    uploadV2(input: ProviderUploadInput): Promise<ProviderAssetReference>;
    getWorkflowJson(workflowId: string): Promise<string>;
    private parseUploadResponse;
    uploadLora(input: ProviderLoraUploadInput): Promise<ProviderLoraReference>;
    status(taskId: string): Promise<ProviderStatus>;
    outputs(taskId: string): Promise<ProviderOutput>;
    cancel(taskId: string): Promise<ProviderStatus>;
    private request;
    private requestMultipart;
    private putSignedLora;
    private body;
    private log;
}
