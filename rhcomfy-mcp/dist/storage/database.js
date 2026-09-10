import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { AppError } from "../errors.js";
function cacheExpired(expiresAt, now) {
    if (!expiresAt)
        return false;
    const timestamp = Date.parse(expiresAt);
    return !Number.isFinite(timestamp) || timestamp <= now.getTime();
}
const MIGRATIONS = [
    {
        id: 1,
        sql: `
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        schema_version TEXT NOT NULL,
        canonical_root TEXT NOT NULL,
        backend_profile_id TEXT NOT NULL,
        documents_json TEXT NOT NULL,
        asset_roots_json TEXT NOT NULL,
        output_root TEXT NOT NULL,
        policy_revision TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS scenes (
        id TEXT NOT NULL,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        schema_version TEXT NOT NULL,
        aliases_json TEXT NOT NULL,
        action_text TEXT NOT NULL,
        output_kind TEXT NOT NULL,
        constraints_json TEXT NOT NULL,
        required_asset_roles_json TEXT NOT NULL,
        dependencies_json TEXT NOT NULL,
        sources_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (project_id, id)
      );
      CREATE TABLE IF NOT EXISTS assets (
        id TEXT NOT NULL,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        schema_version TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        mime TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        roles_json TEXT NOT NULL,
        source TEXT NOT NULL,
        usage_policy_json TEXT NOT NULL,
        review_reference_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (project_id, id),
        UNIQUE (project_id, relative_path, content_hash)
      );
      CREATE TABLE IF NOT EXISTS workflow_revisions (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        schema_version TEXT NOT NULL,
        parent_revision_id TEXT,
        graph_blob_hash TEXT NOT NULL,
        graph_json TEXT NOT NULL,
        schema_refs_json TEXT NOT NULL,
        bindings_json TEXT NOT NULL,
        validation_json TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (workflow_id, id)
      );
      CREATE TABLE IF NOT EXISTS work_items (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        chain_id TEXT NOT NULL,
        scene_id TEXT,
        schema_version TEXT NOT NULL,
        user_request TEXT NOT NULL,
        request_kind TEXT NOT NULL,
        allowed_outputs_json TEXT NOT NULL,
        state TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS work_items_chain_idx ON work_items(project_id, chain_id);
      CREATE TABLE IF NOT EXISTS execution_plans (
        id TEXT PRIMARY KEY,
        work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
        schema_version TEXT NOT NULL,
        graph_revision_id TEXT NOT NULL REFERENCES workflow_revisions(id),
        graph_hash TEXT NOT NULL,
        workflow_json TEXT NOT NULL,
        asset_bindings_json TEXT NOT NULL,
        requirements_hash TEXT NOT NULL,
        policy_hash TEXT NOT NULL,
        backend_profile_id TEXT NOT NULL,
        output_contract_json TEXT NOT NULL,
        mode TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (work_item_id, id)
      );
      CREATE TABLE IF NOT EXISTS requests (
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        request_key TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (project_id, request_key)
      );
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL UNIQUE REFERENCES execution_plans(id),
        request_id TEXT NOT NULL,
        schema_version TEXT NOT NULL,
        execution_state TEXT NOT NULL,
        provider_state TEXT NOT NULL,
        artifact_state TEXT NOT NULL,
        provider_task_id TEXT,
        submit_intent TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (provider_task_id)
      );
      CREATE TABLE IF NOT EXISTS review_events (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        result_id TEXT NOT NULL,
        output_hash TEXT NOT NULL,
        decision TEXT NOT NULL,
        feedback TEXT,
        user_message_ref TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (job_id, result_id, output_hash, id)
      );
      CREATE TABLE IF NOT EXISTS poller_leases (
        job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
        owner_id TEXT NOT NULL,
        lease_until TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS outbox (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        aggregate_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        published_at TEXT,
        created_at TEXT NOT NULL
      );
    `,
    },
    {
        id: 2,
        sql: `
      CREATE TABLE IF NOT EXISTS provider_uploads (
        profile_id TEXT NOT NULL,
        api_family TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        mime TEXT NOT NULL,
        provider_kind TEXT NOT NULL,
        provider_value TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (profile_id, api_family, asset_id, content_hash)
      );
    `,
    },
    {
        id: 3,
        sql: `
      ALTER TABLE execution_plans ADD COLUMN provider_workflow_id TEXT;
    `,
    },
    {
        id: 4,
        sql: `
      CREATE TABLE IF NOT EXISTS results (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        output_id TEXT NOT NULL,
        schema_version TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        mime TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (job_id, output_id)
      );
    `,
    },
    {
        id: 5,
        sql: `
      CREATE TABLE IF NOT EXISTS derived_results (
        id TEXT PRIMARY KEY,
        result_id TEXT NOT NULL REFERENCES results(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        schema_version TEXT NOT NULL,
        source_hash TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        mime TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (result_id, kind)
      );
    `,
    },
    {
        id: 6,
        sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS outbox_kind_aggregate_idx
        ON outbox(kind, aggregate_id);
    `,
    },
    {
        id: 7,
        sql: `
      CREATE TABLE IF NOT EXISTS review_revisions (
        review_event_id TEXT PRIMARY KEY REFERENCES review_events(id) ON DELETE CASCADE,
        source_revision_id TEXT NOT NULL REFERENCES workflow_revisions(id),
        revision_id TEXT NOT NULL REFERENCES workflow_revisions(id),
        work_item_id TEXT NOT NULL REFERENCES work_items(id),
        created_at TEXT NOT NULL
      );
    `,
    },
    {
        id: 8,
        sql: `
      CREATE TABLE IF NOT EXISTS lora_uploads (
        profile_id TEXT NOT NULL,
        api_family TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        provider_kind TEXT NOT NULL,
        provider_value TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (profile_id, api_family, content_hash)
      );
    `,
    },
    {
        id: 9,
        sql: `
      ALTER TABLE provider_uploads ADD COLUMN expires_at TEXT;
      ALTER TABLE lora_uploads ADD COLUMN expires_at TEXT;
    `,
    },
    {
        id: 10,
        sql: `
      ALTER TABLE execution_plans ADD COLUMN workflow_state TEXT NOT NULL DEFAULT 'uninitialized';
    `,
    },
    {
        id: 11,
        sql: `
      ALTER TABLE jobs ADD COLUMN charge_status TEXT NOT NULL DEFAULT 'unknown_or_not_started';
    `,
    },
    {
        id: 12,
        sql: `
      ALTER TABLE execution_plans ADD COLUMN provider_submit_mode TEXT;
    `,
    },
];
export class Storage {
    db;
    constructor(dbPath) {
        if (dbPath !== ":memory:") {
            mkdirSync(dirname(dbPath), { recursive: true });
        }
        this.db = new DatabaseSync(dbPath);
        this.db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
        this.applyMigrations();
    }
    applyMigrations() {
        this.db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);");
        const applied = new Set(this.db.prepare("SELECT id FROM schema_migrations ORDER BY id").all().map((row) => row.id));
        for (const migration of MIGRATIONS) {
            if (applied.has(migration.id)) {
                continue;
            }
            this.db.exec("BEGIN IMMEDIATE");
            try {
                this.db.exec(migration.sql);
                this.db
                    .prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)")
                    .run(migration.id, new Date().toISOString());
                this.db.exec("COMMIT");
            }
            catch (error) {
                this.db.exec("ROLLBACK");
                throw error;
            }
        }
    }
    health() {
        const migration = this.db.prepare("SELECT COALESCE(MAX(id), 0) AS id FROM schema_migrations").get();
        const tables = this.db
            .prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
            .get();
        return { migration_version: migration.id, table_count: tables.count };
    }
    registerProject(projectId, backendProfileId = "default") {
        const now = new Date().toISOString();
        this.db
            .prepare(`INSERT OR IGNORE INTO projects
          (id, schema_version, canonical_root, backend_profile_id, documents_json, asset_roots_json,
           output_root, policy_revision, created_at, updated_at)
         VALUES (?, '1', '', ?, '[]', '[]', '', '1', ?, ?)`)
            .run(projectId, backendProfileId, now, now);
    }
    hasProject(projectId) {
        return Boolean(this.db.prepare("SELECT 1 AS found FROM projects WHERE id = ?").get(projectId));
    }
    saveProject(row) {
        this.db
            .prepare(`INSERT INTO projects
          (id, schema_version, canonical_root, backend_profile_id, documents_json, asset_roots_json,
           output_root, policy_revision, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET canonical_root=excluded.canonical_root,
           backend_profile_id=excluded.backend_profile_id, documents_json=excluded.documents_json,
           asset_roots_json=excluded.asset_roots_json, output_root=excluded.output_root,
           policy_revision=excluded.policy_revision, updated_at=excluded.updated_at`)
            .run(row.id, row.schema_version, row.canonical_root, row.backend_profile_id, row.documents_json, row.asset_roots_json, row.output_root, row.policy_revision, row.created_at, row.updated_at);
    }
    getProject(projectId) {
        return this.db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
    }
    listProjects() {
        return this.db.prepare("SELECT * FROM projects ORDER BY id").all();
    }
    saveScene(row) {
        this.db
            .prepare(`INSERT INTO scenes
          (id, project_id, schema_version, aliases_json, action_text, output_kind, constraints_json,
           required_asset_roles_json, dependencies_json, sources_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id, id) DO UPDATE SET aliases_json=excluded.aliases_json,
           action_text=excluded.action_text, output_kind=excluded.output_kind,
           constraints_json=excluded.constraints_json, required_asset_roles_json=excluded.required_asset_roles_json,
           dependencies_json=excluded.dependencies_json, sources_hash=excluded.sources_hash,
           updated_at=excluded.updated_at`)
            .run(row.id, row.project_id, row.schema_version, row.aliases_json, row.action_text, row.output_kind, row.constraints_json, row.required_asset_roles_json, row.dependencies_json, row.sources_hash, row.created_at, row.updated_at);
    }
    getScene(projectId, sceneId) {
        return this.db.prepare("SELECT * FROM scenes WHERE project_id = ? AND id = ?").get(projectId, sceneId);
    }
    listScenes(projectId) {
        return this.db.prepare("SELECT * FROM scenes WHERE project_id = ? ORDER BY id").all(projectId);
    }
    saveAsset(row) {
        this.db
            .prepare(`INSERT INTO assets
          (id, project_id, schema_version, relative_path, content_hash, mime, size_bytes, roles_json,
           source, usage_policy_json, review_reference_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id, id) DO UPDATE SET roles_json=excluded.roles_json,
           source=excluded.source, usage_policy_json=excluded.usage_policy_json,
           updated_at=excluded.updated_at`)
            .run(row.id, row.project_id, row.schema_version, row.relative_path, row.content_hash, row.mime, row.size_bytes, row.roles_json, row.source, row.usage_policy_json, row.review_reference_json, row.created_at, row.updated_at);
    }
    listAssets(projectId) {
        return this.db.prepare("SELECT * FROM assets WHERE project_id = ? ORDER BY relative_path, content_hash").all(projectId);
    }
    getAsset(projectId, assetId) {
        return this.db.prepare("SELECT * FROM assets WHERE project_id = ? AND id = ?").get(projectId, assetId);
    }
    getProviderUpload(profileId, apiFamily, assetId, contentHash, now = new Date()) {
        const row = this.db
            .prepare("SELECT * FROM provider_uploads WHERE profile_id = ? AND api_family = ? AND asset_id = ? AND content_hash = ?")
            .get(profileId, apiFamily, assetId, contentHash);
        if (!row)
            return undefined;
        if (cacheExpired(row.expires_at, now)) {
            this.invalidateProviderUpload(profileId, apiFamily, assetId, contentHash);
            return undefined;
        }
        return row;
    }
    saveProviderUpload(row) {
        this.db
            .prepare(`INSERT OR IGNORE INTO provider_uploads
          (profile_id, api_family, asset_id, content_hash, mime, provider_kind, provider_value, expires_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(row.profile_id, row.api_family, row.asset_id, row.content_hash, row.mime, row.provider_kind, row.provider_value, row.expires_at ?? null, row.created_at, row.updated_at);
        const stored = this.getProviderUpload(row.profile_id, row.api_family, row.asset_id, row.content_hash);
        if (!stored)
            throw new Error(`Provider upload ${row.asset_id} was not persisted`);
        return stored;
    }
    invalidateProviderUpload(profileId, apiFamily, assetId, contentHash) {
        this.db.prepare("DELETE FROM provider_uploads WHERE profile_id = ? AND api_family = ? AND asset_id = ? AND content_hash = ?").run(profileId, apiFamily, assetId, contentHash);
    }
    getLoraUpload(profileId, apiFamily, contentHash, now = new Date()) {
        const row = this.db
            .prepare("SELECT * FROM lora_uploads WHERE profile_id = ? AND api_family = ? AND content_hash = ?")
            .get(profileId, apiFamily, contentHash);
        if (!row)
            return undefined;
        if (cacheExpired(row.expires_at, now)) {
            this.invalidateLoraUpload(profileId, apiFamily, contentHash);
            return undefined;
        }
        return row;
    }
    saveLoraUpload(row) {
        this.db
            .prepare(`INSERT OR IGNORE INTO lora_uploads
          (profile_id, api_family, asset_id, content_hash, provider_kind, provider_value, expires_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(row.profile_id, row.api_family, row.asset_id, row.content_hash, row.provider_kind, row.provider_value, row.expires_at ?? null, row.created_at, row.updated_at);
        const stored = this.getLoraUpload(row.profile_id, row.api_family, row.content_hash);
        if (!stored)
            throw new Error(`LoRA upload ${row.asset_id} was not persisted`);
        return stored;
    }
    invalidateLoraUpload(profileId, apiFamily, contentHash) {
        this.db.prepare("DELETE FROM lora_uploads WHERE profile_id = ? AND api_family = ? AND content_hash = ?").run(profileId, apiFamily, contentHash);
    }
    saveWorkItem(row) {
        this.db
            .prepare(`INSERT INTO work_items
          (id, project_id, chain_id, scene_id, schema_version, user_request, request_kind,
           allowed_outputs_json, state, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(row.id, row.project_id, row.chain_id, row.scene_id, row.schema_version, row.user_request, row.request_kind, row.allowed_outputs_json, row.state, row.created_at, row.updated_at);
    }
    getWorkItem(id) {
        return this.db.prepare("SELECT * FROM work_items WHERE id = ?").get(id);
    }
    closeWorkItem(id) {
        this.db.prepare("UPDATE work_items SET state = 'CLOSED', updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
    }
    saveExecutionPlan(row) {
        this.db
            .prepare(`INSERT INTO execution_plans
          (id, work_item_id, schema_version, graph_revision_id, graph_hash, workflow_json, asset_bindings_json,
           requirements_hash, policy_hash, backend_profile_id, provider_workflow_id, provider_submit_mode, workflow_state, output_contract_json, mode, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(row.id, row.work_item_id, row.schema_version, row.graph_revision_id, row.graph_hash, row.workflow_json, row.asset_bindings_json, row.requirements_hash, row.policy_hash, row.backend_profile_id, row.provider_workflow_id, row.provider_submit_mode, row.workflow_state, row.output_contract_json, row.mode, row.created_at);
    }
    updateExecutionPlanWorkflowState(id, state) {
        this.db.prepare("UPDATE execution_plans SET workflow_state = ? WHERE id = ?").run(state, id);
    }
    getExecutionPlan(id) {
        return this.db
            .prepare(`SELECT p.*, w.project_id AS project_id
           FROM execution_plans p JOIN work_items w ON w.id = p.work_item_id
          WHERE p.id = ?`)
            .get(id);
    }
    getJobRow(id) {
        return this.db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
    }
    getJob(id) {
        return this.getJobRow(id);
    }
    getJobByPlan(planId) {
        return this.db.prepare("SELECT * FROM jobs WHERE plan_id = ?").get(planId);
    }
    reserveJob(projectId, planId, requestId) {
        this.db.exec("BEGIN IMMEDIATE");
        try {
            const existingRequest = this.db.prepare("SELECT plan_id FROM requests WHERE project_id = ? AND request_key = ?").get(projectId, requestId);
            if (existingRequest && existingRequest.plan_id !== planId) {
                throw new Error("REQUEST_CONFLICT");
            }
            const existingJob = this.getJobByPlan(planId);
            if (existingJob) {
                this.db.exec("COMMIT");
                return existingJob;
            }
            const planContext = this.db
                .prepare(`SELECT w.project_id, w.chain_id, w.id AS work_item_id
             FROM execution_plans p
             JOIN work_items w ON w.id = p.work_item_id
            WHERE p.id = ?`)
                .get(planId);
            if (!planContext)
                throw new AppError("PROJECT_NOT_FOUND", `Execution plan ${planId} was not found.`, { recoverable: true });
            if (planContext.project_id !== projectId) {
                throw new AppError("REQUEST_CONFLICT", `Execution plan ${planId} does not belong to project ${projectId}.`, { recoverable: false });
            }
            const blocker = this.findChainBlocker(planContext.project_id, planContext.chain_id);
            if (blocker) {
                throw new AppError("REVIEW_PENDING", `Review chain ${planContext.chain_id} is not ready for another execution.`, {
                    context: {
                        project_id: planContext.project_id,
                        chain_id: planContext.chain_id,
                        blocking_work_item_id: blocker.work_item_id,
                        blocking_job_id: blocker.job_id,
                        reason: blocker.reason,
                    },
                    recoverable: true,
                    suggestedFix: blocker.reason === "review_pending"
                        ? "Review every saved result in the blocking job before starting another execution."
                        : "Wait for the blocking execution or finish its result download before starting another execution.",
                });
            }
            if (!existingRequest)
                this.db.prepare("INSERT INTO requests (project_id, request_key, plan_id, created_at) VALUES (?, ?, ?, ?)").run(projectId, requestId, planId, new Date().toISOString());
            const id = randomUUID();
            const now = new Date().toISOString();
            this.db.prepare(`INSERT INTO jobs (id, plan_id, request_id, schema_version, execution_state, provider_state, artifact_state, provider_task_id, submit_intent, attempts, created_at, updated_at) VALUES (?, ?, ?, '1', 'READY', 'NOT_SUBMITTED', 'NONE', NULL, NULL, 0, ?, ?)`).run(id, planId, requestId, now, now);
            const created = this.getJobRow(id);
            if (!created)
                throw new Error("Job insert did not return a row");
            this.db.exec("COMMIT");
            return created;
        }
        catch (error) {
            this.db.exec("ROLLBACK");
            throw error;
        }
    }
    findChainBlocker(projectId, chainId) {
        const rows = this.db
            .prepare(`SELECT w.id AS work_item_id, j.id AS job_id, j.execution_state, j.artifact_state,
                (SELECT COUNT(*) FROM results r WHERE r.job_id = j.id) AS result_count,
                (SELECT COUNT(*)
                   FROM results r
                  WHERE r.job_id = j.id
                    AND NOT EXISTS (SELECT 1 FROM review_events e WHERE e.result_id = r.id)) AS unreviewed_count
           FROM execution_plans p
           JOIN work_items w ON w.id = p.work_item_id
           JOIN jobs j ON j.plan_id = p.id
          WHERE w.project_id = ? AND w.chain_id = ?
          ORDER BY j.updated_at, j.id`)
            .all(projectId, chainId);
        for (const row of rows) {
            if (["READY", "SUBMITTING", "SUBMIT_UNKNOWN", "RUNNING"].includes(row.execution_state)) {
                return { work_item_id: row.work_item_id, job_id: row.job_id, reason: "execution_active" };
            }
            if (row.execution_state !== "SUCCEEDED")
                continue;
            if (row.artifact_state !== "READY") {
                return { work_item_id: row.work_item_id, job_id: row.job_id, reason: "download_incomplete" };
            }
            if (row.result_count === 0) {
                return { work_item_id: row.work_item_id, job_id: row.job_id, reason: "results_not_downloaded" };
            }
            if (row.unreviewed_count > 0) {
                return { work_item_id: row.work_item_id, job_id: row.job_id, reason: "review_pending" };
            }
        }
        return undefined;
    }
    claimSubmit(jobId, submitIntent) {
        const result = this.db.prepare("UPDATE jobs SET execution_state = 'SUBMITTING', submit_intent = ?, attempts = attempts + 1, updated_at = ? WHERE id = ? AND execution_state = 'READY' AND submit_intent IS NULL").run(submitIntent, new Date().toISOString(), jobId);
        return Number(result.changes) === 1;
    }
    markSubmitUnknown(jobId) {
        this.db.prepare("UPDATE jobs SET execution_state = 'SUBMIT_UNKNOWN', provider_state = 'UNKNOWN', charge_status = 'unknown', updated_at = ? WHERE id = ? AND provider_task_id IS NULL AND execution_state IN ('SUBMITTING', 'SUBMIT_UNKNOWN')").run(new Date().toISOString(), jobId);
    }
    recordProviderTask(jobId, taskId) {
        this.db.prepare("UPDATE jobs SET execution_state = 'RUNNING', provider_state = 'QUEUED', provider_task_id = ?, updated_at = ? WHERE id = ? AND provider_task_id IS NULL").run(taskId, new Date().toISOString(), jobId);
    }
    attachProviderTask(jobId, taskId) {
        const result = this.db.prepare("UPDATE jobs SET execution_state = 'RUNNING', provider_state = 'QUEUED', provider_task_id = ?, updated_at = ? WHERE id = ? AND execution_state = 'SUBMIT_UNKNOWN' AND provider_task_id IS NULL").run(taskId, new Date().toISOString(), jobId);
        return Number(result.changes) === 1;
    }
    markProviderStatus(jobId, status, artifactState) {
        const state = status === "SUCCESS" ? "SUCCEEDED" : status === "FAILED" ? "FAILED" : status === "CANCEL" ? "CANCELLED" : "RUNNING";
        const provider = status === "SUCCESS" ? "SUCCEEDED" : status === "FAILED" ? "FAILED" : status === "CANCEL" ? "CANCELLED" : status;
        this.db.prepare("UPDATE jobs SET execution_state = ?, provider_state = ?, artifact_state = COALESCE(?, artifact_state), updated_at = ? WHERE id = ?").run(state, provider, artifactState ?? null, new Date().toISOString(), jobId);
    }
    markArtifact(jobId, state) {
        this.db.prepare("UPDATE jobs SET artifact_state = ?, updated_at = ? WHERE id = ?").run(state, new Date().toISOString(), jobId);
    }
    getResult(jobId, outputId) {
        return this.db.prepare("SELECT * FROM results WHERE job_id = ? AND output_id = ?").get(jobId, outputId);
    }
    getResultById(id) {
        return this.db.prepare("SELECT * FROM results WHERE id = ?").get(id);
    }
    listResults(jobId) {
        return this.db.prepare("SELECT * FROM results WHERE job_id = ? ORDER BY output_id").all(jobId);
    }
    saveResult(row) {
        this.db
            .prepare(`INSERT INTO results
          (id, job_id, output_id, schema_version, relative_path, mime, size_bytes, content_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(job_id, output_id) DO UPDATE SET relative_path=excluded.relative_path,
           mime=excluded.mime, size_bytes=excluded.size_bytes, content_hash=excluded.content_hash,
           updated_at=excluded.updated_at`)
            .run(row.id, row.job_id, row.output_id, row.schema_version, row.relative_path, row.mime, row.size_bytes, row.content_hash, row.created_at, row.updated_at);
    }
    getDerivedResult(resultId, kind) {
        return this.db.prepare("SELECT * FROM derived_results WHERE result_id = ? AND kind = ?").get(resultId, kind);
    }
    getDerivedResultById(id) {
        return this.db.prepare("SELECT * FROM derived_results WHERE id = ?").get(id);
    }
    listDerivedResults(resultId) {
        return this.db.prepare("SELECT * FROM derived_results WHERE result_id = ? ORDER BY kind").all(resultId);
    }
    saveDerivedResult(row) {
        this.db
            .prepare(`INSERT INTO derived_results
          (id, result_id, kind, schema_version, source_hash, relative_path, mime, size_bytes, content_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(result_id, kind) DO UPDATE SET source_hash=excluded.source_hash,
           relative_path=excluded.relative_path, mime=excluded.mime, size_bytes=excluded.size_bytes,
           content_hash=excluded.content_hash, updated_at=excluded.updated_at`)
            .run(row.id, row.result_id, row.kind, row.schema_version, row.source_hash, row.relative_path, row.mime, row.size_bytes, row.content_hash, row.created_at, row.updated_at);
    }
    getReviewEvent(id) {
        return this.db.prepare("SELECT * FROM review_events WHERE id = ?").get(id);
    }
    listReviewEvents(resultId) {
        return this.db.prepare("SELECT * FROM review_events WHERE result_id = ? ORDER BY created_at, id").all(resultId);
    }
    saveReviewEvent(row) {
        this.db.exec("BEGIN IMMEDIATE");
        try {
            const existingById = this.getReviewEvent(row.id);
            if (existingById) {
                this.db.exec("COMMIT");
                return { row: existingById, inserted: false };
            }
            const existingByResult = this.db
                .prepare("SELECT * FROM review_events WHERE result_id = ? ORDER BY created_at, id LIMIT 1")
                .get(row.result_id);
            if (existingByResult) {
                this.db.exec("COMMIT");
                return { row: existingByResult, inserted: false };
            }
            this.db
                .prepare(`INSERT INTO review_events
            (id, job_id, result_id, output_hash, decision, feedback, user_message_ref, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
                .run(row.id, row.job_id, row.result_id, row.output_hash, row.decision, row.feedback, row.user_message_ref, row.created_at);
            const stored = this.getReviewEvent(row.id);
            if (!stored)
                throw new Error(`Review event ${row.id} was not persisted`);
            this.db.exec("COMMIT");
            return { row: stored, inserted: true };
        }
        catch (error) {
            this.db.exec("ROLLBACK");
            throw error;
        }
    }
    getReviewRevision(reviewEventId) {
        return this.db.prepare("SELECT * FROM review_revisions WHERE review_event_id = ?").get(reviewEventId);
    }
    saveReviewRevision(row) {
        this.db
            .prepare(`INSERT OR IGNORE INTO review_revisions
           (review_event_id, source_revision_id, revision_id, work_item_id, created_at)
         VALUES (?, ?, ?, ?, ?)`)
            .run(row.review_event_id, row.source_revision_id, row.revision_id, row.work_item_id, row.created_at);
        const stored = this.getReviewRevision(row.review_event_id);
        if (!stored)
            throw new Error(`Review revision ${row.review_event_id} was not persisted`);
        return stored;
    }
    getWorkflowRevision(id) {
        return this.db.prepare("SELECT * FROM workflow_revisions WHERE id = ?").get(id);
    }
    getOutbox(id) {
        return this.db.prepare("SELECT * FROM outbox WHERE id = ?").get(id);
    }
    getOutboxByAggregate(kind, aggregateId) {
        return this.db.prepare("SELECT * FROM outbox WHERE kind = ? AND aggregate_id = ?").get(kind, aggregateId);
    }
    listPendingOutbox(kind) {
        if (kind) {
            return this.db.prepare("SELECT * FROM outbox WHERE published_at IS NULL AND kind = ? ORDER BY created_at, id").all(kind);
        }
        return this.db.prepare("SELECT * FROM outbox WHERE published_at IS NULL ORDER BY created_at, id").all();
    }
    enqueueOutbox(row) {
        this.db
            .prepare(`INSERT OR IGNORE INTO outbox (id, kind, aggregate_id, payload_json, published_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`)
            .run(row.id, row.kind, row.aggregate_id, row.payload_json, row.published_at, row.created_at);
        const stored = this.getOutbox(row.id);
        if (!stored)
            throw new Error(`Outbox ${row.id} was not persisted`);
        return stored;
    }
    markOutboxPublished(id, publishedAt = new Date().toISOString()) {
        this.db.prepare("UPDATE outbox SET published_at = COALESCE(published_at, ?) WHERE id = ?").run(publishedAt, id);
    }
    cancelLocalJob(jobId) {
        this.db.prepare("UPDATE jobs SET execution_state = 'CANCELLED', provider_state = 'CANCELLED', updated_at = ? WHERE id = ? AND provider_task_id IS NULL AND execution_state = 'READY'").run(new Date().toISOString(), jobId);
    }
    listRecoverableJobs() {
        return this.db.prepare("SELECT * FROM jobs WHERE execution_state IN ('SUBMIT_UNKNOWN', 'RUNNING', 'SUBMITTING') ORDER BY created_at").all();
    }
    saveWorkflowRevision(row) {
        this.db
            .prepare(`INSERT INTO workflow_revisions
          (id, workflow_id, project_id, schema_version, parent_revision_id, graph_blob_hash, graph_json,
           schema_refs_json, bindings_json, validation_json, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(row.id, row.workflow_id, row.project_id, row.schema_version, row.parent_revision_id ?? null, row.graph_blob_hash, row.graph_json, row.schema_refs_json, row.bindings_json, row.validation_json, row.reason, row.created_at);
    }
    loadWorkflowRevisions() {
        return this.db
            .prepare(`SELECT id, workflow_id, project_id, schema_version, parent_revision_id, graph_blob_hash,
                graph_json, schema_refs_json, bindings_json, validation_json, reason, created_at
           FROM workflow_revisions ORDER BY created_at, id`)
            .all();
    }
    close() {
        this.db.close();
    }
}
//# sourceMappingURL=database.js.map