import { type GraphDiff, type GraphOperation } from "./operations.js";
import { type Graph, type NodeCatalog, type ValidationReport } from "./types.js";
export interface WorkflowRevision {
    readonly workflow_id: string;
    readonly project_id: string;
    readonly revision_id: string;
    readonly parent_revision_id?: string;
    readonly graph_hash: string;
    readonly graph: Graph;
    readonly validation: ValidationReport;
    readonly reason: string;
    readonly created_at: string;
}
export interface RevisionEditResult {
    readonly revision: WorkflowRevision;
    readonly diff: GraphDiff;
}
export interface RevisionPersistence {
    load(): readonly WorkflowRevision[];
    save(revision: WorkflowRevision, graphText: string): void;
}
export declare class RevisionStore {
    private readonly catalog?;
    private readonly persistence?;
    private readonly revisions;
    private readonly currentByWorkflow;
    private readonly blobs;
    constructor(options?: {
        readonly catalog?: NodeCatalog;
        readonly persistence?: RevisionPersistence;
    });
    createWorkflow(options: {
        readonly project_id: string;
        readonly workflow_id?: string;
        readonly graph?: Graph;
        readonly reason?: string;
    }): WorkflowRevision;
    getCurrent(workflowId: string): WorkflowRevision;
    getWorkflowRevision(workflowId: string, revisionId?: string): WorkflowRevision;
    getRevision(revisionId: string): WorkflowRevision;
    editWorkflow(options: {
        readonly workflow_id: string;
        readonly base_revision_id: string;
        readonly operations: readonly GraphOperation[];
        readonly reason: string;
    }): RevisionEditResult;
    validate(revisionId: string): ValidationReport;
    blobText(graphHash: string): string;
    private makeRevision;
    private storeRevision;
    private publicRevision;
}
