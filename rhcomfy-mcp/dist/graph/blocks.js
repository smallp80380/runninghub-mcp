import { AppError } from "../errors.js";
function clone(value) {
    return structuredClone(value);
}
function remappedId(instanceId, localId) {
    return `${instanceId}::${localId}`;
}
function remapInput(value, idMap) {
    if (value.kind !== "link")
        return clone(value);
    return { ...value, node_id: idMap.get(value.node_id) ?? value.node_id };
}
function referencesTo(graph, nodeIds) {
    const result = [];
    for (const node of Object.values(graph.nodes)) {
        if (nodeIds.has(node.id))
            continue;
        for (const [input, value] of Object.entries(node.inputs)) {
            if (value.kind === "link" && nodeIds.has(value.node_id))
                result.push(`${node.id}.${input}`);
        }
    }
    return result;
}
export function insertBlock(graph, definition, instanceId, bindings = {}) {
    if (!instanceId || graph.metadata[`block:${instanceId}`]) {
        throw new AppError("INVALID_GRAPH", `Block instance ${instanceId} already exists or is empty.`, { recoverable: true });
    }
    const idMap = new Map(definition.nodes.map((node) => [node.id, remappedId(instanceId, node.id)]));
    for (const id of idMap.values()) {
        if (graph.nodes[id])
            throw new AppError("INVALID_GRAPH", `Remapped block node ${id} collides with an existing node.`, { recoverable: true });
    }
    const inputPorts = new Map(definition.inputs.map((port) => [port.name, port]));
    for (const binding of Object.keys(bindings)) {
        if (!inputPorts.has(binding))
            throw new AppError("INVALID_GRAPH", `Unknown block input ${binding}.`, { recoverable: true });
    }
    const nodes = { ...graph.nodes };
    for (const source of definition.nodes) {
        const id = idMap.get(source.id);
        if (!id)
            throw new Error(`Missing remap for ${source.id}`);
        const inputs = {};
        for (const [name, value] of Object.entries(source.inputs))
            inputs[name] = remapInput(value, idMap);
        nodes[id] = { ...clone(source), id, inputs };
    }
    for (const [name, binding] of Object.entries(bindings)) {
        const port = inputPorts.get(name);
        if (!port)
            continue;
        const nodeId = idMap.get(port.node_id);
        if (!nodeId)
            throw new AppError("INVALID_GRAPH", `Block input ${name} references an unknown internal node.`, { recoverable: false });
        const node = nodes[nodeId];
        if (!node)
            throw new Error(`Missing remapped node ${nodeId}`);
        node.inputs[port.input_name] = clone(binding);
    }
    const exposedOutputs = Object.fromEntries(definition.outputs.map((port) => [port.name, {
            node_id: idMap.get(port.node_id) ?? port.node_id,
            output_index: port.output_index,
        }]));
    const metadata = { ...graph.metadata, [`block:${instanceId}`]: {
            block_id: definition.block_id,
            revision_id: definition.revision_id,
            node_ids: [...idMap.values()],
        } };
    return {
        graph: { ...graph, nodes, metadata },
        instance: { instance_id: instanceId, block_id: definition.block_id, revision_id: definition.revision_id, node_ids: [...idMap.values()] },
        exposed_outputs: exposedOutputs,
    };
}
export function removeBlock(graph, instance, strategy = "reject_external_references") {
    const owned = new Set(instance.node_ids);
    const references = referencesTo(graph, owned);
    if (references.length && strategy === "reject_external_references") {
        throw new AppError("INVALID_GRAPH", `Block ${instance.instance_id} has external references: ${references.join(", ")}.`, {
            recoverable: true,
            suggestedFix: "Reconnect consumers explicitly before removing the block.",
        });
    }
    const nodes = {};
    for (const [id, node] of Object.entries(graph.nodes)) {
        if (!owned.has(id)) {
            const inputs = {};
            for (const [name, value] of Object.entries(node.inputs)) {
                if (value.kind === "link" && owned.has(value.node_id) && strategy === "disconnect_external_references")
                    continue;
                inputs[name] = value;
            }
            nodes[id] = { ...node, inputs };
        }
    }
    const metadata = { ...graph.metadata };
    delete metadata[`block:${instance.instance_id}`];
    return { ...graph, nodes, metadata, output_nodes: graph.output_nodes.filter((id) => !owned.has(id)) };
}
//# sourceMappingURL=blocks.js.map