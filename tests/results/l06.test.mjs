import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../../dist/mcp/server.js";
import { ResultDownloadService } from "../../dist/execution/results.js";
import { planToRow } from "../../dist/execution/runner.js";
import { RevisionStore } from "../../dist/graph/revisions.js";
import { createEmptyGraph } from "../../dist/graph/types.js";
import { ProjectContextService } from "../../dist/projects/context.js";
import { Storage } from "../../dist/storage/database.js";
import { SqliteRevisionPersistence } from "../../dist/storage/revisions.js";

const validPng = Uint8Array.from([
  137, 80, 78, 71, 13, 10, 26, 10,
  0, 0, 0, 13, 73, 72, 68, 82,
  0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0,
  0, 0, 0, 0,
  0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
]);

const validQuickTime = Uint8Array.from([
  0, 0, 0, 16, 102, 116, 121, 112,
  113, 116, 32, 32, 0, 0, 0, 0,
]);

class BytesBackend {
  profile_id = "synthetic-download";
  api_family = "synthetic";
  output_calls = 0;
  submit_calls = 0;
  output = { id: "output-1", bytes: validPng, mime: "image/png" };

  async upload() {
    throw new Error("upload must not be called");
  }

  async submit() {
    this.submit_calls += 1;
    throw new Error("submit must not be called");
  }

  async status() {
    throw new Error("status must not be called");
  }

  async outputs() {
    this.output_calls += 1;
    return { outputs: [this.output] };
  }

  async cancel() {
    throw new Error("cancel must not be called");
  }
}

function createProjectJob(root, backendProfileId = "synthetic-download", dbPath = ":memory:") {
  mkdirSync(join(root, "outputs"), { recursive: true });
  const storage = new Storage(dbPath);
  const projects = new ProjectContextService(storage);
  projects.registerProject({ project_id: "download-project", canonical_root: root, backend_profile_id: backendProfileId, output_root: "outputs" });
  const workItem = projects.createWorkItem({ project_id: "download-project", user_request: "download result", request_kind: "image" });
  const revisions = new RevisionStore({ persistence: new SqliteRevisionPersistence(storage) });
  const revision = revisions.createWorkflow({ project_id: "download-project", workflow_id: `workflow-${workItem.id}`, graph: createEmptyGraph() });
  const plan = {
    id: `plan-${workItem.id}`,
    project_id: "download-project",
    work_item_id: workItem.id,
    graph_revision_id: revision.revision_id,
    graph_hash: revision.graph_hash,
    workflow_json: "{}",
    asset_bindings: [],
    requirements_hash: "requirements",
    policy_hash: "policy",
    backend_profile_id: backendProfileId,
    output_contract: {},
    mode: "capability_test",
  };
  storage.saveExecutionPlan(planToRow(plan));
  const job = storage.reserveJob(plan.project_id, plan.id, "download-request");
  assert.equal(storage.claimSubmit(job.id, `submit:${job.id}`), true);
  storage.recordProviderTask(job.id, "provider-task-1");
  storage.markProviderStatus(job.id, "SUCCESS", "PENDING");
  return { storage, projects, plan, job: storage.getJob(job.id) };
}

test("downloads a validated original atomically and retries without another submit or fetch", async () => {
  const root = mkdtempSync(join(tmpdir(), "runninghub-mcp-results-"));
  const backend = new BytesBackend();
  try {
    const { storage, job } = createProjectJob(root);
    const service = new ResultDownloadService(storage, backend);
    const first = await service.download(job.id);
    const second = await service.download(job.id);
    assert.equal(first.length, 1);
    assert.deepEqual(second, first);
    assert.equal(storage.listResults(job.id).length, 1);
    assert.equal(backend.output_calls, 2);
    assert.equal(backend.submit_calls, 0);
    const saved = readFileSync(join(root, first[0].relative_path));
    assert.deepEqual(saved, Buffer.from(validPng));
    storage.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects mismatched MIME and undecodable output without persisting a result", async () => {
  const root = mkdtempSync(join(tmpdir(), "runninghub-mcp-results-invalid-"));
  const backend = new BytesBackend();
  try {
    const { storage, job } = createProjectJob(root);
    backend.output = { id: "bad-mime", bytes: validPng, mime: "video/mp4" };
    await assert.rejects(() => new ResultDownloadService(storage, backend).download(job.id), /declares video\/mp4/);
    assert.equal(storage.listResults(job.id).length, 0);
    backend.output = { id: "bad-bytes", bytes: Uint8Array.from([1, 2, 3]), mime: "image/png" };
    await assert.rejects(() => new ResultDownloadService(storage, backend).download(job.id), /supported, decodable media container/);
    assert.equal(storage.listResults(job.id).length, 0);
    storage.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("accepts a QuickTime container with the provider's video/mp4 label", async () => {
  const root = mkdtempSync(join(tmpdir(), "runninghub-mcp-results-quicktime-"));
  const backend = new BytesBackend();
  try {
    const { storage, job } = createProjectJob(root);
    backend.output = { id: "quicktime-output", bytes: validQuickTime, mime: "video/mp4" };
    const [result] = await new ResultDownloadService(storage, backend).download(job.id);
    assert.equal(result.mime, "video/quicktime");
    assert.match(result.relative_path, /\.mov$/);
    assert.deepEqual(readFileSync(join(root, result.relative_path)), Buffer.from(validQuickTime));
    storage.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rh_get_results downloads through the MCP transport without submitting a task", async () => {
  const root = mkdtempSync(join(tmpdir(), "runninghub-mcp-results-mcp-"));
  const httpRequests = { submit: 0, output: 0, media: 0 };
  const httpServer = createHttpServer((request, response) => {
    if (request.url === "/outputs") {
      httpRequests.output += 1;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ code: 0, data: { results: [{ id: "provider-output", fileUrl: `http://localhost:${httpServer.address().port}/media`, fileType: "image/png" }] } }));
      return;
    }
    if (request.url === "/media") {
      httpRequests.media += 1;
      response.writeHead(200, { "content-type": "image/png", "content-length": validPng.length });
      response.end(Buffer.from(validPng));
      return;
    }
    if (request.url === "/submit") httpRequests.submit += 1;
    response.writeHead(404);
    response.end();
  });
  httpServer.listen(0, "127.0.0.1");
  await once(httpServer, "listening");
  const port = httpServer.address().port;
  const dbPath = join(root, "state.sqlite");
  const seeded = createProjectJob(root, "synthetic-download", dbPath);
  const storage = seeded.storage;
  const { job } = seeded;
  let server;
  let client;
  try {
    const config = {
      dataDir: root,
      dbPath,
      catalogDir: join(process.cwd(), "data", "upstream"),
      profileId: "runninghub",
      workflowApi: {
        profile_id: "synthetic-download",
        base_url: `http://localhost:${port}`,
        api_key: "synthetic-key",
        routes: { submit: "/submit", status: "/status", outputs: "/outputs" },
      },
    };
    server = createServer(config, storage);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "l06-offline-test", version: "0.1.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const result = await client.callTool({ name: "rh_get_results", arguments: { job_id: job.id } });
    const payload = JSON.parse(result.content[0].text);
    assert.equal(result.isError, undefined);
    assert.equal(payload.ok, true);
    assert.equal(payload.data.results.length, 1);
    assert.equal(payload.data.results[0].mime, "image/png");
    assert.match(payload.data.results[0].resource_uri, /^runninghub:\/\/result\//);
    assert.ok(!JSON.stringify(payload).includes("synthetic-key"));
    assert.deepEqual(readFileSync(join(root, payload.data.results[0].relative_path)), Buffer.from(validPng));
    const resourceLink = result.content.find((item) => item.type === "resource_link");
    assert.ok(resourceLink);
    assert.equal(resourceLink.uri, payload.data.results[0].resource_uri);
    assert.equal(resourceLink.mimeType, "image/png");
    const resource = await client.readResource({ uri: resourceLink.uri });
    assert.equal(resource.contents.length, 1);
    assert.equal(resource.contents[0].mimeType, "image/png");
    assert.deepEqual(Buffer.from(resource.contents[0].blob, "base64"), Buffer.from(validPng));
    assert.equal(httpRequests.submit, 0);
    assert.equal(httpRequests.output, 1);
    assert.equal(httpRequests.media, 1);
    await client.close();
    await server.close();
  } finally {
    if (client) await client.close().catch(() => undefined);
    if (server) await server.close().catch(() => undefined);
    httpServer.close();
    storage.close();
    rmSync(root, { recursive: true, force: true });
  }
});
