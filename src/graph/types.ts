import type { LosslessNumber } from "lossless-json";

export type JsonPrimitive = null | boolean | string | number | LosslessNumber;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface IntegerInputValue {
  readonly kind: "integer";
  readonly decimal: string;
}

export interface LiteralInputValue {
  readonly kind: "literal";
  readonly value: JsonValue;
}

export interface LinkInputValue {
  readonly kind: "link";
  readonly node_id: string;
  readonly output_index: number;
}

export interface AssetInputValue {
  readonly kind: "asset";
  readonly asset_id: string;
  readonly representation: string;
}

export type InputValue = LiteralInputValue | IntegerInputValue | LinkInputValue | AssetInputValue;

export interface PortSchema {
  readonly type: "any" | "string" | "number" | "integer" | "boolean" | "image" | "video" | "audio" | "array";
  readonly required?: boolean;
  readonly enum?: readonly string[];
  readonly min?: number;
  readonly max?: number;
  readonly output_types?: readonly string[];
}

export interface NodeSchema {
  readonly class_type: string;
  readonly schema_revision: string;
  readonly inputs: Readonly<Record<string, PortSchema>>;
  readonly outputs: readonly string[];
  readonly source_evidence: string;
  readonly backend_scope: string;
}

export interface GraphNode {
  readonly id: string;
  readonly class_type: string;
  readonly schema_revision: string;
  readonly inputs: Readonly<Record<string, InputValue>>;
}

export interface Graph {
  readonly schema_version: "1";
  readonly nodes: Readonly<Record<string, GraphNode>>;
  readonly output_nodes: readonly string[];
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface ValidationIssue {
  readonly code: string;
  readonly severity: "error" | "warning";
  readonly node_id?: string;
  readonly input_name?: string;
  readonly message: string;
}

export interface ValidationReport {
  readonly structural: "valid" | "invalid";
  readonly runnable: "ready" | "draft" | "invalid";
  readonly backend_compatibility: "verified" | "unknown" | "unsupported";
  readonly issues: readonly ValidationIssue[];
}

export interface NodeCatalog {
  get(classType: string, schemaRevision?: string): NodeSchema | undefined;
}

export class MapNodeCatalog implements NodeCatalog {
  private readonly schemas: Map<string, NodeSchema>;

  constructor(schemas: readonly NodeSchema[] = []) {
    this.schemas = new Map(schemas.map((schema) => [`${schema.class_type}@${schema.schema_revision}`, schema]));
  }

  get(classType: string, schemaRevision?: string): NodeSchema | undefined {
    if (schemaRevision) {
      return this.schemas.get(`${classType}@${schemaRevision}`);
    }
    const match = [...this.schemas.entries()].find(([key]) => key.startsWith(`${classType}@`));
    return match?.[1];
  }
}

export function createEmptyGraph(metadata: Record<string, JsonValue> = {}): Graph {
  return {
    schema_version: "1",
    nodes: {},
    output_nodes: [],
    metadata,
  };
}
