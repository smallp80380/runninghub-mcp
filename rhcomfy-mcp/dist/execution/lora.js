import { AppError } from "../errors.js";
export const RHLORA_LOADER_CLASS = "RHLoraLoader";
export function isLoraAsset(asset) {
    let roles;
    try {
        roles = JSON.parse(asset.roles_json);
    }
    catch {
        return false;
    }
    return Array.isArray(roles) && roles.some((role) => typeof role === "string" && role.trim().toLowerCase() === "lora");
}
function rejectInvalidBinding(asset, nodeId, inputName, message) {
    throw new AppError("INVALID_GRAPH", message, {
        context: { asset_id: asset.id, node_id: nodeId, input_name: inputName },
        recoverable: true,
        suggestedFix: "Bind LoRA assets only to an RHLoraLoader node and use rh_upload_lora for the provider upload.",
    });
}
export function validateLoraGraphBindings(graph, assets) {
    for (const node of Object.values(graph.nodes)) {
        for (const [inputName, value] of Object.entries(node.inputs)) {
            if (value.kind !== "asset")
                continue;
            const asset = assets.get(value.asset_id);
            if (!asset)
                continue;
            const lora = isLoraAsset(asset);
            const loader = node.class_type === RHLORA_LOADER_CLASS;
            if (lora && !loader)
                rejectInvalidBinding(asset, node.id, inputName, `LoRA asset ${asset.id} is bound to ${node.class_type}, not ${RHLORA_LOADER_CLASS}.`);
            if (!lora && loader)
                rejectInvalidBinding(asset, node.id, inputName, `${RHLORA_LOADER_CLASS} requires a registered asset with the lora role.`);
        }
    }
}
function assetReferences(value, result) {
    if (typeof value === "string" && value.startsWith("asset://")) {
        const assetId = value.slice("asset://".length).split("/", 1)[0];
        if (assetId)
            result.add(assetId);
        return;
    }
    if (Array.isArray(value)) {
        for (const item of value)
            assetReferences(item, result);
        return;
    }
    if (value && typeof value === "object") {
        for (const item of Object.values(value))
            assetReferences(item, result);
    }
}
export function validateLoraApiBindings(workflow, assets) {
    if (!workflow || typeof workflow !== "object" || Array.isArray(workflow))
        return new Set();
    const loraAssetIds = new Set();
    for (const [nodeId, value] of Object.entries(workflow)) {
        if (!value || typeof value !== "object" || Array.isArray(value))
            continue;
        const node = value;
        if (typeof node.class_type !== "string" || !node.inputs || typeof node.inputs !== "object" || Array.isArray(node.inputs))
            continue;
        const loader = node.class_type === RHLORA_LOADER_CLASS;
        for (const [inputName, input] of Object.entries(node.inputs)) {
            const referenced = new Set();
            assetReferences(input, referenced);
            for (const assetId of referenced) {
                const asset = assets.get(assetId);
                if (!asset)
                    continue;
                const lora = isLoraAsset(asset);
                if (lora)
                    loraAssetIds.add(assetId);
                if (lora && !loader)
                    rejectInvalidBinding(asset, nodeId, inputName, `LoRA asset ${asset.id} is bound to ${node.class_type}, not ${RHLORA_LOADER_CLASS}.`);
                if (!lora && loader)
                    rejectInvalidBinding(asset, nodeId, inputName, `${RHLORA_LOADER_CLASS} requires a registered asset with the lora role.`);
            }
        }
    }
    return loraAssetIds;
}
//# sourceMappingURL=lora.js.map