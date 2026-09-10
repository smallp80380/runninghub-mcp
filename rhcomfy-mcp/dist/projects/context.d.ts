import { Storage } from "../storage/database.js";
export interface DocumentIndex {
    readonly relative_path: string;
    readonly sha256: string;
    readonly size_bytes: number;
    readonly title?: string;
}
export interface ProjectRecord {
    readonly id: string;
    readonly schema_version: "1";
    readonly canonical_root: string;
    readonly backend_profile_id: string;
    readonly documents: readonly DocumentIndex[];
    readonly document_paths: readonly string[];
    readonly asset_roots: readonly string[];
    readonly output_root: string;
    readonly policy_revision: string;
}
export interface AssetRecord {
    readonly asset_id: string;
    readonly project_id: string;
    readonly relative_path: string;
    readonly content_hash: string;
    readonly mime: string;
    readonly size_bytes: number;
    readonly roles: readonly string[];
    readonly source: string;
    readonly usage_policy: Readonly<Record<string, unknown>>;
    readonly review_reference?: Readonly<Record<string, unknown>>;
}
export interface SceneRecord {
    readonly project_id: string;
    readonly scene_id: string;
    readonly aliases: readonly string[];
    readonly action_text: string;
    readonly output_kind: "image" | "video" | "audio" | "unknown";
    readonly constraints: {
        readonly required: Readonly<Record<string, unknown>>;
        readonly preferred: Readonly<Record<string, unknown>>;
    };
    readonly required_asset_roles: readonly string[];
    readonly dependencies: readonly string[];
    readonly sources_hash: string;
}
export interface WorkItemRecord {
    readonly id: string;
    readonly project_id: string;
    readonly chain_id: string;
    readonly scene_id?: string;
    readonly user_request: string;
    readonly request_kind: string;
    readonly allowed_outputs: readonly string[];
    readonly state: "REQUESTED" | "CLOSED";
}
export interface WorkflowCard {
    readonly workflow_id: string;
    readonly purpose: string;
    readonly output_kind: "image" | "video" | "audio";
    readonly input_roles: readonly string[];
    readonly hard_constraints: Readonly<Record<string, unknown>>;
    readonly backend_profile_id: string;
    readonly node_classes: readonly string[];
    readonly model_ids: readonly string[];
    readonly graph_hash: string;
    readonly last_verified_at: string;
    readonly availability: "verified" | "unknown" | "unsupported";
}
export interface WorkflowFileRecord {
    readonly relative_path: string;
    readonly graph_hash: string;
    readonly workflow_id_hint?: string;
}
export interface WorkflowSource extends WorkflowFileRecord {
    readonly api_graph: string;
}
export interface WorkflowSearchResult {
    readonly selected: readonly (WorkflowCard & {
        score: number;
        reasons: readonly string[];
    })[];
    readonly rejected: readonly {
        workflow_id: string;
        reason: string;
    }[];
}
export declare class ProjectContextService {
    private readonly storage;
    constructor(storage: Storage);
    registerProject(input: {
        readonly project_id: string;
        readonly canonical_root: string;
        readonly backend_profile_id: string;
        readonly document_paths?: readonly string[];
        readonly asset_roots?: readonly string[];
        readonly output_root: string;
        readonly policy_revision?: string;
    }): ProjectRecord;
    getProject(projectId: string): ProjectRecord;
    listProjects(): readonly ProjectRecord[];
    indexProject(projectId: string): {
        project: ProjectRecord;
        documents: readonly DocumentIndex[];
        assets: readonly AssetRecord[];
    };
    registerAsset(projectId: string, relativePath: string, roles: readonly string[], source?: string): AssetRecord;
    listAssets(projectId: string): readonly AssetRecord[];
    discoverWorkflowFiles(projectId: string): readonly WorkflowFileRecord[];
    readWorkflowFile(projectId: string, relativePath: string, outputNodes?: readonly string[]): WorkflowSource;
    upsertScene(scene: Omit<SceneRecord, "sources_hash"> & {
        readonly sources_hash?: string;
    }): SceneRecord;
    getScene(projectId: string, sceneId: string): SceneRecord;
    resolveScene(projectId: string, alias: string): {
        scene: SceneRecord;
        assets: readonly AssetRecord[];
    };
    createWorkItem(input: {
        readonly project_id: string;
        readonly scene_id?: string;
        readonly chain_id?: string;
        readonly user_request: string;
        readonly request_kind: string;
        readonly allowed_outputs?: readonly string[];
    }): WorkItemRecord;
    getWorkItem(id: string): WorkItemRecord;
    closeWorkItem(id: string): WorkItemRecord;
}
export declare class WorkflowLibrary {
    private readonly cards;
    constructor(cards: readonly WorkflowCard[]);
    search(input: {
        readonly output_kind?: string;
        readonly required_roles?: readonly string[];
        readonly backend_profile_id?: string;
        readonly hard_constraints?: Readonly<Record<string, unknown>>;
    }): WorkflowSearchResult;
}
