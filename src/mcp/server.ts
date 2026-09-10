import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ImageContent, ResourceLink } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { WorkflowApiClient } from "../backends/workflow-api/client.js";
import { type AppConfig } from "../config.js";
import { AssetProvider } from "../execution/assets.js";
import { isLoraAsset, validateLoraGraphBindings } from "../execution/lora.js";
import { WORKFLOW_MEDIA_PROFILE } from "../execution/media.js";
import { DerivedMediaService, type DerivedResult } from "../execution/derivatives.js";
import { ResultManifestService } from "../execution/manifests.js";
import { ResultDownloadService } from "../execution/results.js";
import { ReviewService } from "../execution/reviews.js";
import { type ExecutionPlan } from "../execution/types.js";
import { jobHandle, planFromRow, planToRow, DurableWorkflowRunner } from "../execution/runner.js";
import { assetToolSchema, getResultsSchema, jobSchema, prepareGenerationSchema, reviewResultSchema, runWorkflowSchema, uploadLoraSchema } from "../execution/schemas.js";
import { AppError, errorResult, jsonText, okResult } from "../errors.js";
import { exportApiGraph, importApiGraph } from "../graph/codec.js";
import { type GraphOperation } from "../graph/operations.js";
import { RevisionStore } from "../graph/revisions.js";
import {
  createWorkflowSchema,
  editWorkflowSchema,
  exportWorkflowSchema,
  getWorkflowSchema,
  validateWorkflowSchema,
} from "../graph/schemas.js";
import { createEmptyGraph } from "../graph/types.js";
import { ProjectContextService, WorkflowLibrary } from "../projects/context.js";
import { defaultWorkflowCards } from "../projects/library.js";
import { importWorkflowSchema, projectToolSchema, sceneToolSchema, workItemToolSchema, workflowSearchSchema } from "../projects/schemas.js";
import { Storage } from "../storage/database.js";
import { SqliteRevisionPersistence } from "../storage/revisions.js";
import { loadRunningHubData } from "./upstream/data.js";
import { SERVER_INSTRUCTIONS } from "./instructions.js";
import {
  buildExamplePayloadSchema,
  createToolHandlers,
  endpointSchema,
  estimatePriceSchema,
  integrationGuideSchema,
  searchModelsSchema,
  validatePayloadSchema,
} from "./upstream/tools.js";

interface CatalogManifest {
  revision?: string;
  captured_at?: string;
}

function readCatalogManifest(catalogDir: string): CatalogManifest {
  try {
    return JSON.parse(readFileSync(resolve(catalogDir, "..", "upstream", "manifest.json"), "utf8")) as CatalogManifest;
  } catch {
    return {};
  }
}

function normalizeUpstreamResult(result: { content: Array<{ type: "text"; text: string }> }) {
  const text = result.content.find((item) => item.type === "text")?.text;
  let data: unknown = text ?? null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = text;
    }
  }
  return { content: [jsonText(okResult(data))] };
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map((key) => [key, canonicalValue((value as Record<string, unknown>)[key])]));
  }
  return value;
}

function stableJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function bytesSha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function inside(root: string, candidate: string): boolean {
  const value = relative(root, candidate);
  return value !== "" && !value.startsWith("..") && !isAbsolute(value);
}

function resultUri(resultId: string): string {
  return `runninghub://result/${encodeURIComponent(resultId)}`;
}

function resultResourceLink(result: { readonly result_id: string; readonly output_id: string; readonly mime: string }): ResourceLink {
  return {
    type: "resource_link",
    uri: resultUri(result.result_id),
    name: `${result.output_id} original`,
    mimeType: result.mime,
    description: "Validated local original output.",
  };
}

const MAX_INLINE_IMAGE_BYTES = 16 * 1024 * 1024;

function inlineImageContent(
  storage: Storage,
  result: { readonly result_id: string; readonly job_id: string; readonly relative_path: string; readonly mime: string; readonly size_bytes: number; readonly content_hash: string },
): ImageContent | undefined {
  if (!result.mime.toLowerCase().startsWith("image/") || result.size_bytes > MAX_INLINE_IMAGE_BYTES) return undefined;
  const resource = readStoredResource(storage, new URL(resultUri(result.result_id)), {
    id: result.result_id,
    job_id: result.job_id,
    relative_path: result.relative_path,
    mime: result.mime,
    size_bytes: result.size_bytes,
    content_hash: result.content_hash,
  });
  const content = resource.contents[0];
  if (!content || !("blob" in content) || typeof content.blob !== "string") return undefined;
  return { type: "image", data: content.blob, mimeType: result.mime };
}

function derivedUri(derivedId: string): string {
  return `runninghub://derived/${encodeURIComponent(derivedId)}`;
}

function derivedResourceLink(derived: DerivedResult): ResourceLink {
  return {
    type: "resource_link",
    uri: derivedUri(derived.derived_id),
    name: `${derived.kind} for ${derived.result_id}`,
    mimeType: derived.mime,
    description: `Validated local derived ${derived.kind}.`,
  };
}

function validateApprovalContinuation(storage: Storage, resultId: string, continuation: { readonly plan_id: string; readonly request_id: string }): void {
  const result = storage.getResultById(resultId);
  if (!result) throw new AppError("PROJECT_NOT_FOUND", `Result ${resultId} was not found.`, { recoverable: true });
  const sourceJob = storage.getJob(result.job_id);
  if (!sourceJob) throw new AppError("PROJECT_NOT_FOUND", `Job ${result.job_id} was not found.`, { recoverable: false });
  const sourcePlan = storage.getExecutionPlan(sourceJob.plan_id);
  const targetPlan = storage.getExecutionPlan(continuation.plan_id);
  if (!sourcePlan || !targetPlan) throw new AppError("PROJECT_NOT_FOUND", "The review continuation references a missing execution plan.", { recoverable: true });
  const sourceWorkItem = storage.getWorkItem(sourcePlan.work_item_id);
  const targetWorkItem = storage.getWorkItem(targetPlan.work_item_id);
  if (!sourceWorkItem || !targetWorkItem) throw new AppError("PROJECT_NOT_FOUND", "The review continuation references a missing work item.", { recoverable: false });
  if (sourcePlan.project_id !== targetPlan.project_id || sourceWorkItem.chain_id !== targetWorkItem.chain_id) {
    throw new AppError("REVIEW_PENDING", "An approval continuation must stay in the reviewed project and chain.", {
      recoverable: true,
      suggestedFix: "Prepare the continuation plan for the same project and review chain.",
    });
  }
  if (sourcePlan.id === targetPlan.id || sourcePlan.work_item_id === targetPlan.work_item_id) {
    throw new AppError("INVALID_CONFIGURATION", "An approval continuation must reference a different work item.", { recoverable: true });
  }
  if (targetWorkItem.state !== "REQUESTED") {
    throw new AppError("INVALID_CONFIGURATION", `Continuation work item ${targetWorkItem.id} is not open for execution.`, { recoverable: true });
  }
}

function continuationIntentPayload(value: { readonly review_event_id: string; readonly plan_id: string; readonly request_id: string }): string {
  return JSON.stringify(value);
}

function parseContinuationIntent(payload: string): { readonly review_event_id: string; readonly plan_id: string; readonly request_id: string } {
  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch {
    throw new AppError("INVALID_CONFIGURATION", "Stored approval continuation intent is not valid JSON.", { recoverable: false });
  }
  if (!value || typeof value !== "object" || typeof (value as { review_event_id?: unknown }).review_event_id !== "string" || typeof (value as { plan_id?: unknown }).plan_id !== "string" || typeof (value as { request_id?: unknown }).request_id !== "string") {
    throw new AppError("INVALID_CONFIGURATION", "Stored approval continuation intent is malformed.", { recoverable: false });
  }
  return value as { readonly review_event_id: string; readonly plan_id: string; readonly request_id: string };
}

function readStoredResource(
  storage: Storage,
  uri: URL,
  row: { readonly id: string; readonly job_id: string; readonly relative_path: string; readonly mime: string; readonly size_bytes: number; readonly content_hash: string },
) {
  const job = storage.getJob(row.job_id);
  if (!job) throw new AppError("PROJECT_NOT_FOUND", `Job ${row.job_id} was not found.`, { recoverable: false });
  const plan = storage.getExecutionPlan(job.plan_id);
  if (!plan) throw new AppError("PROJECT_NOT_FOUND", `Execution plan ${job.plan_id} was not found.`, { recoverable: false });
  const project = storage.getProject(plan.project_id);
  if (!project?.canonical_root) throw new AppError("INVALID_CONFIGURATION", `Project ${plan.project_id} has no canonical root.`, { recoverable: false });

  const projectRoot = realpathSync(resolve(project.canonical_root));
  const candidate = resolve(projectRoot, row.relative_path);
  if (!inside(projectRoot, candidate) || !existsSync(candidate)) throw new AppError("DOWNLOAD_FAILED", `Stored result ${row.id} is unavailable.`, { recoverable: true });
  const resultPath = realpathSync(candidate);
  if (!inside(projectRoot, resultPath)) throw new AppError("DOWNLOAD_FAILED", `Stored result ${row.id} escapes the project root.`, { recoverable: false });
  const bytes = readFileSync(resultPath);
  if (bytes.length !== row.size_bytes || bytesSha256(bytes) !== row.content_hash) throw new AppError("DOWNLOAD_FAILED", `Stored result ${row.id} failed its integrity check.`, { recoverable: true });
  return { contents: [{ uri: uri.toString(), mimeType: row.mime, blob: bytes.toString("base64") }] };
}

function readResultResource(storage: Storage, uri: URL, variables: Record<string, string | string[]>) {
  const resultId = variables.result_id;
  if (typeof resultId !== "string") throw new AppError("PROJECT_NOT_FOUND", "Result resource ID is invalid.", { recoverable: true });
  const result = storage.getResultById(resultId);
  if (!result) throw new AppError("PROJECT_NOT_FOUND", `Result ${resultId} was not found.`, { recoverable: true });
  return readStoredResource(storage, uri, result);
}

function readDerivedResource(storage: Storage, uri: URL, variables: Record<string, string | string[]>) {
  const derivedId = variables.derived_id;
  if (typeof derivedId !== "string") throw new AppError("PROJECT_NOT_FOUND", "Derived resource ID is invalid.", { recoverable: true });
  const derived = storage.getDerivedResultById(derivedId);
  if (!derived) throw new AppError("PROJECT_NOT_FOUND", `Derived result ${derivedId} was not found.`, { recoverable: true });
  const result = storage.getResultById(derived.result_id);
  if (!result) throw new AppError("PROJECT_NOT_FOUND", `Original result ${derived.result_id} was not found.`, { recoverable: false });
  return readStoredResource(storage, uri, {
    id: derived.id,
    job_id: result.job_id,
    relative_path: derived.relative_path,
    mime: derived.mime,
    size_bytes: derived.size_bytes,
    content_hash: derived.content_hash,
  });
}

function configuredWorkflowBackend(config: AppConfig, profileId: string): WorkflowApiClient {
  if (!config.workflowApi) {
    throw new AppError("CAPABILITY_UNKNOWN", "No Workflow API profile is configured for this server.", {
      recoverable: true,
      suggestedFix: "Configure RUNNINGHUB_WORKFLOW_API_KEY, then restart the server.",
    });
  }
  if (config.workflowApi.profile_id !== profileId) {
    throw new AppError("CAPABILITY_UNKNOWN", `Workflow API profile ${profileId} is not configured.`, {
      context: { configured_profile_id: config.workflowApi.profile_id },
      recoverable: true,
      suggestedFix: "Use the configured backend profile or add a separate profile configuration.",
    });
  }
  return new WorkflowApiClient(config.workflowApi);
}

function executionPlanForInput(
  input: {
    readonly work_item_id: string;
    readonly workflow_revision_id: string;
    readonly backend_profile_id: string;
    readonly provider_workflow_id?: string;
    readonly provider_submit_mode?: "v2_node_info" | "legacy_saved" | "legacy_graph";
    readonly asset_bindings: readonly { readonly asset_id: string; readonly content_hash: string; readonly provider_ref?: { readonly kind: "provider_file" | "provider_url"; readonly value: string } }[];
    readonly output_contract: Readonly<Record<string, unknown>>;
    readonly mode: "production" | "capability_test";
  },
  projects: ProjectContextService,
  revisions: RevisionStore,
  storage: Storage,
): ExecutionPlan {
  const workItem = projects.getWorkItem(input.work_item_id);
  if (workItem.state !== "REQUESTED") {
    throw new AppError("INVALID_CONFIGURATION", `Work item ${workItem.id} is not open for execution.`, { recoverable: true });
  }
  const project = projects.getProject(workItem.project_id);
  const revision = revisions.getRevision(input.workflow_revision_id);
  if (revision.project_id !== workItem.project_id) {
    throw new AppError("REVISION_CONFLICT", `Revision ${revision.revision_id} does not belong to work item project ${workItem.project_id}.`, { recoverable: true });
  }
  if (revision.validation.structural === "invalid") {
    throw new AppError("INVALID_GRAPH", `Workflow revision ${revision.revision_id} is structurally invalid.`, { recoverable: true, suggestedFix: "Read the validation report, correct the graph, and prepare a new revision." });
  }
  const assets = new Map(storage.listAssets(workItem.project_id).map((asset) => [asset.id, asset]));
  for (const binding of input.asset_bindings) {
    const asset = assets.get(binding.asset_id);
    if (!asset) throw new AppError("ASSET_MISSING", `Asset ${binding.asset_id} is not registered in project ${workItem.project_id}.`, { recoverable: true });
    if (asset.content_hash.toLowerCase() !== binding.content_hash.toLowerCase()) {
      throw new AppError("ASSET_CHANGED", `Asset ${binding.asset_id} hash no longer matches the requested binding.`, { recoverable: true, suggestedFix: "Re-index the project and prepare a new plan with the current asset hash." });
    }
    if (isLoraAsset(asset) && binding.provider_ref) {
      throw new AppError("INVALID_CONFIGURATION", `LoRA asset ${asset.id} cannot use a regular provider reference in an execution plan.`, { recoverable: true, suggestedFix: "Use rh_upload_lora or let rh_run_workflow resolve the dedicated LoRA reference." });
    }
  }
  validateLoraGraphBindings(revision.graph, assets);
  const requirements = {
    work_item_id: workItem.id,
    project_id: workItem.project_id,
    scene_id: workItem.scene_id ?? null,
    chain_id: workItem.chain_id,
    user_request: workItem.user_request,
    request_kind: workItem.request_kind,
    allowed_outputs: workItem.allowed_outputs,
  };
  const providerWorkflowId = input.provider_workflow_id;
  const planSeed = {
    work_item_id: workItem.id,
    workflow_revision_id: revision.revision_id,
    backend_profile_id: input.backend_profile_id,
    ...(providerWorkflowId ? { provider_workflow_id: providerWorkflowId } : {}),
    ...(input.provider_submit_mode ? { provider_submit_mode: input.provider_submit_mode } : {}),
    workflow_state: "uninitialized",
    asset_bindings: input.asset_bindings,
    output_contract: input.output_contract,
    mode: input.mode,
  };
  return {
    id: `plan-${sha256(stableJson(planSeed))}`,
    project_id: workItem.project_id,
    work_item_id: workItem.id,
    graph_revision_id: revision.revision_id,
    graph_hash: revision.graph_hash,
    workflow_json: exportApiGraph(revision.graph),
    asset_bindings: input.asset_bindings,
    requirements_hash: sha256(stableJson(requirements)),
    policy_hash: sha256(stableJson({ project_id: project.id, policy_revision: project.policy_revision })),
    backend_profile_id: input.backend_profile_id,
    ...(providerWorkflowId ? { provider_workflow_id: providerWorkflowId } : {}),
    ...(input.provider_submit_mode ? { provider_submit_mode: input.provider_submit_mode } : {}),
    workflow_state: "uninitialized",
    output_contract: input.output_contract,
    mode: input.mode,
  };
}

async function safeUpstream(
  operation: () => { content: Array<{ type: "text"; text: string }> },
) {
  try {
    return normalizeUpstreamResult(operation());
  } catch (error) {
    const normalized = error instanceof Error && error.message.startsWith("Unknown RunningHub endpoint:")
      ? new AppError("SCHEMA_UNKNOWN", error.message, {
          recoverable: true,
          suggestedFix: "Use rh_search_models or rh_get_capabilities before selecting an endpoint.",
        })
      : error;
    return { isError: true, content: [jsonText(errorResult(normalized))] };
  }
}

export function createServer(config: AppConfig, storage: Storage): McpServer {
  const data = loadRunningHubData(config.catalogDir);
  const handlers = createToolHandlers(data);
  const revisions = new RevisionStore({ persistence: new SqliteRevisionPersistence(storage) });
  const projects = new ProjectContextService(storage);
  const assetProvider = new AssetProvider(storage);
  const workflowLibrary = new WorkflowLibrary(defaultWorkflowCards);
  const manifest = readCatalogManifest(config.catalogDir);
  const reviewService = new ReviewService(storage, revisions, projects);
  const server = new McpServer(
    { name: "runninghub-mcp", version: "0.1.0" },
    { instructions: SERVER_INSTRUCTIONS },
  );

  server.resource(
    "result-output",
    new ResourceTemplate("runninghub://result/{result_id}", { list: undefined }),
    { description: "A validated local original result file." },
    async (uri, variables) => readResultResource(storage, uri, variables),
  );
  server.resource(
    "derived-output",
    new ResourceTemplate("runninghub://derived/{derived_id}", { list: undefined }),
    { description: "A validated local derived preview or video poster." },
    async (uri, variables) => readDerivedResource(storage, uri, variables),
  );

  server.tool(
    "rh_search_models",
    "Search the pinned public RunningHub model catalog. This is discovery only, not account availability.",
    searchModelsSchema,
    async (input) => safeUpstream(() => handlers.rh_search_models(input)),
  );
  server.tool(
    "rh_get_model_schema",
    "Return a public schema for one catalog endpoint; it does not verify cloud access.",
    endpointSchema,
    async (input) => safeUpstream(() => handlers.rh_get_model_schema(input)),
  );
  server.tool(
    "rh_estimate_price",
    "Estimate a public catalog price. Verify official RunningHub pricing before showing a final cost.",
    estimatePriceSchema,
    async (input) => safeUpstream(() => handlers.rh_estimate_price(input)),
  );
  server.tool(
    "rh_validate_payload",
    "Validate a payload against a public model schema; this does not execute it.",
    validatePayloadSchema,
    async (input) => safeUpstream(() => handlers.rh_validate_payload(input)),
  );
  server.tool(
    "rh_get_integration_guide",
    "Return public-safe integration guidance for the optional standard model API family.",
    integrationGuideSchema,
    async (input) => safeUpstream(() => handlers.rh_get_integration_guide(input)),
  );
  server.tool(
    "rh_build_example_payload",
    "Build an example payload from a public model schema; it does not submit a task.",
    buildExamplePayloadSchema,
    async (input) => safeUpstream(() => handlers.rh_build_example_payload(input)),
  );

  server.tool(
    "rh_create_workflow",
    "Create an immutable local workflow revision from an API graph or an empty draft. No cloud task is submitted.",
    createWorkflowSchema,
    async (input) => {
      try {
        const graph = input.api_graph ? importApiGraph(input.api_graph, input.output_nodes ?? []) : createEmptyGraph();
        const revision = revisions.createWorkflow({
          project_id: input.project_id,
          ...(input.workflow_id ? { workflow_id: input.workflow_id } : {}),
          graph,
          ...(input.reason ? { reason: input.reason } : {}),
        });
        return { content: [jsonText(okResult(revision))] };
      } catch (error) {
        return { isError: true, content: [jsonText(errorResult(error))] };
      }
    },
  );

  server.tool(
    "rh_get_workflow",
    "Read a local immutable workflow revision and its validation report.",
    getWorkflowSchema,
    async (input) => {
      try {
        return { content: [jsonText(okResult(revisions.getWorkflowRevision(input.workflow_id, input.revision_id)))] };
      } catch (error) {
        return { isError: true, content: [jsonText(errorResult(error))] };
      }
    },
  );

  server.tool(
    "rh_edit_workflow",
    "Apply an atomic typed graph edit batch using compare-and-swap; failed batches create no revision.",
    editWorkflowSchema,
    async (input) => {
      try {
        const result = revisions.editWorkflow({
          workflow_id: input.workflow_id,
          base_revision_id: input.base_revision_id,
          reason: input.reason,
          operations: input.operations as unknown as GraphOperation[],
        });
        return { content: [jsonText(okResult(result))] };
      } catch (error) {
        return { isError: true, content: [jsonText(errorResult(error))] };
      }
    },
  );

  server.tool(
    "rh_validate_workflow",
    "Return structural, runnable, and backend-compatibility states for a local workflow revision.",
    validateWorkflowSchema,
    async (input) => {
      try {
        return { content: [jsonText(okResult(revisions.getWorkflowRevision(input.workflow_id, input.revision_id).validation))] };
      } catch (error) {
        return { isError: true, content: [jsonText(errorResult(error))] };
      }
    },
  );

  server.tool(
    "rh_export_workflow",
    "Export a local workflow revision as API-format JSON without secrets or cloud submission.",
    exportWorkflowSchema,
    async (input) => {
      try {
        const revision = revisions.getWorkflowRevision(input.workflow_id, input.revision_id);
        return {
          content: [
            jsonText(okResult({
              workflow_id: revision.workflow_id,
              revision_id: revision.revision_id,
              graph_hash: revision.graph_hash,
              format: input.format,
              json: exportApiGraph(revision.graph),
            })),
          ],
        };
      } catch (error) {
        return { isError: true, content: [jsonText(errorResult(error))] };
      }
    },
  );

  server.tool(
    "rh_project",
    "Register, inspect, list, or index a project without changing files outside its explicit roots.",
    projectToolSchema,
    async (input) => {
      try {
        if (input.action === "list") return { content: [jsonText(okResult(projects.listProjects()))] };
        if (!input.project_id) throw new AppError("INVALID_CONFIGURATION", "project_id is required for this project action.", { recoverable: true });
        if (input.action === "inspect") return { content: [jsonText(okResult(projects.getProject(input.project_id)))] };
        if (input.action === "index") return { content: [jsonText(okResult(projects.indexProject(input.project_id)))] };
        if (!input.canonical_root || !input.backend_profile_id || !input.output_root) throw new AppError("INVALID_CONFIGURATION", "canonical_root, backend_profile_id, and output_root are required to register a project.", { recoverable: true });
        return {
          content: [jsonText(okResult(projects.registerProject({
            project_id: input.project_id,
            canonical_root: input.canonical_root,
            backend_profile_id: input.backend_profile_id,
            ...(input.document_paths ? { document_paths: input.document_paths } : {}),
            ...(input.asset_roots ? { asset_roots: input.asset_roots } : {}),
            output_root: input.output_root,
            ...(input.policy_revision ? { policy_revision: input.policy_revision } : {}),
          })))],
        };
      } catch (error) {
        return { isError: true, content: [jsonText(errorResult(error))] };
      }
    },
  );

  server.tool(
    "rh_asset",
    "Inspect or register project-owned assets, prepare a tagged provider reference, or explicitly upload one through the configured backend.",
    assetToolSchema,
    async (input) => {
      try {
        projects.getProject(input.project_id);
        if (input.action === "inspect") {
          return { content: [jsonText(okResult(assetProvider.inspect(input.project_id, input.asset_id)))] };
        }
        if (input.action === "register") {
          if (!input.relative_path) throw new AppError("INVALID_CONFIGURATION", "relative_path is required to register an asset.", { recoverable: true });
          return { content: [jsonText(okResult(projects.registerAsset(input.project_id, input.relative_path, input.roles ?? [])))] };
        }
        if (!input.asset_id) throw new AppError("INVALID_CONFIGURATION", "asset_id is required for this asset action.", { recoverable: true });
        const asset = assetProvider.inspect(input.project_id, input.asset_id);
        if (Array.isArray(asset)) throw new Error("Expected one asset");
        const profileId = input.backend_profile_id ?? projects.getProject(input.project_id).backend_profile_id;
        if (input.action === "prepare") {
          const cached = storage.getProviderUpload(profileId, "workflow_api", asset.id, asset.content_hash);
          return {
            content: [jsonText(okResult({
              asset,
              local_reference: { kind: "asset", value: `asset://${asset.id}/default` },
              provider_profile_id: profileId,
              provider_reference_cached: Boolean(cached),
              cache_expires_at: cached?.expires_at ?? null,
              upload_required: !cached,
            }))],
          };
        }
        if (!input.work_item_id) throw new AppError("INVALID_CONFIGURATION", "work_item_id is required for provider upload.", { recoverable: true });
        const workItem = projects.getWorkItem(input.work_item_id);
        if (workItem.project_id !== input.project_id) throw new AppError("ASSET_MISSING", "The work item does not belong to the asset project.", { recoverable: true });
        const backend = configuredWorkflowBackend(config, profileId);
        const reference = await assetProvider.upload({ project_id: input.project_id, asset_id: asset.id, content_hash: asset.content_hash, profile_id: profileId, backend });
        return { content: [jsonText(okResult({ asset, provider_reference: reference }))] };
      } catch (error) {
        return { isError: true, content: [jsonText(errorResult(error))] };
      }
    },
  );

  server.tool(
    "rh_upload_lora",
    "Upload one registered project LoRA through the dedicated RHLoraLoader flow; signed upload URLs are never returned or stored as graph references.",
    uploadLoraSchema,
    async (input) => {
      try {
        const asset = assetProvider.inspect(input.project_id, input.asset_id);
        if (Array.isArray(asset)) throw new Error("Expected one asset");
        const workItem = projects.getWorkItem(input.work_item_id);
        if (workItem.project_id !== input.project_id) throw new AppError("ASSET_MISSING", "The work item does not belong to the LoRA asset project.", { recoverable: true });
        if (workItem.state !== "REQUESTED") throw new AppError("INVALID_CONFIGURATION", `Work item ${workItem.id} is not open for LoRA upload.`, { recoverable: true });
        if (!isLoraAsset(asset)) throw new AppError("INVALID_CONFIGURATION", `Asset ${asset.id} is not registered with the lora role.`, { recoverable: true });
        const profileId = input.backend_profile_id ?? projects.getProject(input.project_id).backend_profile_id;
        const backend = configuredWorkflowBackend(config, profileId);
        const reference = await assetProvider.uploadLora({ project_id: input.project_id, asset_id: asset.id, content_hash: asset.content_hash, profile_id: profileId, backend });
        return { content: [jsonText(okResult({ asset, provider_reference: reference }))] };
      } catch (error) {
        return { isError: true, content: [jsonText(errorResult(error))] };
      }
    },
  );

  server.tool(
    "rh_scene",
    "Read, resolve, or upsert normalized scene context and its required asset roles.",
    sceneToolSchema,
    async (input) => {
      try {
        if (input.action === "resolve") {
          if (!input.alias) throw new AppError("INVALID_CONFIGURATION", "alias is required to resolve a scene.", { recoverable: true });
          return { content: [jsonText(okResult(projects.resolveScene(input.project_id, input.alias)))] };
        }
        if (!input.scene_id) throw new AppError("INVALID_CONFIGURATION", "scene_id is required for read/upsert.", { recoverable: true });
        if (input.action === "read") return { content: [jsonText(okResult(projects.getScene(input.project_id, input.scene_id)))] };
        if (!input.action_text || !input.output_kind || !input.constraints || !input.required_asset_roles || !input.dependencies) throw new AppError("INVALID_CONFIGURATION", "upsert requires action_text, output_kind, constraints, required_asset_roles, and dependencies.", { recoverable: true });
        return {
          content: [jsonText(okResult(projects.upsertScene({
            project_id: input.project_id,
            scene_id: input.scene_id,
            aliases: input.aliases ?? [],
            action_text: input.action_text,
            output_kind: input.output_kind,
            constraints: input.constraints,
            required_asset_roles: input.required_asset_roles,
            dependencies: input.dependencies,
            ...(input.sources_hash ? { sources_hash: input.sources_hash } : {}),
          })))],
        };
      } catch (error) {
        return { isError: true, content: [jsonText(errorResult(error))] };
      }
    },
  );

  server.tool(
    "rh_work_item",
    "Create/read/close a requested work item; creation does not create a job or submit a paid task.",
    workItemToolSchema,
    async (input) => {
      try {
        if (input.action === "read" || input.action === "close") {
          if (!input.work_item_id) throw new AppError("INVALID_CONFIGURATION", "work_item_id is required.", { recoverable: true });
          return { content: [jsonText(okResult(input.action === "read" ? projects.getWorkItem(input.work_item_id) : projects.closeWorkItem(input.work_item_id)))] };
        }
        if (!input.project_id || !input.user_request || !input.request_kind) throw new AppError("INVALID_CONFIGURATION", "create requires project_id, user_request, and request_kind.", { recoverable: true });
        return { content: [jsonText(okResult(projects.createWorkItem({ project_id: input.project_id, ...(input.scene_id ? { scene_id: input.scene_id } : {}), ...(input.chain_id ? { chain_id: input.chain_id } : {}), user_request: input.user_request, request_kind: input.request_kind, ...(input.allowed_outputs ? { allowed_outputs: input.allowed_outputs } : {}) })))] };
      } catch (error) {
        return { isError: true, content: [jsonText(errorResult(error))] };
      }
    },
  );

  server.tool(
    "rh_search_workflows",
    "Search the registered workflow library using hard scene requirements; constraints are never weakened to force a result.",
    workflowSearchSchema,
    async (input) => {
      try {
        return { content: [jsonText(okResult(workflowLibrary.search(input)))] };
      } catch (error) {
        return { isError: true, content: [jsonText(errorResult(error))] };
      }
    },
  );

  server.tool(
    "rh_import_workflow",
    "Discover API-format workflow JSON files in a registered project or import one explicitly; no provider task is submitted.",
    importWorkflowSchema,
    async (input) => {
      try {
        const candidates = projects.discoverWorkflowFiles(input.project_id);
        if (!input.relative_path) {
          if (candidates.length === 0) throw new AppError("SCHEMA_UNKNOWN", `No API-format workflow JSON was found in project ${input.project_id}.`, { recoverable: true, suggestedFix: "Place an exported API-format workflow JSON inside the project or provide an explicit relative_path." });
          if (candidates.length > 1) return { content: [jsonText(okResult({ candidates }, ["Multiple project workflows were found; choose one explicitly or narrow the project workflow folder."]))] };
        }
        const source = projects.readWorkflowFile(input.project_id, input.relative_path ?? candidates[0]?.relative_path ?? "", input.output_nodes ?? []);
        const workflowId = input.workflow_id ?? source.workflow_id_hint ?? `file:${source.relative_path}`;
        let revision;
        try {
          revision = revisions.createWorkflow({
            project_id: input.project_id,
            workflow_id: workflowId,
            graph: importApiGraph(source.api_graph, input.output_nodes ?? []),
            reason: "import_project_workflow",
          });
        } catch (error) {
          if (!(error instanceof AppError) || error.code !== "REVISION_CONFLICT") throw error;
          const current = revisions.getCurrent(workflowId);
          if (current.graph_hash !== source.graph_hash) throw new AppError("REVISION_CONFLICT", `Workflow source ${source.relative_path} changed; create a new revision explicitly before execution.`, { recoverable: true });
          revision = current;
        }
        return { content: [jsonText(okResult({ source_path: source.relative_path, graph_hash: source.graph_hash, revision }))] };
      } catch (error) {
        return { isError: true, content: [jsonText(errorResult(error))] };
      }
    },
  );

  server.tool(
    "rh_prepare_generation",
    "Create an immutable local execution plan from one work item and one workflow revision; no provider task is submitted.",
    prepareGenerationSchema,
    async (input) => {
      try {
        const plan = executionPlanForInput(input, projects, revisions, storage);
        const preparedRevision = revisions.getRevision(plan.graph_revision_id);
        if (plan.mode === "production" && preparedRevision.validation.runnable !== "ready") {
          throw new AppError("INVALID_GRAPH", `Workflow revision ${preparedRevision.revision_id} is not proven runnable for production execution.`, {
            recoverable: true,
            suggestedFix: "Resolve the validation report and prepare a new revision before production submission.",
          });
        }
        const existing = storage.getExecutionPlan(plan.id);
        if (!existing) storage.saveExecutionPlan(planToRow(plan));
        return {
          content: [jsonText(okResult(existing ? planFromRow(existing) : plan, existing ? ["An identical immutable execution plan already exists."] : [
            ...(plan.mode === "production" && plan.backend_profile_id !== config.workflowApi?.profile_id ? ["The selected backend profile is not configured or has not been verified; run is blocked until capability is configured."] : []),
            ...(revisions.getRevision(plan.graph_revision_id).validation.runnable !== "ready" ? ["The graph revision is not proven runnable for a backend; local preparation is preserved, but submit may be rejected."] : []),
          ]))],
        };
      } catch (error) {
        return { isError: true, content: [jsonText(errorResult(error))] };
      }
    },
  );

  server.tool(
    "rh_run_workflow",
    "Submit one prepared execution plan through its configured durable backend; repeated request IDs never create a second local submit.",
    runWorkflowSchema,
    async (input) => {
      try {
        const row = storage.getExecutionPlan(input.plan_id);
        if (!row) throw new AppError("PROJECT_NOT_FOUND", `Execution plan ${input.plan_id} was not found.`, { recoverable: true });
        const plan = planFromRow(row);
        const backend = configuredWorkflowBackend(config, plan.backend_profile_id);
        const runner = new DurableWorkflowRunner(storage, backend);
        return { content: [jsonText(okResult(await runner.run(plan, input.request_id)))] };
      } catch (error) {
        return { isError: true, content: [jsonText(errorResult(error))] };
      }
    },
  );

  server.tool(
    "rh_job",
    "Inspect or advance one durable job without hiding provider errors or retrying an uncertain submit.",
    jobSchema,
    async (input) => {
      try {
        let row = storage.getJob(input.job_id);
        if (!row) throw new AppError("PROJECT_NOT_FOUND", `Job ${input.job_id} was not found.`, { recoverable: true });
        if (input.action === "status") return { content: [jsonText(okResult(jobHandle(row)))] };
        if (input.provider_task_id && input.action !== "resume") {
          throw new AppError("INVALID_CONFIGURATION", "provider_task_id is allowed only when resuming a SUBMIT_UNKNOWN job.", { recoverable: true });
        }
        if (input.action === "resume" && input.provider_task_id) {
          if (row.execution_state !== "SUBMIT_UNKNOWN" || row.provider_task_id) {
            throw new AppError("INVALID_CONFIGURATION", "provider_task_id can only reconcile a SUBMIT_UNKNOWN job without an existing provider task.", { recoverable: true });
          }
          if (!storage.attachProviderTask(input.job_id, input.provider_task_id)) {
            throw new AppError("REQUEST_CONFLICT", `Job ${input.job_id} could not be reconciled with the supplied provider task ID.`, { recoverable: true });
          }
          row = storage.getJob(input.job_id);
          if (!row) throw new AppError("PROJECT_NOT_FOUND", `Job ${input.job_id} disappeared during reconcile.`, { recoverable: false });
        }
        if (input.action === "cancel" && !row.provider_task_id) {
          if (row.execution_state === "SUBMIT_UNKNOWN") {
            throw new AppError("SUBMIT_UNKNOWN", `Job ${input.job_id} has an uncertain provider submit and cannot be cancelled locally.`, {
              recoverable: true,
              suggestedFix: "Reconcile the exact provider task ID with rh_job resume, then cancel that provider task explicitly.",
            });
          }
          if (row.execution_state === "SUBMITTING") {
            storage.markSubmitUnknown(input.job_id);
            const unknown = storage.getJob(input.job_id);
            if (!unknown) throw new AppError("PROJECT_NOT_FOUND", `Job ${input.job_id} disappeared.`, { recoverable: false });
            return { content: [jsonText(okResult(jobHandle(unknown), ["The submit was in flight; it was preserved as SUBMIT_UNKNOWN and not cancelled locally."]))] };
          }
          storage.cancelLocalJob(input.job_id);
          const cancelled = storage.getJob(input.job_id);
          if (!cancelled) throw new AppError("PROJECT_NOT_FOUND", `Job ${input.job_id} disappeared.`, { recoverable: false });
          return { content: [jsonText(okResult(jobHandle(cancelled)))] };
        }
        if (input.action === "resume" && row.execution_state === "SUBMITTING" && !row.provider_task_id) {
          storage.markSubmitUnknown(input.job_id);
          const unknown = storage.getJob(input.job_id);
          if (!unknown) throw new AppError("PROJECT_NOT_FOUND", `Job ${input.job_id} disappeared.`, { recoverable: false });
          return { content: [jsonText(okResult(jobHandle(unknown), ["The interrupted submit was marked SUBMIT_UNKNOWN; no automatic paid retry was made."]))] };
        }
        if (input.action === "wait" && (!row.provider_task_id || ["SUBMIT_UNKNOWN", "SUCCEEDED", "FAILED", "CANCELLED"].includes(row.execution_state))) {
          return { content: [jsonText(okResult(jobHandle(row)))] };
        }
        const planRow = storage.getExecutionPlan(row.plan_id);
        if (!planRow) throw new AppError("PROJECT_NOT_FOUND", `Execution plan ${row.plan_id} was not found.`, { recoverable: false });
        const backend = configuredWorkflowBackend(config, planRow.backend_profile_id);
        const runner = new DurableWorkflowRunner(storage, backend);
        const timeout = input.timeout_ms ?? 30_000;
        const result = input.action === "cancel"
          ? await runner.cancel(input.job_id)
          : input.action === "resume"
            ? await runner.recover(input.job_id, timeout)
            : await runner.wait(input.job_id, timeout);
        return { content: [jsonText(okResult(result))] };
      } catch (error) {
        return { isError: true, content: [jsonText(errorResult(error))] };
      }
    },
  );

  server.tool(
    "rh_get_results",
    "Download confirmed provider outputs as validated local original files, render supported images inline in the current MCP chat, and create local preview/poster derivatives without submitting another task.",
    getResultsSchema,
    async (input) => {
      try {
        const row = storage.getJob(input.job_id);
        if (!row) throw new AppError("PROJECT_NOT_FOUND", `Job ${input.job_id} was not found.`, { recoverable: true });
        const planRow = storage.getExecutionPlan(row.plan_id);
        if (!planRow) throw new AppError("PROJECT_NOT_FOUND", `Execution plan ${row.plan_id} was not found.`, { recoverable: false });
           const backend = configuredWorkflowBackend(config, planRow.backend_profile_id);
            const results = await new ResultDownloadService(storage, backend).download(input.job_id);
            const derived = await new DerivedMediaService(storage).derive(results.map((result) => result.result_id));
             const manifest = new ResultManifestService(storage).create(input.job_id, backend.api_family);
              const review = reviewService.getJobSummary(input.job_id);
             const originalLinks = results.map(resultResourceLink);
             const inlineImages = results.flatMap((result) => {
               const image = inlineImageContent(storage, result);
               return image ? [image] : [];
             });
             const derivedLinks = derived.results.map(derivedResourceLink);
            const enrichedResults = results.map((result, index) => ({
              ...result,
              resource_uri: originalLinks[index]?.uri,
              review: review.results.find((item) => item.result_id === result.result_id),
              derived: derived.results.filter((item) => item.result_id === result.result_id).map((item) => ({ ...item, resource_uri: derivedUri(item.derived_id) })),
            }));
             return { content: [jsonText(okResult({ job_id: input.job_id, results: enrichedResults, manifest, review }, [...derived.warnings])), ...inlineImages, ...originalLinks, ...derivedLinks] };
       } catch (error) {
         return { isError: true, content: [jsonText(errorResult(error))] };
       }
     },
   );

    server.tool(
      "rh_review_result",
      "Record one idempotent user review for a saved result; an explicit approved continuation may run one already prepared next plan.",
       reviewResultSchema,
       async (input) => {
         try {
           const { continuation, ...reviewInput } = input;
           if (continuation && input.decision !== "APPROVED") {
             throw new AppError("INVALID_CONFIGURATION", "continuation is allowed only with APPROVED.", {
               recoverable: true,
               suggestedFix: "Approve the saved result first, then request a continuation explicitly.",
             });
           }
           if (continuation) validateApprovalContinuation(storage, input.result_id, continuation);
           const review = reviewService.review({
             ...reviewInput,
             ...(input.revision_request ? {
               revision_request: {
                 ...input.revision_request,
                 operations: input.revision_request.operations as unknown as GraphOperation[],
               },
             } : {}),
           } as unknown as Parameters<ReviewService["review"]>[0]);
           if (!continuation) return { content: [jsonText(okResult(review))] };

           const intentPayload = {
             review_event_id: review.event.id,
             plan_id: continuation.plan_id,
             request_id: continuation.request_id,
           };
           const existingIntent = storage.getOutboxByAggregate("approval_continuation", review.event.id);
           if (existingIntent) {
             const storedIntent = parseContinuationIntent(existingIntent.payload_json);
             if (storedIntent.plan_id !== intentPayload.plan_id || storedIntent.request_id !== intentPayload.request_id) {
               throw new AppError("REQUEST_CONFLICT", `Review event ${review.event.id} already has a different continuation intent.`, {
                 recoverable: false,
                 suggestedFix: "Retry the original approval continuation or prepare a new reviewed result.",
               });
             }
           } else {
             const now = new Date().toISOString();
             storage.enqueueOutbox({
               id: `approval-continuation:${review.event.id}`,
               kind: "approval_continuation",
               aggregate_id: review.event.id,
               payload_json: continuationIntentPayload(intentPayload),
               published_at: null,
               created_at: now,
             });
           }
           const continuationPlanRow = storage.getExecutionPlan(continuation.plan_id);
           if (!continuationPlanRow) throw new AppError("PROJECT_NOT_FOUND", `Execution plan ${continuation.plan_id} was not found.`, { recoverable: true });
           const backend = configuredWorkflowBackend(config, continuationPlanRow.backend_profile_id);
           const job = await new DurableWorkflowRunner(storage, backend).run(planFromRow(continuationPlanRow), continuation.request_id);
           storage.markOutboxPublished(`approval-continuation:${review.event.id}`);
           return {
             content: [jsonText(okResult({
               ...review,
               continuation: {
                 ...intentPayload,
                 idempotent: Boolean(existingIntent),
                 job,
               },
             }))]
           };
         } catch (error) {
          return { isError: true, content: [jsonText(errorResult(error))] };
       }
     },
   );

  server.tool(
    "rh_get_capabilities",
    "Report local server, catalog provenance, and backend capability evidence without exposing secrets.",
    {
      profile: z.string().min(1).optional(),
      backend: z.enum(["workflow_api", "comfy_proxy", "standard_model"]).optional(),
    },
    async (input) => {
      try {
        const backend = input.backend ?? "workflow_api";
        return {
          content: [
            jsonText(
              okResult({
                server: { name: "runninghub-mcp", version: "0.1.0" },
                profile_id: input.profile ?? config.profileId,
                backend,
                status: config.workflowApi ? "configured_not_verified" : "unknown",
                reason: config.workflowApi
                  ? "The API key and live-case configuration are present; account access still requires an explicit live probe."
                  : "No Workflow API key is configured; source/catalog evidence does not prove account access.",
                configuration: {
                  api_key_configured: Boolean(config.workflowApi?.api_key),
                  live_cases_configured: config.live_cases_configured,
                },
                graph_execution: { status: "unknown", full_graph_submit: "not_verified" },
                local: { sqlite: storage.health(), catalog_revision: manifest.revision ?? "unknown" },
                catalog: {
                  origin: "recorded",
                  captured_at: manifest.captured_at ?? "unknown",
                  model_count: data.registry.model_count,
                  pricing_count: data.pricing.pricing_count,
                },
                 execution: {
                   prepare: "local",
                   submit: config.workflowApi ? "configured_not_verified" : "capability_unknown",
                   polling: config.workflowApi ? "configured_not_verified" : "capability_unknown",
                   upload: (config.workflowApi?.routes.upload_legacy ?? config.workflowApi?.routes.upload) ? "configured_not_verified" : "capability_unknown",
                 },
                 media_profile: { ...WORKFLOW_MEDIA_PROFILE, status: "local" },
                 supported_now: ["catalog_read", "payload_validation", "price_estimation", "local_graph_editing", "local_revisions", "api_graph_export", "project_context", "scene_resolution", "asset_hash_index", "asset_inspection", "asset_prepare", "media_profile_validation", "workflow_library_search", "execution_plan_prepare", "job_status", "result_download", "result_resource_links", "result_preview", "result_poster", "result_manifest", "result_manifest_outbox", "result_review", "changes_requested_revision", "review_chain_gate", "approval_continuation"],
                  not_yet_implemented: ["automatic_approval"],
              }),
            ),
          ],
        };
      } catch (error) {
        return { isError: true, content: [jsonText(errorResult(error))] };
      }
    },
  );

  return server;
}
