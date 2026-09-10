import { z } from "zod";
export declare const inputValueSchema: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
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
export declare const graphOperationSchema: z.ZodDiscriminatedUnion<"op", [z.ZodObject<{
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
}>]>;
export declare const createWorkflowSchema: {
    project_id: z.ZodString;
    workflow_id: z.ZodOptional<z.ZodString>;
    api_graph: z.ZodOptional<z.ZodString>;
    output_nodes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    reason: z.ZodOptional<z.ZodString>;
};
export declare const getWorkflowSchema: {
    workflow_id: z.ZodString;
    revision_id: z.ZodOptional<z.ZodString>;
};
export declare const editWorkflowSchema: {
    workflow_id: z.ZodString;
    base_revision_id: z.ZodString;
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
};
export declare const validateWorkflowSchema: {
    workflow_id: z.ZodString;
    revision_id: z.ZodOptional<z.ZodString>;
};
export declare const exportWorkflowSchema: {
    workflow_id: z.ZodString;
    revision_id: z.ZodOptional<z.ZodString>;
    format: z.ZodDefault<z.ZodLiteral<"api">>;
};
