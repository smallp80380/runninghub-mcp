import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { SubmitUnknownError } from "../../dist/execution/types.js";
import { WorkflowApiClient } from "../../dist/backends/workflow-api/client.js";
import { AssetProvider } from "../../dist/execution/assets.js";
import { DurableWorkflowRunner } from "../../dist/execution/runner.js";
import { RevisionStore } from "../../dist/graph/revisions.js";
import { SqliteRevisionPersistence } from "../../dist/storage/revisions.js";
import { ProjectContextService } from "../../dist/projects/context.js";
import { Storage } from "../../dist/storage/database.js";
import { AppError } from "../../dist/errors.js";

class FakeBackend {
  profile_id = "fake-profile";
  api_family = "synthetic";
  submit_calls = 0;
  status_calls = 0;
  output_calls = 0;
  upload_calls = 0;
  uploaded_inputs = [];
  submitted_workflows = [];
  output_failures = 0;
  mode = "success";
  constructor() {
    this.statuses = new Map();
  }
  async submit() {
    this.submit_calls += 1;
    this.submitted_workflows.push(arguments[0].workflow_json);
    if (this.mode === "unknown") throw new SubmitUnknownError("fake timeout after POST");
    if (this.mode === "rejected") throw new AppError("PROVIDER_ERROR", "fake workflow rejection", { recoverable: false, context: { outcome: "rejected" } });
    if (this.mode === "missing-task") throw new AppError("PROVIDER_ERROR", "HTTP submit response did not contain a provider task ID.", { recoverable: false, context: { outcome: "rejected", charge: "unknown_or_not_started" } });
    const taskId = `fake-task-${this.submit_calls}`;
    this.statuses.set(taskId, this.mode === "failed" ? "FAILED" : "SUCCESS");
    return { task_id: taskId };
  }
  async status(taskId) {
    this.status_calls += 1;
    if (this.mode === "expired") return { task_id: taskId, state: "FAILED", error_code: "TASK_EXPIRED", error_message: "task expired" };
    const state = this.statuses.get(taskId) ?? "FAILED";
    return { task_id: taskId, state };
  }
  async outputs(taskId) {
    this.output_calls += 1;
    if (this.output_failures > 0) {
      this.output_failures -= 1;
      throw new Error("temporary output download failure");
    }
    if (this.mode === "empty") return { outputs: [] };
    return { outputs: [{ id: `${taskId}:0`, url: "https://cdn.example/output.png", mime: "image/png" }] };
  }
  async cancel(taskId) {
    this.statuses.set(taskId, "CANCEL");
    return { task_id: taskId, state: "CANCEL" };
  }
  async upload(input) {
    this.upload_calls += 1;
    this.uploaded_inputs.push(input);
    return { kind: "provider_file", value: `uploaded/${input.filename}` };
  }
}

function createHarness(dbPath = ":memory:") {
  const storage = new Storage(dbPath);
  storage.registerProject("execution-project");
  const context = new ProjectContextService(storage);
  const workItem = context.createWorkItem({ project_id: "execution-project", user_request: "synthetic run", request_kind: "image" });
  const revisions = new RevisionStore({ persistence: new SqliteRevisionPersistence(storage) });
  const revision = revisions.createWorkflow({ project_id: "execution-project", workflow_id: `workflow-${workItem.id}` });
  const backend = new FakeBackend();
  const runner = new DurableWorkflowRunner(storage, backend);
  const plan = {
    id: `plan-${workItem.id}`,
    project_id: "execution-project",
    work_item_id: workItem.id,
    graph_revision_id: revision.revision_id,
    graph_hash: revision.graph_hash,
    workflow_json: "{}",
    asset_bindings: [],
    requirements_hash: "requirements",
    policy_hash: "policy",
    backend_profile_id: backend.profile_id,
    output_contract: { output_node_ids: [] },
    mode: "capability_test",
  };
  return { storage, backend, runner, plan, context, revisions };
}

test("concurrent calls for one plan create one job and one submit", async () => {
  const h = createHarness();
  try {
    const [first, second] = await Promise.all([h.runner.run(h.plan, "request-1"), h.runner.run(h.plan, "request-1")]);
    assert.equal(first.id, second.id);
    assert.equal(h.backend.submit_calls, 1);
    assert.equal(first.attempts, 1);
  } finally {
    h.storage.close();
  }
});

test("review chain gate blocks active and unreviewed work, then releases after review", async () => {
  const h = createHarness();
  try {
    const first = await h.runner.run(h.plan, "chain-request-1");
    const repeated = await h.runner.run(h.plan, "chain-request-retry");
    assert.equal(repeated.id, first.id);

    const chainId = h.context.getWorkItem(h.plan.work_item_id).chain_id;
    const nextWorkItem = h.context.createWorkItem({ project_id: "execution-project", chain_id: chainId, user_request: "next chain step", request_kind: "image" });
    const nextRevision = h.revisions.createWorkflow({ project_id: "execution-project", workflow_id: `workflow-${nextWorkItem.id}` });
    const nextPlan = { ...h.plan, id: `plan-${nextWorkItem.id}`, work_item_id: nextWorkItem.id, graph_revision_id: nextRevision.revision_id, graph_hash: nextRevision.graph_hash };

    await assert.rejects(
      () => h.runner.run(nextPlan, "chain-request-2"),
      (error) => error?.code === "REVIEW_PENDING" && error.context?.reason === "execution_active",
    );
    assert.equal(h.storage.getJobByPlan(nextPlan.id), undefined);

    h.storage.markProviderStatus(first.id, "SUCCESS", "READY");
    h.storage.saveResult({
      id: "chain-result-1",
      job_id: first.id,
      output_id: "output-1",
      schema_version: "1",
      relative_path: "outputs/chain-result-1.png",
      mime: "image/png",
      size_bytes: 1,
      content_hash: "chain-result-hash",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await assert.rejects(
      () => h.runner.run(nextPlan, "chain-request-3"),
      (error) => error?.code === "REVIEW_PENDING" && error.context?.reason === "review_pending",
    );

    h.storage.saveReviewEvent({
      id: "chain-review-1",
      job_id: first.id,
      result_id: "chain-result-1",
      output_hash: "chain-result-hash",
      decision: "APPROVED",
      feedback: null,
      user_message_ref: "message-chain-1",
      created_at: new Date().toISOString(),
    });
    const released = await h.runner.run(nextPlan, "chain-request-4");
    assert.equal(released.execution_state, "RUNNING");
    assert.equal(h.backend.submit_calls, 2);
  } finally {
    h.storage.close();
  }
});

test("lost submit response becomes SUBMIT_UNKNOWN and is never retried blindly", async () => {
  const h = createHarness();
  h.backend.mode = "unknown";
  try {
    const first = await h.runner.run(h.plan, "request-unknown");
    assert.equal(first.execution_state, "SUBMIT_UNKNOWN");
    assert.equal(first.attempts, 1);
    const second = await h.runner.run(h.plan, "request-unknown");
    assert.equal(second.execution_state, "SUBMIT_UNKNOWN");
    assert.equal(h.backend.submit_calls, 1);
    const recovered = await h.runner.recover(first.id, 0);
    assert.equal(recovered.execution_state, "SUBMIT_UNKNOWN");
  } finally {
    h.storage.close();
  }
});

test("deterministic provider submit rejection is failed with its original error", async () => {
  const h = createHarness();
  h.backend.mode = "rejected";
  try {
    await assert.rejects(
      () => h.runner.run(h.plan, "request-rejected"),
      (error) => error?.code === "PROVIDER_ERROR" && error.message === "fake workflow rejection",
    );
    const job = h.storage.getJobByPlan(h.plan.id);
    assert.equal(job.execution_state, "FAILED");
    assert.equal(job.provider_state, "FAILED");
    assert.equal(h.backend.submit_calls, 1);
  } finally {
    h.storage.close();
  }
});

test("missing provider task ID is durably failed without a retry", async () => {
  const h = createHarness();
  h.backend.mode = "missing-task";
  try {
    await assert.rejects(() => h.runner.run(h.plan, "request-missing-task"), /did not contain a provider task ID/);
    const job = h.storage.getJobByPlan(h.plan.id);
    assert.equal(job.provider_task_id, null);
    assert.equal(job.execution_state, "FAILED");
    assert.equal(job.charge_status, "unknown_or_not_started");
    assert.equal(h.backend.submit_calls, 1);
    const repeated = await h.runner.run(h.plan, "request-missing-task-2");
    assert.equal(repeated.execution_state, "FAILED");
    assert.equal(h.backend.submit_calls, 1);
  } finally {
    h.storage.close();
  }
});

test("unknown provider submit returns a durable handle without ending the session", async () => {
  const h = createHarness();
  h.backend.submit = async (...args) => {
    h.backend.submit_calls += 1;
    h.backend.submitted_workflows.push(args[0].workflow_json);
    throw new Error("socket closed after submit");
  };
  try {
    const job = await h.runner.run(h.plan, "request-generic-unknown");
    assert.equal(job.execution_state, "SUBMIT_UNKNOWN");
    assert.equal(job.provider_task_id, undefined);
    assert.equal(h.backend.submit_calls, 1);
    const repeated = await h.runner.run(h.plan, "request-generic-unknown");
    assert.equal(repeated.execution_state, "SUBMIT_UNKNOWN");
    assert.equal(h.backend.submit_calls, 1);
  } finally {
    h.storage.close();
  }
});

test("uncertain submits are not released by local cancellation", async () => {
  const unknown = createHarness();
  unknown.backend.mode = "unknown";
  try {
    const job = await unknown.runner.run(unknown.plan, "request-unknown-cancel");
    await assert.rejects(
      () => unknown.runner.cancel(job.id),
      (error) => error?.code === "SUBMIT_UNKNOWN",
    );
    assert.equal(unknown.storage.getJob(job.id).execution_state, "SUBMIT_UNKNOWN");
  } finally {
    unknown.storage.close();
  }

  const inFlight = createHarness();
  try {
    inFlight.runner.prepare(inFlight.plan);
    const reserved = inFlight.storage.reserveJob(inFlight.plan.project_id, inFlight.plan.id, "request-in-flight-cancel");
    assert.equal(inFlight.storage.claimSubmit(reserved.id, `submit:${reserved.id}`), true);
    const preserved = await inFlight.runner.cancel(reserved.id);
    assert.equal(preserved.execution_state, "SUBMIT_UNKNOWN");
  } finally {
    inFlight.storage.close();
  }
});

test("a supplied provider task ID reconciles SUBMIT_UNKNOWN without another submit", async () => {
  const h = createHarness();
  h.backend.mode = "unknown";
  try {
    const unknown = await h.runner.run(h.plan, "request-reconcile");
    assert.equal(unknown.execution_state, "SUBMIT_UNKNOWN");
    assert.equal(h.storage.attachProviderTask(unknown.id, "late-task-1"), true);
    h.backend.statuses.set("late-task-1", "SUCCESS");
    const reconciled = await h.runner.recover(unknown.id, 100);
    assert.equal(reconciled.execution_state, "SUCCEEDED");
    assert.equal(reconciled.provider_task_id, "late-task-1");
    assert.equal(reconciled.artifact_state, "READY");
    assert.equal(h.backend.submit_calls, 1);
    assert.equal(h.backend.status_calls, 1);
    assert.equal(h.backend.output_calls, 1);
    assert.equal(h.storage.attachProviderTask(unknown.id, "late-task-2"), false);
  } finally {
    h.storage.close();
  }
});

test("crash after submit intent recovers as SUBMIT_UNKNOWN without a provider submit", async () => {
  const h = createHarness();
  try {
    h.runner.prepare(h.plan);
    const reserved = h.storage.reserveJob(h.plan.project_id, h.plan.id, "request-crash");
    assert.equal(h.storage.claimSubmit(reserved.id, `submit:${reserved.id}`), true);
    const recovered = await h.runner.recover(reserved.id, 0);
    assert.equal(recovered.execution_state, "SUBMIT_UNKNOWN");
    const repeated = await h.runner.run(h.plan, "request-crash");
    assert.equal(repeated.execution_state, "SUBMIT_UNKNOWN");
    assert.equal(h.backend.submit_calls, 0);
  } finally {
    h.storage.close();
  }
});

test("provider task expiry is reconciled after restart without outputs or another submit", async () => {
  const dir = mkdtempSync(join(tmpdir(), "runninghub-mcp-reconcile-"));
  const dbPath = join(dir, "state.sqlite");
  const h = createHarness(dbPath);
  try {
    const job = await h.runner.run(h.plan, "request-expired");
    h.backend.mode = "expired";
    h.storage.close();

    const recoveredStorage = new Storage(dbPath);
    try {
      const recovered = await new DurableWorkflowRunner(recoveredStorage, h.backend).recover(job.id, 0);
      assert.equal(recovered.execution_state, "FAILED");
      assert.equal(recovered.provider_state, "FAILED");
      assert.equal(recovered.provider_task_id, "fake-task-1");
      assert.equal(h.backend.submit_calls, 1);
      assert.equal(h.backend.output_calls, 0);
      assert.equal(h.backend.status_calls, 1);
    } finally {
      recoveredStorage.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("provider output failure is retryable without another submit", async () => {
  const h = createHarness();
  h.backend.output_failures = 1;
  try {
    const job = await h.runner.run(h.plan, "request-output-retry");
    await assert.rejects(() => h.runner.wait(job.id, 100, 1), /temporary output download failure/);
    const retried = await h.runner.wait(job.id, 100, 1);
    assert.equal(retried.execution_state, "SUCCEEDED");
    assert.equal(retried.artifact_state, "READY");
    assert.equal(h.backend.submit_calls, 1);
    assert.equal(h.backend.output_calls, 2);
  } finally {
    h.storage.close();
  }
});

test("same request key cannot point to another plan", async () => {
  const h = createHarness();
  const otherWorkItem = h.context.createWorkItem({ project_id: "execution-project", user_request: "second", request_kind: "image" });
  const otherRevision = h.revisions.createWorkflow({ project_id: "execution-project", workflow_id: `workflow-${otherWorkItem.id}` });
  const otherPlan = { ...h.plan, id: `other-plan-${otherWorkItem.id}`, work_item_id: otherWorkItem.id, graph_revision_id: otherRevision.revision_id, graph_hash: otherRevision.graph_hash };
  try {
    await h.runner.run(h.plan, "request-conflict");
    await assert.rejects(() => h.runner.run(otherPlan, "request-conflict"), /already used for another execution plan/);
    assert.equal(h.backend.submit_calls, 1);
  } finally {
    h.storage.close();
  }
});

test("provider application failure and empty output are not successful results", async () => {
  const failed = createHarness();
  failed.backend.mode = "failed";
  try {
    const job = await failed.runner.run(failed.plan, "request-failed");
    const final = await failed.runner.wait(job.id, 100, 1);
    assert.equal(final.execution_state, "FAILED");
    assert.equal(failed.backend.output_calls, 0);
  } finally {
    failed.storage.close();
  }

  const empty = createHarness();
  empty.backend.mode = "empty";
  try {
    const job = await empty.runner.run(empty.plan, "request-empty");
    const final = await empty.runner.wait(job.id, 100, 1);
    assert.equal(final.execution_state, "SUCCEEDED");
    assert.equal(final.artifact_state, "FAILED");
  } finally {
    empty.storage.close();
  }
});

test("successful status polls outputs without another submit", async () => {
  const h = createHarness();
  try {
    const job = await h.runner.run(h.plan, "request-success");
    const final = await h.runner.wait(job.id, 100, 1);
    assert.equal(final.execution_state, "SUCCEEDED");
    assert.equal(final.artifact_state, "READY");
    assert.equal(h.backend.submit_calls, 1);
    assert.equal(h.backend.output_calls, 1);
  } finally {
    h.storage.close();
  }
});

test("polling persists queued and running provider states", async () => {
  const h = createHarness();
  try {
    const job = await h.runner.run(h.plan, "request-progress");
    h.backend.statuses.set(job.provider_task_id, "RUNNING");
    const observed = await h.runner.wait(job.id, 20, 1);
    assert.equal(observed.execution_state, "RUNNING");
    assert.equal(observed.provider_state, "RUNNING");
    assert.equal(h.backend.output_calls, 0);
  } finally {
    h.storage.close();
  }
});

test("provider cancellation marks the job cancelled without another submit", async () => {
  const h = createHarness();
  try {
    const job = await h.runner.run(h.plan, "request-cancel");
    const cancelled = await h.runner.cancel(job.id);
    assert.equal(cancelled.execution_state, "CANCELLED");
    assert.equal(cancelled.provider_state, "CANCELLED");
    assert.equal(cancelled.provider_task_id, "fake-task-1");
    assert.equal(h.backend.submit_calls, 1);
  } finally {
    h.storage.close();
  }
});

test("Workflow API cancel parses taskStatus and rejects provider application errors", async () => {
  const client = new WorkflowApiClient({
    profile_id: "cancel-profile",
    base_url: "https://api.example.invalid",
    api_key: "redacted-test-key",
    routes: { submit: "/submit", status: "/status", outputs: "/outputs", cancel: "/cancel" },
    fetch_impl: async () => new Response(JSON.stringify({ code: 0, data: { taskStatus: "CANCELLED" } }), { status: 200, headers: { "content-type": "application/json" } }),
  });
  const cancelled = await client.cancel("task-1");
  assert.equal(cancelled.state, "CANCEL");
  assert.equal(cancelled.task_id, "task-1");

  const failed = new WorkflowApiClient({
    profile_id: "cancel-profile",
    base_url: "https://api.example.invalid",
    api_key: "redacted-test-key",
    routes: { submit: "/submit", status: "/status", outputs: "/outputs", cancel: "/cancel" },
    fetch_impl: async () => new Response(JSON.stringify({ code: 400, msg: "task is already finished" }), { status: 200, headers: { "content-type": "application/json" } }),
  });
  await assert.rejects(() => failed.cancel("task-2"), /task is already finished/);
});

test("Workflow API status reconciles explicit expiry and not-found responses", async () => {
  const expired = new WorkflowApiClient({
    profile_id: "reconcile-profile",
    base_url: "https://api.example.invalid",
    api_key: "redacted-test-key",
    routes: { submit: "/submit", status: "/status", outputs: "/outputs" },
    fetch_impl: async () => new Response(JSON.stringify({ code: "TASK_EXPIRED", msg: "task expired" }), { status: 200, headers: { "content-type": "application/json" } }),
  });
  const expiredStatus = await expired.status("task-expired");
  assert.equal(expiredStatus.state, "FAILED");
  assert.equal(expiredStatus.error_code, "TASK_EXPIRED");

  const missing = new WorkflowApiClient({
    profile_id: "reconcile-profile",
    base_url: "https://api.example.invalid",
    api_key: "redacted-test-key",
    routes: { submit: "/submit", status: "/status", outputs: "/outputs" },
    fetch_impl: async () => new Response(JSON.stringify({ data: { taskStatus: "NOT_FOUND" } }), { status: 200, headers: { "content-type": "application/json" } }),
  });
  const missingStatus = await missing.status("task-missing");
  assert.equal(missingStatus.state, "FAILED");
  assert.equal(missingStatus.error_code, "TASK_NOT_FOUND");

  const transient = new WorkflowApiClient({
    profile_id: "reconcile-profile",
    base_url: "https://api.example.invalid",
    api_key: "redacted-test-key",
    routes: { submit: "/submit", status: "/status", outputs: "/outputs" },
    fetch_impl: async () => new Response(JSON.stringify({ code: "TEMPORARY_PROVIDER_ERROR", msg: "try later" }), { status: 200, headers: { "content-type": "application/json" } }),
  });
  await assert.rejects(() => transient.status("task-transient"), /TEMPORARY_PROVIDER_ERROR/);
});

test("registered asset upload is hash-checked, cached, and substituted into the submit snapshot", async () => {
  const root = mkdtempSync(join(tmpdir(), "runninghub-mcp-asset-"));
  mkdirSync(join(root, "assets"), { recursive: true });
  writeFileSync(join(root, "assets", "reference.png"), Buffer.from("reference-v1"));
  const storage = new Storage(":memory:");
  const context = new ProjectContextService(storage);
  const revisions = new RevisionStore({ persistence: new SqliteRevisionPersistence(storage) });
  const backend = new FakeBackend();
  try {
    context.registerProject({ project_id: "asset-project", canonical_root: root, backend_profile_id: backend.profile_id, asset_roots: ["assets"], output_root: "outputs" });
    const asset = context.registerAsset("asset-project", "assets/reference.png", ["reference"]);
    const workItem = context.createWorkItem({ project_id: "asset-project", user_request: "asset run", request_kind: "image" });
    const revision = revisions.createWorkflow({ project_id: "asset-project", workflow_id: `workflow-${workItem.id}` });
    const plan = {
      id: `plan-${workItem.id}`,
      project_id: "asset-project",
      work_item_id: workItem.id,
      graph_revision_id: revision.revision_id,
      graph_hash: revision.graph_hash,
      workflow_json: JSON.stringify({ "1": { class_type: "LoadImage", inputs: { image: `asset://${asset.asset_id}/default` } } }),
      asset_bindings: [{ asset_id: asset.asset_id, content_hash: asset.content_hash }],
      requirements_hash: "requirements",
      policy_hash: "policy",
      backend_profile_id: backend.profile_id,
      output_contract: { output_node_ids: [] },
      mode: "capability_test",
    };
    const runner = new DurableWorkflowRunner(storage, backend);
    await runner.run(plan, "asset-request-1");
    assert.equal(backend.upload_calls, 1);
    assert.equal(backend.uploaded_inputs[0].filename, "reference.png");
    assert.ok(!backend.submitted_workflows[0].includes("asset://"));
    assert.ok(backend.submitted_workflows[0].includes("uploaded/reference.png"));

    const secondWorkItem = context.createWorkItem({ project_id: "asset-project", chain_id: "independent-upload-check", user_request: "asset run again", request_kind: "image" });
    const secondRevision = revisions.createWorkflow({ project_id: "asset-project", workflow_id: `workflow-${secondWorkItem.id}` });
    const secondPlan = { ...plan, id: `plan-${secondWorkItem.id}`, work_item_id: secondWorkItem.id, graph_revision_id: secondRevision.revision_id, graph_hash: secondRevision.graph_hash };
    await runner.run(secondPlan, "asset-request-2");
    assert.equal(backend.upload_calls, 1);

    writeFileSync(join(root, "assets", "reference.png"), Buffer.from("reference-v2"));
    const provider = new AssetProvider(storage);
    await assert.rejects(() => provider.upload({ project_id: "asset-project", asset_id: asset.asset_id, content_hash: asset.content_hash, profile_id: backend.profile_id, backend }), /no longer matches/);
  } finally {
    storage.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("two file-backed stores for one plan still create one job and one submit", async () => {
  const dir = mkdtempSync(join(tmpdir(), "runninghub-mcp-concurrent-"));
  const dbPath = join(dir, "state.sqlite");
  const firstStorage = new Storage(dbPath);
  const secondStorage = new Storage(dbPath);
  const backend = new FakeBackend();
  try {
    firstStorage.registerProject("shared-project");
    const firstContext = new ProjectContextService(firstStorage);
    const firstRevisionStore = new RevisionStore({ persistence: new SqliteRevisionPersistence(firstStorage) });
    const workItem = firstContext.createWorkItem({ project_id: "shared-project", user_request: "shared run", request_kind: "image" });
    const revision = firstRevisionStore.createWorkflow({ project_id: "shared-project", workflow_id: `workflow-${workItem.id}` });
    const plan = { id: `plan-${workItem.id}`, project_id: "shared-project", work_item_id: workItem.id, graph_revision_id: revision.revision_id, graph_hash: revision.graph_hash, workflow_json: "{}", asset_bindings: [], requirements_hash: "requirements", policy_hash: "policy", backend_profile_id: backend.profile_id, output_contract: {}, mode: "capability_test" };
    const firstRunner = new DurableWorkflowRunner(firstStorage, backend);
    const secondRunner = new DurableWorkflowRunner(secondStorage, backend);
    const [first, second] = await Promise.all([firstRunner.run(plan, "shared-request"), secondRunner.run(plan, "shared-request")]);
    assert.equal(first.id, second.id);
    assert.equal(backend.submit_calls, 1);
  } finally {
    firstStorage.close();
    secondStorage.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Workflow API adapter distinguishes HTTP-200 application errors from unknown network submit", async () => {
  const applicationError = new WorkflowApiClient({
    profile_id: "http-profile",
    base_url: "https://api.example.invalid",
    api_key: "redacted-test-key",
    routes: { submit: "/submit", status: "/status", outputs: "/outputs" },
    fetch_impl: async () => new Response(JSON.stringify({ errorCode: "BAD_GRAPH", errorMessage: "graph rejected" }), { status: 200, headers: { "content-type": "application/json" } }),
  });
  await assert.rejects(() => applicationError.submit({ workflow_json: "{}", plan_id: "plan" }), /graph rejected/);

  const networkError = new WorkflowApiClient({
    profile_id: "http-profile",
    base_url: "https://api.example.invalid",
    api_key: "redacted-test-key",
    routes: { submit: "/submit", status: "/status", outputs: "/outputs" },
    fetch_impl: async () => { throw new Error("socket timeout"); },
  });
  await assert.rejects(() => networkError.submit({ workflow_json: "{}", plan_id: "plan" }), (error) => error instanceof SubmitUnknownError);

  let uploadBody;
  const uploadClient = new WorkflowApiClient({
    profile_id: "http-profile",
    base_url: "https://api.example.invalid",
    api_key: "redacted-test-key",
    routes: { upload: "/upload", submit: "/submit", status: "/status", outputs: "/outputs" },
    fetch_impl: async (_url, init) => {
      uploadBody = init.body;
      return new Response(JSON.stringify({ data: { fileName: "server-reference.png" } }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const uploaded = await uploadClient.upload({ asset_id: "asset", content_hash: "hash", filename: "input.png", mime: "image/png", bytes: new Uint8Array([1, 2, 3]) });
  assert.deepEqual(uploaded, { kind: "provider_file", value: "server-reference.png" });
  assert.equal(uploadBody instanceof FormData, true);
  assert.equal(await uploadBody.get("apiKey"), "redacted-test-key");
  assert.equal(await uploadBody.get("fileType"), "input");
  assert.equal(uploadBody.get("file").name, "input.png");

  let v2Body;
  const v2UploadClient = new WorkflowApiClient({
    profile_id: "http-profile",
    base_url: "https://api.example.invalid",
    api_key: "redacted-test-key",
    routes: { upload_v2: "/openapi/v2/media/upload/binary", submit: "/submit", status: "/status", outputs: "/outputs" },
    fetch_impl: async (_url, init) => {
      v2Body = init.body;
      return new Response(JSON.stringify({ data: { filename: "openapi/server-reference.png" } }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const v2Uploaded = await v2UploadClient.uploadV2({ asset_id: "asset", content_hash: "hash", filename: "input.png", mime: "image/png", bytes: new Uint8Array([1, 2, 3]) });
  assert.deepEqual(v2Uploaded, { kind: "provider_file", value: "openapi/server-reference.png" });
  assert.equal(await v2Body.get("apiKey"), null);
  assert.equal(await v2Body.get("fileType"), null);
  assert.equal(v2Body.get("file").name, "input.png");
});

test("Workflow API preserves deterministic HTTP submit rejection details", async () => {
  const rejected = new WorkflowApiClient({
    profile_id: "http-rejection-profile",
    base_url: "https://api.example.invalid",
    api_key: "redacted-test-key",
    routes: { submit: "/submit", status: "/status", outputs: "/outputs" },
    fetch_impl: async () => new Response(JSON.stringify({ code: 400, msg: "workflowId is required" }), { status: 400, headers: { "content-type": "application/json" } }),
  });
  await assert.rejects(
    () => rejected.submit({ workflow_json: "{}", plan_id: "plan" }),
    (error) => error?.code === "PROVIDER_ERROR"
      && error.context?.outcome === "rejected"
      && error.context?.http_status === "400"
      && error.context?.provider_code === "400"
      && error.context?.provider_response === undefined
      && error.message === "workflowId is required",
  );
});

test("Workflow API legacy full-graph submit keeps the legacy payload", async () => {
  let requestedUrl;
  let requestBody;
  const client = new WorkflowApiClient({
    profile_id: "new-graph-profile",
    base_url: "https://api.example.invalid",
    api_key: "redacted-test-key",
    routes: { submit: "/task/openapi/create", status: "/status", outputs: "/outputs" },
    fetch_impl: async (url, init) => {
      requestedUrl = String(url);
      requestBody = JSON.parse(String(init.body));
      assert.equal(init.headers.Host, "api.example.invalid");
      return new Response(JSON.stringify({ taskId: "new-graph-task" }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });

  const submitted = await client.submit({ workflow_json: '{"1":{"class_type":"Save","inputs":{}}}', plan_id: "new-graph-plan", workflow_id: "2097177175284154370", submit_mode: "legacy_graph" });
  assert.equal(submitted.task_id, "new-graph-task");
  assert.equal(new URL(requestedUrl).pathname, "/task/openapi/create");
  assert.equal(requestBody.workflow, '{"1":{"class_type":"Save","inputs":{}}}');
  assert.equal(requestBody.workflowId, "2097177175284154370");
  assert.equal(requestBody.nodeInfoList, undefined);
});

test("Workflow API V2 submit uses nodeInfoList and never sends the full graph", async () => {
  let requestedUrl;
  let requestBody;
  const log = [];
  const apiKey = "secret-api-key";
  const client = new WorkflowApiClient({
    profile_id: "v2-profile",
    base_url: "https://api.example.invalid",
    api_key: apiKey,
    routes: { submit: "/task/openapi/create", submit_v2: "/openapi/v2/run/workflow", status: "/status", outputs: "/outputs" },
    logger: (event) => log.push(event),
    fetch_impl: async (url, init) => {
      requestedUrl = String(url);
      requestBody = JSON.parse(String(init.body));
      assert.equal(init.headers.Host, "api.example.invalid");
      return new Response(JSON.stringify({ taskId: "v2-task" }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const submitted = await client.submit({
    workflow_json: '{"1":{"class_type":"LoadImage","inputs":{"image":"should-not-be-sent"}}}',
    plan_id: "v2-plan",
    workflow_id: "2097424727420821506",
    node_info_list: [{ nodeId: "1", fieldName: "image", fieldValue: "api/uploaded.png" }],
  });
  assert.equal(submitted.task_id, "v2-task");
  assert.equal(new URL(requestedUrl).pathname, "/openapi/v2/run/workflow/2097424727420821506");
  assert.deepEqual(requestBody.nodeInfoList, [{ nodeId: "1", fieldName: "image", fieldValue: "api/uploaded.png" }]);
  assert.equal(requestBody.workflow, undefined);
  assert.equal(JSON.stringify(log).includes(apiKey), false);
});

test("Workflow API nested invalid-image response is deterministic and has no retry", async () => {
  const client = new WorkflowApiClient({
    profile_id: "validation-profile",
    base_url: "https://api.example.invalid",
    api_key: "redacted-test-key",
    routes: { submit: "/task/openapi/create", status: "/status", outputs: "/outputs" },
    fetch_impl: async () => new Response(JSON.stringify({ error: { message: JSON.stringify({ code: "prompt_outputs_failed_validation", message: "Invalid image file", prompt: "private-prompt" }) } }), { status: 200, headers: { "content-type": "application/json" } }),
  });
  await assert.rejects(
    () => client.submit({ workflow_json: "{}", plan_id: "validation-plan" }),
    (error) => error?.code === "PROVIDER_ERROR" && error?.recoverable === false && error?.context?.retry === "never" && /prompt_outputs_failed_validation/.test(error.message) && !error.message.includes("private-prompt"),
  );
});

test("Workflow API rejects non-loopback HTTP bases and cross-origin routes", () => {
  const routes = { submit: "/submit", status: "/status", outputs: "/outputs" };
  assert.throws(
    () => new WorkflowApiClient({ profile_id: "url-profile", base_url: "http://localhost.evil", api_key: "redacted-test-key", routes }),
    /must be HTTPS/,
  );
  assert.throws(
    () => new WorkflowApiClient({ profile_id: "url-profile", base_url: "https://api.example.invalid", api_key: "redacted-test-key", routes: { ...routes, submit: "https://evil.example/submit" } }),
    /configured base URL/,
  );
});

test("Workflow API submit timeout covers a response body that honors abort", async () => {
  const client = new WorkflowApiClient({
    profile_id: "body-timeout-profile",
    base_url: "https://api.example.invalid",
    api_key: "redacted-test-key",
    timeout_ms: 10,
    routes: { submit: "/submit", status: "/status", outputs: "/outputs" },
    fetch_impl: async (_url, init) => ({
      ok: true,
      status: 200,
      text: () => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })),
    }),
  });
  await assert.rejects(() => client.submit({ workflow_json: "{}", plan_id: "body-timeout" }), (error) => error instanceof SubmitUnknownError);
});

test("Workflow API missing taskId is failed with unknown-or-not-started charge", async () => {
  const client = new WorkflowApiClient({
    profile_id: "missing-task-profile",
    base_url: "https://api.example.invalid",
    api_key: "redacted-test-key",
    routes: { submit: "/task/openapi/create", status: "/status", outputs: "/outputs" },
    fetch_impl: async () => new Response(JSON.stringify({ code: 0, data: { taskStatus: "QUEUED" } }), { status: 200, headers: { "content-type": "application/json" } }),
  });
  await assert.rejects(
    () => client.submit({ workflow_json: "{}", plan_id: "missing-task-plan" }),
    (error) => error?.code === "PROVIDER_ERROR" && error?.context?.charge === "unknown_or_not_started" && error?.context?.outcome === "rejected",
  );
});

test("Workflow API ignores output entries without a usable download URL", async () => {
  const client = new WorkflowApiClient({
    profile_id: "outputs-profile",
    base_url: "https://api.example.invalid",
    api_key: "redacted-test-key",
    routes: { submit: "/submit", status: "/status", outputs: "/outputs" },
    fetch_impl: async () => new Response(JSON.stringify({ data: { results: [{ id: "missing-url" }, { id: "valid", fileUrl: "https://cdn.example/output.png" }] } }), { status: 200, headers: { "content-type": "application/json" } }),
  });
  const output = await client.outputs("task-outputs");
  assert.deepEqual(output.outputs, [{ id: "valid", url: "https://cdn.example/output.png" }]);
});
