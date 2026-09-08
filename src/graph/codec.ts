import { createHash } from "node:crypto";
import { isLosslessNumber, LosslessNumber, parse as parseLossless, stringify as stringifyLossless } from "lossless-json";
import { AppError } from "../errors.js";
import type { Graph, GraphNode, InputValue, JsonValue } from "./types.js";

type LosslessObject = Record<string, unknown>;

function isObject(value: unknown): value is LosslessObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function integerDecimal(value: LosslessNumber): string | undefined {
  const decimal = value.toString();
  return /^-?(?:0|[1-9]\d*)$/.test(decimal) ? decimal : undefined;
}

function safeJsonValue(value: unknown, path: string): JsonValue {
  if (isLosslessNumber(value)) {
    const decimal = value.toString();
    const number = Number(decimal);
    if (!Number.isFinite(number)) throw new AppError("INVALID_GRAPH", `Invalid numeric literal at ${path}.`, { context: { path, decimal }, recoverable: false });
    return Number.isSafeInteger(number) || !Number.isInteger(number) ? number : value;
  }
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => safeJsonValue(item, `${path}[${index}]`));
  }
  if (isObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, safeJsonValue(item, `${path}.${key}`)]));
  }
  throw new AppError("INVALID_GRAPH", `Unsupported JSON value at ${path}.`);
}

function parseInputValue(value: unknown, nodeIds: ReadonlySet<string>, path: string): InputValue {
  if (isLosslessNumber(value)) {
    const integer = integerDecimal(value);
    if (integer !== undefined) {
      return { kind: "integer", decimal: integer };
    }
    return { kind: "literal", value: safeJsonValue(value, path) };
  }
  if (Array.isArray(value) && value.length === 2 && typeof value[0] === "string" && isLosslessNumber(value[1])) {
    const outputIndex = integerDecimal(value[1]);
    if (nodeIds.has(value[0]) && outputIndex !== undefined && Number.isSafeInteger(Number(outputIndex))) {
      return { kind: "link", node_id: value[0], output_index: Number(outputIndex) };
    }
  }
  return { kind: "literal", value: safeJsonValue(value, path) };
}

function parseGraphObject(raw: unknown, outputNodes: readonly string[] = []): Graph {
  if (!isObject(raw)) {
    throw new AppError("INVALID_GRAPH", "API graph must be a JSON object keyed by node ID.");
  }
  const nodeIds = new Set(Object.keys(raw));
  const nodes: Record<string, GraphNode> = {};
  for (const [id, value] of Object.entries(raw)) {
    if (!isObject(value) || typeof value.class_type !== "string" || !isObject(value.inputs)) {
      throw new AppError("INVALID_GRAPH", `Node ${id} must contain class_type and inputs.`);
    }
    const inputs: Record<string, InputValue> = {};
    for (const [name, input] of Object.entries(value.inputs)) {
      inputs[name] = parseInputValue(input, nodeIds, `${id}.inputs.${name}`);
    }
    nodes[id] = {
      id,
      class_type: value.class_type,
      schema_revision: typeof value.schema_revision === "string" ? value.schema_revision : "unknown",
      inputs,
    };
  }
  return {
    schema_version: "1",
    nodes,
    output_nodes: [...outputNodes],
    metadata: {},
  };
}

export function importApiGraph(text: string, outputNodes: readonly string[] = []): Graph {
  try {
    return parseGraphObject(parseLossless(text), outputNodes);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("INVALID_GRAPH", error instanceof Error ? error.message : "Invalid API graph JSON.");
  }
}

function apiInputValue(value: InputValue): unknown {
  switch (value.kind) {
    case "literal":
      return value.value;
    case "integer":
      return new LosslessNumber(value.decimal);
    case "link":
      return [value.node_id, new LosslessNumber(String(value.output_index))];
    case "asset":
      return `asset://${value.asset_id}/${value.representation}`;
  }
}

export function exportApiGraph(graph: Graph, pretty = true): string {
  const apiGraph: Record<string, unknown> = {};
  for (const id of Object.keys(graph.nodes).sort()) {
    const node = graph.nodes[id];
    if (!node) continue;
    const inputs: Record<string, unknown> = {};
    for (const name of Object.keys(node.inputs).sort()) {
      const value = node.inputs[name];
      if (value) inputs[name] = apiInputValue(value);
    }
    apiGraph[id] = { class_type: node.class_type, inputs };
  }
  const serialized = stringifyLossless(apiGraph, null, pretty ? 2 : 0);
  if (serialized === undefined) throw new AppError("INVALID_GRAPH", "Could not serialize API graph.");
  return serialized;
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (isObject(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
  }
  return value;
}

export function canonicalGraphJson(graph: Graph): string {
  const canonical = canonicalValue(graph);
  const serialized = stringifyLossless(canonical, null, 0);
  if (serialized === undefined) throw new AppError("INVALID_GRAPH", "Could not canonicalize graph.");
  return serialized;
}

export function hashGraph(graph: Graph): string {
  return createHash("sha256").update(canonicalGraphJson(graph), "utf8").digest("hex");
}
