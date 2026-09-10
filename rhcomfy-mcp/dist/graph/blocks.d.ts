import type { Graph, GraphNode, InputValue } from "./types.js";
export interface BlockInputPort {
    readonly name: string;
    readonly node_id: string;
    readonly input_name: string;
}
export interface BlockOutputPort {
    readonly name: string;
    readonly node_id: string;
    readonly output_index: number;
}
export interface BlockDefinition {
    readonly block_id: string;
    readonly revision_id: string;
    readonly nodes: readonly GraphNode[];
    readonly inputs: readonly BlockInputPort[];
    readonly outputs: readonly BlockOutputPort[];
    readonly dependency_constraints: readonly string[];
}
export interface BlockInstance {
    readonly instance_id: string;
    readonly block_id: string;
    readonly revision_id: string;
    readonly node_ids: readonly string[];
}
export interface BlockInsertResult {
    readonly graph: Graph;
    readonly instance: BlockInstance;
    readonly exposed_outputs: Readonly<Record<string, {
        node_id: string;
        output_index: number;
    }>>;
}
export declare function insertBlock(graph: Graph, definition: BlockDefinition, instanceId: string, bindings?: Readonly<Record<string, InputValue>>): BlockInsertResult;
export declare function removeBlock(graph: Graph, instance: BlockInstance, strategy?: "reject_external_references" | "disconnect_external_references"): Graph;
