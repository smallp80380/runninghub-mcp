import { z } from "zod";
export declare const prepareGenerationSchema: {
    work_item_id: z.ZodString;
    workflow_revision_id: z.ZodString;
    backend_profile_id: z.ZodString;
    provider_workflow_id: z.ZodOptional<z.ZodString>;
    provider_submit_mode: z.ZodOptional<z.ZodEnum<["v2_node_info", "legacy_saved", "legacy_graph"]>>;
    asset_bindings: z.ZodDefault<z.ZodArray<z.ZodObject<{
        asset_id: z.ZodString;
        content_hash: z.ZodString;
        provider_ref: z.ZodOptional<z.ZodObject<{
            kind: z.ZodEnum<["provider_file", "provider_url"]>;
            value: z.ZodString;
            expires_at: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            kind: "provider_file" | "provider_url";
            value: string;
            expires_at?: string | undefined;
        }, {
            kind: "provider_file" | "provider_url";
            value: string;
            expires_at?: string | undefined;
        }>>;
    }, "strict", z.ZodTypeAny, {
        asset_id: string;
        content_hash: string;
        provider_ref?: {
            kind: "provider_file" | "provider_url";
            value: string;
            expires_at?: string | undefined;
        } | undefined;
    }, {
        asset_id: string;
        content_hash: string;
        provider_ref?: {
            kind: "provider_file" | "provider_url";
            value: string;
            expires_at?: string | undefined;
        } | undefined;
    }>, "many">>;
    output_contract: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    mode: z.ZodDefault<z.ZodEnum<["production", "capability_test"]>>;
};
export declare const runWorkflowSchema: {
    plan_id: z.ZodString;
    request_id: z.ZodString;
};
export declare const jobSchema: {
    action: z.ZodEnum<["status", "wait", "resume", "cancel"]>;
    job_id: z.ZodString;
    provider_task_id: z.ZodOptional<z.ZodString>;
    timeout_ms: z.ZodOptional<z.ZodNumber>;
};
export declare const getResultsSchema: {
    job_id: z.ZodString;
};
export declare const reviewResultSchema: {
    result_id: z.ZodString;
    decision: z.ZodEnum<["APPROVED", "CHANGES_REQUESTED", "REJECTED"]>;
    feedback: z.ZodOptional<z.ZodString>;
    user_message_ref: z.ZodOptional<z.ZodString>;
    review_event_id: z.ZodOptional<z.ZodString>;
    continuation: z.ZodOptional<z.ZodObject<{
        plan_id: z.ZodString;
        request_id: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        plan_id: string;
        request_id: string;
    }, {
        plan_id: string;
        request_id: string;
    }>>;
    revision_request: z.ZodOptional<z.ZodObject<{
        reason: z.ZodString;
        operations: z.ZodArray<z.ZodDiscriminatedUnion<"op", [z.ZodObject<{
            op: z.ZodLiteral<"add_node">;
            class_type: z.ZodString;
            schema_revision: z.ZodString;
            node_id: z.ZodOptional<z.ZodString>;
            inputs: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
                kind: z.ZodLiteral<"literal">;
                value: z.ZodUnknown;
            }, "strict", z.ZodTypeAny, {
                kind: "literal";
                value?: unknown;
            }, {
                kind: "literal";
                value?: unknown;
            }>, z.ZodObject<{
                kind: z.ZodLiteral<"integer">;
                decimal: z.ZodString;
            }, "strict", z.ZodTypeAny, {
                kind: "integer";
                decimal: string;
            }, {
                kind: "integer";
                decimal: string;
            }>, z.ZodObject<{
                kind: z.ZodLiteral<"link">;
                node_id: z.ZodString;
                output_index: z.ZodNumber;
            }, "strict", z.ZodTypeAny, {
                kind: "link";
                node_id: string;
                output_index: number;
            }, {
                kind: "link";
                node_id: string;
                output_index: number;
            }>, z.ZodObject<{
                kind: z.ZodLiteral<"asset">;
                asset_id: z.ZodString;
                representation: z.ZodString;
            }, "strict", z.ZodTypeAny, {
                asset_id: string;
                kind: "asset";
                representation: string;
            }, {
                asset_id: string;
                kind: "asset";
                representation: string;
            }>]>>>;
        }, "strict", z.ZodTypeAny, {
            class_type: string;
            schema_revision: string;
            op: "add_node";
            node_id?: string | undefined;
            inputs?: Record<string, {
                kind: "literal";
                value?: unknown;
            } | {
                kind: "integer";
                decimal: string;
            } | {
                kind: "link";
                node_id: string;
                output_index: number;
            } | {
                asset_id: string;
                kind: "asset";
                representation: string;
            }> | undefined;
        }, {
            class_type: string;
            schema_revision: string;
            op: "add_node";
            node_id?: string | undefined;
            inputs?: Record<string, {
                kind: "literal";
                value?: unknown;
            } | {
                kind: "integer";
                decimal: string;
            } | {
                kind: "link";
                node_id: string;
                output_index: number;
            } | {
                asset_id: string;
                kind: "asset";
                representation: string;
            }> | undefined;
        }>, z.ZodObject<{
            op: z.ZodLiteral<"remove_node">;
            node_id: z.ZodString;
            strategy: z.ZodOptional<z.ZodEnum<["reject_if_referenced", "defer_reconnect"]>>;
        }, "strict", z.ZodTypeAny, {
            node_id: string;
            op: "remove_node";
            strategy?: "reject_if_referenced" | "defer_reconnect" | undefined;
        }, {
            node_id: string;
            op: "remove_node";
            strategy?: "reject_if_referenced" | "defer_reconnect" | undefined;
        }>, z.ZodObject<{
            op: z.ZodLiteral<"set_input">;
            node_id: z.ZodString;
            input_name: z.ZodString;
            value: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
                kind: z.ZodLiteral<"literal">;
                value: z.ZodUnknown;
            }, "strict", z.ZodTypeAny, {
                kind: "literal";
                value?: unknown;
            }, {
                kind: "literal";
                value?: unknown;
            }>, z.ZodObject<{
                kind: z.ZodLiteral<"integer">;
                decimal: z.ZodString;
            }, "strict", z.ZodTypeAny, {
                kind: "integer";
                decimal: string;
            }, {
                kind: "integer";
                decimal: string;
            }>, z.ZodObject<{
                kind: z.ZodLiteral<"link">;
                node_id: z.ZodString;
                output_index: z.ZodNumber;
            }, "strict", z.ZodTypeAny, {
                kind: "link";
                node_id: string;
                output_index: number;
            }, {
                kind: "link";
                node_id: string;
                output_index: number;
            }>, z.ZodObject<{
                kind: z.ZodLiteral<"asset">;
                asset_id: z.ZodString;
                representation: z.ZodString;
            }, "strict", z.ZodTypeAny, {
                asset_id: string;
                kind: "asset";
                representation: string;
            }, {
                asset_id: string;
                kind: "asset";
                representation: string;
            }>]>;
        }, "strict", z.ZodTypeAny, {
            value: {
                kind: "literal";
                value?: unknown;
            } | {
                kind: "integer";
                decimal: string;
            } | {
                kind: "link";
                node_id: string;
                output_index: number;
            } | {
                asset_id: string;
                kind: "asset";
                representation: string;
            };
            node_id: string;
            input_name: string;
            op: "set_input";
        }, {
            value: {
                kind: "literal";
                value?: unknown;
            } | {
                kind: "integer";
                decimal: string;
            } | {
                kind: "link";
                node_id: string;
                output_index: number;
            } | {
                asset_id: string;
                kind: "asset";
                representation: string;
            };
            node_id: string;
            input_name: string;
            op: "set_input";
        }>, z.ZodObject<{
            op: z.ZodLiteral<"unset_input">;
            node_id: z.ZodString;
            input_name: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            node_id: string;
            input_name: string;
            op: "unset_input";
        }, {
            node_id: string;
            input_name: string;
            op: "unset_input";
        }>, z.ZodObject<{
            op: z.ZodLiteral<"connect">;
            source_node_id: z.ZodString;
            output_index: z.ZodNumber;
            target_node_id: z.ZodString;
            input_name: z.ZodString;
            replace_existing: z.ZodOptional<z.ZodBoolean>;
        }, "strict", z.ZodTypeAny, {
            input_name: string;
            output_index: number;
            op: "connect";
            source_node_id: string;
            target_node_id: string;
            replace_existing?: boolean | undefined;
        }, {
            input_name: string;
            output_index: number;
            op: "connect";
            source_node_id: string;
            target_node_id: string;
            replace_existing?: boolean | undefined;
        }>, z.ZodObject<{
            op: z.ZodLiteral<"disconnect">;
            target_node_id: z.ZodString;
            input_name: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            input_name: string;
            op: "disconnect";
            target_node_id: string;
        }, {
            input_name: string;
            op: "disconnect";
            target_node_id: string;
        }>, z.ZodObject<{
            op: z.ZodLiteral<"replace_node">;
            node_id: z.ZodString;
            class_type: z.ZodString;
            schema_revision: z.ZodString;
            port_mapping: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, "strict", z.ZodTypeAny, {
            node_id: string;
            class_type: string;
            schema_revision: string;
            op: "replace_node";
            port_mapping?: Record<string, string> | undefined;
        }, {
            node_id: string;
            class_type: string;
            schema_revision: string;
            op: "replace_node";
            port_mapping?: Record<string, string> | undefined;
        }>, z.ZodObject<{
            op: z.ZodLiteral<"bind_asset">;
            asset_id: z.ZodString;
            representation: z.ZodString;
            target_node_id: z.ZodString;
            input_name: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            asset_id: string;
            input_name: string;
            representation: string;
            op: "bind_asset";
            target_node_id: string;
        }, {
            asset_id: string;
            input_name: string;
            representation: string;
            op: "bind_asset";
            target_node_id: string;
        }>, z.ZodObject<{
            op: z.ZodLiteral<"set_output_nodes">;
            output_nodes: z.ZodArray<z.ZodString, "many">;
        }, "strict", z.ZodTypeAny, {
            op: "set_output_nodes";
            output_nodes: string[];
        }, {
            op: "set_output_nodes";
            output_nodes: string[];
        }>, z.ZodObject<{
            op: z.ZodLiteral<"set_model">;
            model_id: z.ZodString;
            target_node_id: z.ZodString;
            input_name: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            input_name: string;
            op: "set_model";
            target_node_id: string;
            model_id: string;
        }, {
            input_name: string;
            op: "set_model";
            target_node_id: string;
            model_id: string;
        }>]>, "many">;
        user_request: z.ZodOptional<z.ZodString>;
        request_kind: z.ZodOptional<z.ZodString>;
        allowed_outputs: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strict", z.ZodTypeAny, {
        reason: string;
        operations: ({
            class_type: string;
            schema_revision: string;
            op: "add_node";
            node_id?: string | undefined;
            inputs?: Record<string, {
                kind: "literal";
                value?: unknown;
            } | {
                kind: "integer";
                decimal: string;
            } | {
                kind: "link";
                node_id: string;
                output_index: number;
            } | {
                asset_id: string;
                kind: "asset";
                representation: string;
            }> | undefined;
        } | {
            node_id: string;
            op: "remove_node";
            strategy?: "reject_if_referenced" | "defer_reconnect" | undefined;
        } | {
            value: {
                kind: "literal";
                value?: unknown;
            } | {
                kind: "integer";
                decimal: string;
            } | {
                kind: "link";
                node_id: string;
                output_index: number;
            } | {
                asset_id: string;
                kind: "asset";
                representation: string;
            };
            node_id: string;
            input_name: string;
            op: "set_input";
        } | {
            node_id: string;
            input_name: string;
            op: "unset_input";
        } | {
            input_name: string;
            output_index: number;
            op: "connect";
            source_node_id: string;
            target_node_id: string;
            replace_existing?: boolean | undefined;
        } | {
            input_name: string;
            op: "disconnect";
            target_node_id: string;
        } | {
            node_id: string;
            class_type: string;
            schema_revision: string;
            op: "replace_node";
            port_mapping?: Record<string, string> | undefined;
        } | {
            asset_id: string;
            input_name: string;
            representation: string;
            op: "bind_asset";
            target_node_id: string;
        } | {
            op: "set_output_nodes";
            output_nodes: string[];
        } | {
            input_name: string;
            op: "set_model";
            target_node_id: string;
            model_id: string;
        })[];
        user_request?: string | undefined;
        request_kind?: string | undefined;
        allowed_outputs?: string[] | undefined;
    }, {
        reason: string;
        operations: ({
            class_type: string;
            schema_revision: string;
            op: "add_node";
            node_id?: string | undefined;
            inputs?: Record<string, {
                kind: "literal";
                value?: unknown;
            } | {
                kind: "integer";
                decimal: string;
            } | {
                kind: "link";
                node_id: string;
                output_index: number;
            } | {
                asset_id: string;
                kind: "asset";
                representation: string;
            }> | undefined;
        } | {
            node_id: string;
            op: "remove_node";
            strategy?: "reject_if_referenced" | "defer_reconnect" | undefined;
        } | {
            value: {
                kind: "literal";
                value?: unknown;
            } | {
                kind: "integer";
                decimal: string;
            } | {
                kind: "link";
                node_id: string;
                output_index: number;
            } | {
                asset_id: string;
                kind: "asset";
                representation: string;
            };
            node_id: string;
            input_name: string;
            op: "set_input";
        } | {
            node_id: string;
            input_name: string;
            op: "unset_input";
        } | {
            input_name: string;
            output_index: number;
            op: "connect";
            source_node_id: string;
            target_node_id: string;
            replace_existing?: boolean | undefined;
        } | {
            input_name: string;
            op: "disconnect";
            target_node_id: string;
        } | {
            node_id: string;
            class_type: string;
            schema_revision: string;
            op: "replace_node";
            port_mapping?: Record<string, string> | undefined;
        } | {
            asset_id: string;
            input_name: string;
            representation: string;
            op: "bind_asset";
            target_node_id: string;
        } | {
            op: "set_output_nodes";
            output_nodes: string[];
        } | {
            input_name: string;
            op: "set_model";
            target_node_id: string;
            model_id: string;
        })[];
        user_request?: string | undefined;
        request_kind?: string | undefined;
        allowed_outputs?: string[] | undefined;
    }>>;
};
export declare const assetToolSchema: {
    action: z.ZodEnum<["inspect", "register", "prepare", "upload"]>;
    project_id: z.ZodString;
    asset_id: z.ZodOptional<z.ZodString>;
    relative_path: z.ZodOptional<z.ZodString>;
    roles: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    work_item_id: z.ZodOptional<z.ZodString>;
    backend_profile_id: z.ZodOptional<z.ZodString>;
};
export declare const uploadLoraSchema: {
    project_id: z.ZodString;
    asset_id: z.ZodString;
    work_item_id: z.ZodString;
    backend_profile_id: z.ZodOptional<z.ZodString>;
};
