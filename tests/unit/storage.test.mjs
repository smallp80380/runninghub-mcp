import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Storage } from "../../dist/storage/database.js";

test("SQLite migrations are applied and reopening is idempotent", () => {
  const dir = mkdtempSync(join(tmpdir(), "runninghub-mcp-unit-"));
  const dbPath = join(dir, "state.sqlite");
  try {
    const first = new Storage(dbPath);
    assert.deepEqual(first.health(), { migration_version: 12, table_count: 17 });
    first.close();
    const second = new Storage(dbPath);
    assert.deepEqual(second.health(), { migration_version: 12, table_count: 17 });
    second.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("expired provider upload cache entries are invalidated for media and LoRA", () => {
  const storage = new Storage(":memory:");
  const past = "2020-01-01T00:00:00.000Z";
  const future = "2999-01-01T00:00:00.000Z";
  try {
    storage.saveProviderUpload({
      profile_id: "profile",
      api_family: "workflow_api",
      asset_id: "asset",
      content_hash: "asset-hash",
      mime: "image/png",
      provider_kind: "provider_url",
      provider_value: "https://cdn.example/asset.png",
      expires_at: future,
      created_at: future,
      updated_at: future,
    });
    storage.db.prepare("UPDATE provider_uploads SET expires_at = ?").run(past);
    assert.equal(storage.getProviderUpload("profile", "workflow_api", "asset", "asset-hash"), undefined);
    assert.equal(storage.db.prepare("SELECT COUNT(*) AS count FROM provider_uploads").get().count, 0);

    storage.saveLoraUpload({
      profile_id: "profile",
      api_family: "workflow_api",
      asset_id: "lora",
      content_hash: "lora-hash",
      provider_kind: "provider_lora",
      provider_value: "lora/style.safetensors",
      expires_at: future,
      created_at: future,
      updated_at: future,
    });
    storage.db.prepare("UPDATE lora_uploads SET expires_at = ?").run(past);
    assert.equal(storage.getLoraUpload("profile", "workflow_api", "lora-hash"), undefined);
    assert.equal(storage.db.prepare("SELECT COUNT(*) AS count FROM lora_uploads").get().count, 0);
  } finally {
    storage.close();
  }
});
