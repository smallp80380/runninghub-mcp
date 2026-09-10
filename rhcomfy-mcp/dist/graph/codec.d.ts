import type { Graph } from "./types.js";
export declare function importApiGraph(text: string, outputNodes?: readonly string[]): Graph;
export declare function exportApiGraph(graph: Graph, pretty?: boolean): string;
export declare function canonicalGraphJson(graph: Graph): string;
export declare function hashGraph(graph: Graph): string;
