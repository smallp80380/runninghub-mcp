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
    assert.deepEqual(first.health(), { migration_version: 7, table_count: 16 });
    first.close();
    const second = new Storage(dbPath);
    assert.deepEqual(second.health(), { migration_version: 7, table_count: 16 });
    second.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
