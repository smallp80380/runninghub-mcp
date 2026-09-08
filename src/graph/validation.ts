import { AppError } from "../errors.js";
import type {
  Graph,
  GraphNode,
  InputValue,
  NodeCatalog,
  NodeSchema,
  PortSchema,
  ValidationIssue,
  ValidationReport,
} from "./types.js";

function issue(
  code: string,
  severity: "error" | "warning",
  message: string,
  node_id?: string,
  input_name?: string,
): ValidationIssue {
  return {
    code,
    severity,
    message,
    ...(node_id ? { node_id } : {}),
    ...(input_name ? { input_name } : {}),
  };
}
function portTypeCompatible(sourceType: string | undefined, targetType: PortSchema["type"]): boolean {
  if (!sourceType || sourceType === "any" || targetType === "any") return true;
  if (sourceType === targetType) return true;
  if (targetType === "number" && sourceType === "integer") return true;
  return false;
}

function validateInputValue(value: InputValue, port: PortSchema | undefined, issues: ValidationIssue[], nodeId: string, name: string): void {
  if (!port) return;
  if (value.kind === "link" || value.kind === "asset") return;
  if (value.kind === "integer") {
    if (!/^-?(?:0|[1-9]\d*)$/.test(value.decimal)) {
      issues.push(issue("INTEGER_INVALID", "error", "Integer input must be a canonical decimal string.", nodeId, name));
      return;
    }
    const numeric = Number(value.decimal);
    if (port.type !== "integer" && port.type !== "number" && port.type !== "any") {
      issues.push(issue("INPUT_TYPE_MISMATCH", "error", `Integer cannot be assigned to ${port.type} input.`, nodeId, name));
    }
    if (Number.isSafeInteger(numeric)) {
      if (port.min !== undefined && numeric < port.min) issues.push(issue("INPUT_RANGE", "error", `Value is below minimum ${port.min}.`, nodeId, name));
      if (port.max !== undefined && numeric > port.max) issues.push(issue("INPUT_RANGE", "error", `Value is above maximum ${port.max}.`, nodeId, name));
    }
    return;
  }
  const literal = value.value;
  if (port.type === "array" && !Array.isArray(literal)) {
    issues.push(issue("INPUT_TYPE_MISMATCH", "error", "Expected an array literal.", nodeId, name));
  } else if (port.type === "string" && typeof literal !== "string") {
    issues.push(issue("INPUT_TYPE_MISMATCH", "error", "Expected a string literal.", nodeId, name));
  } else if (port.type === "boolean" && typeof literal !== "boolean") {
    issues.push(issue("INPUT_TYPE_MISMATCH", "error", "Expected a boolean literal.", nodeId, name));
  } else if (port.type === "number" && (typeof literal !== "number" || !Number.isFinite(literal))) {
    issues.push(issue("INPUT_TYPE_MISMATCH", "error", "Expected a finite number literal.", nodeId, name));
  } else if (port.type === "integer" && (!Number.isInteger(literal) || !Number.isSafeInteger(literal))) {
    issues.push(issue("INPUT_TYPE_MISMATCH", "error", "Expected a safe integer literal or tagged integer.", nodeId, name));
  }
  if (port.enum && typeof literal === "string" && !port.enum.includes(literal)) {
    issues.push(issue("INPUT_ENUM", "error", `Value must be one of: ${port.enum.join(", ")}.`, nodeId, name));
  }
  if (typeof literal === "number") {
    if (port.min !== undefined && literal < port.min) issues.push(issue("INPUT_RANGE", "error", `Value is below minimum ${port.min}.`, nodeId, name));
    if (port.max !== undefined && literal > port.max) issues.push(issue("INPUT_RANGE", "error", `Value is above maximum ${port.max}.`, nodeId, name));
  }
}

export function validateGraph(graph: Graph, catalog?: NodeCatalog): ValidationReport {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set(Object.keys(graph.nodes));
  const schemas = new Map<string, NodeSchema | undefined>();

  for (const [id, node] of Object.entries(graph.nodes)) {
    if (node.id !== id) {
      issues.push(issue("NODE_ID_MISMATCH", "error", `Node map key ${id} does not match node.id.`, id));
    }
    const schema = catalog?.get(node.class_type, node.schema_revision);
    schemas.set(id, schema);
    if (!schema) {
      issues.push(issue("SCHEMA_UNKNOWN", "warning", `Schema ${node.class_type}@${node.schema_revision} is unknown.`, id));
    }
    for (const [name, value] of Object.entries(node.inputs)) {
      if (schema && !schema.inputs[name]) {
        issues.push(issue("INPUT_UNKNOWN", "error", `Input ${name} is not present in schema.`, id, name));
        continue;
      }
      const port = schema?.inputs[name];
      validateInputValue(value, port, issues, id, name);
      if (value.kind === "link") {
        if (!nodeIds.has(value.node_id)) {
          issues.push(issue("LINK_TARGET_MISSING", "error", `Link target ${value.node_id} does not exist.`, id, name));
          continue;
        }
        if (value.output_index < 0 || !Number.isInteger(value.output_index)) {
          issues.push(issue("OUTPUT_INDEX_INVALID", "error", "Output index must be a non-negative integer.", id, name));
        }
        const source = graph.nodes[value.node_id];
        const sourceSchema = source ? schemas.get(value.node_id) ?? catalog?.get(source.class_type, source.schema_revision) : undefined;
        const sourceType = sourceSchema?.outputs[value.output_index];
        if (port && !portTypeCompatible(sourceType, port.type)) {
          issues.push(issue("EDGE_TYPE_MISMATCH", "error", `Output ${sourceType} cannot connect to ${port.type}.`, id, name));
        }
      }
    }
    if (schema) {
      for (const [name, port] of Object.entries(schema.inputs)) {
        if (port.required && !node.inputs[name]) {
          issues.push(issue("REQUIRED_INPUT_MISSING", "error", `Required input ${name} is not connected or set.`, id, name));
        }
      }
    }
  }

  for (const outputId of graph.output_nodes) {
    if (!nodeIds.has(outputId)) {
      issues.push(issue("OUTPUT_NODE_MISSING", "error", `Output node ${outputId} does not exist.`));
    }
  }

  const structuralErrors = issues.some(
    (entry) => entry.severity === "error" &&
      ["NODE_ID_MISMATCH", "INPUT_UNKNOWN", "INPUT_TYPE_MISMATCH", "INPUT_ENUM", "INPUT_RANGE", "LINK_TARGET_MISSING", "OUTPUT_INDEX_INVALID", "EDGE_TYPE_MISMATCH", "OUTPUT_NODE_MISSING", "INTEGER_INVALID"].includes(entry.code),
  );
  const runnableErrors = issues.some((entry) => entry.severity === "error");
  const hasUnknownSchema = issues.some((entry) => entry.code === "SCHEMA_UNKNOWN");
  const hasNoNodes = Object.keys(graph.nodes).length === 0;
  const hasNoOutputs = graph.output_nodes.length === 0;

  return {
    structural: structuralErrors ? "invalid" : "valid",
    runnable: structuralErrors || runnableErrors ? (structuralErrors ? "invalid" : "draft") : hasNoNodes || hasNoOutputs || hasUnknownSchema ? "draft" : "ready",
    backend_compatibility: hasUnknownSchema ? "unknown" : "unknown",
    issues: [
      ...issues,
      ...(hasNoNodes ? [issue("DRAFT_EMPTY", "warning", "Empty graph is a valid draft but is not runnable.")] : []),
      ...(hasNoOutputs ? [issue("DRAFT_NO_OUTPUT", "warning", "No output node is declared; graph remains a draft.")] : []),
    ],
  };
}

export function assertStructurallyValid(report: ValidationReport): void {
  if (report.structural === "invalid") {
    throw new AppError("INVALID_GRAPH", "Graph operation would produce an invalid structure.", {
      recoverable: true,
      suggestedFix: "Correct the reported node, input, or link issues and retry the edit batch.",
    });
  }
}
