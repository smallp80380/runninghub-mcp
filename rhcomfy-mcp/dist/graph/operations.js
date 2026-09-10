import { AppError } from "../errors.js";
import { assertStructurallyValid, validateGraph } from "./validation.js";
function clone(value) {
    return structuredClone(value);
}
function mutableGraph(graph) {
    return clone(graph);
}
function requireNode(graph, nodeId) {
    const node = graph.nodes[nodeId];
    if (!node) {
        throw new AppError("INVALID_GRAPH", `Unknown node ${nodeId}.`, { recoverable: true });
    }
    return node;
}
function requireInput(catalog, node, inputName) {
    const schema = catalog?.get(node.class_type, node.schema_revision);
    if (schema && !schema.inputs[inputName]) {
        throw new AppError("INVALID_GRAPH", `Unknown input ${inputName} on ${node.class_type}.`, {
            context: { node_id: node.id, input_name: inputName },
            recoverable: true,
        });
    }
}
function referencedBy(graph, nodeId) {
    const references = [];
    for (const node of Object.values(graph.nodes)) {
        for (const [inputName, value] of Object.entries(node.inputs)) {
            if (value.kind === "link" && value.node_id === nodeId)
                references.push(`${node.id}.${inputName}`);
        }
    }
    return references;
}
function generatedNodeId(graph) {
    let index = 1;
    while (graph.nodes[`node_${index}`])
        index += 1;
    return `node_${index}`;
}
export function applyGraphOperations(base, operations, options = {}) {
    const graph = mutableGraph(base);
    const beforeIds = new Set(Object.keys(graph.nodes));
    const touched = new Set();
    for (const operation of operations) {
        switch (operation.op) {
            case "add_node": {
                const id = operation.node_id ?? generatedNodeId(graph);
                if (graph.nodes[id])
                    throw new AppError("INVALID_GRAPH", `Node ID ${id} already exists.`, { recoverable: true });
                graph.nodes[id] = {
                    id,
                    class_type: operation.class_type,
                    schema_revision: operation.schema_revision,
                    inputs: clone(operation.inputs ?? {}),
                };
                touched.add(id);
                break;
            }
            case "remove_node": {
                requireNode(graph, operation.node_id);
                const references = referencedBy(graph, operation.node_id);
                if (references.length && (operation.strategy ?? "reject_if_referenced") === "reject_if_referenced") {
                    throw new AppError("INVALID_GRAPH", `Node ${operation.node_id} is referenced by ${references.join(", ")}.`, {
                        context: { node_id: operation.node_id, references: references.join(",") },
                        recoverable: true,
                        suggestedFix: "Use one atomic batch with reconnect operations or explicitly defer reconnect validation.",
                    });
                }
                delete graph.nodes[operation.node_id];
                graph.output_nodes = graph.output_nodes.filter((id) => id !== operation.node_id);
                touched.add(operation.node_id);
                break;
            }
            case "set_input": {
                const node = requireNode(graph, operation.node_id);
                requireInput(options.catalog, node, operation.input_name);
                node.inputs[operation.input_name] = clone(operation.value);
                touched.add(operation.node_id);
                break;
            }
            case "unset_input": {
                const node = requireNode(graph, operation.node_id);
                requireInput(options.catalog, node, operation.input_name);
                delete node.inputs[operation.input_name];
                touched.add(operation.node_id);
                break;
            }
            case "connect": {
                requireNode(graph, operation.source_node_id);
                const target = requireNode(graph, operation.target_node_id);
                requireInput(options.catalog, target, operation.input_name);
                if (!Number.isInteger(operation.output_index) || operation.output_index < 0) {
                    throw new AppError("INVALID_GRAPH", "Output index must be a non-negative integer.", { recoverable: true });
                }
                if (target.inputs[operation.input_name] && !operation.replace_existing) {
                    throw new AppError("INVALID_GRAPH", `Input ${operation.target_node_id}.${operation.input_name} is already set.`, { recoverable: true });
                }
                target.inputs[operation.input_name] = { kind: "link", node_id: operation.source_node_id, output_index: operation.output_index };
                touched.add(operation.target_node_id);
                break;
            }
            case "disconnect": {
                const target = requireNode(graph, operation.target_node_id);
                requireInput(options.catalog, target, operation.input_name);
                delete target.inputs[operation.input_name];
                touched.add(operation.target_node_id);
                break;
            }
            case "replace_node": {
                const old = requireNode(graph, operation.node_id);
                const mapping = operation.port_mapping ?? {};
                const replacementSchema = options.catalog?.get(operation.class_type, operation.schema_revision);
                const inputs = {};
                for (const [oldName, value] of Object.entries(old.inputs)) {
                    const newName = mapping[oldName] ?? oldName;
                    if (replacementSchema && !replacementSchema.inputs[newName]) {
                        throw new AppError("INVALID_GRAPH", `Replacement has no input ${newName}.`, { recoverable: true });
                    }
                    inputs[newName] = clone(value);
                }
                graph.nodes[operation.node_id] = { id: operation.node_id, class_type: operation.class_type, schema_revision: operation.schema_revision, inputs };
                touched.add(operation.node_id);
                break;
            }
            case "bind_asset": {
                const node = requireNode(graph, operation.target_node_id);
                requireInput(options.catalog, node, operation.input_name);
                node.inputs[operation.input_name] = { kind: "asset", asset_id: operation.asset_id, representation: operation.representation };
                touched.add(operation.target_node_id);
                break;
            }
            case "set_output_nodes": {
                for (const nodeId of operation.output_nodes)
                    requireNode(graph, nodeId);
                graph.output_nodes = [...new Set(operation.output_nodes)];
                break;
            }
            case "set_model": {
                const node = requireNode(graph, operation.target_node_id);
                requireInput(options.catalog, node, operation.input_name);
                node.inputs[operation.input_name] = { kind: "literal", value: operation.model_id };
                touched.add(operation.target_node_id);
                break;
            }
        }
    }
    const validation = validateGraph(graph, options.catalog);
    assertStructurallyValid(validation);
    const afterIds = new Set(Object.keys(graph.nodes));
    const added = [...afterIds].filter((id) => !beforeIds.has(id)).sort();
    const removed = [...beforeIds].filter((id) => !afterIds.has(id)).sort();
    const changed = [...touched].filter((id) => afterIds.has(id) && beforeIds.has(id)).sort();
    return {
        graph,
        validation,
        diff: { added_nodes: added, removed_nodes: removed, changed_nodes: changed, operations: clone(operations) },
    };
}
//# sourceMappingURL=operations.js.map