import { isLosslessNumber, parse as parseLossless } from "lossless-json";
import { AppError } from "../errors.js";
const ROOT_KEYS = new Set(["last_node_id", "last_link_id", "nodes", "links", "groups", "config", "extra", "version"]);
const NODE_KEYS = new Set(["id", "type", "pos", "size", "flags", "order", "mode", "inputs", "outputs", "properties", "widgets_values", "title"]);
export class UiCodecError extends AppError {
    source_json;
    constructor(message, sourceJson) {
        super("CAPABILITY_UNSUPPORTED", message, {
            recoverable: true,
            suggestedFix: "Preserve the original UI JSON and use a supported API/profile export or add an explicit adapter.",
        });
        this.name = "UiCodecError";
        this.source_json = sourceJson;
    }
}
function object(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("Expected JSON object");
    return value;
}
function nodeId(value) {
    if (typeof value === "string" || typeof value === "number")
        return String(value);
    if (isLosslessNumber(value))
        return value.toString();
    throw new Error("UI node id must be a string or number");
}
function safeInteger(value) {
    const text = isLosslessNumber(value) ? value.toString() : typeof value === "number" ? String(value) : undefined;
    if (text === undefined || !/^(?:0|[1-9]\d*)$/.test(text))
        return undefined;
    const parsed = Number(text);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
}
function literal(value, path) {
    if (isLosslessNumber(value)) {
        const decimal = value.toString();
        const numeric = Number(decimal);
        if (!Number.isFinite(numeric) || !Number.isSafeInteger(numeric)) {
            throw new Error(`Unsafe UI literal at ${path}`);
        }
        return numeric;
    }
    if (value === null || typeof value === "boolean" || typeof value === "string")
        return value;
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    if (Array.isArray(value))
        return value.map((item, index) => literal(item, `${path}[${index}]`));
    if (value && typeof value === "object")
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, literal(item, `${path}.${key}`)]));
    throw new Error(`Unsupported UI literal at ${path}`);
}
function widgetValue(value, valueType, path) {
    if (valueType === "string") {
        if (typeof value !== "string")
            throw new Error(`Widget ${path} must be a string`);
        return { kind: "literal", value };
    }
    if (valueType === "boolean") {
        if (typeof value !== "boolean")
            throw new Error(`Widget ${path} must be boolean`);
        return { kind: "literal", value };
    }
    if (valueType === "integer") {
        const parsed = safeInteger(value);
        if (parsed !== undefined)
            return { kind: "integer", decimal: String(parsed) };
        if (typeof value === "string" && /^-?(?:0|[1-9]\d*)$/.test(value))
            return { kind: "integer", decimal: value };
        throw new Error(`Widget ${path} must be a safe integer or canonical integer string`);
    }
    if (typeof value !== "number" || !Number.isFinite(value))
        throw new Error(`Widget ${path} must be a finite number`);
    return { kind: "literal", value };
}
function rejectUnknownKeys(value, allowed, context, source) {
    const unknown = Object.keys(value).filter((key) => !allowed.has(key));
    if (unknown.length)
        throw new UiCodecError(`Unsupported UI extension at ${context}: ${unknown.join(", ")}.`, source);
}
export function importUiGraph(text, profile) {
    let raw;
    try {
        raw = parseLossless(text);
    }
    catch (error) {
        throw new UiCodecError(`Invalid UI JSON: ${error instanceof Error ? error.message : "parse error"}.`, text);
    }
    const root = object(raw);
    rejectUnknownKeys(root, new Set(profile.supported_root_keys), "root", text);
    if (!Array.isArray(root.nodes) || !Array.isArray(root.links))
        throw new UiCodecError("Supported UI JSON requires nodes and links arrays.", text);
    const linkMap = new Map();
    for (const rawLink of root.links) {
        if (!Array.isArray(rawLink) || rawLink.length < 5)
            throw new UiCodecError("Unsupported UI link tuple.", text);
        const [link, source, output, target, input, type] = rawLink;
        const outputIndex = safeInteger(output);
        const inputIndex = safeInteger(input);
        if (outputIndex === undefined || inputIndex === undefined)
            throw new UiCodecError("UI link ports must be integers.", text);
        linkMap.set(String(link), { source: nodeId(source), output: outputIndex, target: nodeId(target), input: inputIndex, type: typeof type === "string" ? type : "*" });
    }
    const nodes = {};
    const outputNodes = [];
    const uiPositions = {};
    for (const rawNode of root.nodes) {
        const value = object(rawNode);
        rejectUnknownKeys(value, NODE_KEYS, `node ${String(value.id)}`, text);
        const id = nodeId(value.id);
        if (typeof value.type !== "string" || !profile.supported_node_types.includes(value.type)) {
            throw new UiCodecError(`Unsupported UI node type ${String(value.type)} at node ${id}.`, text);
        }
        const mode = value.mode === undefined ? undefined : safeInteger(value.mode);
        if (value.mode !== undefined && (mode === undefined || !profile.supported_modes.includes(mode))) {
            throw new UiCodecError(`Unsupported UI node mode at node ${id}.`, text);
        }
        const inputs = {};
        for (const rawInput of value.inputs ?? []) {
            const input = object(rawInput);
            if (typeof input.name !== "string")
                throw new UiCodecError(`UI input name missing at node ${id}.`, text);
            if (input.link !== undefined && input.link !== null) {
                const link = linkMap.get(String(input.link));
                if (!link || link.target !== id)
                    throw new UiCodecError(`UI input ${id}.${input.name} points to an invalid link.`, text);
                inputs[input.name] = { kind: "link", node_id: link.source, output_index: link.output };
            }
        }
        const widgets = value.widgets_values ?? [];
        if (!Array.isArray(widgets))
            throw new UiCodecError(`widgets_values must be an array at node ${id}.`, text);
        for (const binding of profile.widget_bindings.filter((entry) => entry.node_type === value.type)) {
            if (widgets[binding.widget_index] !== undefined) {
                inputs[binding.input_name] = widgetValue(widgets[binding.widget_index], binding.value_type, `${id}.${binding.input_name}`);
            }
        }
        nodes[id] = { id, class_type: value.type, schema_revision: profile.node_schema_revision, inputs };
        if (profile.output_node_types.includes(value.type))
            outputNodes.push(id);
        if (Array.isArray(value.pos))
            uiPositions[id] = literal(value.pos, `${id}.pos`);
    }
    return {
        graph: {
            schema_version: "1",
            nodes,
            output_nodes: outputNodes,
            metadata: { ui_profile_id: profile.profile_id, ui_positions: uiPositions },
        },
        source_json: text,
        warnings: [],
    };
}
export function exportUiGraph(graph, profile) {
    const numericIds = new Map();
    let nextId = 1;
    for (const id of Object.keys(graph.nodes).sort()) {
        const asNumber = /^\d+$/.test(id) ? Number(id) : NaN;
        const numeric = Number.isSafeInteger(asNumber) && asNumber > 0 ? asNumber : nextId;
        numericIds.set(id, numeric);
        nextId = Math.max(nextId, numeric + 1);
    }
    const links = [];
    let nextLink = 1;
    const nodes = [];
    for (const id of Object.keys(graph.nodes).sort()) {
        const node = graph.nodes[id];
        if (!node || !profile.supported_node_types.includes(node.class_type))
            throw new UiCodecError(`Node ${node?.class_type ?? "unknown"} is not supported by UI profile.`, JSON.stringify(graph));
        const uiInputs = [];
        const widgets = [];
        for (const [name, value] of Object.entries(node.inputs)) {
            const binding = profile.widget_bindings.find((entry) => entry.node_type === node.class_type && entry.input_name === name);
            if (value.kind === "link") {
                const linkId = nextLink++;
                links.push([linkId, numericIds.get(value.node_id), value.output_index, numericIds.get(id), uiInputs.length, "*"]);
                uiInputs.push({ name, type: "*", link: linkId });
            }
            else if (value.kind === "literal" && binding) {
                widgets[binding.widget_index] = value.value;
            }
            else if (value.kind === "integer" && binding) {
                widgets[binding.widget_index] = Number(value.decimal);
                if (!Number.isSafeInteger(widgets[binding.widget_index]))
                    throw new UiCodecError(`Integer widget ${id}.${name} cannot be represented safely in UI JSON.`, JSON.stringify(graph));
            }
            else if (value.kind !== "asset") {
                throw new UiCodecError(`Input ${id}.${name} has no supported UI widget mapping.`, JSON.stringify(graph));
            }
        }
        nodes.push({ id: numericIds.get(id), type: node.class_type, pos: [0, 0], size: [200, 100], flags: {}, order: 0, mode: 0, inputs: uiInputs, outputs: [], properties: {}, widgets_values: widgets });
    }
    const output = {
        last_node_id: Math.max(0, ...numericIds.values()),
        last_link_id: Math.max(0, ...links.map((link) => Number(link[0]))),
        nodes,
        links,
        groups: [],
        config: {},
        extra: {},
        version: 0.4,
    };
    return JSON.stringify(output, null, 2);
}
//# sourceMappingURL=uiCodec.js.map