import type { AssetRow } from "../storage/database.js";
import type { Graph } from "../graph/types.js";
export declare const RHLORA_LOADER_CLASS = "RHLoraLoader";
export declare function isLoraAsset(asset: AssetRow): boolean;
export declare function validateLoraGraphBindings(graph: Graph, assets: ReadonlyMap<string, AssetRow>): void;
export declare function validateLoraApiBindings(workflow: unknown, assets: ReadonlyMap<string, AssetRow>): ReadonlySet<string>;
