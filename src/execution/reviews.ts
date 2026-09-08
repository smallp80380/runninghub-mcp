import { createHash } from "node:crypto";
import { AppError } from "../errors.js";
import type { GraphOperation } from "../graph/operations.js";
import { RevisionStore, type WorkflowRevision } from "../graph/revisions.js";
import { ProjectContextService, type WorkItemRecord } from "../projects/context.js";
import { Storage, type ResultRow, type ReviewDecision, type ReviewEventRow } from "../storage/database.js";

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

function reviewEventId(input: {
  readonly result_id: string;
  readonly output_hash: string;
  readonly decision: ReviewDecision;
  readonly feedback?: string;
  readonly user_message_ref?: string;
}): string {
  const value = [input.result_id, input.output_hash, input.decision, input.feedback ?? "", input.user_message_ref ?? ""].join("\0");
  return `review-${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function eventState(event: ReviewEventRow): ReviewState {
  return {
    result_id: event.result_id,
    output_hash: event.output_hash,
    status: event.decision,
    event_id: event.id,
    ...(event.feedback !== null ? { feedback: event.feedback } : {}),
    ...(event.user_message_ref !== null ? { user_message_ref: event.user_message_ref } : {}),
    reviewed_at: event.created_at,
  };
}

function sameEvent(left: ReviewEventRow, right: ReviewEventRow): boolean {
  return left.id === right.id
    && left.job_id === right.job_id
    && left.result_id === right.result_id
    && left.output_hash === right.output_hash
    && left.decision === right.decision
    && left.feedback === right.feedback
    && left.user_message_ref === right.user_message_ref;
}

function aggregateStatus(states: readonly ReviewState[]): ReviewStatus {
  if (states.some((state) => state.status === "PENDING_REVIEW")) return "PENDING_REVIEW";
  if (states.some((state) => state.status === "CHANGES_REQUESTED")) return "CHANGES_REQUESTED";
  if (states.some((state) => state.status === "REJECTED")) return "REJECTED";
  return "APPROVED";
}

function nextActions(decision: ReviewDecision): readonly string[] {
  if (decision === "CHANGES_REQUESTED") return ["Create a new work item and revision explicitly from this feedback; the reviewed result remains unchanged."];
  if (decision === "APPROVED") return ["Wait for an explicit user request before starting another generation."];
  return ["Do not start a replacement unless the user explicitly requests one."];
}

export class ReviewService {
  constructor(
    private readonly storage: Storage,
    private readonly revisions?: RevisionStore,
    private readonly projects?: ProjectContextService,
  ) {}

  getState(resultId: string): ReviewState {
    const result = this.requireResult(resultId);
    const event = this.storage.listReviewEvents(result.id)[0];
    return event ? eventState(event) : { result_id: result.id, output_hash: result.content_hash, status: "PENDING_REVIEW" };
  }

  getJobSummary(jobId: string): ReviewSummary {
    const results = this.storage.listResults(jobId);
    if (!results.length) throw new AppError("DOWNLOAD_FAILED", `Job ${jobId} has no saved results to review.`, { recoverable: true });
    const states = results.map((result) => this.getState(result.id));
    return { status: aggregateStatus(states), results: states };
  }

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
  }): ReviewOutcome {
    if (input.revision_request && input.decision !== "CHANGES_REQUESTED") {
      throw new AppError("INVALID_CONFIGURATION", "revision_request is allowed only with CHANGES_REQUESTED.", {
        recoverable: true,
        suggestedFix: "Record CHANGES_REQUESTED first, then provide the explicit revision request.",
      });
    }
    if (input.revision_request && !input.feedback && !input.revision_request.user_request) {
      throw new AppError("INVALID_CONFIGURATION", "A changes-requested revision needs feedback or an explicit user_request.", {
        recoverable: true,
        suggestedFix: "Include feedback from the user or revision_request.user_request.",
      });
    }
    const result = this.requireResult(input.result_id);
    const job = this.storage.getJob(result.job_id);
    if (!job) throw new AppError("PROJECT_NOT_FOUND", `Job ${result.job_id} was not found.`, { recoverable: false });
    const event: ReviewEventRow = {
      id: input.review_event_id ?? reviewEventId({ result_id: result.id, output_hash: result.content_hash, decision: input.decision, ...(input.feedback ? { feedback: input.feedback } : {}), ...(input.user_message_ref ? { user_message_ref: input.user_message_ref } : {}) }),
      job_id: job.id,
      result_id: result.id,
      output_hash: result.content_hash,
      decision: input.decision,
      feedback: input.feedback ?? null,
      user_message_ref: input.user_message_ref ?? null,
      created_at: new Date().toISOString(),
    };
    const stored = this.storage.saveReviewEvent(event);
    if (!sameEvent(stored.row, event)) {
      throw new AppError("REQUEST_CONFLICT", `Review result ${result.id} already has a different review event.`, { recoverable: false, suggestedFix: "Use the original review event ID for an idempotent retry, or review a new result version." });
    }
    const review = eventState(stored.row);
    const changesRequestedRevision = input.revision_request
      ? this.createChangesRequestedRevision(stored.row, result, input.revision_request)
      : undefined;
    return {
      event: stored.row,
      review,
      idempotent: !stored.inserted,
      next_actions: nextActions(stored.row.decision),
      ...(changesRequestedRevision ? { changes_requested_revision: changesRequestedRevision } : {}),
    };
  }

  private createChangesRequestedRevision(
    event: ReviewEventRow,
    result: ResultRow,
    request: {
      readonly reason: string;
      readonly operations: readonly GraphOperation[];
      readonly user_request?: string;
      readonly request_kind?: string;
      readonly allowed_outputs?: readonly string[];
    },
  ): ChangesRequestedRevision {
    if (!this.revisions || !this.projects) {
      throw new AppError("INVALID_CONFIGURATION", "Changes-requested revisions require the workflow and project services.", { recoverable: false });
    }
    const existing = this.storage.getReviewRevision(event.id);
    if (existing) {
      return {
        source_revision_id: existing.source_revision_id,
        revision: this.revisions.getRevision(existing.revision_id),
        work_item: this.projects.getWorkItem(existing.work_item_id),
      };
    }

    const job = this.storage.getJob(result.job_id);
    if (!job) throw new AppError("PROJECT_NOT_FOUND", `Job ${result.job_id} was not found.`, { recoverable: false });
    const plan = this.storage.getExecutionPlan(job.plan_id);
    if (!plan) throw new AppError("PROJECT_NOT_FOUND", `Execution plan ${job.plan_id} was not found.`, { recoverable: false });
    const sourceRevisionRow = this.storage.getWorkflowRevision(plan.graph_revision_id);
    if (!sourceRevisionRow) throw new AppError("PROJECT_NOT_FOUND", `Workflow revision ${plan.graph_revision_id} was not found.`, { recoverable: false });
    const sourceRevision = this.revisions.getRevision(sourceRevisionRow.id);
    const workItem = this.projects.getWorkItem(plan.work_item_id);
    const revision = this.revisions.editWorkflow({
      workflow_id: sourceRevision.workflow_id,
      base_revision_id: sourceRevision.revision_id,
      operations: request.operations,
      reason: request.reason,
    }).revision;
    const nextWorkItem = this.projects.createWorkItem({
      project_id: workItem.project_id,
      ...(workItem.scene_id ? { scene_id: workItem.scene_id } : {}),
      chain_id: workItem.chain_id,
      user_request: request.user_request ?? inputFeedback(event, request.reason),
      request_kind: request.request_kind ?? workItem.request_kind,
      allowed_outputs: request.allowed_outputs ?? workItem.allowed_outputs,
    });
    const stored = this.storage.saveReviewRevision({
      review_event_id: event.id,
      source_revision_id: sourceRevision.revision_id,
      revision_id: revision.revision_id,
      work_item_id: nextWorkItem.id,
      created_at: new Date().toISOString(),
    });
    return {
      source_revision_id: stored.source_revision_id,
      revision: this.revisions.getRevision(stored.revision_id),
      work_item: this.projects.getWorkItem(stored.work_item_id),
    };
  }

  private requireResult(resultId: string): ResultRow {
    const result = this.storage.getResultById(resultId);
    if (!result) throw new AppError("PROJECT_NOT_FOUND", `Result ${resultId} was not found.`, { recoverable: true });
    return result;
  }
}

function inputFeedback(event: ReviewEventRow, reason: string): string {
  return event.feedback ? `Revision requested from review feedback: ${event.feedback}` : `Revision requested: ${reason}`;
}
