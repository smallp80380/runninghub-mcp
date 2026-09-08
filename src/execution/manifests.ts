import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { parse as parseLossless } from "lossless-json";
import { AppError } from "../errors.js";
import { Storage, type DerivedResultRow, type JobRow, type OutboxRow, type ProjectRow, type ResultRow } from "../storage/database.js";

export interface ManifestPublication {
  readonly manifest_id: string;
  readonly relative_path: string;
  readonly content_hash: string;
  readonly size_bytes: number;
  readonly outbox_id: string;
  readonly published_at: string;
}

interface ResultManifest {
  readonly schema_version: "1";
  readonly manifest_id: string;
  readonly generated_at: string;
  readonly project: {
    readonly project_id: string;
    readonly work_item_id: string;
    readonly chain_id: string;
    readonly scene_id?: string;
    readonly requirements_hash: string;
    readonly policy_hash: string;
  };
  readonly workflow: {
    readonly workflow_id: string;
    readonly revision_id: string;
    readonly parent_revision_id?: string;
    readonly reason: string;
    readonly created_at: string;
    readonly graph_hash: string;
    readonly submitted_workflow_hash: string;
    readonly node_classes: readonly { readonly class_type: string; readonly schema_revision: string }[];
    readonly models: readonly string[];
    readonly internal_graph_json: string;
    readonly submitted_workflow_json: string;
  };
  readonly request: {
    readonly user_request: string;
    readonly request_kind: string;
    readonly scene_id?: string;
    readonly allowed_outputs: readonly string[];
    readonly output_contract: Readonly<Record<string, unknown>>;
  };
  readonly assets: readonly { readonly asset_id: string; readonly content_hash: string }[];
  readonly backend: {
    readonly profile_id: string;
    readonly api_family: string;
    readonly provider_workflow_id?: string;
    readonly provider_task_id?: string;
  };
  readonly execution: {
    readonly job_id: string;
    readonly request_id: string;
    readonly attempts: number;
    readonly execution_state: string;
    readonly provider_state: string;
    readonly artifact_state: string;
    readonly created_at: string;
  };
  readonly outputs: readonly {
    readonly output_id: string;
    readonly relative_path: string;
    readonly mime: string;
    readonly size_bytes: number;
    readonly content_hash: string;
    readonly created_at: string;
    readonly derived: readonly {
      readonly derived_id: string;
      readonly kind: "preview" | "poster";
      readonly relative_path: string;
      readonly mime: string;
      readonly size_bytes: number;
      readonly content_hash: string;
    }[];
  }[];
  readonly review: { readonly status: "NOT_READY" };
}

interface ManifestContext {
  readonly projectRoot: string;
  readonly project: ProjectRow;
  readonly job: JobRow;
  readonly manifestPath: string;
  readonly manifestRelativePath: string;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function inside(root: string, candidate: string): boolean {
  const value = relative(root, candidate);
  return value !== "" && !value.startsWith("..") && !isAbsolute(value);
}

function portablePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function parseNodeClasses(graphJson: string): readonly { readonly class_type: string; readonly schema_revision: string }[] {
  try {
    const parsed = parseLossless(graphJson) as { nodes?: unknown };
    if (!parsed || typeof parsed !== "object" || !parsed.nodes || typeof parsed.nodes !== "object" || Array.isArray(parsed.nodes)) return [];
    return Object.values(parsed.nodes as Record<string, unknown>)
      .flatMap((node) => {
        if (!node || typeof node !== "object" || Array.isArray(node)) return [];
        const value = node as { class_type?: unknown; schema_revision?: unknown };
        return typeof value.class_type === "string"
          ? [{ class_type: value.class_type, schema_revision: typeof value.schema_revision === "string" ? value.schema_revision : "unknown" }]
          : [];
      })
      .sort((left, right) => `${left.class_type}@${left.schema_revision}`.localeCompare(`${right.class_type}@${right.schema_revision}`));
  } catch {
    return [];
  }
}

function manifestFromBytes(bytes: Uint8Array, manifestId: string): ResultManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    throw new AppError("DOWNLOAD_FAILED", `Manifest ${manifestId} is not valid JSON.`, { recoverable: false });
  }
  if (!parsed || typeof parsed !== "object" || (parsed as { manifest_id?: unknown }).manifest_id !== manifestId) {
    throw new AppError("DOWNLOAD_FAILED", `Manifest ${manifestId} has an unexpected identity.`, { recoverable: false });
  }
  return parsed as ResultManifest;
}

export class ResultManifestService {
  constructor(private readonly storage: Storage) {}

  create(jobId: string, apiFamily: string): ManifestPublication {
    const context = this.context(jobId);
    const existing = this.readExisting(context);
    const bytes = existing ?? this.buildManifest(context, apiFamily);
    if (!existing) this.writeManifest(context, bytes);

    const manifestHash = sha256(bytes);
    const outboxId = `result-manifest:${jobId}`;
    const payloadJson = JSON.stringify({
      schema_version: "1",
      manifest_id: jobId,
      relative_path: context.manifestRelativePath,
      content_hash: manifestHash,
      size_bytes: bytes.length,
    });
    const now = new Date().toISOString();
    const stored = this.storage.enqueueOutbox({
      id: outboxId,
      kind: "result_manifest",
      aggregate_id: jobId,
      payload_json: payloadJson,
      published_at: null,
      created_at: now,
    });
    if (stored.payload_json !== payloadJson) {
      throw new AppError("INVALID_CONFIGURATION", `Manifest outbox ${outboxId} conflicts with the immutable manifest.`, { recoverable: false });
    }
    this.publishPending(jobId);
    const published = this.storage.getOutbox(outboxId);
    if (!published?.published_at) throw new AppError("DOWNLOAD_FAILED", `Manifest ${jobId} remains unpublished.`, { recoverable: true });
    return {
      manifest_id: jobId,
      relative_path: context.manifestRelativePath,
      content_hash: manifestHash,
      size_bytes: bytes.length,
      outbox_id: outboxId,
      published_at: published.published_at,
    };
  }

  publishPending(jobId?: string): readonly ManifestPublication[] {
    const pending = this.storage.listPendingOutbox("result_manifest").filter((row) => !jobId || row.aggregate_id === jobId);
    const published: ManifestPublication[] = [];
    for (const row of pending) {
      published.push(this.publish(row));
    }
    return published;
  }

  private publish(row: OutboxRow): ManifestPublication {
    let payload: { manifest_id?: unknown; relative_path?: unknown; content_hash?: unknown; size_bytes?: unknown };
    try {
      payload = JSON.parse(row.payload_json) as typeof payload;
    } catch {
      throw new AppError("DOWNLOAD_FAILED", `Manifest outbox ${row.id} has invalid payload JSON.`, { recoverable: false });
    }
    if (payload.manifest_id !== row.aggregate_id || typeof payload.relative_path !== "string" || typeof payload.content_hash !== "string" || typeof payload.size_bytes !== "number") {
      throw new AppError("DOWNLOAD_FAILED", `Manifest outbox ${row.id} has an invalid payload.`, { recoverable: false });
    }
    const context = this.context(row.aggregate_id);
    const candidate = resolve(context.projectRoot, payload.relative_path);
    if (!inside(context.projectRoot, candidate) || candidate !== context.manifestPath || !existsSync(candidate)) {
      throw new AppError("DOWNLOAD_FAILED", `Manifest ${row.aggregate_id} is unavailable at its recorded path.`, { recoverable: true });
    }
    const realPath = realpathSync(candidate);
    if (!inside(context.projectRoot, realPath)) throw new AppError("DOWNLOAD_FAILED", `Manifest ${row.aggregate_id} escapes the project root.`, { recoverable: false });
    const bytes = readFileSync(realPath);
    if (bytes.length !== payload.size_bytes || sha256(bytes) !== payload.content_hash) {
      throw new AppError("DOWNLOAD_FAILED", `Manifest ${row.aggregate_id} failed its integrity check.`, { recoverable: true });
    }
    this.storage.markOutboxPublished(row.id);
    const stored = this.storage.getOutbox(row.id);
    if (!stored?.published_at) throw new AppError("DOWNLOAD_FAILED", `Manifest outbox ${row.id} was not marked published.`, { recoverable: true });
    return {
      manifest_id: row.aggregate_id,
      relative_path: portablePath(payload.relative_path),
      content_hash: payload.content_hash,
      size_bytes: payload.size_bytes,
      outbox_id: row.id,
      published_at: stored.published_at,
    };
  }

  private context(jobId: string): ManifestContext {
    const job = this.storage.getJob(jobId);
    if (!job) throw new AppError("PROJECT_NOT_FOUND", `Job ${jobId} was not found.`, { recoverable: true });
    const plan = this.storage.getExecutionPlan(job.plan_id);
    if (!plan) throw new AppError("PROJECT_NOT_FOUND", `Execution plan ${job.plan_id} was not found.`, { recoverable: false });
    const project = this.storage.getProject(plan.project_id);
    if (!project?.canonical_root || !project.output_root) throw new AppError("INVALID_CONFIGURATION", `Project ${plan.project_id} has no configured project root/output root.`, { recoverable: false });
    const projectRoot = realpathSync(resolve(project.canonical_root));
    if (!/^[A-Za-z0-9._-]+$/.test(job.id)) throw new AppError("INVALID_CONFIGURATION", `Job ${job.id} cannot be used as a manifest path.`, { recoverable: false });
    const metadataRoot = resolve(projectRoot, ".runninghub");
    mkdirSync(metadataRoot, { recursive: true });
    const realMetadataRoot = realpathSync(metadataRoot);
    if (!inside(projectRoot, realMetadataRoot)) throw new AppError("INVALID_CONFIGURATION", "Manifest metadata root escapes the project root.", { recoverable: false });
    const runsRoot = join(realMetadataRoot, "runs");
    mkdirSync(runsRoot, { recursive: true });
    const realRunsRoot = realpathSync(runsRoot);
    if (!inside(projectRoot, realRunsRoot)) throw new AppError("INVALID_CONFIGURATION", "Manifest runs root escapes the project root.", { recoverable: false });
    const runDirectory = join(realRunsRoot, job.id);
    mkdirSync(runDirectory, { recursive: true });
    const realRunDirectory = realpathSync(runDirectory);
    if (!inside(projectRoot, realRunDirectory)) throw new AppError("INVALID_CONFIGURATION", "Manifest run directory escapes the project root.", { recoverable: false });
    const manifestPath = join(realRunDirectory, "manifest.json");
    return {
      projectRoot,
      project,
      job,
      manifestPath,
      manifestRelativePath: portablePath(relative(projectRoot, manifestPath)),
    };
  }

  private readExisting(context: ManifestContext): Uint8Array | undefined {
    if (!existsSync(context.manifestPath)) return undefined;
    const realPath = realpathSync(context.manifestPath);
    if (!inside(context.projectRoot, realPath)) throw new AppError("DOWNLOAD_FAILED", `Manifest ${context.job.id} escapes the project root.`, { recoverable: false });
    const bytes = Uint8Array.from(readFileSync(realPath));
    manifestFromBytes(bytes, context.job.id);
    return bytes;
  }

  private buildManifest(context: ManifestContext, apiFamily: string): Uint8Array {
    if (context.job.execution_state !== "SUCCEEDED" || !context.job.provider_task_id) {
      throw new AppError("DOWNLOAD_FAILED", `Job ${context.job.id} is not a confirmed successful execution.`, { recoverable: true });
    }
    const plan = this.storage.getExecutionPlan(context.job.plan_id);
    const workItem = this.storage.getWorkItem(plan?.work_item_id ?? "");
    const revision = plan ? this.storage.getWorkflowRevision(plan.graph_revision_id) : undefined;
    if (!plan || !workItem || !revision) throw new AppError("PROJECT_NOT_FOUND", `Manifest dependencies for job ${context.job.id} were not found.`, { recoverable: false });
    const results = this.storage.listResults(context.job.id);
    if (!results.length) throw new AppError("DOWNLOAD_FAILED", `Job ${context.job.id} has no downloaded outputs for its manifest.`, { recoverable: true });
    const derivedByResult = new Map(results.map((result) => [result.id, this.storage.listDerivedResults(result.id)]));
    const assetBindings = JSON.parse(plan.asset_bindings_json) as Array<{ asset_id?: unknown; content_hash?: unknown }>;
    const manifest: ResultManifest = {
      schema_version: "1",
      manifest_id: context.job.id,
      generated_at: new Date().toISOString(),
      project: {
        project_id: context.project.id,
        work_item_id: workItem.id,
        chain_id: workItem.chain_id,
        ...(workItem.scene_id ? { scene_id: workItem.scene_id } : {}),
        requirements_hash: plan.requirements_hash,
        policy_hash: plan.policy_hash,
      },
      workflow: {
        workflow_id: revision.workflow_id,
        revision_id: revision.id,
        ...(revision.parent_revision_id ? { parent_revision_id: revision.parent_revision_id } : {}),
        reason: revision.reason,
        created_at: revision.created_at,
        graph_hash: plan.graph_hash,
        submitted_workflow_hash: sha256(Buffer.from(plan.workflow_json, "utf8")),
        node_classes: parseNodeClasses(revision.graph_json),
        models: [],
        internal_graph_json: revision.graph_json,
        submitted_workflow_json: plan.workflow_json,
      },
      request: {
        user_request: workItem.user_request,
        request_kind: workItem.request_kind,
        ...(workItem.scene_id ? { scene_id: workItem.scene_id } : {}),
        allowed_outputs: JSON.parse(workItem.allowed_outputs_json) as string[],
        output_contract: JSON.parse(plan.output_contract_json) as Record<string, unknown>,
      },
      assets: assetBindings.flatMap((binding) => typeof binding.asset_id === "string" && typeof binding.content_hash === "string"
        ? [{ asset_id: binding.asset_id, content_hash: binding.content_hash }]
        : []),
      backend: {
        profile_id: plan.backend_profile_id,
        api_family: apiFamily,
        ...(plan.provider_workflow_id ? { provider_workflow_id: plan.provider_workflow_id } : {}),
        provider_task_id: context.job.provider_task_id,
      },
      execution: {
        job_id: context.job.id,
        request_id: context.job.request_id,
        attempts: context.job.attempts,
        execution_state: context.job.execution_state,
        provider_state: context.job.provider_state,
        artifact_state: context.job.artifact_state,
        created_at: context.job.created_at,
      },
      outputs: results.map((result) => this.manifestOutput(result, derivedByResult.get(result.id) ?? [])),
      review: { status: "NOT_READY" },
    };
    return Uint8Array.from(Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"));
  }

  private manifestOutput(result: ResultRow, derived: readonly DerivedResultRow[]): ResultManifest["outputs"][number] {
    return {
      output_id: result.output_id,
      relative_path: result.relative_path,
      mime: result.mime,
      size_bytes: result.size_bytes,
      content_hash: result.content_hash,
      created_at: result.created_at,
      derived: derived.map((item) => ({
        derived_id: item.id,
        kind: item.kind,
        relative_path: item.relative_path,
        mime: item.mime,
        size_bytes: item.size_bytes,
        content_hash: item.content_hash,
      })),
    };
  }

  private writeManifest(context: ManifestContext, bytes: Uint8Array): void {
    const temporaryPath = join(resolve(context.manifestPath, ".."), `.manifest.${randomUUID()}.tmp`);
    try {
      writeFileSync(temporaryPath, bytes, { flag: "wx", mode: 0o600 });
      renameSync(temporaryPath, context.manifestPath);
    } catch (error) {
      rmSync(temporaryPath, { force: true });
      throw new AppError("DOWNLOAD_FAILED", error instanceof Error ? error.message : "Could not atomically store the manifest.", { recoverable: true });
    }
  }
}
