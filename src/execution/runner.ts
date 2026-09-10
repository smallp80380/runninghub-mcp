import { AppError } from "../errors.js";
import { Storage, type AssetRow, type ExecutionPlanRow, type JobRow } from "../storage/database.js";
import { stringify as stringifyLossless, parse as parseLossless } from "lossless-json";
import { AssetProvider } from "./assets.js";
import { isLoraAsset, validateLoraApiBindings } from "./lora.js";
import { validateMediaBindings } from "./media.js";
import { type ExecutionPlan, type JobHandle, type NodeInfoOverride, type ProviderAssetReference, type ProviderLoraReference, type ProviderOutput, type WorkflowBackend, type WorkflowSubmitMode } from "./types.js";

interface ResolvedProviderWorkflow {
  readonly workflow_json: string;
  readonly node_info_list: readonly NodeInfoOverride[];
  readonly submit_mode: WorkflowSubmitMode;
}

export function planToRow(plan: ExecutionPlan, createdAt = new Date().toISOString()): ExecutionPlanRow {
  return {
    id: plan.id,
    work_item_id: plan.work_item_id,
    schema_version: "1",
    graph_revision_id: plan.graph_revision_id,
    graph_hash: plan.graph_hash,
    workflow_json: plan.workflow_json,
    asset_bindings_json: JSON.stringify(plan.asset_bindings),
    requirements_hash: plan.requirements_hash,
    policy_hash: plan.policy_hash,
    backend_profile_id: plan.backend_profile_id,
    provider_workflow_id: plan.provider_workflow_id ?? null,
    provider_submit_mode: plan.provider_submit_mode ?? null,
    workflow_state: plan.workflow_state ?? "uninitialized",
    output_contract_json: JSON.stringify(plan.output_contract),
    mode: plan.mode,
    project_id: plan.project_id,
    created_at: createdAt,
  };
}

export function planFromRow(row: ExecutionPlanRow): ExecutionPlan {
  return {
    id: row.id,
    project_id: row.project_id,
    work_item_id: row.work_item_id,
    graph_revision_id: row.graph_revision_id,
    graph_hash: row.graph_hash,
    workflow_json: row.workflow_json,
    asset_bindings: JSON.parse(row.asset_bindings_json) as ExecutionPlan["asset_bindings"],
    requirements_hash: row.requirements_hash,
    policy_hash: row.policy_hash,
    backend_profile_id: row.backend_profile_id,
    ...(row.provider_workflow_id ? { provider_workflow_id: row.provider_workflow_id } : {}),
    ...(row.provider_submit_mode ? { provider_submit_mode: row.provider_submit_mode as ExecutionPlan["provider_submit_mode"] } : {}),
    workflow_state: row.workflow_state as ExecutionPlan["workflow_state"],
    output_contract: JSON.parse(row.output_contract_json) as Record<string, unknown>,
    mode: row.mode as ExecutionPlan["mode"],
  };
}

export function jobHandle(row: JobRow): JobHandle {
  return {
    id: row.id,
    plan_id: row.plan_id,
    request_id: row.request_id,
    execution_state: row.execution_state as JobHandle["execution_state"],
    provider_state: row.provider_state as JobHandle["provider_state"],
    artifact_state: row.artifact_state as JobHandle["artifact_state"],
    ...(row.provider_task_id ? { provider_task_id: row.provider_task_id } : {}),
    ...(row.submit_intent ? { submit_intent: row.submit_intent } : {}),
    charge_status: row.charge_status as JobHandle["charge_status"],
    attempts: row.attempts,
  };
}

export class DurableWorkflowRunner {
  private readonly assets: AssetProvider;

  constructor(private readonly storage: Storage, private readonly backend: WorkflowBackend) {
    this.assets = new AssetProvider(storage);
  }

  prepare(plan: ExecutionPlan): ExecutionPlan {
    if (plan.backend_profile_id !== this.backend.profile_id) {
      throw new AppError("CAPABILITY_UNKNOWN", `Plan profile ${plan.backend_profile_id} does not match backend ${this.backend.profile_id}.`, { recoverable: true });
    }
    let workflow: unknown;
    try {
      workflow = parseLossless(plan.workflow_json);
    } catch {
      throw new AppError("INVALID_GRAPH", "The immutable workflow snapshot is not valid JSON.", { recoverable: false });
    }
    const assets = new Map((this.assets.inspect(plan.project_id) as AssetRow[]).map((asset) => [asset.id, asset]));
    validateMediaBindings({
      workflow,
      asset_bindings: plan.asset_bindings,
      assets,
      strict_bytes: this.backend.api_family !== "synthetic",
      read_asset: (assetId, contentHash) => this.assets.read(plan.project_id, assetId, contentHash).bytes,
    });
    const existing = this.storage.getExecutionPlan(plan.id);
    if (existing?.workflow_state === "failed_validation" || plan.workflow_state === "failed_validation") {
      throw new AppError("REMOTE_WORKFLOW_DOES_NOT_ACCEPT_IMAGE_OVERRIDES", "Workflow is in failed_validation state and cannot be launched.", {
        recoverable: true,
        suggestedFix: "Correct the remote image bindings and prepare a new execution plan.",
      });
    }
    if (!existing) this.storage.saveExecutionPlan(planToRow(plan));
    return plan;
  }

  async run(plan: ExecutionPlan, requestId: string): Promise<JobHandle> {
    this.prepare(plan);
    let row: JobRow;
    try {
      row = this.storage.reserveJob(plan.project_id, plan.id, requestId);
    } catch (error) {
      if (error instanceof Error && error.message === "REQUEST_CONFLICT") {
        throw new AppError("REQUEST_CONFLICT", `Request ${requestId} was already used for another execution plan.`, { recoverable: false });
      }
      throw error;
    }
    if (row.execution_state !== "READY") return jobHandle(row);
    let resolved: ResolvedProviderWorkflow;
    try {
      resolved = await this.resolveProviderWorkflow(plan);
    } catch (error) {
      if (error instanceof AppError && error.code === "REMOTE_WORKFLOW_DOES_NOT_ACCEPT_IMAGE_OVERRIDES") this.storage.updateExecutionPlanWorkflowState(plan.id, "failed_validation");
      throw error;
    }
    this.storage.updateExecutionPlanWorkflowState(plan.id, "ready");
    const state = this.storage.getExecutionPlan(plan.id)?.workflow_state;
    if (state !== "ready") throw new AppError("INVALID_CONFIGURATION", "Workflow must be ready before paid launch.", { recoverable: true });
    const intent = `submit:${row.id}`;
    if (!this.storage.claimSubmit(row.id, intent)) {
      const current = this.storage.getJob(row.id);
      if (!current) throw new Error(`Job ${row.id} disappeared`);
      return jobHandle(current);
    }
    try {
      const submitted = await this.backend.submit({
        workflow_json: resolved.workflow_json,
        plan_id: plan.id,
        ...(plan.provider_workflow_id ? { workflow_id: plan.provider_workflow_id } : {}),
        ...(resolved.node_info_list.length ? { node_info_list: resolved.node_info_list } : {}),
        submit_mode: resolved.submit_mode,
      });
      this.storage.recordProviderTask(row.id, submitted.task_id);
    } catch (error) {
      if (error && typeof error === "object" && "name" in error && (error as { name?: string }).name === "SubmitUnknownError") {
        this.storage.markSubmitUnknown(row.id);
        const current = this.storage.getJob(row.id);
        if (!current) throw new AppError("SUBMIT_UNKNOWN", "Submit intent was recorded but the job row disappeared.", { recoverable: false });
        return jobHandle(current);
      }
      if (error instanceof AppError && error.code !== "PROVIDER_ERROR") {
        this.storage.markProviderStatus(row.id, "FAILED", "FAILED");
        throw error;
      }
      if (error instanceof AppError && error.code === "PROVIDER_ERROR" && error.context.outcome === "cache_expired") {
        this.invalidatePlanCaches(plan);
        this.storage.markProviderStatus(row.id, "FAILED", "FAILED");
        throw error;
      }
      if (error instanceof AppError && error.code === "PROVIDER_ERROR" && error.context.outcome === "rejected") {
        this.storage.markProviderStatus(row.id, "FAILED", "FAILED");
        throw error;
      }
      this.storage.markSubmitUnknown(row.id);
      const current = this.storage.getJob(row.id);
      if (!current) throw new AppError("SUBMIT_UNKNOWN", "Submit intent was recorded but the job row disappeared.", { recoverable: false });
      return jobHandle(current);
    }
    const current = this.storage.getJob(row.id);
    if (!current) throw new Error(`Job ${row.id} disappeared after submit`);
    return jobHandle(current);
  }

  async wait(jobId: string, timeoutMs = 30_000, pollIntervalMs = 250): Promise<JobHandle> {
    const deadline = Date.now() + Math.max(0, timeoutMs);
    while (Date.now() <= deadline) {
      const row = this.storage.getJob(jobId);
      if (!row) throw new AppError("PROJECT_NOT_FOUND", `Job ${jobId} was not found.`, { recoverable: true });
      if (row.execution_state === "SUBMIT_UNKNOWN") return jobHandle(row);
      if (row.execution_state === "FAILED" || row.execution_state === "CANCELLED") return jobHandle(row);
      if (row.execution_state === "SUCCEEDED" && row.artifact_state === "READY") return jobHandle(row);
      if (!row.provider_task_id) return jobHandle(row);
      const status = await this.backend.status(row.provider_task_id);
      if (status.state === "QUEUED" || status.state === "RUNNING") {
        this.storage.markProviderStatus(jobId, status.state);
      }
      if (status.state === "FAILED") {
        this.storage.markProviderStatus(jobId, "FAILED", "FAILED");
        return jobHandle(this.requireJob(jobId));
      }
      if (status.state === "CANCEL") {
        this.storage.markProviderStatus(jobId, "CANCEL", "FAILED");
        return jobHandle(this.requireJob(jobId));
      }
      if (status.state === "SUCCESS") {
        this.storage.markProviderStatus(jobId, "SUCCESS", "PENDING");
        let output: ProviderOutput;
        try {
          output = await this.backend.outputs(row.provider_task_id);
        } catch (error) {
          this.storage.markArtifact(jobId, "FAILED");
          throw new AppError("DOWNLOAD_FAILED", error instanceof Error ? error.message : "Provider outputs failed.", { recoverable: true });
        }
        if (!output.outputs.length) {
          this.storage.markArtifact(jobId, "FAILED");
          return jobHandle(this.requireJob(jobId));
        }
        this.storage.markArtifact(jobId, "READY");
        return jobHandle(this.requireJob(jobId));
      }
      await new Promise((resolve) => setTimeout(resolve, Math.min(Math.max(pollIntervalMs, 1), 1000)));
    }
    return jobHandle(this.requireJob(jobId));
  }

  async cancel(jobId: string): Promise<JobHandle> {
    const row = this.requireJob(jobId);
    if (!row.provider_task_id) {
      if (row.execution_state === "SUBMIT_UNKNOWN") {
        throw new AppError("SUBMIT_UNKNOWN", `Job ${jobId} has an uncertain provider submit and cannot be cancelled locally.`, {
          recoverable: true,
          suggestedFix: "Reconcile the exact provider task ID with rh_job resume, then cancel that provider task explicitly.",
        });
      }
      if (row.execution_state === "SUBMITTING") {
        this.storage.markSubmitUnknown(jobId);
        return jobHandle(this.requireJob(jobId));
      }
      this.storage.cancelLocalJob(jobId);
      return jobHandle(this.requireJob(jobId));
    }
    const status = await this.backend.cancel(row.provider_task_id);
    if (status.state === "CANCEL") this.storage.markProviderStatus(jobId, "CANCEL", "FAILED");
    else if (status.state === "SUCCESS") this.storage.markProviderStatus(jobId, "SUCCESS", "PENDING");
    else if (status.state === "FAILED") this.storage.markProviderStatus(jobId, "FAILED", "FAILED");
    else this.storage.markProviderStatus(jobId, status.state);
    return jobHandle(this.requireJob(jobId));
  }

  async recover(jobId: string, timeoutMs = 30_000): Promise<JobHandle> {
    const row = this.requireJob(jobId);
    if (row.execution_state === "SUBMITTING" && !row.provider_task_id) {
      this.storage.markSubmitUnknown(jobId);
      return jobHandle(this.requireJob(jobId));
    }
    return this.wait(jobId, timeoutMs);
  }

  private requireJob(jobId: string): JobRow {
    const row = this.storage.getJob(jobId);
    if (!row) throw new AppError("PROJECT_NOT_FOUND", `Job ${jobId} was not found.`, { recoverable: true });
    return row;
  }

  private invalidatePlanCaches(plan: ExecutionPlan): void {
    for (const binding of plan.asset_bindings) {
      this.storage.invalidateProviderUpload(this.backend.profile_id, this.backend.api_family, binding.asset_id, binding.content_hash);
      this.storage.invalidateLoraUpload(this.backend.profile_id, this.backend.api_family, binding.content_hash);
    }
  }

  private async resolveProviderWorkflow(plan: ExecutionPlan): Promise<ResolvedProviderWorkflow> {
    let parsed: unknown;
    try {
      parsed = parseLossless(plan.workflow_json);
    } catch {
      throw new AppError("INVALID_GRAPH", "The immutable workflow snapshot is not valid JSON.", { recoverable: false });
    }
    const assetRows = new Map((this.assets.inspect(plan.project_id) as AssetRow[]).map((asset) => [asset.id, asset]));
    const loraAssetIds = validateLoraApiBindings(parsed, assetRows);
    const boundAssetIds = new Set(plan.asset_bindings.map((binding) => binding.asset_id));
    for (const assetId of loraAssetIds) {
      if (!boundAssetIds.has(assetId)) {
        throw new AppError("ASSET_MISSING", `LoRA asset ${assetId} is referenced by the workflow but is not bound to the execution plan.`, { recoverable: true });
      }
    }
    const requestedMode = plan.provider_submit_mode ?? (plan.provider_workflow_id ? "v2_node_info" : "legacy_graph");
    if (!plan.asset_bindings.length) return {
      workflow_json: plan.workflow_json,
      node_info_list: [],
      submit_mode: requestedMode,
    };
    const references = new Map<string, ProviderAssetReference | ProviderLoraReference>();
    for (const binding of plan.asset_bindings) {
      const previous = references.get(binding.asset_id);
      if (previous) {
        if (binding.provider_ref && (previous.kind !== binding.provider_ref.kind || previous.value !== binding.provider_ref.value)) {
          throw new AppError("ASSET_CHANGED", `Asset ${binding.asset_id} has conflicting provider references in the plan.`, { recoverable: true });
        }
        this.assets.read(plan.project_id, binding.asset_id, binding.content_hash);
        continue;
      }
      const asset = assetRows.get(binding.asset_id);
      const providerRef = asset && isLoraAsset(asset)
        ? binding.provider_ref
          ? (() => { throw new AppError("INVALID_CONFIGURATION", `LoRA asset ${binding.asset_id} cannot use a regular provider reference.`, { recoverable: true }); })()
          : await this.assets.uploadLora({ project_id: plan.project_id, asset_id: binding.asset_id, content_hash: binding.content_hash, profile_id: plan.backend_profile_id, backend: this.backend })
        : binding.provider_ref ?? await this.assets.upload({
            project_id: plan.project_id,
            asset_id: binding.asset_id,
            content_hash: binding.content_hash,
            profile_id: plan.backend_profile_id,
            backend: this.backend,
          });
      if (binding.provider_ref) this.assets.read(plan.project_id, binding.asset_id, binding.content_hash);
      references.set(binding.asset_id, providerRef);
    }

    const nodeInfoList: NodeInfoOverride[] = [];
    if (plan.provider_workflow_id && parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [nodeId, nodeValue] of Object.entries(parsed as Record<string, unknown>)) {
        if (!nodeValue || typeof nodeValue !== "object" || Array.isArray(nodeValue)) continue;
        const node = nodeValue as Record<string, unknown>;
        if (node.class_type !== "LoadImage") continue;
        const inputs = node.inputs && typeof node.inputs === "object" && !Array.isArray(node.inputs) ? node.inputs as Record<string, unknown> : undefined;
        const image = inputs?.image;
        if (typeof image !== "string" || !image.startsWith("asset://")) continue;
        const binding = plan.asset_bindings.find((candidate) => image.startsWith(`asset://${candidate.asset_id}/`));
        if (!binding) throw new AppError("ASSET_MISSING", `Workflow contains an unbound asset reference ${image}.`, { recoverable: true });
        const reference = references.get(binding.asset_id);
        if (!reference) throw new AppError("ASSET_MISSING", `No provider reference was prepared for asset ${binding.asset_id}.`, { recoverable: true });
        if (reference.kind !== "provider_file") {
          throw new AppError("REMOTE_WORKFLOW_DOES_NOT_ACCEPT_IMAGE_OVERRIDES", "REMOTE_WORKFLOW_DOES_NOT_ACCEPT_IMAGE_OVERRIDES", {
            recoverable: true,
            suggestedFix: "Initialize the image input in RunningHub or provide a provider file reference before retrying.",
          });
        }
        nodeInfoList.push({ nodeId, fieldName: "image", fieldValue: reference.value });
      }
    }

    const replace = (value: unknown): unknown => {
      if (typeof value === "string" && value.startsWith("asset://")) {
        const binding = plan.asset_bindings.find((candidate) => value.startsWith(`asset://${candidate.asset_id}/`));
        if (!binding) throw new AppError("ASSET_MISSING", `Workflow contains an unbound asset reference ${value}.`, { recoverable: true });
        const reference = references.get(binding.asset_id);
        if (!reference) throw new AppError("ASSET_MISSING", `No provider reference was prepared for asset ${binding.asset_id}.`, { recoverable: true });
        return reference.value;
      }
      if (Array.isArray(value)) return value.map(replace);
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, replace(child)]));
      return value;
    };
    const resolved = stringifyLossless(replace(parsed), null, 2);
    if (resolved === undefined) throw new AppError("INVALID_GRAPH", "Could not serialize the provider workflow snapshot.", { recoverable: false });
    const submitMode: WorkflowSubmitMode = requestedMode;
    if (submitMode === "v2_node_info" && plan.asset_bindings.length > 0 && nodeInfoList.length === 0) {
      throw new AppError("REMOTE_WORKFLOW_DOES_NOT_ACCEPT_IMAGE_OVERRIDES", "REMOTE_WORKFLOW_DOES_NOT_ACCEPT_IMAGE_OVERRIDES", {
        recoverable: true,
        suggestedFix: "Bind the remote LoadImage inputs through nodeInfoList or explicitly select the legacy full-graph submit mode.",
      });
    }
    if (submitMode === "v2_node_info") await this.preflightRemoteImageOverrides(plan, nodeInfoList);
    return { workflow_json: resolved, node_info_list: nodeInfoList, submit_mode: submitMode };
  }

  private async preflightRemoteImageOverrides(plan: ExecutionPlan, nodeInfoList: readonly NodeInfoOverride[]): Promise<void> {
    if (!plan.provider_workflow_id || !nodeInfoList.length) return;
    if (!this.backend.getWorkflowJson) {
      throw new AppError("REMOTE_WORKFLOW_DOES_NOT_ACCEPT_IMAGE_OVERRIDES", "REMOTE_WORKFLOW_DOES_NOT_ACCEPT_IMAGE_OVERRIDES", {
        recoverable: true,
        suggestedFix: "Enable the RunningHub Get Workflow JSON endpoint and initialize matching LoadImage inputs in RunningHub.",
      });
    }
    let remoteWorkflow: unknown;
    try {
      remoteWorkflow = parseLossless(await this.backend.getWorkflowJson(plan.provider_workflow_id));
    } catch {
      throw new AppError("REMOTE_WORKFLOW_DOES_NOT_ACCEPT_IMAGE_OVERRIDES", "REMOTE_WORKFLOW_DOES_NOT_ACCEPT_IMAGE_OVERRIDES", {
        recoverable: true,
        suggestedFix: "Verify the remote workflow ID and initialize matching LoadImage inputs in RunningHub.",
      });
    }
    const nodes = remoteWorkflow && typeof remoteWorkflow === "object" && !Array.isArray(remoteWorkflow)
      ? remoteWorkflow as Record<string, unknown>
      : {};
    for (const [nodeId, nodeValue] of Object.entries(nodes)) {
      if (!nodeValue || typeof nodeValue !== "object" || Array.isArray(nodeValue)) continue;
      const node = nodeValue as Record<string, unknown>;
      if (node.class_type !== "LoadImage") continue;
      const inputs = node.inputs && typeof node.inputs === "object" && !Array.isArray(node.inputs) ? node.inputs as Record<string, unknown> : undefined;
      if (!inputs || typeof inputs.image !== "string" || !inputs.image.trim()) {
        throw new AppError("REMOTE_WORKFLOW_DOES_NOT_ACCEPT_IMAGE_OVERRIDES", "REMOTE_WORKFLOW_DOES_NOT_ACCEPT_IMAGE_OVERRIDES", {
          recoverable: true,
          context: { workflow_id: plan.provider_workflow_id, node_id: nodeId, field_name: "image" },
          suggestedFix: "Initialize every LoadImage input in RunningHub before retrying.",
        });
      }
    }
    for (const override of nodeInfoList) {
      const node = nodes[override.nodeId];
      const inputs = node && typeof node === "object" && !Array.isArray(node) ? (node as Record<string, unknown>).inputs : undefined;
      if (!node || typeof node !== "object" || (node as Record<string, unknown>).class_type !== "LoadImage" || !inputs || typeof inputs !== "object" || !Object.prototype.hasOwnProperty.call(inputs, override.fieldName)) {
        throw new AppError("REMOTE_WORKFLOW_DOES_NOT_ACCEPT_IMAGE_OVERRIDES", "REMOTE_WORKFLOW_DOES_NOT_ACCEPT_IMAGE_OVERRIDES", {
          recoverable: true,
          context: { workflow_id: plan.provider_workflow_id, node_id: override.nodeId, field_name: override.fieldName },
          suggestedFix: "Initialize the image input in RunningHub and retry with the matching node ID.",
        });
      }
    }
  }
}
