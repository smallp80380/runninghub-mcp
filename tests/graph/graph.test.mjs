import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalGraphJson, exportApiGraph, hashGraph, importApiGraph } from "../../dist/graph/codec.js";
import { applyGraphOperations } from "../../dist/graph/operations.js";
import { prepareResizeGraph } from "../../dist/graph/structuralProbe.js";
import { RevisionStore } from "../../dist/graph/revisions.js";
import { SqliteRevisionPersistence } from "../../dist/storage/revisions.js";
import { Storage } from "../../dist/storage/database.js";
import { MapNodeCatalog, createEmptyGraph } from "../../dist/graph/types.js";
import { validateGraph } from "../../dist/graph/validation.js";

const catalog = new MapNodeCatalog([
  { class_type: "Source", schema_revision: "1", inputs: {}, outputs: ["image"], source_evidence: "fixture", backend_scope: "synthetic" },
  { class_type: "Transform", schema_revision: "1", inputs: { image: { type: "image", required: true }, values: { type: "array" }, seed: { type: "integer", required: true } }, outputs: ["image"], source_evidence: "fixture", backend_scope: "synthetic" },
  { class_type: "Save", schema_revision: "1", inputs: { image: { type: "image", required: true } }, outputs: ["file"], source_evidence: "fixture", backend_scope: "synthetic" },
]);

test("empty graph is a valid draft and becomes runnable after node/link edits", () => {
  const empty = createEmptyGraph();
  const emptyReport = applyGraphOperations(empty, [], { catalog }).validation;
  assert.equal(emptyReport.structural, "valid");
  assert.equal(emptyReport.runnable, "draft");

  const edited = applyGraphOperations(empty, [
    { op: "add_node", node_id: "1", class_type: "Source", schema_revision: "1" },
    { op: "add_node", node_id: "2", class_type: "Transform", schema_revision: "1", inputs: { seed: { kind: "integer", decimal: "9007199254740993" }, values: { kind: "literal", value: ["node_looks_like_literal", 1] } } },
    { op: "add_node", node_id: "3", class_type: "Save", schema_revision: "1" },
    { op: "connect", source_node_id: "1", output_index: 0, target_node_id: "2", input_name: "image" },
    { op: "connect", source_node_id: "2", output_index: 0, target_node_id: "3", input_name: "image" },
  ], { catalog });
  const runnable = { ...edited.graph, output_nodes: ["3"] };
  assert.equal(validateGraph(runnable, catalog).runnable, "ready");
});

test("API codec preserves a large seed and distinguishes literal arrays from links", () => {
  const graph = importApiGraph('{"1":{"class_type":"Transform","schema_revision":"1","inputs":{"seed":9007199254740993,"values":["literal",1]}}}', ["1"]);
  assert.deepEqual(graph.nodes["1"].inputs.seed, { kind: "integer", decimal: "9007199254740993" });
  assert.deepEqual(graph.nodes["1"].inputs.values, { kind: "literal", value: ["literal", 1] });
  const exported = exportApiGraph(graph, false);
  assert.match(exported, /9007199254740993/);
  assert.equal(importApiGraph(exported, ["1"]).nodes["1"].inputs.seed.decimal, "9007199254740993");
});

test("API codec preserves unsafe numeric literals nested inside an input object", () => {
  const graph = importApiGraph('{"1":{"class_type":"Transform","inputs":{"options":{"megapixels":9007199254740993}}}}');
  const exported = exportApiGraph(graph);
  assert.match(exported, /9007199254740993/);
  assert.match(exportApiGraph(importApiGraph(exported)), /9007199254740993/);
});

test("structural probe changes an unambiguous resize node without guessing", () => {
  const source = importApiGraph('{"latent":{"class_type":"EmptyLatentImage","inputs":{"width":512,"height":512}}}');
  const prepared = prepareResizeGraph(source, { width: 64, height: 96 });
  assert.equal(prepared.node_id, "latent");
  assert.deepEqual(prepared.before, { width: "512", height: "512" });
  assert.deepEqual(prepared.after, { width: "64", height: "96" });
  assert.notEqual(hashGraph(source), hashGraph(prepared.graph));
  assert.match(exportApiGraph(prepared.graph, false), /"width":64/);
  assert.match(exportApiGraph(prepared.graph, false), /"height":96/);

  const ambiguous = importApiGraph('{"a":{"class_type":"EmptyLatentImage","inputs":{"width":512,"height":512}},"b":{"class_type":"EmptyLatentImage","inputs":{"width":512,"height":512}}}');
  assert.throws(() => prepareResizeGraph(ambiguous, { width: 64, height: 96 }), /Multiple resize nodes/);
});

test("structural probe replaces supported provider string and link dimensions", () => {
  const stringDimensions = importApiGraph('{"resize":{"class_type":"ProviderResize","inputs":{"width":"512","height":"512"}}}');
  const fromStrings = prepareResizeGraph(stringDimensions, { width: 64, height: 96 });
  assert.deepEqual(fromStrings.before, { width: "512", height: "512" });
  assert.match(exportApiGraph(fromStrings.graph, false), /"width":64/);

  const linkedDimensions = importApiGraph('{"sizes":{"class_type":"SizeSource","inputs":{"width":512,"height":512}},"resize":{"class_type":"ProviderResize","inputs":{"width":["sizes",0],"height":["sizes",1]}}}');
  const fromLinks = prepareResizeGraph(linkedDimensions, { node_id: "resize", width: 64, height: 96 });
  assert.deepEqual(fromLinks.before, { width: "link:sizes:0", height: "link:sizes:1" });
  assert.match(exportApiGraph(fromLinks.graph, false), /"width":64/);
});

test("bad edit batch rolls back and remove/reconnect is atomic", () => {
  const base = applyGraphOperations(createEmptyGraph(), [
    { op: "add_node", node_id: "a", class_type: "Source", schema_revision: "1" },
    { op: "add_node", node_id: "b", class_type: "Save", schema_revision: "1" },
    { op: "connect", source_node_id: "a", output_index: 0, target_node_id: "b", input_name: "image" },
  ], { catalog });
  assert.throws(() => applyGraphOperations(base.graph, [
    { op: "add_node", node_id: "c", class_type: "Save", schema_revision: "1" },
    { op: "connect", source_node_id: "missing", output_index: 0, target_node_id: "c", input_name: "image" },
  ], { catalog }), /Unknown node missing/);
  assert.ok(base.graph.nodes.b.inputs.image);

  const reconnected = applyGraphOperations(base.graph, [
    { op: "add_node", node_id: "c", class_type: "Save", schema_revision: "1" },
    { op: "remove_node", node_id: "b", strategy: "defer_reconnect" },
    { op: "connect", source_node_id: "a", output_index: 0, target_node_id: "c", input_name: "image" },
  ], { catalog });
  assert.equal(reconnected.graph.nodes.b, undefined);
  assert.equal(reconnected.graph.nodes.c.inputs.image.kind, "link");
});

test("revisions are immutable and compare-and-swap rejects stale edits", () => {
  const store = new RevisionStore({ catalog });
  const first = store.createWorkflow({ project_id: "project-a", workflow_id: "workflow-a" });
  const second = store.editWorkflow({ workflow_id: "workflow-a", base_revision_id: first.revision_id, reason: "add source", operations: [
    { op: "add_node", node_id: "source", class_type: "Source", schema_revision: "1" },
  ] });
  assert.notEqual(first.revision_id, second.revision.revision_id);
  assert.equal(first.graph.nodes.source, undefined);
  assert.throws(() => store.editWorkflow({ workflow_id: "workflow-a", base_revision_id: first.revision_id, reason: "stale", operations: [] }), /Base revision is not the current revision/);
  assert.equal(store.blobText(second.revision.graph_hash), canonicalGraphJson(second.revision.graph));
});

test("SQLite persistence restores the current immutable revision after restart", () => {
  const dir = mkdtempSync(join(tmpdir(), "runninghub-mcp-revision-"));
    const dbPath = join(dir, "state.sqlite");
  let firstStorage;
  let secondStorage;
  try {
    firstStorage = new Storage(dbPath);
    firstStorage.registerProject("project-persisted");
    const firstStore = new RevisionStore({ persistence: new SqliteRevisionPersistence(firstStorage), catalog });
    const created = firstStore.createWorkflow({ project_id: "project-persisted", workflow_id: "workflow-persisted" });
    const edited = firstStore.editWorkflow({ workflow_id: created.workflow_id, base_revision_id: created.revision_id, reason: "persist node", operations: [
      { op: "add_node", node_id: "source", class_type: "Source", schema_revision: "1" },
    ] });
    firstStorage.close();
    firstStorage = undefined;

    secondStorage = new Storage(dbPath);
    const secondStore = new RevisionStore({ persistence: new SqliteRevisionPersistence(secondStorage), catalog });
    const restored = secondStore.getCurrent("workflow-persisted");
    assert.equal(restored.revision_id, edited.revision.revision_id);
    assert.equal(restored.graph.nodes.source.class_type, "Source");
    secondStorage.close();
    secondStorage = undefined;
  } finally {
    firstStorage?.close();
    secondStorage?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
