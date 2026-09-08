import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Storage } from "../../dist/storage/database.js";

function frame(message) {
  return `${JSON.stringify(message)}\n`;
}

function createReader(stream) {
  let buffer = "";
  const pending = [];
  let ended = false;
  stream.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    drain();
  });
  stream.on("end", () => {
    ended = true;
    while (pending.length) pending.shift().reject(new Error("MCP stdout ended"));
  });
  function drain() {
    while (true) {
      const separator = buffer.indexOf("\n");
      if (separator < 0) return;
      const body = buffer.slice(0, separator).replace(/\r$/, "");
      buffer = buffer.slice(separator + 1);
      const waiter = pending.shift();
      waiter?.resolve(JSON.parse(body));
    }
  }
  return () => {
    if (ended) return Promise.reject(new Error("MCP stdout ended"));
    return new Promise((resolve, reject) => pending.push({ resolve, reject }));
  };
}

test("stdio MCP initialize, catalog, graph, and local execution tools work", async () => {
  const dir = mkdtempSync(join(tmpdir(), "runninghub-mcp-stdio-"));
  const seedStorage = new Storage(join(dir, "runninghub.sqlite"));
  seedStorage.registerProject("mcp-project");
  seedStorage.close();
  const child = spawn(process.execPath, ["dist/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      RUNNINGHUB_DATA_DIR: dir,
      RUNNINGHUB_CATALOG_DIR: resolveCatalogDir(),
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const nextMessage = createReader(child.stdout);
  try {
    child.stdin.write(frame({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "offline-test", version: "0.1.0" },
      },
    }));
    const initialized = await nextMessage();
    assert.equal(initialized.id, 1);
    assert.equal(initialized.result.serverInfo.name, "runninghub-mcp");

    child.stdin.write(frame({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }));
    child.stdin.write(frame({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }));
    const listed = await nextMessage();
    const names = listed.result.tools.map((tool) => tool.name);
    assert.deepEqual(names, [
      "rh_search_models",
      "rh_get_model_schema",
      "rh_estimate_price",
      "rh_validate_payload",
      "rh_get_integration_guide",
      "rh_build_example_payload",
      "rh_create_workflow",
      "rh_get_workflow",
      "rh_edit_workflow",
      "rh_validate_workflow",
      "rh_export_workflow",
      "rh_project",
      "rh_asset",
      "rh_scene",
       "rh_work_item",
       "rh_search_workflows",
       "rh_import_workflow",
       "rh_prepare_generation",
       "rh_run_workflow",
        "rh_job",
        "rh_get_results",
        "rh_review_result",
        "rh_get_capabilities",
    ]);

    child.stdin.write(frame({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "rh_get_capabilities", arguments: {} },
    }));
    const called = await nextMessage();
    assert.equal(called.id, 3);
    assert.equal(called.result.isError, undefined);
    const payload = JSON.parse(called.result.content[0].text);
    assert.equal(payload.ok, true);
    assert.equal(payload.data.graph_execution.full_graph_submit, "not_verified");

    child.stdin.write(frame({
      jsonrpc: "2.0",
      id: 11,
      method: "tools/call",
      params: { name: "rh_asset", arguments: { action: "inspect", project_id: "mcp-project" } },
    }));
    const assets = await nextMessage();
    assert.equal(assets.id, 11);
    const assetsPayload = JSON.parse(assets.result.content[0].text);
    assert.equal(assetsPayload.ok, true);
    assert.deepEqual(assetsPayload.data, []);

    child.stdin.write(frame({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "rh_get_model_schema", arguments: { endpoint: "missing-endpoint" } },
    }));
    const failed = await nextMessage();
    assert.equal(failed.id, 4);
    assert.equal(failed.result.isError, true);
    const failurePayload = JSON.parse(failed.result.content[0].text);
    assert.equal(failurePayload.ok, false);
    assert.equal(failurePayload.error.code, "SCHEMA_UNKNOWN");

    child.stdin.write(frame({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "rh_create_workflow", arguments: { project_id: "mcp-project", workflow_id: "mcp-workflow" } },
    }));
    const created = await nextMessage();
    const createdPayload = JSON.parse(created.result.content[0].text);
    assert.equal(createdPayload.ok, true);

    child.stdin.write(frame({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "rh_edit_workflow",
        arguments: {
          workflow_id: "mcp-workflow",
          base_revision_id: createdPayload.data.revision_id,
          reason: "add local node",
          operations: [{ op: "add_node", node_id: "local", class_type: "Source", schema_revision: "1" }],
        },
      },
    }));
    const edited = await nextMessage();
    const editedPayload = JSON.parse(edited.result.content[0].text);
    assert.equal(editedPayload.ok, true);
    assert.equal(editedPayload.data.revision.parent_revision_id, createdPayload.data.revision_id);

    child.stdin.write(frame({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: {
        name: "rh_work_item",
        arguments: { action: "create", project_id: "mcp-project", user_request: "offline execution plan", request_kind: "image" },
      },
    }));
    const workItemCall = await nextMessage();
    const workItemPayload = JSON.parse(workItemCall.result.content[0].text);
    assert.equal(workItemPayload.ok, true);

    child.stdin.write(frame({
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: {
        name: "rh_prepare_generation",
        arguments: {
          work_item_id: workItemPayload.data.id,
          workflow_revision_id: editedPayload.data.revision.revision_id,
          backend_profile_id: "offline-profile",
          output_contract: { output_node_ids: [] },
          mode: "capability_test",
        },
      },
    }));
    const prepared = await nextMessage();
    const preparedPayload = JSON.parse(prepared.result.content[0].text);
    assert.equal(preparedPayload.ok, true);
    assert.equal(preparedPayload.data.graph_revision_id, editedPayload.data.revision.revision_id);
    assert.equal(preparedPayload.data.backend_profile_id, "offline-profile");

    child.stdin.write(frame({
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: { name: "rh_run_workflow", arguments: { plan_id: preparedPayload.data.id, request_id: "offline-request" } },
    }));
    const runFailed = await nextMessage();
    assert.equal(runFailed.result.isError, true);
    const runFailurePayload = JSON.parse(runFailed.result.content[0].text);
    assert.equal(runFailurePayload.ok, false);
    assert.equal(runFailurePayload.error.code, "CAPABILITY_UNKNOWN");

    child.stdin.write(frame({
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: { name: "rh_job", arguments: { action: "status", job_id: "missing-offline-job" } },
    }));
    const jobFailed = await nextMessage();
    assert.equal(jobFailed.result.isError, true);
    const jobFailurePayload = JSON.parse(jobFailed.result.content[0].text);
    assert.equal(jobFailurePayload.ok, false);
    assert.equal(jobFailurePayload.error.code, "PROJECT_NOT_FOUND");
  } finally {
    child.kill();
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 1000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    rmSync(dir, { recursive: true, force: true });
  }
});

function resolveCatalogDir() {
  return join(process.cwd(), "data", "upstream");
}
