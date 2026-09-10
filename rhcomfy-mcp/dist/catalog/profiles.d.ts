import { type NodeCatalog, type NodeSchema } from "../graph/types.js";
export interface WidgetBinding {
    readonly node_type: string;
    readonly input_name: string;
    readonly widget_index: number;
    readonly value_type: "string" | "number" | "integer" | "boolean";
}
export interface UiNodeProfile {
    readonly profile_id: string;
    readonly supported_root_keys: readonly string[];
    readonly supported_node_types: readonly string[];
    readonly widget_bindings: readonly WidgetBinding[];
    readonly reroute_types: readonly string[];
    readonly supported_modes: readonly number[];
    readonly output_node_types: readonly string[];
    readonly node_schema_revision: string;
}
export interface SchemaProfile {
    readonly profile_id: string;
    readonly revision: string;
    readonly backend_scope: string;
    readonly nodes: readonly NodeSchema[];
    readonly ui: UiNodeProfile;
}
export declare const syntheticSchemaProfile: SchemaProfile;
export declare function createSyntheticNodeCatalog(): NodeCatalog;
export declare function getSchemaProfile(profileId: string): SchemaProfile | undefined;
