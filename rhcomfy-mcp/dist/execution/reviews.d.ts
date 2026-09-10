import type { GraphOperation } from "../graph/operations.js";
import { RevisionStore, type WorkflowRevision } from "../graph/revisions.js";
import { ProjectContextService, type WorkItemRecord } from "../projects/context.js";
import { Storage, type ReviewDecision, type ReviewEventRow } from "../storage/database.js";
export type ReviewStatus = "PENDING_REVIEW" | ReviewDecision;
export interface ReviewState {
    readonly result_id: string;
    readonly output_hash: string;
    readonly status: ReviewStatus;
    readonly event_id?: string;
    readonly feedback?: string;
    readonly user_message_ref?: string;
    readonly reviewed_at?: string;
}
export interface ReviewSummary {
    readonly status: ReviewStatus;
    readonly results: readonly ReviewState[];
}
export interface ReviewOutcome {
    readonly event: ReviewEventRow;
    readonly review: ReviewState;
    readonly idempotent: boolean;
    readonly next_actions: readonly string[];
    readonly changes_requested_revision?: ChangesRequestedRevision;
}
export interface ChangesRequestedRevision {
    readonly source_revision_id: string;
    readonly revision: WorkflowRevision;
    readonly work_item: WorkItemRecord;
}
export declare class ReviewService {
    private readonly storage;
    private readonly revisions?;
    private readonly projects?;
    constructor(storage: Storage, revisions?: RevisionStore | undefined, projects?: ProjectContextService | undefined);
    getState(resultId: string): ReviewState;
    getJobSummary(jobId: string): ReviewSummary;
    review(input: {
        readonly result_id: string;
        readonly decision: ReviewDecision;
        readonly feedback?: string;
        readonly user_message_ref?: string;
        readonly review_event_id?: string;
        readonly revision_request?: {
            readonly reason: string;
            readonly operations: readonly GraphOperation[];
            readonly user_request?: string;
            readonly request_kind?: string;
            readonly allowed_outputs?: readonly string[];
        };
    }): ReviewOutcome;
    private createChangesRequestedRevision;
    private requireResult;
}
