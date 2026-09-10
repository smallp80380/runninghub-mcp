import { DatabaseSync } from "node:sqlite";
export interface WorkflowRevisionRow {
    readonly id: string;
    readonly workflow_id: string;
    readonly project_id: string;
    readonly schema_version: string;
    readonly parent_revision_id?: string;
    readonly graph_blob_hash: string;
    readonly graph_json: string;
    readonly schema_refs_json: string;
    readonly bindings_json: string;
    readonly validation_json: string;
    readonly reason: string;
    readonly created_at: string;
}
export interface ProjectRow {
    readonly id: string;
    readonly schema_version: string;
    readonly canonical_root: string;
    readonly backend_profile_id: string;
    readonly documents_json: string;
    readonly asset_roots_json: string;
    readonly output_root: string;
    readonly policy_revision: string;
    readonly created_at: string;
    readonly updated_at: string;
}
export interface SceneRow {
    readonly id: string;
    readonly project_id: string;
    readonly schema_version: string;
    readonly aliases_json: string;
    readonly action_text: string;
    readonly output_kind: string;
    readonly constraints_json: string;
    readonly required_asset_roles_json: string;
    readonly dependencies_json: string;
    readonly sources_hash: string;
    readonly created_at: string;
    readonly updated_at: string;
}
export interface AssetRow {
    readonly id: string;
    readonly project_id: string;
    readonly schema_version: string;
    readonly relative_path: string;
    readonly content_hash: string;
    readonly mime: string;
    readonly size_bytes: number;
    readonly roles_json: string;
    readonly source: string;
    readonly usage_policy_json: string;
    readonly review_reference_json: string | null;
    readonly created_at: string;
    readonly updated_at: string;
}
export interface ProviderUploadRow {
    readonly profile_id: string;
    readonly api_family: string;
    readonly asset_id: string;
    readonly content_hash: string;
    readonly mime: string;
    readonly provider_kind: string;
    readonly provider_value: string;
    readonly expires_at: string | null;
    readonly created_at: string;
    readonly updated_at: string;
}
export interface LoraUploadRow {
    readonly profile_id: string;
    readonly api_family: string;
    readonly asset_id: string;
    readonly content_hash: string;
    readonly provider_kind: string;
    readonly provider_value: string;
    readonly expires_at: string | null;
    readonly created_at: string;
    readonly updated_at: string;
}
export interface WorkItemRow {
    readonly id: string;
    readonly project_id: string;
    readonly chain_id: string;
    readonly scene_id: string | null;
    readonly schema_version: string;
    readonly user_request: string;
    readonly request_kind: string;
    readonly allowed_outputs_json: string;
    readonly state: string;
    readonly created_at: string;
    readonly updated_at: string;
}
export interface ExecutionPlanRow {
    readonly id: string;
    readonly work_item_id: string;
    readonly schema_version: string;
    readonly graph_revision_id: string;
    readonly graph_hash: string;
    readonly workflow_json: string;
    readonly asset_bindings_json: string;
    readonly requirements_hash: string;
    readonly policy_hash: string;
    readonly backend_profile_id: string;
    readonly provider_workflow_id: string | null;
    readonly provider_submit_mode: string | null;
    readonly workflow_state: string;
    readonly output_contract_json: string;
    readonly mode: string;
    readonly project_id: string;
    readonly created_at: string;
}
export interface JobRow {
    readonly id: string;
    readonly plan_id: string;
    readonly request_id: string;
    readonly schema_version: string;
    readonly execution_state: string;
    readonly provider_state: string;
    readonly artifact_state: string;
    readonly provider_task_id: string | null;
    readonly submit_intent: string | null;
    readonly charge_status: string;
    readonly attempts: number;
    readonly created_at: string;
    readonly updated_at: string;
}
export interface ResultRow {
    readonly id: string;
    readonly job_id: string;
    readonly output_id: string;
    readonly schema_version: string;
    readonly relative_path: string;
    readonly mime: string;
    readonly size_bytes: number;
    readonly content_hash: string;
    readonly created_at: string;
    readonly updated_at: string;
}
export interface DerivedResultRow {
    readonly id: string;
    readonly result_id: string;
    readonly kind: "preview" | "poster";
    readonly schema_version: string;
    readonly source_hash: string;
    readonly relative_path: string;
    readonly mime: string;
    readonly size_bytes: number;
    readonly content_hash: string;
    readonly created_at: string;
    readonly updated_at: string;
}
export type ReviewDecision = "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
export interface ReviewEventRow {
    readonly id: string;
    readonly job_id: string;
    readonly result_id: string;
    readonly output_hash: string;
    readonly decision: ReviewDecision;
    readonly feedback: string | null;
    readonly user_message_ref: string | null;
    readonly created_at: string;
}
export interface ReviewEventWriteResult {
    readonly row: ReviewEventRow;
    readonly inserted: boolean;
}
export interface ReviewRevisionRow {
    readonly review_event_id: string;
    readonly source_revision_id: string;
    readonly revision_id: string;
    readonly work_item_id: string;
    readonly created_at: string;
}
export interface OutboxRow {
    readonly id: string;
    readonly kind: string;
    readonly aggregate_id: string;
    readonly payload_json: string;
    readonly published_at: string | null;
    readonly created_at: string;
}
export declare class Storage {
    readonly db: DatabaseSync;
    constructor(dbPath: string);
    private applyMigrations;
    health(): {
        migration_version: number;
        table_count: number;
    };
    registerProject(projectId: string, backendProfileId?: string): void;
    hasProject(projectId: string): boolean;
    saveProject(row: ProjectRow): void;
    getProject(projectId: string): ProjectRow | undefined;
    listProjects(): ProjectRow[];
    saveScene(row: SceneRow): void;
    getScene(projectId: string, sceneId: string): SceneRow | undefined;
    listScenes(projectId: string): SceneRow[];
    saveAsset(row: AssetRow): void;
    listAssets(projectId: string): AssetRow[];
    getAsset(projectId: string, assetId: string): AssetRow | undefined;
    getProviderUpload(profileId: string, apiFamily: string, assetId: string, contentHash: string, now?: Date): ProviderUploadRow | undefined;
    saveProviderUpload(row: ProviderUploadRow): ProviderUploadRow;
    invalidateProviderUpload(profileId: string, apiFamily: string, assetId: string, contentHash: string): void;
    getLoraUpload(profileId: string, apiFamily: string, contentHash: string, now?: Date): LoraUploadRow | undefined;
    saveLoraUpload(row: LoraUploadRow): LoraUploadRow;
    invalidateLoraUpload(profileId: string, apiFamily: string, contentHash: string): void;
    saveWorkItem(row: WorkItemRow): void;
    getWorkItem(id: string): WorkItemRow | undefined;
    closeWorkItem(id: string): void;
    saveExecutionPlan(row: ExecutionPlanRow): void;
    updateExecutionPlanWorkflowState(id: string, state: "uninitialized" | "ready" | "failed_validation"): void;
    getExecutionPlan(id: string): ExecutionPlanRow | undefined;
    private getJobRow;
    getJob(id: string): JobRow | undefined;
    getJobByPlan(planId: string): JobRow | undefined;
    reserveJob(projectId: string, planId: string, requestId: string): JobRow;
    private findChainBlocker;
    claimSubmit(jobId: string, submitIntent: string): boolean;
    markSubmitUnknown(jobId: string): void;
    recordProviderTask(jobId: string, taskId: string): void;
    attachProviderTask(jobId: string, taskId: string): boolean;
    markProviderStatus(jobId: string, status: "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCEL", artifactState?: string): void;
    markArtifact(jobId: string, state: "NONE" | "PENDING" | "READY" | "FAILED"): void;
    getResult(jobId: string, outputId: string): ResultRow | undefined;
    getResultById(id: string): ResultRow | undefined;
    listResults(jobId: string): ResultRow[];
    saveResult(row: ResultRow): void;
    getDerivedResult(resultId: string, kind: DerivedResultRow["kind"]): DerivedResultRow | undefined;
    getDerivedResultById(id: string): DerivedResultRow | undefined;
    listDerivedResults(resultId: string): DerivedResultRow[];
    saveDerivedResult(row: DerivedResultRow): void;
    getReviewEvent(id: string): ReviewEventRow | undefined;
    listReviewEvents(resultId: string): ReviewEventRow[];
    saveReviewEvent(row: ReviewEventRow): ReviewEventWriteResult;
    getReviewRevision(reviewEventId: string): ReviewRevisionRow | undefined;
    saveReviewRevision(row: ReviewRevisionRow): ReviewRevisionRow;
    getWorkflowRevision(id: string): WorkflowRevisionRow | undefined;
    getOutbox(id: string): OutboxRow | undefined;
    getOutboxByAggregate(kind: string, aggregateId: string): OutboxRow | undefined;
    listPendingOutbox(kind?: string): OutboxRow[];
    enqueueOutbox(row: OutboxRow): OutboxRow;
    markOutboxPublished(id: string, publishedAt?: string): void;
    cancelLocalJob(jobId: string): void;
    listRecoverableJobs(): JobRow[];
    saveWorkflowRevision(row: WorkflowRevisionRow): void;
    loadWorkflowRevisions(): WorkflowRevisionRow[];
    close(): void;
}
