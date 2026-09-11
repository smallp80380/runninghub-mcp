import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { WorkflowApiRoutes } from "./backends/workflow-api/client.js";

export const RUNNINGHUB_WORKFLOW_PROFILE_ID = "runninghub";
export const RUNNINGHUB_WORKFLOW_API_BASE_URL = "https://www.runninghub.ai";
export const RUNNINGHUB_LIVE_CASES_DEFAULT = "full";
export const RUNNINGHUB_WORKFLOW_API_ROUTES: WorkflowApiRoutes = {
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
};

export interface AppConfig {
  readonly dataDir: string;
  readonly dbPath: string;
  readonly catalogDir: string;
  readonly profileId: string;
  readonly live_cases_configured: boolean;
  readonly projectRoot?: string;
  readonly workflowApi?: {
    readonly profile_id: string;
    readonly base_url: string;
    readonly api_key: string;
    readonly routes: WorkflowApiRoutes;
  };
}

export function getRunningHubLiveCases(env: NodeJS.ProcessEnv = process.env): string {
  return env.RUNNINGHUB_LIVE_CASES?.trim().toLowerCase() || RUNNINGHUB_LIVE_CASES_DEFAULT;
}

function pathFromEnv(value: string | undefined, fallback: string): string {
  return value ? resolve(value) : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const dataDir = pathFromEnv(env.RUNNINGHUB_DATA_DIR, join(homedir(), ".runninghub"));
  const dbPath = pathFromEnv(env.RUNNINGHUB_DB_PATH, join(dataDir, "runninghub.sqlite"));
  const catalogDir = pathFromEnv(env.RUNNINGHUB_CATALOG_DIR, resolve(process.cwd(), "data", "upstream"));
  const projectRoot = env.RUNNINGHUB_PROJECT_ROOT
    ? resolve(env.RUNNINGHUB_PROJECT_ROOT)
    : undefined;
  const profileId = RUNNINGHUB_WORKFLOW_PROFILE_ID;
  const workflowApi = readWorkflowApiConfig(env, profileId);

  if (!isAbsolute(dataDir) || !isAbsolute(dbPath) || !isAbsolute(catalogDir)) {
    throw new Error("Resolved RunningHub paths must be absolute.");
  }
  if (dirname(dbPath) !== dataDir && !env.RUNNINGHUB_DB_PATH) {
    throw new Error("Default database path must be inside RUNNINGHUB_DATA_DIR.");
  }

  return {
    dataDir,
    dbPath,
    catalogDir,
    profileId,
    live_cases_configured: Boolean(getRunningHubLiveCases(env)),
    ...(projectRoot ? { projectRoot } : {}),
    ...(workflowApi ? { workflowApi } : {}),
  };
}

function readWorkflowApiConfig(env: NodeJS.ProcessEnv, defaultProfileId: string): AppConfig["workflowApi"] {
  const apiKey = env.RUNNINGHUB_WORKFLOW_API_KEY?.trim();
  if (!apiKey) return undefined;
  return { profile_id: defaultProfileId, base_url: RUNNINGHUB_WORKFLOW_API_BASE_URL, api_key: apiKey, routes: RUNNINGHUB_WORKFLOW_API_ROUTES };
}
