import { z } from "zod";

export const projectToolSchema = {
  action: z.enum(["register", "list", "inspect", "index"]),
  project_id: z.string().min(1).optional(),
  canonical_root: z.string().min(1).optional(),
  backend_profile_id: z.string().min(1).optional(),
  document_paths: z.array(z.string().min(1)).optional(),
  asset_roots: z.array(z.string().min(1)).optional(),
  output_root: z.string().min(1).optional(),
  policy_revision: z.string().min(1).optional(),
};

export const sceneToolSchema = {
  action: z.enum(["resolve", "read", "upsert"]),
  project_id: z.string().min(1),
  scene_id: z.string().min(1).optional(),
  alias: z.string().min(1).optional(),
  aliases: z.array(z.string().min(1)).optional(),
  action_text: z.string().optional(),
  output_kind: z.enum(["image", "video", "audio", "unknown"]).optional(),
  constraints: z.object({ required: z.record(z.unknown()), preferred: z.record(z.unknown()) }).optional(),
  required_asset_roles: z.array(z.string().min(1)).optional(),
  dependencies: z.array(z.string().min(1)).optional(),
  sources_hash: z.string().min(1).optional(),
};

export const workItemToolSchema = {
  action: z.enum(["create", "read", "close"]),
  project_id: z.string().min(1).optional(),
  scene_id: z.string().min(1).optional(),
  chain_id: z.string().min(1).optional(),
  user_request: z.string().min(1).optional(),
  request_kind: z.string().min(1).optional(),
  allowed_outputs: z.array(z.string().min(1)).optional(),
  work_item_id: z.string().min(1).optional(),
};

export const workflowSearchSchema = {
  output_kind: z.enum(["image", "video", "audio"]).optional(),
  required_roles: z.array(z.string().min(1)).optional(),
  backend_profile_id: z.string().min(1).optional(),
  hard_constraints: z.record(z.unknown()).optional(),
};

export const importWorkflowSchema = {
  project_id: z.string().min(1),
  relative_path: z.string().min(1).optional(),
  workflow_id: z.string().min(1).optional(),
  output_nodes: z.array(z.string().min(1)).optional(),
};
