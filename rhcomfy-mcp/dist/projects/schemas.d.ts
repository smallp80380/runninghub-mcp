import { z } from "zod";
export declare const projectToolSchema: {
    action: z.ZodEnum<["register", "list", "inspect", "index"]>;
    project_id: z.ZodOptional<z.ZodString>;
    canonical_root: z.ZodOptional<z.ZodString>;
    backend_profile_id: z.ZodOptional<z.ZodString>;
    document_paths: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    asset_roots: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    output_root: z.ZodOptional<z.ZodString>;
    policy_revision: z.ZodOptional<z.ZodString>;
};
export declare const sceneToolSchema: {
    action: z.ZodEnum<["resolve", "read", "upsert"]>;
    project_id: z.ZodString;
    scene_id: z.ZodOptional<z.ZodString>;
    alias: z.ZodOptional<z.ZodString>;
    aliases: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    action_text: z.ZodOptional<z.ZodString>;
    output_kind: z.ZodOptional<z.ZodEnum<["image", "video", "audio", "unknown"]>>;
    constraints: z.ZodOptional<z.ZodObject<{
        required: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        preferred: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        required: Record<string, unknown>;
        preferred: Record<string, unknown>;
    }, {
        required: Record<string, unknown>;
        preferred: Record<string, unknown>;
    }>>;
    required_asset_roles: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    dependencies: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sources_hash: z.ZodOptional<z.ZodString>;
};
export declare const workItemToolSchema: {
    action: z.ZodEnum<["create", "read", "close"]>;
    project_id: z.ZodOptional<z.ZodString>;
    scene_id: z.ZodOptional<z.ZodString>;
    chain_id: z.ZodOptional<z.ZodString>;
    user_request: z.ZodOptional<z.ZodString>;
    request_kind: z.ZodOptional<z.ZodString>;
    allowed_outputs: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    work_item_id: z.ZodOptional<z.ZodString>;
};
export declare const workflowSearchSchema: {
    output_kind: z.ZodOptional<z.ZodEnum<["image", "video", "audio"]>>;
    required_roles: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    backend_profile_id: z.ZodOptional<z.ZodString>;
    hard_constraints: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
};
export declare const importWorkflowSchema: {
    project_id: z.ZodString;
    relative_path: z.ZodOptional<z.ZodString>;
    workflow_id: z.ZodOptional<z.ZodString>;
    output_nodes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
};
