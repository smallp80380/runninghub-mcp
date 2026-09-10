import { z } from "zod";
import { graphOperationSchema } from "../graph/schemas.js";

export const prepareGenerationSchema = {
  work_item_id: z.string().min(1),
  workflow_revision_id: z.string().min(1),
  backend_profile_id: z.string().min(1),
  provider_workflow_id: z.string().min(1).optional(),
  provider_submit_mode: z.enum(["v2_node_info", "legacy_saved", "legacy_graph"]).optional(),
  asset_bindings: z.array(z.object({
    asset_id: z.string().min(1),
    content_hash: z.string().regex(/^[a-f0-9]{64}$/i),
    provider_ref: z.object({
      kind: z.enum(["provider_file", "provider_url"]),
      value: z.string().min(1),
      expires_at: z.string().datetime().optional(),
    }).strict().optional(),
  }).strict()).default([]),
  output_contract: z.record(z.unknown()),
  mode: z.enum(["production", "capability_test"]).default("production"),
};

export const runWorkflowSchema = {
  plan_id: z.string().min(1),
  request_id: z.string().min(1),
};

export const jobSchema = {
  action: z.enum(["status", "wait", "resume", "cancel"]),
  job_id: z.string().min(1),
  provider_task_id: z.string().min(1).max(256).regex(/^[A-Za-z0-9._:-]+$/).optional(),
  timeout_ms: z.number().int().min(0).max(60_000).optional(),
};

export const getResultsSchema = {
  job_id: z.string().min(1),
};

export const reviewResultSchema = {
  result_id: z.string().min(1),
  decision: z.enum(["APPROVED", "CHANGES_REQUESTED", "REJECTED"]),
  feedback: z.string().min(1).optional(),
  user_message_ref: z.string().min(1).optional(),
  review_event_id: z.string().min(1).optional(),
  continuation: z.object({
    plan_id: z.string().min(1),
    request_id: z.string().min(1),
  }).strict().optional(),
  revision_request: z.object({
    reason: z.string().min(1),
    operations: z.array(graphOperationSchema).min(1),
    user_request: z.string().min(1).optional(),
    request_kind: z.string().min(1).optional(),
    allowed_outputs: z.array(z.string().min(1)).min(1).optional(),
  }).strict().optional(),
};

export const assetToolSchema = {
  action: z.enum(["inspect", "register", "prepare", "upload"]),
  project_id: z.string().min(1),
  asset_id: z.string().min(1).optional(),
  relative_path: z.string().min(1).optional(),
  roles: z.array(z.string().min(1)).optional(),
  work_item_id: z.string().min(1).optional(),
  backend_profile_id: z.string().min(1).optional(),
};

export const uploadLoraSchema = {
  project_id: z.string().min(1),
  asset_id: z.string().min(1),
  work_item_id: z.string().min(1),
  backend_profile_id: z.string().min(1).optional(),
};
