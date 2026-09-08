import { MapNodeCatalog, type NodeCatalog, type NodeSchema } from "../graph/types.js";

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

const nodes: readonly NodeSchema[] = [
  {
    class_type: "Source",
    schema_revision: "synthetic-basic-v1",
    inputs: {},
    outputs: ["image"],
    source_evidence: "fixtures/contracts/schema-profiles.json",
    backend_scope: "synthetic-offline",
  },
  {
    class_type: "Transform",
    schema_revision: "synthetic-basic-v1",
    inputs: {
      image: { type: "image", required: true },
      prompt: { type: "string" },
      seed: { type: "integer", required: true, min: 0 },
      values: { type: "array" },
    },
    outputs: ["image"],
    source_evidence: "fixtures/contracts/schema-profiles.json",
    backend_scope: "synthetic-offline",
  },
  {
    class_type: "Save",
    schema_revision: "synthetic-basic-v1",
    inputs: { image: { type: "image", required: true }, filename_prefix: { type: "string" } },
    outputs: ["file"],
    source_evidence: "fixtures/contracts/schema-profiles.json",
    backend_scope: "synthetic-offline",
  },
  {
    class_type: "SharedLoader",
    schema_revision: "synthetic-basic-v1",
    inputs: { model_id: { type: "string", required: true } },
    outputs: ["model"],
    source_evidence: "fixtures/contracts/schema-profiles.json",
    backend_scope: "synthetic-offline",
  },
  {
    class_type: "ModelConsumer",
    schema_revision: "synthetic-basic-v1",
    inputs: { model: { type: "any", required: true } },
    outputs: ["image"],
    source_evidence: "fixtures/contracts/schema-profiles.json",
    backend_scope: "synthetic-offline",
  },
  {
    class_type: "Reroute",
    schema_revision: "synthetic-basic-v1",
    inputs: { input: { type: "any" } },
    outputs: ["any"],
    source_evidence: "fixtures/contracts/schema-profiles.json",
    backend_scope: "synthetic-offline",
  },
];

export const syntheticSchemaProfile: SchemaProfile = {
  profile_id: "synthetic-basic",
  revision: "1",
  backend_scope: "synthetic-offline",
  nodes,
  ui: {
    profile_id: "comfyui-ui-basic-v1",
    supported_root_keys: ["last_node_id", "last_link_id", "nodes", "links", "groups", "config", "extra", "version"],
    supported_node_types: nodes.map((node) => node.class_type),
    widget_bindings: [
      { node_type: "Transform", input_name: "prompt", widget_index: 0, value_type: "string" },
      { node_type: "Transform", input_name: "seed", widget_index: 1, value_type: "integer" },
      { node_type: "Save", input_name: "filename_prefix", widget_index: 0, value_type: "string" },
    ],
    reroute_types: ["Reroute"],
    supported_modes: [0, 4],
    output_node_types: ["Save"],
    node_schema_revision: "synthetic-basic-v1",
  },
};

export function createSyntheticNodeCatalog(): NodeCatalog {
  return new MapNodeCatalog(nodes);
}

export function getSchemaProfile(profileId: string): SchemaProfile | undefined {
  return profileId === syntheticSchemaProfile.profile_id ? syntheticSchemaProfile : undefined;
}
