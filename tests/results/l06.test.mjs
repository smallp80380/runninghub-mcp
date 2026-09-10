import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../../dist/mcp/server.js";
import { DerivedMediaService } from "../../dist/execution/derivatives.js";
import { ResultDownloadService } from "../../dist/execution/results.js";
import { ReviewService } from "../../dist/execution/reviews.js";
import { planToRow } from "../../dist/execution/runner.js";
import { RevisionStore } from "../../dist/graph/revisions.js";
import { createEmptyGraph } from "../../dist/graph/types.js";
import { ProjectContextService } from "../../dist/projects/context.js";
import { Storage } from "../../dist/storage/database.js";
import { SqliteRevisionPersistence } from "../../dist/storage/revisions.js";

const validPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

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

test("creates and reuses an image preview derivative", async () => {
  const root = mkdtempSync(join(tmpdir(), "runninghub-mcp-results-preview-"));
  const backend = new BytesBackend();
  try {
    const { storage, job } = createProjectJob(root);
    const [original] = await new ResultDownloadService(storage, backend).download(job.id);
    const service = new DerivedMediaService(storage, { ffmpeg_path: "ffmpeg" });
    const first = await service.derive([original.result_id]);
    const second = await service.derive([original.result_id]);
    assert.equal(first.results.length, 1);
    assert.equal(first.results[0].kind, "preview");
    assert.equal(first.results[0].mime, "image/png");
    assert.equal(first.warnings.length, 0);
    assert.deepEqual(second, first);
    assert.equal(storage.listDerivedResults(original.result_id).length, 1);
    assert.deepEqual(readFileSync(join(root, first.results[0].relative_path)).subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    storage.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("creates a video poster from the first frame without another provider operation", async () => {
  const root = mkdtempSync(join(tmpdir(), "runninghub-mcp-results-poster-"));
  const videoPath = join(root, "source.mp4");
  try {
    const generated = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=red:s=16x16:r=1", "-frames:v", "1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", videoPath], { encoding: "utf8" });
    assert.equal(generated.status, 0, generated.stderr);
    const backend = new BytesBackend();
    const { storage, job } = createProjectJob(root);
    backend.output = { id: "video-output", bytes: readFileSync(videoPath), mime: "video/mp4" };
    const [original] = await new ResultDownloadService(storage, backend).download(job.id);
    const derived = await new DerivedMediaService(storage, { ffmpeg_path: "ffmpeg" }).derive([original.result_id]);
    assert.equal(derived.results.length, 1);
    assert.equal(derived.results[0].kind, "poster");
    assert.equal(derived.results[0].mime, "image/png");
    assert.equal(derived.warnings.length, 0);
    storage.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects private output URLs before fetching and refuses redirects", async () => {
  const root = mkdtempSync(join(tmpdir(), "runninghub-mcp-results-ssrf-"));
  const backend = new BytesBackend();
  let fetchCalls = 0;
  try {
    const { storage, job } = createProjectJob(root);
    backend.output = { id: "private-output", url: "https://127.0.0.1/private.png", mime: "image/png" };
    await assert.rejects(
      () => new ResultDownloadService(storage, backend, { fetch_impl: async () => { fetchCalls += 1; return new Response(validPng); } }).download(job.id),
      /disallowed download URL scheme or host/,
    );
    assert.equal(fetchCalls, 0);
    backend.output = { id: "redirect-output", url: "https://cdn.example/redirect.png", mime: "image/png" };
    await assert.rejects(
      () => new ResultDownloadService(storage, backend, { fetch_impl: async () => new Response(null, { status: 302, headers: { location: "https://127.0.0.1/private.png" } }) }).download(job.id),
      /returned HTTP 302/,
    );
    storage.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("does not add revision side effects when an existing review retry omits its original revision request", () => {
  const root = mkdtempSync(join(tmpdir(), "runninghub-mcp-review-idempotency-"));
  try {
    const { storage, projects, job } = createProjectJob(root);
    storage.saveResult({
      id: "review-result",
      job_id: job.id,
      output_id: "output-1",
      schema_version: "1",
      relative_path: "outputs/result.png",
      mime: "image/png",
      size_bytes: 1,
      content_hash: "a".repeat(64),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const reviews = new ReviewService(storage, new RevisionStore({ persistence: new SqliteRevisionPersistence(storage) }), projects);
    const event = { result_id: "review-result", decision: "CHANGES_REQUESTED", feedback: "Please revise.", review_event_id: "review-idempotency-event" };
    reviews.review(event);
    assert.throws(
      () => reviews.review({ ...event, revision_request: { reason: "Apply the feedback", operations: [{ op: "add_node", node_id: "new-node", class_type: "Source", schema_revision: "1" }] } }),
      (error) => error?.code === "REQUEST_CONFLICT",
    );
    assert.equal(storage.getReviewRevision("review-idempotency-event"), undefined);
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
    const inlineImage = result.content.find((item) => item.type === "image");
    assert.ok(inlineImage);
    assert.equal(inlineImage.mimeType, "image/png");
    assert.deepEqual(Buffer.from(inlineImage.data, "base64"), Buffer.from(validPng));
    assert.equal(payload.data.manifest.manifest_id, job.id);
    assert.match(payload.data.manifest.relative_path, /^\.runninghub\/runs\/[^/]+\/manifest\.json$/);
    assert.equal(payload.data.manifest.outbox_id, `result-manifest:${job.id}`);
    assert.ok(!JSON.stringify(payload).includes("synthetic-key"));
    assert.deepEqual(readFileSync(join(root, payload.data.results[0].relative_path)), Buffer.from(validPng));
    const manifestPath = join(root, payload.data.manifest.relative_path);
    assert.equal(existsSync(manifestPath), true);
    const manifestText = readFileSync(manifestPath, "utf8");
    const manifest = JSON.parse(manifestText);
    assert.equal(manifest.schema_version, "1");
    assert.equal(manifest.project.project_id, "download-project");
    assert.equal(manifest.outputs[0].content_hash, payload.data.results[0].content_hash);
    assert.equal(manifest.review.status, "PENDING_REVIEW");
    assert.equal(payload.data.review.status, "PENDING_REVIEW");
    assert.ok(manifest.workflow.submitted_workflow_hash);
    assert.equal(manifestText.includes(root), false);
    assert.equal(manifestText.includes("synthetic-key"), false);
    assert.equal(storage.getOutbox(payload.data.manifest.outbox_id).published_at !== null, true);
    const resourceLink = result.content.find((item) => item.type === "resource_link");
    assert.ok(resourceLink);
    assert.equal(resourceLink.uri, payload.data.results[0].resource_uri);
    assert.equal(resourceLink.mimeType, "image/png");
    const resource = await client.readResource({ uri: resourceLink.uri });
    assert.equal(resource.contents.length, 1);
    assert.equal(resource.contents[0].mimeType, "image/png");
    assert.deepEqual(Buffer.from(resource.contents[0].blob, "base64"), Buffer.from(validPng));
    const derivedLink = result.content.find((item) => item.type === "resource_link" && item.uri.startsWith("runninghub://derived/"));
    assert.ok(derivedLink);
    assert.equal(derivedLink.mimeType, "image/png");
    const derivedResource = await client.readResource({ uri: derivedLink.uri });
    assert.equal(derivedResource.contents.length, 1);
    assert.equal(derivedResource.contents[0].mimeType, "image/png");
    assert.deepEqual(Buffer.from(derivedResource.contents[0].blob, "base64").subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const reviewArguments = {
      result_id: payload.data.results[0].result_id,
      decision: "CHANGES_REQUESTED",
      feedback: "Adjust the composition.",
      user_message_ref: "message-1",
      review_event_id: "review-event-1",
      revision_request: {
        reason: "Apply the composition feedback",
        operations: [{ op: "add_node", node_id: "requested-change", class_type: "Source", schema_revision: "1" }],
      },
    };
    const review = await client.callTool({ name: "rh_review_result", arguments: reviewArguments });
    const reviewPayload = JSON.parse(review.content[0].text);
    assert.equal(review.isError, undefined);
    assert.equal(reviewPayload.ok, true);
    assert.equal(reviewPayload.data.idempotent, false);
    assert.equal(reviewPayload.data.review.status, "CHANGES_REQUESTED");
    assert.equal(reviewPayload.data.changes_requested_revision.source_revision_id, seeded.plan.graph_revision_id);
    assert.equal(reviewPayload.data.changes_requested_revision.revision.parent_revision_id, seeded.plan.graph_revision_id);
    assert.equal(reviewPayload.data.changes_requested_revision.work_item.chain_id, storage.getWorkItem(seeded.plan.work_item_id).chain_id);
    assert.notEqual(reviewPayload.data.changes_requested_revision.work_item.id, seeded.plan.work_item_id);
    assert.equal(storage.getJob(job.id).execution_state, "SUCCEEDED");
    assert.equal(storage.listReviewEvents(payload.data.results[0].result_id).length, 1);
    const repeatedReview = await client.callTool({ name: "rh_review_result", arguments: reviewArguments });
    const repeatedReviewPayload = JSON.parse(repeatedReview.content[0].text);
    assert.equal(repeatedReviewPayload.ok, true);
    assert.equal(repeatedReviewPayload.data.idempotent, true);
    assert.equal(repeatedReviewPayload.data.changes_requested_revision.revision.revision_id, reviewPayload.data.changes_requested_revision.revision.revision_id);
    assert.equal(repeatedReviewPayload.data.changes_requested_revision.work_item.id, reviewPayload.data.changes_requested_revision.work_item.id);
    assert.equal(storage.listReviewEvents(payload.data.results[0].result_id).length, 1);
    const invalidRevisionDecision = await client.callTool({ name: "rh_review_result", arguments: {
      ...reviewArguments,
      decision: "APPROVED",
      review_event_id: "review-event-3",
    } });
    const invalidRevisionPayload = JSON.parse(invalidRevisionDecision.content[0].text);
    assert.equal(invalidRevisionDecision.isError, true);
    assert.equal(invalidRevisionPayload.error.code, "INVALID_CONFIGURATION");
    const conflictingReview = await client.callTool({ name: "rh_review_result", arguments: { ...reviewArguments, decision: "APPROVED", review_event_id: "review-event-2", revision_request: undefined } });
    const conflictingReviewPayload = JSON.parse(conflictingReview.content[0].text);
    assert.equal(conflictingReview.isError, true);
    assert.equal(conflictingReviewPayload.ok, false);
    assert.equal(conflictingReviewPayload.error.code, "REQUEST_CONFLICT");
    const reviewedResults = await client.callTool({ name: "rh_get_results", arguments: { job_id: job.id } });
    const reviewedResultsPayload = JSON.parse(reviewedResults.content[0].text);
    assert.equal(reviewedResultsPayload.data.review.status, "CHANGES_REQUESTED");
    assert.equal(reviewedResultsPayload.data.results[0].review.status, "CHANGES_REQUESTED");
    storage.db.prepare("UPDATE outbox SET published_at = NULL WHERE id = ?").run(payload.data.manifest.outbox_id);
    const repeated = await client.callTool({ name: "rh_get_results", arguments: { job_id: job.id } });
    const repeatedPayload = JSON.parse(repeated.content[0].text);
    assert.equal(repeatedPayload.data.manifest.content_hash, payload.data.manifest.content_hash);
    assert.equal(storage.getOutbox(payload.data.manifest.outbox_id).published_at !== null, true);
    assert.equal(httpRequests.submit, 0);
    assert.equal(httpRequests.output, 3);
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

test("MCP review gate blocks by default and supports an explicit idempotent continuation", async () => {
  const root = mkdtempSync(join(tmpdir(), "runninghub-mcp-review-gate-"));
  const httpRequests = { submit: 0, output: 0, media: 0 };
  const httpServer = createHttpServer((request, response) => {
    if (request.url === "/submit") {
      httpRequests.submit += 1;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ data: { taskId: `provider-next-${httpRequests.submit}` } }));
      return;
    }
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
    response.writeHead(404);
    response.end();
  });
  httpServer.listen(0, "127.0.0.1");
  await once(httpServer, "listening");
  const port = httpServer.address().port;
  const dbPath = join(root, "state.sqlite");
  const seeded = createProjectJob(root, "review-gate-profile", dbPath);
  const storage = seeded.storage;
  let server;
  let client;
  try {
    const config = {
      dataDir: root,
      dbPath,
      catalogDir: join(process.cwd(), "data", "upstream"),
      profileId: "runninghub",
      workflowApi: {
        profile_id: "review-gate-profile",
        base_url: `http://localhost:${port}`,
        api_key: "synthetic-key",
        routes: { submit: "/submit", status: "/status", outputs: "/outputs" },
      },
    };
    server = createServer(config, storage);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "l06-review-gate", version: "0.1.0" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const downloaded = await client.callTool({ name: "rh_get_results", arguments: { job_id: seeded.job.id } });
    const downloadedPayload = JSON.parse(downloaded.content[0].text);
    assert.equal(downloadedPayload.ok, true);
    assert.equal(downloadedPayload.data.review.status, "PENDING_REVIEW");

    const chainId = seeded.projects.getWorkItem(seeded.plan.work_item_id).chain_id;
    const revisions = new RevisionStore({ persistence: new SqliteRevisionPersistence(storage) });
    const nextWorkItem = seeded.projects.createWorkItem({ project_id: "download-project", chain_id: chainId, user_request: "explicit next step", request_kind: "image" });
    const nextRevision = revisions.createWorkflow({ project_id: "download-project", workflow_id: `workflow-${nextWorkItem.id}`, graph: createEmptyGraph() });
    const nextPlan = { ...seeded.plan, id: `plan-${nextWorkItem.id}`, work_item_id: nextWorkItem.id, graph_revision_id: nextRevision.revision_id, graph_hash: nextRevision.graph_hash };
    storage.saveExecutionPlan(planToRow(nextPlan));

    const blocked = await client.callTool({ name: "rh_run_workflow", arguments: { plan_id: nextPlan.id, request_id: "explicit-next-request" } });
    const blockedPayload = JSON.parse(blocked.content[0].text);
    assert.equal(blocked.isError, true);
    assert.equal(blockedPayload.error.code, "REVIEW_PENDING");
    assert.equal(httpRequests.submit, 0);
    assert.equal(storage.getJobByPlan(nextPlan.id), undefined);

    const reviewed = await client.callTool({ name: "rh_review_result", arguments: {
      result_id: downloadedPayload.data.results[0].result_id,
      decision: "APPROVED",
      user_message_ref: "message-approved-1",
      review_event_id: "review-gate-event-1",
    } });
    const reviewedPayload = JSON.parse(reviewed.content[0].text);
    assert.equal(reviewedPayload.ok, true);
    assert.equal(httpRequests.submit, 0);

    const armed = await client.callTool({ name: "rh_review_result", arguments: {
      result_id: downloadedPayload.data.results[0].result_id,
      decision: "APPROVED",
      user_message_ref: "message-approved-1",
      review_event_id: "review-gate-event-1",
      continuation: { plan_id: nextPlan.id, request_id: "explicit-next-request" },
    } });
    const armedPayload = JSON.parse(armed.content[0].text);
    assert.equal(armed.isError, undefined);
    assert.equal(armedPayload.data.idempotent, true);
    assert.equal(armedPayload.data.continuation.idempotent, false);
    assert.equal(armedPayload.data.continuation.job.provider_task_id, "provider-next-1");
    assert.equal(httpRequests.submit, 1);

    const repeatedArmed = await client.callTool({ name: "rh_review_result", arguments: {
      result_id: downloadedPayload.data.results[0].result_id,
      decision: "APPROVED",
      user_message_ref: "message-approved-1",
      review_event_id: "review-gate-event-1",
      continuation: { plan_id: nextPlan.id, request_id: "explicit-next-request" },
    } });
    const repeatedArmedPayload = JSON.parse(repeatedArmed.content[0].text);
    assert.equal(repeatedArmed.isError, undefined);
    assert.equal(repeatedArmedPayload.data.continuation.idempotent, true);
    assert.equal(repeatedArmedPayload.data.continuation.job.id, armedPayload.data.continuation.job.id);
    assert.equal(httpRequests.submit, 1);

    const continued = await client.callTool({ name: "rh_run_workflow", arguments: { plan_id: nextPlan.id, request_id: "explicit-next-request" } });
    const continuedPayload = JSON.parse(continued.content[0].text);
    assert.equal(continued.isError, undefined);
    assert.equal(continuedPayload.data.provider_task_id, "provider-next-1");
    assert.equal(httpRequests.submit, 1);
  } finally {
    if (client) await client.close().catch(() => undefined);
    if (server) await server.close().catch(() => undefined);
    httpServer.close();
    storage.close();
    rmSync(root, { recursive: true, force: true });
  }
});
