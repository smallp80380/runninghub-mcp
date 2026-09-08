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

    const secondWorkItem = context.createWorkItem({ project_id: "asset-project", user_request: "asset run again", request_kind: "image" });
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
});
