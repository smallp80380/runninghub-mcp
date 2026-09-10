import type { Graph, NodeCatalog, ValidationReport } from "./types.js";
export declare function validateGraph(graph: Graph, catalog?: NodeCatalog): ValidationReport;
export declare function assertStructurallyValid(report: ValidationReport): void;
