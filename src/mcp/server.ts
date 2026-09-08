import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WorkflowApiClient } from "../backends/workflow-api/client.js";
import { type AppConfig } from "../config.js";
import { AssetProvider } from "../execution/assets.js";
import { type ExecutionPlan } from "../execution/types.js";
import { jobHandle, planFromRow, planToRow, DurableWorkflowRunner } from "../execution/runner.js";
import { assetToolSchema, jobSchema, prepareGenerationSchema, runWorkflowSchema } from "../execution/schemas.js";
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
  }
  const requirements = {
    work_item_id: workItem.id,
    project_id: workItem.project_id,
    scene_id: workItem.scene_id ?? null,
    chain_id: workItem.chain_id,
    user_request: workItem.user_request,
    request_kind: workItem.request_kind,
    allowed_outputs: workItem.allowed_outputs,
  };
  const providerWorkflowId = input.provider_workflow_id ?? (/^\d+$/.test(revision.workflow_id) ? revision.workflow_id : undefined);
  const planSeed = {
    work_item_id: workItem.id,
    workflow_revision_id: revision.revision_id,
    backend_profile_id: input.backend_profile_id,
    ...(providerWorkflowId ? { provider_workflow_id: providerWorkflowId } : {}),
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
  const server = new McpServer({ name: "runninghub-mcp", version: "0.1.0" });

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
        const source = projects.readWorkflowFile(input.project_id, input.relative_path ?? candidates[0]?.relative_path ?? "");
        const workflowId = input.workflow_id ?? source.workflow_id_hint ?? `file:${source.relative_path}`;
        let revision;
        try {
          revision = revisions.createWorkflow({ project_id: input.project_id, workflow_id: workflowId, graph: importApiGraph(source.api_graph), reason: "import_project_workflow" });
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
        const row = storage.getJob(input.job_id);
        if (!row) throw new AppError("PROJECT_NOT_FOUND", `Job ${input.job_id} was not found.`, { recoverable: true });
        if (input.action === "status") return { content: [jsonText(okResult(jobHandle(row)))] };
        if (input.action === "cancel" && !row.provider_task_id) {
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
                status: "unknown",
                reason: "No live profile probe has been run; source/catalog evidence does not prove account access.",
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
                  upload: config.workflowApi?.routes.upload ? "configured_not_verified" : "capability_unknown",
                },
                supported_now: ["catalog_read", "payload_validation", "price_estimation", "local_graph_editing", "local_revisions", "api_graph_export", "project_context", "scene_resolution", "asset_hash_index", "asset_inspection", "asset_prepare", "workflow_library_search", "execution_plan_prepare", "job_status"],
                not_yet_implemented: ["result_review"],
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
