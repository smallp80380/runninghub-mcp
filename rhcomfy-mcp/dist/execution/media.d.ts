import type { AssetRow } from "../storage/database.js";
export declare const WORKFLOW_MEDIA_PROFILE: {
    readonly id: "runninghub-workflow-media-v1";
    readonly max_reference_images: 4;
    readonly max_masks: 1;
    readonly max_videos: 1;
    readonly max_total_inputs: 6;
};
interface MediaValidationInput {
    readonly workflow: unknown;
    readonly asset_bindings: readonly {
        readonly asset_id: string;
        readonly content_hash: string;
    }[];
    readonly assets: ReadonlyMap<string, AssetRow>;
    readonly read_asset?: (asset_id: string, content_hash: string) => Uint8Array;
    readonly strict_bytes: boolean;
}
export declare function validateMediaBindings(input: MediaValidationInput): {
    readonly profile_id: string;
    readonly references: number;
    readonly masks: number;
    readonly videos: number;
};
export {};
