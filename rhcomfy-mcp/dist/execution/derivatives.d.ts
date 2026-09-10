import { Storage } from "../storage/database.js";
export interface DerivedResult {
    readonly derived_id: string;
    readonly result_id: string;
    readonly kind: "preview" | "poster";
    readonly relative_path: string;
    readonly mime: string;
    readonly size_bytes: number;
    readonly content_hash: string;
}
interface DerivedMediaOptions {
    readonly ffmpeg_path?: string;
    readonly max_derived_bytes?: number;
    readonly preview_size?: number;
    readonly timeout_ms?: number;
}
export declare class DerivedMediaService {
    private readonly storage;
    private readonly ffmpegPath;
    private readonly maxDerivedBytes;
    private readonly previewSize;
    private readonly timeoutMs;
    constructor(storage: Storage, options?: DerivedMediaOptions);
    derive(resultIds: readonly string[]): Promise<{
        readonly results: readonly DerivedResult[];
        readonly warnings: readonly string[];
    }>;
    private deriveOne;
    private resultContext;
    private validStoredFile;
    private renderPng;
}
export {};
