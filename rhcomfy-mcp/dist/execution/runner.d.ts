import { Storage, type ExecutionPlanRow, type JobRow } from "../storage/database.js";
import { type ExecutionPlan, type JobHandle, type WorkflowBackend } from "./types.js";
export declare function planToRow(plan: ExecutionPlan, createdAt?: string): ExecutionPlanRow;
export declare function planFromRow(row: ExecutionPlanRow): ExecutionPlan;
export declare function jobHandle(row: JobRow): JobHandle;
export declare class DurableWorkflowRunner {
    private readonly storage;
    private readonly backend;
    private readonly assets;
    constructor(storage: Storage, backend: WorkflowBackend);
    prepare(plan: ExecutionPlan): ExecutionPlan;
    run(plan: ExecutionPlan, requestId: string): Promise<JobHandle>;
    wait(jobId: string, timeoutMs?: number, pollIntervalMs?: number): Promise<JobHandle>;
    cancel(jobId: string): Promise<JobHandle>;
    recover(jobId: string, timeoutMs?: number): Promise<JobHandle>;
    private requireJob;
    private invalidatePlanCaches;
    private resolveProviderWorkflow;
    private preflightRemoteImageOverrides;
}
