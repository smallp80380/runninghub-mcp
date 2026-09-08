import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../../dist/config.js";

test("Workflow API uses built-in official routes and only reads the API key", () => {
  const config = loadConfig({
    RUNNINGHUB_WORKFLOW_API_KEY: "redacted-test-key",
    RUNNINGHUB_WORKFLOW_API_PROFILE_ID: "must-be-ignored",
    RUNNINGHUB_WORKFLOW_API_BASE_URL: "https://must-be-ignored.invalid",
    RUNNINGHUB_WORKFLOW_API_SUBMIT_PATH: "/must-be-ignored",
    RUNNINGHUB_WORKFLOW_API_STATUS_PATH: "/must-be-ignored",
    RUNNINGHUB_WORKFLOW_API_OUTPUTS_PATH: "/must-be-ignored",
  });

  assert.equal(config.profileId, "runninghub");
  assert.equal(config.workflowApi?.profile_id, "runninghub");
  assert.equal(config.workflowApi?.base_url, "https://www.runninghub.ai");
  assert.deepEqual(config.workflowApi?.routes, {
    submit: "/task/openapi/create",
    status: "/openapi/v2/query",
    outputs: "/openapi/v2/query",
    upload: "/openapi/v2/media/upload/binary",
    lora_upload_url: "/api/openapi/getLoraUploadUrl",
    cancel: "/task/openapi/cancel",
  });
});

test("Workflow API stays unavailable without the API key", () => {
  const config = loadConfig({});
  assert.equal(config.workflowApi, undefined);
});
