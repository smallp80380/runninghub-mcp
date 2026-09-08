import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { loadRunningHubData } from "../../dist/mcp/upstream/data.js";
import { searchModels } from "../../dist/mcp/upstream/search.js";
import { validatePayload } from "../../dist/mcp/upstream/validation.js";

test("pinned catalog loads without network and supports deterministic search", () => {
  const data = loadRunningHubData(resolve(process.cwd(), "data", "upstream"));
  assert.equal(data.registry.model_count, data.registry.models.length);
  assert.equal(data.pricing.pricing_count, data.pricing.pricing.length);
  const result = searchModels(data, { output_type: "image", limit: 3 });
  assert.equal(result.models.length, 3);
  assert.equal(result.models[0]?.output_type, "image");
});

test("catalog payload validation reports missing required fields", () => {
  const data = loadRunningHubData(resolve(process.cwd(), "data", "upstream"));
  const model = data.registry.models.find((item) => item.params.some((param) => param.required));
  assert.ok(model);
  const result = validatePayload(model, {});
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});
