import { AppError } from "../errors.js";
import type { Graph, GraphNode, NodeCatalog } from "../graph/types.js";

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

export class GraphModelCatalog {
  private readonly models = new Map<string, GraphModel>();

  constructor(models: readonly GraphModel[] = []) {
    for (const model of models) this.models.set(model.model_id, model);
  }

  get(modelId: string): GraphModel | undefined {
    return this.models.get(modelId);
  }

  list(): readonly GraphModel[] {
    return [...this.models.values()];
  }
}

export function checkModelCompatibility(
  graph: Graph,
  modelId: string,
  models: GraphModelCatalog,
  nodeCatalog?: NodeCatalog,
): ModelCompatibilityReport {
  const model = models.get(modelId);
  if (!model) {
    return { compatible: false, status: "unknown", model_id: modelId, issues: [{ code: "MODEL_UNKNOWN", message: `Model ${modelId} is not in the registered graph model catalog.` }] };
  }
  const issues: ModelCompatibilityIssue[] = [];
  const loaderNodes = Object.values(graph.nodes).filter((node) => node.class_type === model.loader_class);
  if (loaderNodes.length === 0) {
    issues.push({ code: "LOADER_MISMATCH", message: `Graph does not contain the required loader ${model.loader_class}.` });
  }
  for (const node of Object.values(graph.nodes)) {
    if (node.class_type !== model.loader_class && !model.compatible_consumers.includes(node.class_type)) continue;
    const schema = nodeCatalog?.get(node.class_type, node.schema_revision);
    if (node.class_type === model.loader_class && !schema) {
      issues.push({ code: "LOADER_MISMATCH", message: `Loader ${node.class_type}@${node.schema_revision} is not verified in the active node catalog.`, node_id: node.id });
    }
    if (node.class_type !== model.loader_class && !model.compatible_consumers.includes(node.class_type)) {
      issues.push({ code: "CONSUMER_MISMATCH", message: `Model ${modelId} has no known consumer mapping for ${node.class_type}.`, node_id: node.id });
    }
  }
  if (model.availability === "unsupported") {
    issues.push({ code: "MODEL_FAMILY_UNSUPPORTED", message: `Model ${modelId} is explicitly unsupported for ${model.backend_scope}.` });
  }
  return {
    compatible: issues.length === 0 && model.availability !== "unsupported",
    status: issues.length ? "unsupported" : model.availability,
    model_id: modelId,
    issues,
  };
}

export function assertModelCompatible(report: ModelCompatibilityReport): void {
  if (!report.compatible) {
    throw new AppError("MODEL_INCOMPATIBLE", `Graph model ${report.model_id} is not compatible with the active graph profile.`, {
      recoverable: true,
      suggestedFix: "Select a model with a verified loader/family mapping or choose another workflow profile.",
    });
  }
}

export function replaceModelBinding(
  graph: Graph,
  loaderNodeId: string,
  modelId: string,
  models: GraphModelCatalog,
): Graph {
  const node = graph.nodes[loaderNodeId] as GraphNode | undefined;
  if (!node) throw new AppError("INVALID_GRAPH", `Loader node ${loaderNodeId} does not exist.`, { recoverable: true });
  const model = models.get(modelId);
  if (!model) throw new AppError("MODEL_INCOMPATIBLE", `Model ${modelId} is not registered.`, { recoverable: true });
  if (node.class_type !== model.loader_class) {
    throw new AppError("MODEL_INCOMPATIBLE", `Model ${modelId} requires loader ${model.loader_class}, not ${node.class_type}.`, { recoverable: true });
  }
  return {
    ...graph,
    nodes: {
      ...graph.nodes,
      [loaderNodeId]: { ...node, inputs: { ...node.inputs, model_id: { kind: "literal", value: modelId } } },
    },
  };
}
