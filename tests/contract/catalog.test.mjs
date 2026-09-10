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

test("catalog payload validation enforces numeric and string constraints", () => {
  const result = validatePayload({
    endpoint: "constraint-fixture",
    output_type: "image",
    params: [
      { fieldKey: "count", type: "INT", required: true, min: 2, max: 8, step: 2 },
      { fieldKey: "strength", type: "FLOAT", required: true, min: 0, max: 1 },
      { fieldKey: "prompt", type: "STRING", required: true, maxLength: 5 },
    ],
  }, {
    count: 3,
    strength: Infinity,
    prompt: "too long",
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /Invalid step for count/);
  assert.match(result.errors.join("\n"), /Invalid number for strength/);
  assert.match(result.errors.join("\n"), /String too long for prompt/);

  const unsafe = validatePayload({
    endpoint: "integer-fixture",
    output_type: "image",
    params: [{ fieldKey: "seed", type: "INT", required: true }],
  }, { seed: 9007199254740992 });
  assert.equal(unsafe.valid, false);
  assert.match(unsafe.errors[0], /Invalid integer/);
});
