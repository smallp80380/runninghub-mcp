import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const rootDist = join(process.cwd(), "dist");
const runtimeDist = join(process.cwd(), "rhcomfy-mcp", "dist");

function javascriptFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...javascriptFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(path);
  }
  return files.sort();
}

function digest(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

test("packaged runtime JavaScript matches the current build", () => {
  const rootFiles = javascriptFiles(rootDist);
  const runtimeFiles = javascriptFiles(runtimeDist);
  assert.ok(rootFiles.length > 0);
  assert.deepEqual(
    runtimeFiles.map((path) => relative(runtimeDist, path)),
    rootFiles.map((path) => relative(rootDist, path)),
  );
  for (const rootFile of rootFiles) {
    const relativePath = relative(rootDist, rootFile);
    assert.equal(digest(join(runtimeDist, relativePath)), digest(rootFile), relativePath);
  }
});
