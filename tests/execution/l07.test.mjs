import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { WorkflowApiClient } from "../../dist/backends/workflow-api/client.js";
import { AssetProvider } from "../../dist/execution/assets.js";
import { DurableWorkflowRunner } from "../../dist/execution/runner.js";
import { ProjectContextService } from "../../dist/projects/context.js";
import { RevisionStore } from "../../dist/graph/revisions.js";
import { SqliteRevisionPersistence } from "../../dist/storage/revisions.js";
import { Storage } from "../../dist/storage/database.js";

class FakeLoraBackend {
  profile_id = "lora-profile";
  api_family = "workflow_api";
  media_upload_calls = 0;
  lora_upload_calls = 0;
  submit_calls = 0;
  submitted_workflows = [];

  async upload() {
    this.media_upload_calls += 1;
    throw new Error("regular media upload must not receive a LoRA asset");
  }

  async uploadLora(input) {
    this.lora_upload_calls += 1;
    assert.equal(input.filename, "style.safetensors");
    return { kind: "provider_lora", value: "api-lora-cn/style-hash.safetensors" };
  }

  async submit(input) {
    this.submit_calls += 1;
    this.submitted_workflows.push(input.workflow_json);
    return { task_id: `task-${this.submit_calls}` };
  }

  async status(taskId) { return { task_id: taskId, state: "SUCCESS" }; }
  async outputs(taskId) { return { outputs: [{ id: `${taskId}:0`, url: "https://cdn.example/output.png" }] }; }
  async cancel(taskId) { return { task_id: taskId, state: "CANCEL" }; }
}

function createHarness(classType = "RHLoraLoader") {
  const root = mkdtempSync(join(tmpdir(), "runninghub-mcp-l07-"));
  mkdirSync(join(root, "assets"), { recursive: true });
  writeFileSync(join(root, "assets", "style.safetensors"), Buffer.from("synthetic-lora-bytes"));
  const storage = new Storage(":memory:");
  const context = new ProjectContextService(storage);
  const backend = new FakeLoraBackend();
  context.registerProject({ project_id: "lora-project", canonical_root: root, backend_profile_id: backend.profile_id, asset_roots: ["assets"], output_root: "outputs" });
  const asset = context.registerAsset("lora-project", "assets/style.safetensors", ["lora"]);
  const workItem = context.createWorkItem({ project_id: "lora-project", user_request: "lora test", request_kind: "image" });
  const revisions = new RevisionStore({ persistence: new SqliteRevisionPersistence(storage) });
  const revision = revisions.createWorkflow({
    project_id: "lora-project",
    workflow_id: `workflow-${workItem.id}`,
    graph: {
      schema_version: "1",
      nodes: {
        loader: {
          id: "loader",
          class_type: classType,
          schema_revision: "1",
          inputs: { lora_name: { kind: "asset", asset_id: asset.asset_id, representation: "lora" } },
        },
      },
      output_nodes: ["loader"],
      metadata: {},
    },
  });
  const plan = {
    id: `plan-${workItem.id}`,
    project_id: "lora-project",
    work_item_id: workItem.id,
    graph_revision_id: revision.revision_id,
    graph_hash: revision.graph_hash,
    workflow_json: JSON.stringify({ loader: { class_type: classType, inputs: { lora_name: `asset://${asset.asset_id}/lora` } } }),
    asset_bindings: [{ asset_id: asset.asset_id, content_hash: asset.content_hash }],
    requirements_hash: "requirements",
    policy_hash: "policy",
    backend_profile_id: backend.profile_id,
    output_contract: { output_node_ids: ["loader"] },
    mode: "capability_test",
  };
  return { root, storage, context, asset, workItem, backend, runner: new DurableWorkflowRunner(storage, backend), plan };
}

test("LoRA upload uses a separate tagged cache and runner never calls regular media upload", async () => {
  const h = createHarness();
  try {
    const job = await h.runner.run(h.plan, "lora-request");
    assert.equal(job.execution_state, "RUNNING");
    assert.equal(h.backend.lora_upload_calls, 1);
    assert.equal(h.backend.media_upload_calls, 0);
    assert.equal(h.backend.submit_calls, 1);
    assert.match(h.backend.submitted_workflows[0], /api-lora-cn\/style-hash\.safetensors/);
    const cached = await new AssetProvider(h.storage).uploadLora({
      project_id: "lora-project",
      asset_id: h.asset.asset_id,
      content_hash: h.asset.content_hash,
      profile_id: h.backend.profile_id,
      backend: h.backend,
    });
    assert.deepEqual(cached, { kind: "provider_lora", value: "api-lora-cn/style-hash.safetensors" });
    assert.equal(h.backend.lora_upload_calls, 1);
    await assert.rejects(
      () => new AssetProvider(h.storage).upload({ project_id: "lora-project", asset_id: h.asset.asset_id, content_hash: h.asset.content_hash, profile_id: h.backend.profile_id, backend: h.backend }),
      (error) => error?.code === "CAPABILITY_UNSUPPORTED",
    );
  } finally {
    h.storage.close();
    rmSync(h.root, { recursive: true, force: true });
  }
});

test("LoRA references are scoped to the selected backend profile", async () => {
  const h = createHarness();
  const other = new FakeLoraBackend();
  other.profile_id = "other-profile";
  try {
    await assert.rejects(
      () => new AssetProvider(h.storage).uploadLora({ project_id: "lora-project", asset_id: h.asset.asset_id, content_hash: h.asset.content_hash, profile_id: "other-profile", backend: h.backend }),
      (error) => error?.code === "CAPABILITY_UNKNOWN",
    );
    const uploaded = await new AssetProvider(h.storage).uploadLora({
      project_id: "lora-project",
      asset_id: h.asset.asset_id,
      content_hash: h.asset.content_hash,
      profile_id: other.profile_id,
      backend: other,
    });
    assert.equal(uploaded.kind, "provider_lora");
    assert.equal(other.lora_upload_calls, 1);
  } finally {
    h.storage.close();
    rmSync(h.root, { recursive: true, force: true });
  }
});

test("LoRA asset bound to a non-RHLoraLoader is rejected before submit", async () => {
  const h = createHarness("LoadImage");
  try {
    await assert.rejects(() => h.runner.run(h.plan, "invalid-lora-request"), (error) => error?.code === "INVALID_GRAPH");
    assert.equal(h.backend.lora_upload_calls, 0);
    assert.equal(h.backend.media_upload_calls, 0);
    assert.equal(h.backend.submit_calls, 0);
  } finally {
    h.storage.close();
    rmSync(h.root, { recursive: true, force: true });
  }
});

test("Workflow API LoRA adapter computes MD5 and does not forward bearer auth to signed PUT", async () => {
  const calls = [];
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const client = new WorkflowApiClient({
    profile_id: "lora-profile",
    base_url: "https://api.example.invalid",
    api_key: "redacted-test-key",
    routes: { submit: "/submit", status: "/status", outputs: "/outputs", lora_upload_url: "/api/openapi/getLoraUploadUrl" },
    fetch_impl: async (url, init) => {
      calls.push({ url, init });
      if (init.method === "POST") {
        return new Response(JSON.stringify({ code: 0, data: { fileName: "api-lora-cn/style.safetensors", url: "https://upload.example.invalid/signed?token=redacted" } }), { status: 200 });
      }
      return new Response(null, { status: 200 });
    },
  });
  const reference = await client.uploadLora({ asset_id: "asset", content_hash: "sha256", filename: "style.safetensors", mime: "application/octet-stream", bytes });
  assert.deepEqual(reference, { kind: "provider_lora", value: "api-lora-cn/style.safetensors" });
  assert.equal(calls.length, 2);
  const request = JSON.parse(calls[0].init.body);
  assert.equal(request.apiKey, "redacted-test-key");
  assert.equal(request.loraName, "style");
  assert.equal(request.md5Hex, createHash("md5").update(bytes).digest("hex"));
  assert.equal(calls[1].init.method, "PUT");
  assert.equal(calls[1].init.headers.Authorization, undefined);
  assert.equal(calls[1].init.headers["Content-Type"], "application/octet-stream");
  assert.deepEqual(new Uint8Array(await calls[1].init.body.arrayBuffer()), bytes);
});
