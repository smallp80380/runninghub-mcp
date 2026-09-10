import type { Graph, NodeCatalog } from "../graph/types.js";
export interface GraphModel {
    readonly model_id: string;
    readonly family: string;
    readonly loader_class: string;
    readonly backend_scope: string;
    readonly compatible_consumers: readonly string[];
    readonly source_evidence: string;
    readonly availability: "verified" | "unknown" | "unsupported";
}
export interface ModelCompatibilityIssue {
    readonly code: "MODEL_FAMILY_UNSUPPORTED" | "LOADER_MISMATCH" | "CONSUMER_MISMATCH" | "MODEL_UNKNOWN";
    readonly message: string;
    readonly node_id?: string;
}
export interface ModelCompatibilityReport {
    readonly compatible: boolean;
    readonly status: "verified" | "unknown" | "unsupported";
    readonly model_id: string;
    readonly issues: readonly ModelCompatibilityIssue[];
}
export declare class GraphModelCatalog {
    private readonly models;
    constructor(models?: readonly GraphModel[]);
    get(modelId: string): GraphModel | undefined;
    list(): readonly GraphModel[];
}
export declare function checkModelCompatibility(graph: Graph, modelId: string, models: GraphModelCatalog, nodeCatalog?: NodeCatalog): ModelCompatibilityReport;
export declare function assertModelCompatible(report: ModelCompatibilityReport): void;
export declare function replaceModelBinding(graph: Graph, loaderNodeId: string, modelId: string, models: GraphModelCatalog): Graph;
