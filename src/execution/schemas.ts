import { z } from "zod";

export const prepareGenerationSchema = {
  work_item_id: z.string().min(1),
  workflow_revision_id: z.string().min(1),
  backend_profile_id: z.string().min(1),
  provider_workflow_id: z.string().min(1).optional(),
  asset_bindings: z.array(z.object({
    asset_id: z.string().min(1),
    content_hash: z.string().regex(/^[a-f0-9]{64}$/i),
    provider_ref: z.object({
      kind: z.enum(["provider_file", "provider_url"]),
      value: z.string().min(1),
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
  timeout_ms: z.number().int().min(0).max(60_000).optional(),
};

export const getResultsSchema = {
  job_id: z.string().min(1),
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
