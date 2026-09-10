import { AppError } from "../errors.js";
import { Storage } from "./database.js";
export class SqliteRevisionPersistence {
    storage;
    constructor(storage) {
        this.storage = storage;
    }
    load() {
        return this.storage.loadWorkflowRevisions().map((row) => this.fromRow(row));
    }
    save(revision, graphText) {
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
    fromRow(row) {
        return {
            workflow_id: row.workflow_id,
            project_id: row.project_id,
            revision_id: row.id,
            ...(row.parent_revision_id ? { parent_revision_id: row.parent_revision_id } : {}),
            graph_hash: row.graph_blob_hash,
            graph: JSON.parse(row.graph_json),
            validation: JSON.parse(row.validation_json),
            reason: row.reason,
            created_at: row.created_at,
        };
    }
}
//# sourceMappingURL=revisions.js.map