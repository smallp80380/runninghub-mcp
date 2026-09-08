import { z } from "zod";

export const inputValueSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("literal"), value: z.unknown() }).strict(),
  z.object({ kind: z.literal("integer"), decimal: z.string().regex(/^-?(?:0|[1-9]\d*)$/) }).strict(),
  z.object({ kind: z.literal("link"), node_id: z.string().min(1), output_index: z.number().int().nonnegative() }).strict(),
  z.object({ kind: z.literal("asset"), asset_id: z.string().min(1), representation: z.string().min(1) }).strict(),
]);

export const graphOperationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add_node"), class_type: z.string().min(1), schema_revision: z.string().min(1), node_id: z.string().min(1).optional(), inputs: z.record(inputValueSchema).optional() }).strict(),
  z.object({ op: z.literal("remove_node"), node_id: z.string().min(1), strategy: z.enum(["reject_if_referenced", "defer_reconnect"]).optional() }).strict(),
  z.object({ op: z.literal("set_input"), node_id: z.string().min(1), input_name: z.string().min(1), value: inputValueSchema }).strict(),
  z.object({ op: z.literal("unset_input"), node_id: z.string().min(1), input_name: z.string().min(1) }).strict(),
  z.object({ op: z.literal("connect"), source_node_id: z.string().min(1), output_index: z.number().int().nonnegative(), target_node_id: z.string().min(1), input_name: z.string().min(1), replace_existing: z.boolean().optional() }).strict(),
  z.object({ op: z.literal("disconnect"), target_node_id: z.string().min(1), input_name: z.string().min(1) }).strict(),
  z.object({ op: z.literal("replace_node"), node_id: z.string().min(1), class_type: z.string().min(1), schema_revision: z.string().min(1), port_mapping: z.record(z.string()).optional() }).strict(),
  z.object({ op: z.literal("bind_asset"), asset_id: z.string().min(1), representation: z.string().min(1), target_node_id: z.string().min(1), input_name: z.string().min(1) }).strict(),
  z.object({ op: z.literal("set_output_nodes"), output_nodes: z.array(z.string().min(1)) }).strict(),
  z.object({ op: z.literal("set_model"), model_id: z.string().min(1), target_node_id: z.string().min(1), input_name: z.string().min(1) }).strict(),
]);

export const createWorkflowSchema = {
  project_id: z.string().min(1),
  workflow_id: z.string().min(1).optional(),
  api_graph: z.string().min(2).optional(),
  output_nodes: z.array(z.string().min(1)).optional(),
  reason: z.string().min(1).optional(),
};
export const getWorkflowSchema = {
  workflow_id: z.string().min(1),
  revision_id: z.string().min(1).optional(),
};

export const editWorkflowSchema = {
  workflow_id: z.string().min(1),
  base_revision_id: z.string().min(1),
  reason: z.string().min(1),
  operations: z.array(graphOperationSchema).min(1),
};

export const validateWorkflowSchema = {
  workflow_id: z.string().min(1),
  revision_id: z.string().min(1).optional(),
};

export const exportWorkflowSchema = {
  workflow_id: z.string().min(1),
  revision_id: z.string().min(1).optional(),
  format: z.literal("api").default("api"),
};
