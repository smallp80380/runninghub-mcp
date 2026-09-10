import { Storage } from "../storage/database.js";
import { type WorkflowBackend } from "./types.js";
export interface DownloadedResult {
    readonly result_id: string;
    readonly job_id: string;
    readonly output_id: string;
    readonly relative_path: string;
    readonly mime: string;
    readonly size_bytes: number;
    readonly content_hash: string;
}
interface ResultDownloadOptions {
    readonly fetch_impl?: typeof fetch;
    readonly max_output_bytes?: number;
}
export declare class ResultDownloadService {
    private readonly storage;
    private readonly backend;
    private readonly fetchImpl;
    private readonly maxOutputBytes;
    constructor(storage: Storage, backend: WorkflowBackend, options?: ResultDownloadOptions);
    download(jobId: string): Promise<readonly DownloadedResult[]>;
    private prepareOutputDirectory;
    private downloadOne;
    private readOutput;
}
export {};
