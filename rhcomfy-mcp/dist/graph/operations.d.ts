import { validateGraph } from "./validation.js";
import type { Graph, InputValue, NodeCatalog } from "./types.js";
export type GraphOperation = {
    readonly op: "add_node";
    readonly class_type: string;
    readonly schema_revision: string;
    readonly node_id?: string;
    readonly inputs?: Readonly<Record<string, InputValue>>;
} | {
    readonly op: "remove_node";
    readonly node_id: string;
    readonly strategy?: "reject_if_referenced" | "defer_reconnect";
} | {
    readonly op: "set_input";
    readonly node_id: string;
    readonly input_name: string;
    readonly value: InputValue;
} | {
    readonly op: "unset_input";
    readonly node_id: string;
    readonly input_name: string;
} | {
    readonly op: "connect";
    readonly source_node_id: string;
    readonly output_index: number;
    readonly target_node_id: string;
    readonly input_name: string;
    readonly replace_existing?: boolean;
} | {
    readonly op: "disconnect";
    readonly target_node_id: string;
    readonly input_name: string;
} | {
    readonly op: "replace_node";
    readonly node_id: string;
    readonly class_type: string;
    readonly schema_revision: string;
    readonly port_mapping?: Readonly<Record<string, string>>;
} | {
    readonly op: "bind_asset";
    readonly asset_id: string;
    readonly representation: string;
    readonly target_node_id: string;
    readonly input_name: string;
} | {
    readonly op: "set_output_nodes";
    readonly output_nodes: readonly string[];
} | {
    readonly op: "set_model";
    readonly model_id: string;
    readonly target_node_id: string;
    readonly input_name: string;
};
export interface GraphDiff {
    readonly added_nodes: readonly string[];
    readonly removed_nodes: readonly string[];
    readonly changed_nodes: readonly string[];
    readonly operations: readonly GraphOperation[];
}
export declare function applyGraphOperations(base: Graph, operations: readonly GraphOperation[], options?: {
    readonly catalog?: NodeCatalog;
}): {
    graph: Graph;
    diff: GraphDiff;
    validation: ReturnType<typeof validateGraph>;
};
