import { Storage, type AssetRow } from "../storage/database.js";
import type { ProviderAssetReference, ProviderLoraReference, WorkflowBackend } from "./types.js";
export interface LocalAssetBytes {
    readonly row: AssetRow;
    readonly filename: string;
    readonly bytes: Uint8Array;
}
export declare class AssetProvider {
    private readonly storage;
    constructor(storage: Storage);
    inspect(projectId: string, assetId?: string): AssetRow | AssetRow[];
    read(projectId: string, assetId: string, expectedHash: string): LocalAssetBytes;
    upload(input: {
        readonly project_id: string;
        readonly asset_id: string;
        readonly content_hash: string;
        readonly profile_id: string;
        readonly backend: WorkflowBackend;
    }): Promise<ProviderAssetReference>;
    uploadLora(input: {
        readonly project_id: string;
        readonly asset_id: string;
        readonly content_hash: string;
        readonly profile_id: string;
        readonly backend: WorkflowBackend;
    }): Promise<ProviderLoraReference>;
}
