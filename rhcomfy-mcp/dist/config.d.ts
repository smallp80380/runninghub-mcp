import type { WorkflowApiRoutes } from "./backends/workflow-api/client.js";
export declare const RUNNINGHUB_WORKFLOW_PROFILE_ID = "runninghub";
export declare const RUNNINGHUB_WORKFLOW_API_BASE_URL = "https://www.runninghub.ai";
export declare const RUNNINGHUB_WORKFLOW_API_ROUTES: WorkflowApiRoutes;
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
export declare function loadConfig(env?: NodeJS.ProcessEnv): AppConfig;
