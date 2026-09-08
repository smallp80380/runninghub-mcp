import type { RevisionPersistence, WorkflowRevision } from "../graph/revisions.js";
import { AppError } from "../errors.js";
import type { Graph, ValidationReport } from "../graph/types.js";
import { Storage, type WorkflowRevisionRow } from "./database.js";

export class SqliteRevisionPersistence implements RevisionPersistence {
  constructor(private readonly storage: Storage) {}

  load(): readonly WorkflowRevision[] {
    return this.storage.loadWorkflowRevisions().map((row) => this.fromRow(row));
  }

  save(revision: WorkflowRevision, graphText: string): void {
    if (!this.storage.hasProject(revision.project_id)) {
      throw new AppError("PROJECT_NOT_FOUND", `Project ${revision.project_id} must be registered before creating a workflow.`, {
        recoverable: true,
        suggestedFix: "Register the project and retry the local workflow operation.",
      });
    }
    this.storage.saveWorkflowRevision({
      id: revision.revision_id,
      workflow_id: revision.workflow_id,
      project_id: revision.project_id,
      schema_version: revision.graph.schema_version,
      ...(revision.parent_revision_id ? { parent_revision_id: revision.parent_revision_id } : {}),
      graph_blob_hash: revision.graph_hash,
      graph_json: graphText,
      schema_refs_json: "[]",
      bindings_json: "{}",
      validation_json: JSON.stringify(revision.validation),
      reason: revision.reason,
      created_at: revision.created_at,
    });
  }

  private fromRow(row: WorkflowRevisionRow): WorkflowRevision {
    return {
      workflow_id: row.workflow_id,
      project_id: row.project_id,
      revision_id: row.id,
      ...(row.parent_revision_id ? { parent_revision_id: row.parent_revision_id } : {}),
      graph_hash: row.graph_blob_hash,
      graph: JSON.parse(row.graph_json) as Graph,
      validation: JSON.parse(row.validation_json) as ValidationReport,
      reason: row.reason,
      created_at: row.created_at,
    };
  }
}
