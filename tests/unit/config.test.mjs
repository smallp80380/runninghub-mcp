import assert from "node:assert/strict";
import test from "node:test";
import { getRunningHubLiveCases, loadConfig, RUNNINGHUB_LIVE_CASES_DEFAULT } from "../../dist/config.js";

test("Live cases default to full and normalize explicit overrides", () => {
  assert.equal(RUNNINGHUB_LIVE_CASES_DEFAULT, "full");
  assert.equal(getRunningHubLiveCases({}), "full");
  assert.equal(getRunningHubLiveCases({ RUNNINGHUB_LIVE_CASES: " LIMITED " }), "limited");
});

test("Workflow API uses built-in official routes and only reads the API key", () => {
  const config = loadConfig({
    RUNNINGHUB_WORKFLOW_API_KEY: "redacted-test-key",
    RUNNINGHUB_WORKFLOW_API_PROFILE_ID: "must-be-ignored",
    RUNNINGHUB_WORKFLOW_API_BASE_URL: "https://must-be-ignored.invalid",
    RUNNINGHUB_WORKFLOW_API_SUBMIT_PATH: "/must-be-ignored",
    RUNNINGHUB_WORKFLOW_API_STATUS_PATH: "/must-be-ignored",
    RUNNINGHUB_WORKFLOW_API_OUTPUTS_PATH: "/must-be-ignored",
    RUNNINGHUB_LIVE_CASES: "full",
  });

  assert.equal(config.profileId, "runninghub");
  assert.equal(config.workflowApi?.profile_id, "runninghub");
  assert.equal(config.workflowApi?.base_url, "https://www.runninghub.ai");
  assert.equal(config.live_cases_configured, true);
  assert.deepEqual(config.workflowApi?.routes, {
    submit: "/task/openapi/create",
    submit_v2: "/openapi/v2/run/workflow",
    workflow_json: "/api/openapi/getJsonApiFormat",
    status: "/openapi/v2/query",
    outputs: "/openapi/v2/query",
    upload: "/task/openapi/upload",
    upload_legacy: "/task/openapi/upload",
    upload_v2: "/openapi/v2/media/upload/binary",
    lora_upload_url: "/api/openapi/getLoraUploadUrl",
    cancel: "/task/openapi/cancel",
  });
});

test("Workflow API stays unavailable without the API key", () => {
  const config = loadConfig({});
  assert.equal(config.workflowApi, undefined);
  assert.equal(config.live_cases_configured, true);
});
