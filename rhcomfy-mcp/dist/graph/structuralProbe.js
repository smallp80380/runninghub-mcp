import { AppError } from "../errors.js";
import { applyGraphOperations } from "./operations.js";
function requestedDimension(value, name) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 4096) {
        throw new AppError("INVALID_GRAPH", `${name} must be an integer between 1 and 4096.`, { recoverable: true });
    }
    return String(value);
}
function existingDimension(graph, nodeId, inputName) {
    const value = graph.nodes[nodeId]?.inputs[inputName];
    if (!value) {
        throw new AppError("CAPABILITY_UNKNOWN", `Resize node ${nodeId} has no ${inputName} input.`, { recoverable: true });
    }
    if (value.kind === "integer")
        return value.decimal;
    if (value.kind === "literal" && typeof value.value === "number" && Number.isSafeInteger(value.value) && value.value > 0) {
        return String(value.value);
    }
    if (value.kind === "literal" && typeof value.value === "string" && /^[1-9]\d*$/.test(value.value) && Number.isSafeInteger(Number(value.value))) {
        return value.value;
    }
    if (value.kind === "link")
        return `link:${value.node_id}:${value.output_index}`;
    throw new AppError("CAPABILITY_UNKNOWN", `Resize input ${nodeId}.${inputName} is not a supported numeric or link value.`, { recoverable: true });
}
export function prepareResizeGraph(graph, options) {
    const candidates = Object.values(graph.nodes).filter((node) => "width" in node.inputs && "height" in node.inputs);
    const nodeId = options.node_id ?? (candidates.length === 1 ? candidates[0]?.id : undefined);
    if (!nodeId) {
        throw new AppError("CAPABILITY_UNKNOWN", candidates.length === 0
            ? "No node with both width and height inputs was found for the structural probe."
            : "Multiple resize nodes were found; provide an explicit resize node ID.", { recoverable: true });
    }
    if (!graph.nodes[nodeId]) {
        throw new AppError("INVALID_GRAPH", `Resize node ${nodeId} does not exist.`, { recoverable: true });
    }
    const before = {
        width: existingDimension(graph, nodeId, "width"),
        height: existingDimension(graph, nodeId, "height"),
    };
    const after = {
        width: requestedDimension(options.width, "resize width"),
        height: requestedDimension(options.height, "resize height"),
    };
    if (before.width === after.width && before.height === after.height) {
        throw new AppError("INVALID_GRAPH", "Structural probe dimensions must differ from the source graph.", { recoverable: true });
    }
    const operations = [];
    if (before.width !== after.width) {
        operations.push({ op: "set_input", node_id: nodeId, input_name: "width", value: { kind: "integer", decimal: after.width } });
    }
    if (before.height !== after.height) {
        operations.push({ op: "set_input", node_id: nodeId, input_name: "height", value: { kind: "integer", decimal: after.height } });
    }
    const edited = applyGraphOperations(graph, operations);
    return { ...edited, operations, node_id: nodeId, before, after };
}
//# sourceMappingURL=structuralProbe.js.map