import { AppError } from "../errors.js";
import type { UiNodeProfile } from "../catalog/profiles.js";
import type { Graph } from "./types.js";
export declare class UiCodecError extends AppError {
    readonly source_json: string;
    constructor(message: string, sourceJson: string);
}
export declare function importUiGraph(text: string, profile: UiNodeProfile): {
    graph: Graph;
    source_json: string;
    warnings: readonly string[];
};
export declare function exportUiGraph(graph: Graph, profile: UiNodeProfile): string;
