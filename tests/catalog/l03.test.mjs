import assert from "node:assert/strict";
import test from "node:test";
import { GraphModelCatalog, checkModelCompatibility } from "../../dist/catalog/models.js";
import { syntheticSchemaProfile } from "../../dist/catalog/profiles.js";
import { insertBlock, removeBlock } from "../../dist/graph/blocks.js";
import { importUiGraph, UiCodecError, exportUiGraph } from "../../dist/graph/uiCodec.js";
import { MapNodeCatalog } from "../../dist/graph/types.js";

const nodeCatalog = new MapNodeCatalog(syntheticSchemaProfile.nodes);

const block = {
  block_id: "consumer-save",
  revision_id: "1",
  nodes: [
    { id: "consumer", class_type: "ModelConsumer", schema_revision: "synthetic-basic-v1", inputs: {} },
    { id: "save", class_type: "Save", schema_revision: "synthetic-basic-v1", inputs: { image: { kind: "link", node_id: "consumer", output_index: 0 } } },
  ],
  inputs: [{ name: "model", node_id: "consumer", input_name: "model" }],
  outputs: [{ name: "file", node_id: "save", output_index: 0 }],
  dependency_constraints: [],
};

test("block insertion remaps owned IDs and removal keeps shared loader", () => {
  const graph = {
    schema_version: "1",
    nodes: {
      loader: { id: "loader", class_type: "SharedLoader", schema_revision: "synthetic-basic-v1", inputs: { model_id: { kind: "literal", value: "model-a" } } },
    },
    output_nodes: [],
    metadata: {},
  };
  const first = insertBlock(graph, block, "instance-a", { model: { kind: "link", node_id: "loader", output_index: 0 } });
  const second = insertBlock(first.graph, block, "instance-b", { model: { kind: "link", node_id: "loader", output_index: 0 } });
  assert.ok(second.graph.nodes["instance-a::consumer"]);
  assert.ok(second.graph.nodes["instance-b::consumer"]);
  const removed = removeBlock(second.graph, second.instance === first.instance ? first.instance : { instance_id: "instance-a", block_id: "consumer-save", revision_id: "1", node_ids: ["instance-a::consumer", "instance-a::save"] });
  assert.ok(removed.nodes.loader);
  assert.equal(removed.nodes["instance-a::consumer"], undefined);
  assert.ok(removed.nodes["instance-b::consumer"]);
});
test("model family mismatch is explicit", () => {
  const graph = {
    schema_version: "1",
    nodes: {
      loader: { id: "loader", class_type: "SharedLoader", schema_revision: "synthetic-basic-v1", inputs: { model_id: { kind: "literal", value: "model-a" } } },
    },
    output_nodes: [],
    metadata: {},
  };
  const models = new GraphModelCatalog([
    { model_id: "model-a", family: "base", loader_class: "SharedLoader", backend_scope: "synthetic", compatible_consumers: ["ModelConsumer"], source_evidence: "fixture", availability: "verified" },
    { model_id: "model-b", family: "other", loader_class: "OtherLoader", backend_scope: "synthetic", compatible_consumers: [], source_evidence: "fixture", availability: "verified" },
  ]);
  assert.equal(checkModelCompatibility(graph, "model-a", models, nodeCatalog).compatible, true);
  const conflict = checkModelCompatibility(graph, "model-b", models, nodeCatalog);
  assert.equal(conflict.compatible, false);
  assert.ok(conflict.issues.some((issue) => issue.code === "LOADER_MISMATCH"));
});

test("supported UI JSON preserves links and mapped widgets", () => {
  const source = JSON.stringify({
    last_node_id: 3,
    last_link_id: 2,
    nodes: [
      { id: 1, type: "Source", pos: [0, 0], size: [200, 100], mode: 0, inputs: [], outputs: [], widgets_values: [] },
      { id: 2, type: "Transform", pos: [300, 0], size: [200, 100], mode: 0, inputs: [{ name: "image", type: "image", link: 1 }], outputs: [], widgets_values: ["hello", 7] },
      { id: 3, type: "Save", pos: [600, 0], size: [200, 100], mode: 0, inputs: [{ name: "image", type: "image", link: 2 }], outputs: [], widgets_values: ["result"] },
    ],
    links: [[1, 1, 0, 2, 0, "image"], [2, 2, 0, 3, 0, "image"]],
    groups: [], config: {}, extra: {}, version: 0.4,
  });
  const imported = importUiGraph(source, syntheticSchemaProfile.ui);
  assert.equal(imported.graph.nodes["2"].inputs.image.node_id, "1");
  assert.deepEqual(imported.graph.nodes["2"].inputs.prompt, { kind: "literal", value: "hello" });
  assert.deepEqual(imported.graph.nodes["2"].inputs.seed, { kind: "integer", decimal: "7" });
  const exported = exportUiGraph(imported.graph, syntheticSchemaProfile.ui);
  const roundTrip = importUiGraph(exported, syntheticSchemaProfile.ui);
  assert.equal(roundTrip.graph.nodes["2"].inputs.image.node_id, "1");
  assert.equal(roundTrip.graph.output_nodes[0], "3");
});

test("unknown UI extension is rejected while original source remains available", () => {
  const source = JSON.stringify({ nodes: [], links: [], unknown_extension: { secret: false } });
  assert.throws(() => importUiGraph(source, syntheticSchemaProfile.ui), (error) => {
    assert.ok(error instanceof UiCodecError);
    assert.equal(error.source_json, source);
    return true;
  });
});
