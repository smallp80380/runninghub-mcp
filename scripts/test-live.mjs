import { parse as parseLossless, stringify as stringifyLossless } from "lossless-json";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Storage } from "../dist/storage/database.js";
import { ProjectContextService } from "../dist/projects/context.js";
import { RevisionStore } from "../dist/graph/revisions.js";
import { SqliteRevisionPersistence } from "../dist/storage/revisions.js";
import { exportApiGraph, hashGraph, importApiGraph } from "../dist/graph/codec.js";
import { prepareResizeGraph } from "../dist/graph/structuralProbe.js";
import { AssetProvider } from "../dist/execution/assets.js";
import { DurableWorkflowRunner, planToRow } from "../dist/execution/runner.js";
import { WorkflowApiClient } from "../dist/backends/workflow-api/client.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../dist/mcp/server.js";
import { createEmptyGraph } from "../dist/graph/types.js";

const apiKey = process.env.RUNNINGHUB_WORKFLOW_API_KEY?.trim();
const liveCases = process.env.RUNNINGHUB_LIVE_CASES?.trim().toLowerCase();
const workflowId = argumentValue("--workflow-id");
const taskId = argumentValue("--task-id");
const uploadOnly = process.argv.includes("--upload-only");
const structuralGraph = process.argv.includes("--structural-graph");
const cancelProbe = process.argv.includes("--cancel");
const expiryProbe = process.argv.includes("--expiry");
const resultResourceProbe = process.argv.includes("--result-resource");
const resizeNodeId = argumentValue("--resize-node-id");
const resizeWidth = integerArgument("--resize-width");
const resizeHeight = integerArgument("--resize-height");
const durationSecondsArgument = argumentValue("--duration-seconds");
const durationSeconds = durationSecondsArgument === undefined ? undefined : Number(durationSecondsArgument);
const timeoutMs = Number(argumentValue("--timeout-ms") ?? "180000");

if (!apiKey || liveCases !== "full") {
  console.error("NOT_RUN: configure RUNNINGHUB_WORKFLOW_API_KEY and RUNNINGHUB_LIVE_CASES=full before live tests.");
  process.exitCode = 2;
} else if (uploadOnly && (taskId || workflowId)) {
  console.error("NOT_RUN: --upload-only cannot be combined with --task-id or --workflow-id.");
  process.exitCode = 2;
} else if (uploadOnly && structuralGraph) {
  console.error("NOT_RUN: --upload-only cannot be combined with --structural-graph.");
  process.exitCode = 2;
} else if (uploadOnly && cancelProbe) {
  console.error("NOT_RUN: --upload-only cannot be combined with --cancel.");
  process.exitCode = 2;
} else if ((uploadOnly || structuralGraph || cancelProbe) && expiryProbe) {
  console.error("NOT_RUN: --expiry is read-only and cannot be combined with another probe mode.");
  process.exitCode = 2;
} else if (resultResourceProbe && (uploadOnly || structuralGraph || cancelProbe || expiryProbe)) {
  console.error("NOT_RUN: --result-resource cannot be combined with another probe mode.");
  process.exitCode = 2;
} else if (structuralGraph && cancelProbe) {
  console.error("NOT_RUN: --structural-graph cannot be combined with --cancel.");
  process.exitCode = 2;
} else if (structuralGraph && taskId) {
  console.error("NOT_RUN: --structural-graph cannot be combined with --task-id.");
  process.exitCode = 2;
} else if (cancelProbe && taskId) {
  console.error("NOT_RUN: --cancel cannot be combined with --task-id.");
  process.exitCode = 2;
} else if (taskId && !/^\d+$/.test(taskId)) {
  console.error("NOT_RUN: --task-id must be a numeric provider task ID.");
  process.exitCode = 2;
} else if (structuralGraph && (!workflowId || !/^\d+$/.test(workflowId))) {
  console.error("NOT_RUN: --structural-graph requires an explicit numeric --workflow-id.");
  process.exitCode = 2;
} else if (structuralGraph && (!Number.isSafeInteger(resizeWidth) || !Number.isSafeInteger(resizeHeight))) {
  console.error("NOT_RUN: --structural-graph requires integer --resize-width and --resize-height values.");
  process.exitCode = 2;
} else if (cancelProbe && (!workflowId || !/^\d+$/.test(workflowId))) {
  console.error("NOT_RUN: --cancel requires an explicit numeric --workflow-id.");
  process.exitCode = 2;
} else if (expiryProbe && (!taskId || !/^\d+$/.test(taskId))) {
  console.error("NOT_RUN: --expiry requires an explicit numeric --task-id.");
  process.exitCode = 2;
} else if (resultResourceProbe && (!taskId || !/^\d+$/.test(taskId))) {
  console.error("NOT_RUN: --result-resource requires an explicit numeric --task-id.");
  process.exitCode = 2;
} else if (durationSecondsArgument !== undefined && (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 60)) {
  console.error("NOT_RUN: --duration-seconds must be a positive number no greater than 60.");
  process.exitCode = 2;
} else if (durationSeconds !== undefined && (uploadOnly || structuralGraph || cancelProbe || expiryProbe || resultResourceProbe)) {
  console.error("NOT_RUN: --duration-seconds is supported only for the ephemeral generation probe.");
  process.exitCode = 2;
} else if (!uploadOnly && !taskId && !expiryProbe && !resultResourceProbe && (!workflowId || !/^\d+$/.test(workflowId))) {
  console.error("NOT_RUN: pass an explicit numeric --workflow-id for the ephemeral live probe.");
  process.exitCode = 2;
} else {
  try {
    await (uploadOnly
      ? runUploadProbe(apiKey)
      : expiryProbe
        ? runExpiryProbe(apiKey, taskId)
      : resultResourceProbe
        ? runResultResourceProbe(apiKey, taskId)
      : taskId
      ? recoverProbe(apiKey, taskId, timeoutMs)
        : structuralGraph
          ? runStructuralGraphProbe(apiKey, workflowId, resizeNodeId, resizeWidth, resizeHeight, timeoutMs)
          : cancelProbe
            ? runCancelProbe(apiKey, workflowId)
            : runProbe(apiKey, workflowId, timeoutMs, durationSeconds));
  } catch (error) {
    console.error(`LIVE_FAIL: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function integerArgument(name) {
  const value = argumentValue(name);
  if (value === undefined || !/^\d+$/.test(value)) return undefined;
  return Number(value);
}

async function runUploadProbe(apiKeyValue) {
  const root = mkdtempSync(join(tmpdir(), "runninghub-mcp-live-upload-"));
  const storage = new Storage(":memory:");
  try {
    mkdirSync(join(root, "assets"), { recursive: true });
    writeFileSync(join(root, "assets", "synthetic-reference.png"), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
    const projectId = "live-upload-memory";
    const projects = new ProjectContextService(storage);
    projects.registerProject({ project_id: projectId, canonical_root: root, backend_profile_id: "runninghub", asset_roots: ["assets"], output_root: "outputs" });
    const asset = projects.registerAsset(projectId, "assets/synthetic-reference.png", ["live_probe"]);
    projects.createWorkItem({ project_id: projectId, user_request: "authorized ephemeral Workflow API upload probe", request_kind: "capability_test" });
    const backend = new WorkflowApiClient({
      profile_id: "runninghub",
      base_url: "https://www.runninghub.ai",
      api_key: apiKeyValue,
      routes: {
        submit: "/task/openapi/create",
        status: "/openapi/v2/query",
        outputs: "/openapi/v2/query",
        upload: "/openapi/v2/media/upload/binary",
        cancel: "/task/openapi/cancel",
      },
    });
    const provider = new AssetProvider(storage);
    const first = await provider.upload({ project_id: projectId, asset_id: asset.asset_id, content_hash: asset.content_hash, profile_id: "runninghub", backend });
    const second = await provider.upload({ project_id: projectId, asset_id: asset.asset_id, content_hash: asset.content_hash, profile_id: "runninghub", backend });
    const cached = storage.getProviderUpload("runninghub", "workflow_api", asset.asset_id, asset.content_hash);
    if (first.kind !== second.kind || first.value !== second.value || !cached) throw new Error("provider upload cache did not preserve the tagged reference");
    console.error(`LIVE_PASS: upload_kind=${first.kind} cache_reused=true`);
  } finally {
    storage.close();
    rmSync(root, { recursive: true, force: true });
  }
}

function overrideDuration(source, seconds) {
  let parsed;
  try {
    parsed = parseLossless(source);
  } catch {
    throw new Error("workflow JSON could not be parsed for the duration override");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("workflow JSON is not an API-format graph object");
  const graph = parsed;
  const visited = new Set();
  const setLinkedNumericSource = (link) => {
    if (!Array.isArray(link) || link.length < 1) return false;
    const id = String(link[0]);
    if (visited.has(id)) return false;
    visited.add(id);
    const node = graph[id];
    if (!node || typeof node !== "object" || !node.inputs || typeof node.inputs !== "object") return false;
    if (/primitive(?:float|int)/i.test(String(node.class_type ?? "")) && Object.prototype.hasOwnProperty.call(node.inputs, "value")) {
      node.inputs.value = seconds;
      return true;
    }
    return Object.values(node.inputs).some((value) => setLinkedNumericSource(value));
  };

  let changed = false;
  for (const node of Object.values(graph)) {
    if (!node || typeof node !== "object" || !/image.*to.*video/i.test(String(node.class_type ?? "")) || !node.inputs || typeof node.inputs !== "object") continue;
    for (const [name, value] of Object.entries(node.inputs)) {
      if (!/duration|length/i.test(name)) continue;
      if (typeof value === "number") {
        node.inputs[name] = seconds;
        changed = true;
      } else if (setLinkedNumericSource(value)) {
        changed = true;
      }
    }
  }
  if (!changed) throw new Error("could not find a linked numeric duration/length input in the video workflow");
  const serialized = stringifyLossless(graph, null, 2);
  if (typeof serialized !== "string") throw new Error("duration override could not serialize the workflow");
  return serialized;
}

async function runProbe(apiKeyValue, remoteWorkflowId, waitTimeoutMs, durationSecondsValue) {
  const source = await getWorkflowJson(apiKeyValue, remoteWorkflowId);
  const submittedSource = durationSecondsValue === undefined ? source : overrideDuration(source, durationSecondsValue);
  if (durationSecondsValue !== undefined) console.error(`LIVE_DURATION_OVERRIDE: seconds=${durationSecondsValue}`);
  const graph = importApiGraph(submittedSource);
  const storage = new Storage(":memory:");
  try {
    const projectId = "live-probe-memory";
    storage.registerProject(projectId, "runninghub");
    const projects = new ProjectContextService(storage);
    const workItem = projects.createWorkItem({ project_id: projectId, user_request: "authorized ephemeral Workflow API probe", request_kind: "capability_test" });
    const revisions = new RevisionStore({ persistence: new SqliteRevisionPersistence(storage) });
    const revision = revisions.createWorkflow({ project_id: projectId, workflow_id: `live-probe-${remoteWorkflowId}`, graph, reason: "ephemeral_live_probe" });
    const backend = new WorkflowApiClient({
      profile_id: "runninghub",
      base_url: "https://www.runninghub.ai",
      api_key: apiKeyValue,
      routes: {
        submit: "/task/openapi/create",
        status: "/openapi/v2/query",
        outputs: "/openapi/v2/query",
        upload: "/openapi/v2/media/upload/binary",
        cancel: "/task/openapi/cancel",
      },
    });
    const runner = new DurableWorkflowRunner(storage, backend);
    const plan = {
      id: `live-probe-plan-${remoteWorkflowId}`,
      project_id: projectId,
      work_item_id: workItem.id,
      graph_revision_id: revision.revision_id,
      graph_hash: revision.graph_hash,
      workflow_json: submittedSource,
      asset_bindings: [],
      requirements_hash: "ephemeral-live-probe",
      policy_hash: "ephemeral-live-probe",
      backend_profile_id: "runninghub",
      provider_workflow_id: remoteWorkflowId,
      output_contract: { output_node_ids: revision.graph.output_nodes },
      mode: "capability_test",
    };
    const requestId = `live-probe-${remoteWorkflowId}-${Date.now()}`;
    const job = await runner.run(plan, requestId);
    console.error(`LIVE_SUBMIT: task_id=${job.provider_task_id ?? "unknown"} execution_state=${job.execution_state}`);
    const final = await runner.wait(job.id, waitTimeoutMs, 5_000);
    if (final.execution_state !== "SUCCEEDED" || final.artifact_state !== "READY") {
      throw new Error(`live probe ended with execution_state=${final.execution_state}, artifact_state=${final.artifact_state}`);
    }
    console.error(`LIVE_PASS: task_id=${final.provider_task_id ?? "unknown"} outputs_ready=true`);
  } finally {
    storage.close();
  }
}

async function runStructuralGraphProbe(apiKeyValue, remoteWorkflowId, nodeId, width, height, waitTimeoutMs) {
  const source = await getWorkflowJson(apiKeyValue, remoteWorkflowId);
  const originalGraph = importApiGraph(source);
  const prepared = prepareResizeGraph(originalGraph, { node_id: nodeId, width, height });
  const editedSource = exportApiGraph(prepared.graph);
  const originalHash = hashGraph(originalGraph);
  const editedHash = hashGraph(prepared.graph);
  if (originalHash === editedHash || editedSource === source) throw new Error("structural probe did not change the workflow graph");

  const storage = new Storage(":memory:");
  try {
    const projectId = "live-structural-probe-memory";
    storage.registerProject(projectId, "runninghub");
    const projects = new ProjectContextService(storage);
    const workItem = projects.createWorkItem({ project_id: projectId, user_request: "authorized ephemeral structural graph probe", request_kind: "capability_test" });
    const revisions = new RevisionStore({ persistence: new SqliteRevisionPersistence(storage) });
    const revision = revisions.createWorkflow({ project_id: projectId, workflow_id: `live-structural-probe-${remoteWorkflowId}`, graph: prepared.graph, reason: "ephemeral_structural_live_probe" });
    const backend = new WorkflowApiClient({
      profile_id: "runninghub",
      base_url: "https://www.runninghub.ai",
      api_key: apiKeyValue,
      routes: {
        submit: "/task/openapi/create",
        status: "/openapi/v2/query",
        outputs: "/openapi/v2/query",
        cancel: "/task/openapi/cancel",
      },
    });
    const runner = new DurableWorkflowRunner(storage, backend);
    const plan = {
      id: `live-structural-probe-plan-${remoteWorkflowId}-${Date.now()}`,
      project_id: projectId,
      work_item_id: workItem.id,
      graph_revision_id: revision.revision_id,
      graph_hash: revision.graph_hash,
      workflow_json: editedSource,
      asset_bindings: [],
      requirements_hash: "ephemeral-structural-live-probe",
      policy_hash: "ephemeral-structural-live-probe",
      backend_profile_id: "runninghub",
      provider_workflow_id: remoteWorkflowId,
      output_contract: {
        output_node_ids: revision.graph.output_nodes,
        structural_probe: { node_id: prepared.node_id, width: prepared.after.width, height: prepared.after.height },
      },
      mode: "capability_test",
    };
    const job = await runner.run(plan, `live-structural-probe-${remoteWorkflowId}-${Date.now()}`);
    console.error(`LIVE_STRUCTURAL_SUBMIT: node_id=${prepared.node_id} graph_hash_changed=true execution_state=${job.execution_state}`);
    const final = await runner.wait(job.id, waitTimeoutMs, 5_000);
    if (final.execution_state !== "SUCCEEDED" || final.artifact_state !== "READY") {
      throw new Error(`structural graph probe ended with execution_state=${final.execution_state}, artifact_state=${final.artifact_state}`);
    }
    console.error(`LIVE_PASS: structural_graph=true resize_node=${prepared.node_id} output_ready=true`);
  } finally {
    storage.close();
  }
}

async function runCancelProbe(apiKeyValue, remoteWorkflowId) {
  const source = await getWorkflowJson(apiKeyValue, remoteWorkflowId);
  const graph = importApiGraph(source);
  const storage = new Storage(":memory:");
  try {
    const projectId = "live-cancel-probe-memory";
    storage.registerProject(projectId, "runninghub");
    const projects = new ProjectContextService(storage);
    const workItem = projects.createWorkItem({ project_id: projectId, user_request: "authorized ephemeral Workflow API cancel probe", request_kind: "capability_test" });
    const revisions = new RevisionStore({ persistence: new SqliteRevisionPersistence(storage) });
    const revision = revisions.createWorkflow({ project_id: projectId, workflow_id: `live-cancel-probe-${remoteWorkflowId}`, graph });
    const backend = new WorkflowApiClient({
      profile_id: "runninghub",
      base_url: "https://www.runninghub.ai",
      api_key: apiKeyValue,
      routes: {
        submit: "/task/openapi/create",
        status: "/openapi/v2/query",
        outputs: "/openapi/v2/query",
        cancel: "/task/openapi/cancel",
      },
    });
    const runner = new DurableWorkflowRunner(storage, backend);
    const plan = {
      id: `live-cancel-probe-plan-${remoteWorkflowId}-${Date.now()}`,
      project_id: projectId,
      work_item_id: workItem.id,
      graph_revision_id: revision.revision_id,
      graph_hash: revision.graph_hash,
      workflow_json: source,
      asset_bindings: [],
      requirements_hash: "ephemeral-cancel-live-probe",
      policy_hash: "ephemeral-cancel-live-probe",
      backend_profile_id: "runninghub",
      provider_workflow_id: remoteWorkflowId,
      output_contract: { output_node_ids: revision.graph.output_nodes },
      mode: "capability_test",
    };
    const job = await runner.run(plan, `live-cancel-probe-${remoteWorkflowId}-${Date.now()}`);
    if (!job.provider_task_id) throw new Error("cancel probe submit did not return a provider task ID");
    console.error(`LIVE_CANCEL_SUBMIT: task_id=${job.provider_task_id} execution_state=${job.execution_state}`);
    const cancelled = await runner.cancel(job.id);
    if (cancelled.execution_state !== "CANCELLED" || cancelled.provider_state !== "CANCELLED") {
      throw new Error(`cancel probe returned execution_state=${cancelled.execution_state}, provider_state=${cancelled.provider_state}`);
    }
    console.error("LIVE_PASS: cancel=true provider_state=CANCELLED");
  } finally {
    storage.close();
  }
}

async function runExpiryProbe(apiKeyValue, providerTaskId) {
  const backend = new WorkflowApiClient({
    profile_id: "runninghub",
    base_url: "https://www.runninghub.ai",
    api_key: apiKeyValue,
    routes: { submit: "/task/openapi/create", status: "/openapi/v2/query", outputs: "/openapi/v2/query", cancel: "/task/openapi/cancel" },
  });
  const status = await backend.status(providerTaskId);
  const terminalCodes = new Set(["TASK_EXPIRED", "TASK_NOT_FOUND", "NOT_FOUND", "NOTFOUND"]);
  const terminalMessage = status.error_message?.toUpperCase() ?? "";
  const terminalMarker = /(?:TASK|JOB).*(?:EXPIRED|NOT FOUND|DOES NOT EXIST)/.test(terminalMessage) || terminalMessage === "EXPIRED" || terminalMessage === "NOT_FOUND";
  if (status.state !== "FAILED" || !status.error_code || (!terminalCodes.has(status.error_code.toUpperCase()) && !terminalMarker)) {
    throw new Error(`expiry probe returned state=${status.state} code=${status.error_code ?? "unknown"}; no explicit provider expiry/not-found marker`);
  }
  const reason = /EXPIRED/.test(terminalMessage) || status.error_code.toUpperCase().includes("EXPIRED") ? "expired" : "not_found";
  console.error(`LIVE_PASS: provider_reconciliation=true reason=${reason} terminal=${status.error_code.toUpperCase()}`);
}

async function recoverProbe(apiKeyValue, providerTaskId, waitTimeoutMs) {
  const storage = new Storage(":memory:");
  try {
    const projectId = "live-recovery-memory";
    storage.registerProject(projectId, "runninghub");
    const projects = new ProjectContextService(storage);
    const workItem = projects.createWorkItem({ project_id: projectId, user_request: "authorized ephemeral Workflow API recovery probe", request_kind: "capability_test" });
    const revisions = new RevisionStore({ persistence: new SqliteRevisionPersistence(storage) });
    const revision = revisions.createWorkflow({ project_id: projectId, workflow_id: `live-recovery-${providerTaskId}` });
    const backend = new WorkflowApiClient({
      profile_id: "runninghub",
      base_url: "https://www.runninghub.ai",
      api_key: apiKeyValue,
      routes: { submit: "/task/openapi/create", status: "/openapi/v2/query", outputs: "/openapi/v2/query", cancel: "/task/openapi/cancel" },
    });
    const runner = new DurableWorkflowRunner(storage, backend);
    const plan = {
      id: `live-recovery-plan-${providerTaskId}`,
      project_id: projectId,
      work_item_id: workItem.id,
      graph_revision_id: revision.revision_id,
      graph_hash: revision.graph_hash,
      workflow_json: "{}",
      asset_bindings: [],
      requirements_hash: "ephemeral-live-recovery",
      policy_hash: "ephemeral-live-recovery",
      backend_profile_id: "runninghub",
      output_contract: {},
      mode: "capability_test",
    };
    runner.prepare(plan);
    const row = storage.reserveJob(projectId, plan.id, `live-recovery-request-${providerTaskId}`);
    storage.recordProviderTask(row.id, providerTaskId);
    const final = await runner.wait(row.id, waitTimeoutMs, 5_000);
    if (final.execution_state === "SUCCEEDED" && final.artifact_state === "READY") {
      console.error(`LIVE_PASS: recovered_task_id=${providerTaskId} outputs_ready=true`);
      return;
    }
    if (final.execution_state === "RUNNING") {
      console.error(`LIVE_PENDING: recovered_task_id=${providerTaskId} remains RUNNING after bounded wait; no submit was repeated.`);
      process.exitCode = 2;
      return;
    }
    throw new Error(`recovered task ended with execution_state=${final.execution_state}, artifact_state=${final.artifact_state}`);
  } finally {
    storage.close();
  }
}

async function runResultResourceProbe(apiKeyValue, providerTaskId) {
  const root = mkdtempSync(join(tmpdir(), "runninghub-mcp-live-result-resource-"));
  mkdirSync(join(root, "outputs"), { recursive: true });
  const storage = new Storage(":memory:");
  let server;
  let client;
  try {
    const projectId = "live-result-resource-memory";
    const projects = new ProjectContextService(storage);
    projects.registerProject({ project_id: projectId, canonical_root: root, backend_profile_id: "runninghub", output_root: "outputs" });
    const workItem = projects.createWorkItem({ project_id: projectId, user_request: "authorized read-only result resource probe", request_kind: "capability_test" });
    const revisions = new RevisionStore({ persistence: new SqliteRevisionPersistence(storage) });
    const revision = revisions.createWorkflow({ project_id: projectId, workflow_id: `live-result-resource-${providerTaskId}`, graph: createEmptyGraph(), reason: "read_only_result_resource_probe" });
    const plan = {
      id: `live-result-resource-plan-${providerTaskId}`,
      project_id: projectId,
      work_item_id: workItem.id,
      graph_revision_id: revision.revision_id,
      graph_hash: revision.graph_hash,
      workflow_json: "{}",
      asset_bindings: [],
      requirements_hash: "read-only-result-resource-probe",
      policy_hash: "read-only-result-resource-probe",
      backend_profile_id: "runninghub",
      output_contract: {},
      mode: "capability_test",
    };
    storage.saveExecutionPlan(planToRow(plan));
    const job = storage.reserveJob(projectId, plan.id, `live-result-resource-request-${providerTaskId}`);
    storage.claimSubmit(job.id, `read-only:${job.id}`);
    storage.recordProviderTask(job.id, providerTaskId);
    storage.markProviderStatus(job.id, "SUCCESS", "PENDING");

    const config = {
      dataDir: root,
      dbPath: ":memory:",
      catalogDir: join(process.cwd(), "data", "upstream"),
      profileId: "runninghub",
      workflowApi: {
        profile_id: "runninghub",
        base_url: "https://www.runninghub.ai",
        api_key: apiKeyValue,
        routes: {
          submit: "/task/openapi/create",
          status: "/openapi/v2/query",
          outputs: "/openapi/v2/query",
          upload: "/openapi/v2/media/upload/binary",
          cancel: "/task/openapi/cancel",
        },
      },
    };
    server = createServer(config, storage);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "runninghub-live-result-resource-probe", version: "0.1.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const result = await client.callTool({ name: "rh_get_results", arguments: { job_id: job.id } });
    if (result.isError) {
      const errorText = result.content.find((item) => item.type === "text")?.text;
      let error;
      try {
        error = errorText ? JSON.parse(errorText).error : undefined;
      } catch {
        error = undefined;
      }
      const code = typeof error?.code === "string" ? error.code : "UNKNOWN";
      const message = typeof error?.message === "string" ? error.message.replace(/https?:\/\/\S+/gi, "[redacted-url]") : "unknown MCP error";
      throw new Error(`rh_get_results returned MCP error ${code}: ${message}`);
    }
    const text = result.content.find((item) => item.type === "text")?.text;
    const payload = text ? JSON.parse(text) : undefined;
    const resourceLink = result.content.find((item) => item.type === "resource_link");
    const resourceUri = resourceLink && "uri" in resourceLink ? resourceLink.uri : undefined;
    if (payload?.ok !== true || !resourceUri || payload.data?.results?.length !== 1) throw new Error("rh_get_results did not return one result resource link.");
    const resource = await client.readResource({ uri: resourceUri });
    const content = resource.contents[0];
    if (!content || typeof content.blob !== "string" || content.mimeType !== payload.data.results[0].mime) throw new Error("resources/read did not return the downloaded result blob.");
    console.error(`LIVE_PASS: result_resource=true mime=${content.mimeType} bytes=${Buffer.from(content.blob, "base64").length}`);
  } finally {
    if (client) await client.close().catch(() => undefined);
    if (server) await server.close().catch(() => undefined);
    storage.close();
    rmSync(root, { recursive: true, force: true });
  }
}

async function getWorkflowJson(apiKeyValue, remoteWorkflowId) {
  const response = await fetch("https://www.runninghub.ai/api/openapi/getJsonApiFormat", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKeyValue}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ apiKey: apiKeyValue, workflowId: remoteWorkflowId }),
  });
  const body = await parseResponse(response);
  const code = body && typeof body === "object" ? body.code : undefined;
  if (code !== undefined && !["0", "200"].includes(String(code))) throw new Error(`workflow JSON lookup returned provider code ${String(code)}`);
  const prompt = body && typeof body === "object" && body.data && typeof body.data === "object" ? body.data.prompt : undefined;
  if (typeof prompt !== "string" || !prompt.trim()) throw new Error("workflow JSON lookup returned no API-format prompt");
  return prompt;
}

async function parseResponse(response) {
  const text = await response.text();
  if (!response.ok) throw new Error(`RunningHub HTTP ${response.status}`);
  try {
    return parseLossless(text);
  } catch {
    throw new Error("RunningHub returned non-JSON content");
  }
}
