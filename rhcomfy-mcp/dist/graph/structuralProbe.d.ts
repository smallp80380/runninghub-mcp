import { type GraphDiff, type GraphOperation } from "./operations.js";
import type { Graph, ValidationReport } from "./types.js";
export interface ResizeProbeOptions {
    readonly node_id?: string;
    readonly width: number;
    readonly height: number;
}
export interface ResizeProbeResult {
    readonly graph: Graph;
    readonly operations: readonly GraphOperation[];
    readonly diff: GraphDiff;
    readonly validation: ValidationReport;
    readonly node_id: string;
    readonly before: {
        readonly width: string;
        readonly height: string;
    };
    readonly after: {
        readonly width: string;
        readonly height: string;
    };
}
export declare function prepareResizeGraph(graph: Graph, options: ResizeProbeOptions): ResizeProbeResult;
