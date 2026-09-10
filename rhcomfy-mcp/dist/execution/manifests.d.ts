import { Storage } from "../storage/database.js";
export interface ManifestPublication {
    readonly manifest_id: string;
    readonly relative_path: string;
    readonly content_hash: string;
    readonly size_bytes: number;
    readonly outbox_id: string;
    readonly published_at: string;
}
export declare class ResultManifestService {
    private readonly storage;
    constructor(storage: Storage);
    create(jobId: string, apiFamily: string): ManifestPublication;
    publishPending(jobId?: string): readonly ManifestPublication[];
    private publish;
    private context;
    private readExisting;
    private buildManifest;
    private manifestOutput;
    private writeManifest;
}
