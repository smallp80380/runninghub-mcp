import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { WorkflowApiClient } from "../../dist/backends/workflow-api/client.js";
import { AppError } from "../../dist/errors.js";
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
  submit_mode = "success";
  media_expiry;
  lora_expiry;

  async upload() {
    this.media_upload_calls += 1;
    return { kind: "provider_file", value: "uploaded/media-reference.png", ...(this.media_expiry ? { expires_at: this.media_expiry } : {}) };
  }

  async uploadLora(input) {
    this.lora_upload_calls += 1;
    assert.equal(input.filename, "style.safetensors");
    return { kind: "provider_lora", value: "api-lora-cn/style-hash.safetensors", ...(this.lora_expiry ? { expires_at: this.lora_expiry } : {}) };
  }

  async submit(input) {
    this.submit_calls += 1;
    this.submitted_workflows.push(input.workflow_json);
    if (this.submit_mode === "cache_expired") throw new AppError("PROVIDER_ERROR", "provider file expired", { recoverable: true, context: { outcome: "cache_expired" } });
    return { task_id: `task-${this.submit_calls}` };
  }

  async status(taskId) { return { task_id: taskId, state: "SUCCESS" }; }
  async outputs(taskId) { return { outputs: [{ id: `${taskId}:0`, url: "https://cdn.example/output.png" }] }; }
  async cancel(taskId) { return { task_id: taskId, state: "CANCEL" }; }
}

function png(colorType = 6) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = colorType;
  const chunk = (type, body) => {
    const result = Buffer.alloc(12 + body.length);
    result.writeUInt32BE(body.length, 0);
    Buffer.from(type).copy(result, 4);
    body.copy(result, 8);
    return result;
  };
  const data = chunk("IDAT", Buffer.from([0]));
  const end = chunk("IEND", Buffer.alloc(0));
  return Buffer.concat([signature, chunk("IHDR", header), data, end]);
}

function jpegWithExifOrientation(orientation) {
  const exif = Buffer.alloc(38);
  exif.write("Exif\0\0", 0, "ascii");
  exif.write("II", 6, "ascii");
  exif.writeUInt16LE(42, 8);
  exif.writeUInt32LE(8, 10);
  exif.writeUInt16LE(1, 14);
  exif.writeUInt16LE(0x0112, 16);
  exif.writeUInt16LE(3, 18);
  exif.writeUInt32LE(1, 20);
  exif.writeUInt16LE(orientation, 24);
  const app = Buffer.alloc(exif.length + 2);
  app.writeUInt16BE(app.length, 0);
  exif.copy(app, 2);
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1]), app, Buffer.from([0xff, 0xc0, 0, 7, 8, 0, 1, 0, 1, 0xff, 0xd9])]);
}

function mp4(brand = "isom") {
  const bytes = Buffer.alloc(24);
  bytes.writeUInt32BE(bytes.length, 0);
  bytes.write("ftyp", 4, "ascii");
  bytes.write(brand, 8, "ascii");
  return bytes;
}

function createMediaHarness({ referenceCount = 1, maskColorType, videoCount = 0, exifOrientation } = {}) {
  const root = mkdtempSync(join(tmpdir(), "runninghub-mcp-media-"));
  mkdirSync(join(root, "assets"), { recursive: true });
  const storage = new Storage(":memory:");
  const context = new ProjectContextService(storage);
  const backend = new FakeLoraBackend();
  backend.profile_id = "media-profile";
  context.registerProject({ project_id: "media-project", canonical_root: root, backend_profile_id: backend.profile_id, asset_roots: ["assets"], output_root: "outputs" });
  const assets = [];
  const register = (name, bytes, roles, representation) => {
    writeFileSync(join(root, "assets", name), bytes);
    assets.push({ asset: context.registerAsset("media-project", `assets/${name}`, roles), representation });
  };
  for (let index = 0; index < referenceCount; index += 1) {
    const extension = exifOrientation === undefined ? "png" : "jpg";
    register(`reference-${index}.${extension}`, exifOrientation === undefined ? png() : jpegWithExifOrientation(exifOrientation), ["character"], "reference");
  }
  if (maskColorType !== undefined) {
    register("mask.png", png(maskColorType), ["mask"], "mask");
  }
  for (let index = 0; index < videoCount; index += 1) {
    register(`video-${index}.mp4`, mp4(`is${index}m`), ["video"], "video");
  }
  const workItem = context.createWorkItem({ project_id: "media-project", user_request: "media test", request_kind: "image" });
  const revisions = new RevisionStore({ persistence: new SqliteRevisionPersistence(storage) });
  const revision = revisions.createWorkflow({ project_id: "media-project", workflow_id: `workflow-${workItem.id}` });
  const workflowInputs = Object.fromEntries(assets.map(({ asset, representation }, index) => [
    `ref-${index}`,
    `asset://${asset.asset_id}/${representation}`,
  ]));
  const plan = {
    id: `plan-${workItem.id}`,
    project_id: "media-project",
    work_item_id: workItem.id,
    graph_revision_id: revision.revision_id,
    graph_hash: revision.graph_hash,
    workflow_json: JSON.stringify({ loader: { class_type: "ReferenceLoader", inputs: workflowInputs } }),
    asset_bindings: assets.map(({ asset }) => ({ asset_id: asset.asset_id, content_hash: asset.content_hash })),
    requirements_hash: "requirements",
    policy_hash: "policy",
    backend_profile_id: backend.profile_id,
    output_contract: { output_node_ids: ["loader"] },
    mode: "capability_test",
  };
  return { root, storage, backend, runner: new DurableWorkflowRunner(storage, backend), plan };
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

test("expired media and LoRA cache entries are re-uploaded by a later explicit flow", async () => {
  const media = createMediaHarness();
  try {
    const provider = new AssetProvider(media.storage);
    await provider.upload({ project_id: "media-project", asset_id: media.plan.asset_bindings[0].asset_id, content_hash: media.plan.asset_bindings[0].content_hash, profile_id: media.backend.profile_id, backend: media.backend });
    media.storage.db.prepare("UPDATE provider_uploads SET expires_at = ?").run("2020-01-01T00:00:00.000Z");
    await provider.upload({ project_id: "media-project", asset_id: media.plan.asset_bindings[0].asset_id, content_hash: media.plan.asset_bindings[0].content_hash, profile_id: media.backend.profile_id, backend: media.backend });
    assert.equal(media.backend.media_upload_calls, 2);
  } finally {
    media.storage.close();
    rmSync(media.root, { recursive: true, force: true });
  }

  const lora = createHarness();
  try {
    const provider = new AssetProvider(lora.storage);
    await provider.uploadLora({ project_id: "lora-project", asset_id: lora.asset.asset_id, content_hash: lora.asset.content_hash, profile_id: lora.backend.profile_id, backend: lora.backend });
    lora.storage.db.prepare("UPDATE lora_uploads SET expires_at = ?").run("2020-01-01T00:00:00.000Z");
    await provider.uploadLora({ project_id: "lora-project", asset_id: lora.asset.asset_id, content_hash: lora.asset.content_hash, profile_id: lora.backend.profile_id, backend: lora.backend });
    assert.equal(lora.backend.lora_upload_calls, 2);
  } finally {
    lora.storage.close();
    rmSync(lora.root, { recursive: true, force: true });
  }
});

test("provider cache expiry invalidates linked entries without retrying submit", async () => {
  const h = createMediaHarness();
  try {
    const provider = new AssetProvider(h.storage);
    const binding = h.plan.asset_bindings[0];
    await provider.upload({ project_id: h.plan.project_id, asset_id: binding.asset_id, content_hash: binding.content_hash, profile_id: h.backend.profile_id, backend: h.backend });
    h.backend.submit_mode = "cache_expired";
    await assert.rejects(() => h.runner.run(h.plan, "cache-expired-request"), (error) => error?.context?.outcome === "cache_expired");
    const job = h.storage.getJobByPlan(h.plan.id);
    assert.equal(job.execution_state, "FAILED");
    assert.equal(h.storage.getProviderUpload(h.backend.profile_id, h.backend.api_family, binding.asset_id, binding.content_hash), undefined);
    assert.equal(h.backend.media_upload_calls, 1);
    assert.equal(h.backend.submit_calls, 1);
    const repeated = await h.runner.run(h.plan, "cache-expired-retry");
    assert.equal(repeated.execution_state, "FAILED");
    assert.equal(h.backend.submit_calls, 1);
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
        return new Response(JSON.stringify({ code: 0, data: { fileName: "api-lora-cn/style.safetensors", url: "https://upload.myqcloud.com/signed?token=redacted" } }), { status: 200 });
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

test("Workflow API media upload preserves an explicit cache expiry", async () => {
  const client = new WorkflowApiClient({
    profile_id: "expiry-profile",
    base_url: "https://api.example.invalid",
    api_key: "redacted-test-key",
    routes: { submit: "/submit", status: "/status", outputs: "/outputs", upload: "/upload" },
    fetch_impl: async () => new Response(JSON.stringify({ data: { download_url: "https://cdn.example/asset.png?Expires=4102444800" } }), { status: 200 }),
  });
  const reference = await client.upload({ asset_id: "asset", content_hash: "hash", filename: "asset.png", mime: "image/png", bytes: new Uint8Array([1]) });
  assert.deepEqual(reference, { kind: "provider_url", value: "https://cdn.example/asset.png?Expires=4102444800", expires_at: "2100-01-01T00:00:00.000Z" });
});

test("Workflow API marks an explicit expired provider reference without making it an unknown submit", async () => {
  const client = new WorkflowApiClient({
    profile_id: "expiry-profile",
    base_url: "https://api.example.invalid",
    api_key: "redacted-test-key",
    routes: { submit: "/submit", status: "/status", outputs: "/outputs" },
    fetch_impl: async () => new Response(JSON.stringify({ code: "FILE_NOT_FOUND", msg: "uploaded file not found" }), { status: 200 }),
  });
  await assert.rejects(
    () => client.submit({ workflow_json: "{}", plan_id: "plan" }),
    (error) => error?.code === "PROVIDER_ERROR" && error?.recoverable === true && error?.context?.outcome === "cache_expired",
  );
});

test("media profile rejects too many references before upload or submit", async () => {
  const h = createMediaHarness({ referenceCount: 5 });
  try {
    await assert.rejects(() => h.runner.run(h.plan, "too-many-references"), (error) => error?.code === "INVALID_CONFIGURATION" && /at most 4 image references/.test(error.message));
    assert.equal(h.backend.media_upload_calls, 0);
    assert.equal(h.backend.submit_calls, 0);
  } finally {
    h.storage.close();
    rmSync(h.root, { recursive: true, force: true });
  }
});

test("media profile accepts alpha references and rejects RGB masks", async () => {
  const accepted = createMediaHarness();
  try {
    const job = await accepted.runner.run(accepted.plan, "alpha-reference");
    assert.equal(job.execution_state, "RUNNING");
    assert.equal(accepted.backend.media_upload_calls, 1);
    assert.equal(accepted.backend.submit_calls, 1);
  } finally {
    accepted.storage.close();
    rmSync(accepted.root, { recursive: true, force: true });
  }

  const rejected = createMediaHarness({ maskColorType: 2 });
  try {
    await assert.rejects(() => rejected.runner.run(rejected.plan, "rgb-mask"), (error) => error?.code === "INVALID_CONFIGURATION" && /grayscale PNG/.test(error.message));
    assert.equal(rejected.backend.media_upload_calls, 0);
    assert.equal(rejected.backend.submit_calls, 0);
  } finally {
    rejected.storage.close();
    rmSync(rejected.root, { recursive: true, force: true });
  }
});

test("media profile rejects more than one video input before submit", async () => {
  const h = createMediaHarness({ referenceCount: 0, videoCount: 2 });
  try {
    await assert.rejects(() => h.runner.run(h.plan, "too-many-videos"), (error) => error?.code === "INVALID_CONFIGURATION" && /at most 1 video input/.test(error.message));
    assert.equal(h.backend.media_upload_calls, 0);
    assert.equal(h.backend.submit_calls, 0);
  } finally {
    h.storage.close();
    rmSync(h.root, { recursive: true, force: true });
  }
});

test("media profile rejects non-identity EXIF orientation before upload", async () => {
  const h = createMediaHarness({ exifOrientation: 6 });
  try {
    await assert.rejects(() => h.runner.run(h.plan, "rotated-exif"), (error) => error?.code === "INVALID_CONFIGURATION" && /EXIF orientation 6/.test(error.message));
    assert.equal(h.backend.media_upload_calls, 0);
    assert.equal(h.backend.submit_calls, 0);
  } finally {
    h.storage.close();
    rmSync(h.root, { recursive: true, force: true });
  }
});
