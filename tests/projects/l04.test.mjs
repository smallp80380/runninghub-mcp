import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ProjectContextService, WorkflowLibrary } from "../../dist/projects/context.js";
import { defaultWorkflowCards } from "../../dist/projects/library.js";
import { Storage } from "../../dist/storage/database.js";

function createProjectRoot(prefix) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  mkdirSync(join(root, "assets"), { recursive: true });
  writeFileSync(join(root, "plan.md"), "# Plan\nScene 02B\n", "utf8");
  writeFileSync(join(root, "assets", "character.png"), Buffer.from("character-v1"));
  writeFileSync(join(root, "assets", "location.png"), Buffer.from("location-v1"));
  return root;
}

function scene(projectId, sceneId, aliases, role = "character") {
  return {
    project_id: projectId,
    scene_id: sceneId,
    aliases,
    action_text: "A character crosses the location.",
    output_kind: "image",
    constraints: { required: { aspect_ratio: "16:9" }, preferred: {} },
    required_asset_roles: [role],
    dependencies: ["plan.md"],
  };
}

test("two projects resolve the same 02B alias without mixing assets", () => {
  const rootA = createProjectRoot("runninghub-project-a-");
  const rootB = createProjectRoot("runninghub-project-b-");
  const storage = new Storage(":memory:");
  const context = new ProjectContextService(storage);
  try {
    context.registerProject({ project_id: "project-a", canonical_root: rootA, backend_profile_id: "synthetic-basic", document_paths: ["plan.md"], asset_roots: ["assets"], output_root: "outputs" });
    context.registerProject({ project_id: "project-b", canonical_root: rootB, backend_profile_id: "synthetic-basic", document_paths: ["plan.md"], asset_roots: ["assets"], output_root: "outputs" });
    context.indexProject("project-a");
    context.indexProject("project-b");
    context.registerAsset("project-a", "assets/character.png", ["character"]);
    context.registerAsset("project-b", "assets/location.png", ["location"]);
    context.upsertScene(scene("project-a", "scene-a", ["02B", "scene_02b"]));
    context.upsertScene(scene("project-b", "scene-b", ["02b"], "location"));

    const resolvedA = context.resolveScene("project-a", "02b");
    const resolvedB = context.resolveScene("project-b", "02B");
    assert.equal(resolvedA.scene.scene_id, "scene-a");
    assert.equal(resolvedA.assets[0].relative_path, "assets/character.png");
    assert.equal(resolvedB.scene.scene_id, "scene-b");
    assert.equal(resolvedB.assets[0].relative_path, "assets/location.png");
    assert.notEqual(resolvedA.assets[0].project_id, resolvedB.assets[0].project_id);
  } finally {
    storage.close();
    rmSync(rootA, { recursive: true, force: true });
    rmSync(rootB, { recursive: true, force: true });
  }
});

test("project reindex preserves registered asset roles and document index", () => {
  const root = createProjectRoot("runninghub-project-reindex-");
  const storage = new Storage(":memory:");
  const context = new ProjectContextService(storage);
  try {
    context.registerProject({
      project_id: "project-reindex",
      canonical_root: root,
      backend_profile_id: "synthetic-basic",
      document_paths: ["plan.md"],
      asset_roots: ["assets"],
      output_root: "outputs",
    });
    context.registerAsset("project-reindex", "assets/character.png", ["character"]);

    const indexed = context.indexProject("project-reindex");
    const character = indexed.assets.find((asset) => asset.relative_path === "assets/character.png");
    assert.equal(indexed.documents.length, 1);
    assert.deepEqual(character?.roles, ["character"]);
  } finally {
    storage.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("asset hash changes invalidate the old path binding and missing roles are explicit", () => {
  const root = createProjectRoot("runninghub-project-change-");
  const storage = new Storage(":memory:");
  const context = new ProjectContextService(storage);
  try {
    context.registerProject({ project_id: "project-change", canonical_root: root, backend_profile_id: "synthetic-basic", asset_roots: ["assets"], output_root: "outputs" });
    const first = context.registerAsset("project-change", "assets/character.png", ["character"]);
    context.upsertScene(scene("project-change", "scene-change", ["02b"]));
    writeFileSync(join(root, "assets", "character.png"), Buffer.from("character-v2"));
    const second = context.registerAsset("project-change", "assets/character.png", ["character"]);
    assert.notEqual(first.content_hash, second.content_hash);
    assert.throws(() => context.resolveScene("project-change", "02b"), /multiple content hashes/);

    context.upsertScene(scene("project-change", "scene-missing", ["missing"], "location"));
    assert.throws(() => context.resolveScene("project-change", "missing"), /Required asset roles are missing/);
  } finally {
    storage.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("ambiguous aliases and hard workflow constraints are not guessed away", () => {
  const root = createProjectRoot("runninghub-project-ambiguous-");
  const storage = new Storage(":memory:");
  const context = new ProjectContextService(storage);
  try {
    context.registerProject({ project_id: "project-ambiguous", canonical_root: root, backend_profile_id: "synthetic-basic", output_root: "outputs" });
    context.upsertScene(scene("project-ambiguous", "scene-one", ["02b"]));
    context.upsertScene(scene("project-ambiguous", "scene-two", ["02b"]));
    assert.throws(() => context.resolveScene("project-ambiguous", "02B"), /matches multiple scenes/);
  } finally {
    storage.close();
    rmSync(root, { recursive: true, force: true });
  }

  const library = new WorkflowLibrary(defaultWorkflowCards);
  const reference = library.search({ output_kind: "image", required_roles: ["character", "location"], backend_profile_id: "synthetic-basic", hard_constraints: { aspect_ratio: "16:9" } });
  assert.deepEqual(reference.selected.map((card) => card.workflow_id), ["synthetic-reference-image-v1"]);
  assert.ok(reference.rejected.some((item) => item.workflow_id === "synthetic-text-to-image-v1"));
  const video = library.search({ output_kind: "video", required_roles: ["first_frame"], backend_profile_id: "synthetic-basic" });
  assert.deepEqual(video.selected.map((card) => card.workflow_id), ["synthetic-image-to-video-v1"]);
});

test("missing project is reported before scene resolution", () => {
  const storage = new Storage(":memory:");
  const context = new ProjectContextService(storage);
  try {
    assert.throws(() => context.resolveScene("missing-project", "02b"), /Project missing-project was not found/);
  } finally {
    storage.close();
  }
});

test("project workflow discovery finds API JSON without treating assets or plans as workflows", () => {
  const root = createProjectRoot("runninghub-project-workflows-");
  mkdirSync(join(root, "workflows"), { recursive: true });
  writeFileSync(join(root, "workflows", "9876543210123456789.json"), JSON.stringify({ "1": { class_type: "SaveImage", inputs: {} } }), "utf8");
  writeFileSync(join(root, "workflows", "notes.json"), JSON.stringify({ title: "not an API graph" }), "utf8");
  const storage = new Storage(":memory:");
  const context = new ProjectContextService(storage);
  try {
    context.registerProject({ project_id: "project-workflows", canonical_root: root, backend_profile_id: "synthetic-basic", asset_roots: ["assets"], output_root: "outputs" });
    const candidates = context.discoverWorkflowFiles("project-workflows");
    assert.deepEqual(candidates.map((candidate) => candidate.relative_path), ["workflows/9876543210123456789.json"]);
    assert.equal(candidates[0].workflow_id_hint, "9876543210123456789");
    const source = context.readWorkflowFile("project-workflows", "workflows/9876543210123456789.json");
    assert.equal(source.graph_hash, candidates[0].graph_hash);
    assert.match(source.api_graph, /SaveImage/);
  } finally {
    storage.close();
    rmSync(root, { recursive: true, force: true });
  }
});
