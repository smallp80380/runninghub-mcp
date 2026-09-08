import { AppError } from "../errors.js";
import type { AssetRow } from "../storage/database.js";
import type { Graph } from "../graph/types.js";

export const RHLORA_LOADER_CLASS = "RHLoraLoader";

export function isLoraAsset(asset: AssetRow): boolean {
  let roles: unknown;
  try {
    roles = JSON.parse(asset.roles_json);
  } catch {
    return false;
  }
  return Array.isArray(roles) && roles.some((role) => typeof role === "string" && role.trim().toLowerCase() === "lora");
}

function rejectInvalidBinding(asset: AssetRow, nodeId: string, inputName: string, message: string): never {
  throw new AppError("INVALID_GRAPH", message, {
    context: { asset_id: asset.id, node_id: nodeId, input_name: inputName },
    recoverable: true,
    suggestedFix: "Bind LoRA assets only to an RHLoraLoader node and use rh_upload_lora for the provider upload.",
  });
}

export function validateLoraGraphBindings(graph: Graph, assets: ReadonlyMap<string, AssetRow>): void {
  for (const node of Object.values(graph.nodes)) {
    for (const [inputName, value] of Object.entries(node.inputs)) {
      if (value.kind !== "asset") continue;
      const asset = assets.get(value.asset_id);
      if (!asset) continue;
      const lora = isLoraAsset(asset);
      const loader = node.class_type === RHLORA_LOADER_CLASS;
      if (lora && !loader) rejectInvalidBinding(asset, node.id, inputName, `LoRA asset ${asset.id} is bound to ${node.class_type}, not ${RHLORA_LOADER_CLASS}.`);
      if (!lora && loader) rejectInvalidBinding(asset, node.id, inputName, `${RHLORA_LOADER_CLASS} requires a registered asset with the lora role.`);
    }
  }
}

function assetReferences(value: unknown, result: Set<string>): void {
  if (typeof value === "string" && value.startsWith("asset://")) {
    const assetId = value.slice("asset://".length).split("/", 1)[0];
    if (assetId) result.add(assetId);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) assetReferences(item, result);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) assetReferences(item, result);
  }
}

export function validateLoraApiBindings(workflow: unknown, assets: ReadonlyMap<string, AssetRow>): ReadonlySet<string> {
  if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) return new Set();
  const loraAssetIds = new Set<string>();
  for (const [nodeId, value] of Object.entries(workflow as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const node = value as { class_type?: unknown; inputs?: unknown };
    if (typeof node.class_type !== "string" || !node.inputs || typeof node.inputs !== "object" || Array.isArray(node.inputs)) continue;
    const loader = node.class_type === RHLORA_LOADER_CLASS;
    for (const [inputName, input] of Object.entries(node.inputs as Record<string, unknown>)) {
      const referenced = new Set<string>();
      assetReferences(input, referenced);
      for (const assetId of referenced) {
        const asset = assets.get(assetId);
        if (!asset) continue;
        const lora = isLoraAsset(asset);
        if (lora) loraAssetIds.add(assetId);
        if (lora && !loader) rejectInvalidBinding(asset, nodeId, inputName, `LoRA asset ${asset.id} is bound to ${node.class_type}, not ${RHLORA_LOADER_CLASS}.`);
        if (!lora && loader) rejectInvalidBinding(asset, nodeId, inputName, `${RHLORA_LOADER_CLASS} requires a registered asset with the lora role.`);
      }
    }
  }
  return loraAssetIds;
}
