import { randomUUID } from "node:crypto";
import { AppError } from "../errors.js";
import { canonicalGraphJson, hashGraph } from "./codec.js";
import { applyGraphOperations } from "./operations.js";
import { validateGraph } from "./validation.js";
import { createEmptyGraph } from "./types.js";
function freezeDeep(value) {
    if (value && typeof value === "object") {
        for (const child of Object.values(value))
            freezeDeep(child);
        Object.freeze(value);
    }
    return value;
}
function snapshot(value) {
    return structuredClone(value);
}
export class RevisionStore {
    catalog;
    persistence;
    revisions = new Map();
    currentByWorkflow = new Map();
    blobs = new Map();
    constructor(options = {}) {
        this.catalog = options.catalog;
        this.persistence = options.persistence;
        for (const revision of options.persistence?.load() ?? []) {
            const restored = freezeDeep(snapshot(revision));
            const graphText = canonicalGraphJson(restored.graph);
            if (hashGraph(restored.graph) !== restored.graph_hash) {
                throw new AppError("INVALID_GRAPH", `Persisted revision ${restored.revision_id} has a graph hash mismatch.`);
            }
            this.revisions.set(restored.revision_id, restored);
            this.currentByWorkflow.set(restored.workflow_id, restored.revision_id);
            this.blobs.set(restored.graph_hash, graphText);
        }
    }
    createWorkflow(options) {
        const workflowId = options.workflow_id ?? randomUUID();
        if (this.currentByWorkflow.has(workflowId)) {
            throw new AppError("REVISION_CONFLICT", `Workflow ${workflowId} already exists.`, { recoverable: true });
        }
        const graph = snapshot(options.graph ?? createEmptyGraph());
        const revision = this.makeRevision({
            projectId: options.project_id,
            workflowId,
            graph,
            reason: options.reason ?? "create_workflow",
        });
        this.storeRevision(revision);
        return this.publicRevision(revision);
    }
    getCurrent(workflowId) {
        const revisionId = this.currentByWorkflow.get(workflowId);
        if (!revisionId)
            throw new AppError("PROJECT_NOT_FOUND", `Workflow ${workflowId} was not found.`, { recoverable: true });
        return this.getRevision(revisionId);
    }
    getWorkflowRevision(workflowId, revisionId) {
        const revision = revisionId ? this.getRevision(revisionId) : this.getCurrent(workflowId);
        if (revision.workflow_id !== workflowId) {
            throw new AppError("REVISION_CONFLICT", `Revision ${revision.revision_id} does not belong to workflow ${workflowId}.`, {
                recoverable: true,
            });
        }
        return revision;
    }
    getRevision(revisionId) {
        const revision = this.revisions.get(revisionId);
        if (!revision)
            throw new AppError("PROJECT_NOT_FOUND", `Revision ${revisionId} was not found.`, { recoverable: true });
        return this.publicRevision(revision);
    }
    editWorkflow(options) {
        const current = this.getCurrent(options.workflow_id);
        if (current.revision_id !== options.base_revision_id) {
            throw new AppError("REVISION_CONFLICT", "Base revision is not the current revision; last-write-wins is disabled.", {
                context: { workflow_id: options.workflow_id, expected: current.revision_id, received: options.base_revision_id },
                recoverable: true,
                suggestedFix: "Read the current revision and rebase the edit operations explicitly.",
            });
        }
        const edited = applyGraphOperations(current.graph, options.operations, { catalog: this.catalog });
        const revision = this.makeRevision({
            projectId: current.project_id,
            workflowId: options.workflow_id,
            graph: edited.graph,
            parentRevisionId: current.revision_id,
            reason: options.reason,
            validation: edited.validation,
        });
        this.storeRevision(revision);
        return { revision: this.publicRevision(revision), diff: edited.diff };
    }
    validate(revisionId) {
        return this.getRevision(revisionId).validation;
    }
    blobText(graphHash) {
        const blob = this.blobs.get(graphHash);
        if (!blob)
            throw new AppError("PROJECT_NOT_FOUND", `Graph blob ${graphHash} was not found.`, { recoverable: false });
        return blob;
    }
    makeRevision(options) {
        const graphHash = hashGraph(options.graph);
        const revision = {
            workflow_id: options.workflowId,
            project_id: options.projectId,
            revision_id: randomUUID(),
            ...(options.parentRevisionId ? { parent_revision_id: options.parentRevisionId } : {}),
            graph_hash: graphHash,
            graph: freezeDeep(snapshot(options.graph)),
            validation: options.validation ?? validateGraph(options.graph, this.catalog),
            reason: options.reason,
            created_at: new Date().toISOString(),
        };
        return revision;
    }
    storeRevision(revision) {
        if (this.revisions.has(revision.revision_id))
            throw new Error(`Revision ID collision: ${revision.revision_id}`);
        const graphText = canonicalGraphJson(revision.graph);
        const existingBlob = this.blobs.get(revision.graph_hash);
        if (existingBlob && existingBlob !== graphText)
            throw new Error(`Hash collision detected for ${revision.graph_hash}`);
        this.persistence?.save(revision, graphText);
        this.blobs.set(revision.graph_hash, graphText);
        this.revisions.set(revision.revision_id, revision);
        this.currentByWorkflow.set(revision.workflow_id, revision.revision_id);
    }
    publicRevision(revision) {
        return { ...revision, graph: snapshot(revision.graph), validation: snapshot(revision.validation) };
    }
}
//# sourceMappingURL=revisions.js.map