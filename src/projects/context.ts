import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { basename, extname, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { AppError } from "../errors.js";
import { hashGraph, importApiGraph } from "../graph/codec.js";
import { Storage, type AssetRow, type ProjectRow, type SceneRow, type WorkItemRow } from "../storage/database.js";

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
  readonly constraints: { readonly required: Readonly<Record<string, unknown>>; readonly preferred: Readonly<Record<string, unknown>> };
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
  readonly selected: readonly (WorkflowCard & { score: number; reasons: readonly string[] })[];
  readonly rejected: readonly { workflow_id: string; reason: string }[];
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizeAlias(value: string): string {
  return value.toLowerCase().replace(/[\s_-]/g, "");
}

function portablePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function ensureInside(root: string, path: string): string {
  const absolute = resolve(root, path);
  const rel = relative(root, absolute);
  if (rel.startsWith(`..${sep}`) || rel === ".." || rel.includes(`${sep}..${sep}`) || absolute === root) {
    throw new AppError("ASSET_MISSING", `Path ${path} escapes the project root or names the root itself.`, { recoverable: true });
  }
  return absolute;
}

function mimeFor(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    case ".mp4": return "video/mp4";
    case ".mov": return "video/quicktime";
    case ".wav": return "audio/wav";
    case ".mp3": return "audio/mpeg";
    case ".md": return "text/markdown";
    case ".txt": return "text/plain";
    case ".json": return "application/json";
    default: return "application/octet-stream";
  }
}

function workflowIdHint(path: string): string | undefined {
  const stem = basename(path, extname(path));
  return /^\d+$/.test(stem) ? stem : undefined;
}

function walkFiles(root: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) result.push(...walkFiles(path));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}

function documentTitle(text: string): string | undefined {
  return text.split(/\r?\n/).find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, "").trim();
}

function projectFromRow(row: ProjectRow): ProjectRecord {
  const stored = JSON.parse(row.documents_json) as unknown;
  const documentPaths: string[] = Array.isArray(stored)
    ? stored.map((item) => typeof item === "string" ? item : String((item as { relative_path?: string }).relative_path ?? ""))
    : [];
  const documents: DocumentIndex[] = Array.isArray(stored)
    ? stored.filter((item): item is DocumentIndex => Boolean(item && typeof item === "object" && "sha256" in item && "relative_path" in item))
    : [];
  return {
    id: row.id,
    schema_version: "1",
    canonical_root: row.canonical_root,
    backend_profile_id: row.backend_profile_id,
    documents,
    document_paths: documentPaths.filter(Boolean),
    asset_roots: JSON.parse(row.asset_roots_json) as string[],
    output_root: row.output_root,
    policy_revision: row.policy_revision,
  };
}

function assetFromRow(row: AssetRow): AssetRecord {
  return {
    asset_id: row.id,
    project_id: row.project_id,
    relative_path: row.relative_path,
    content_hash: row.content_hash,
    mime: row.mime,
    size_bytes: row.size_bytes,
    roles: JSON.parse(row.roles_json) as string[],
    source: row.source,
    usage_policy: JSON.parse(row.usage_policy_json) as Record<string, unknown>,
    ...(row.review_reference_json ? { review_reference: JSON.parse(row.review_reference_json) as Record<string, unknown> } : {}),
  };
}

function sceneFromRow(row: SceneRow): SceneRecord {
  return {
    project_id: row.project_id,
    scene_id: row.id,
    aliases: JSON.parse(row.aliases_json) as string[],
    action_text: row.action_text,
    output_kind: row.output_kind as SceneRecord["output_kind"],
    constraints: JSON.parse(row.constraints_json) as SceneRecord["constraints"],
    required_asset_roles: JSON.parse(row.required_asset_roles_json) as string[],
    dependencies: JSON.parse(row.dependencies_json) as string[],
    sources_hash: row.sources_hash,
  };
}

export class ProjectContextService {
  constructor(private readonly storage: Storage) {}

  registerProject(input: {
    readonly project_id: string;
    readonly canonical_root: string;
    readonly backend_profile_id: string;
    readonly document_paths?: readonly string[];
    readonly asset_roots?: readonly string[];
    readonly output_root: string;
    readonly policy_revision?: string;
  }): ProjectRecord {
    const root = realpathSync(resolve(input.canonical_root));
    if (!statSync(root).isDirectory()) throw new AppError("PROJECT_NOT_FOUND", `Project root ${root} is not a directory.`, { recoverable: true });
    const documentPaths = [...(input.document_paths ?? [])].map((path) => {
      const absolute = ensureInside(root, path);
      if (!existsSync(absolute) || !lstatSync(absolute).isFile()) throw new AppError("ASSET_MISSING", `Project document ${path} does not exist.`, { recoverable: true });
      return portablePath(path);
    });
    const assetRoots = [...(input.asset_roots ?? [])].map((path) => {
      const absolute = ensureInside(root, path);
      if (!existsSync(absolute) || !lstatSync(absolute).isDirectory()) throw new AppError("ASSET_MISSING", `Asset root ${path} does not exist.`, { recoverable: true });
      return portablePath(path);
    });
    const outputRoot = ensureInside(root, input.output_root);
    const now = new Date().toISOString();
    this.storage.saveProject({
      id: input.project_id,
      schema_version: "1",
      canonical_root: root,
      backend_profile_id: input.backend_profile_id,
      documents_json: JSON.stringify(documentPaths),
      asset_roots_json: JSON.stringify(assetRoots),
      output_root: portablePath(relative(root, outputRoot)),
      policy_revision: input.policy_revision ?? "1",
      created_at: now,
      updated_at: now,
    });
    return this.getProject(input.project_id);
  }

  getProject(projectId: string): ProjectRecord {
    const row = this.storage.getProject(projectId);
    if (!row) throw new AppError("PROJECT_NOT_FOUND", `Project ${projectId} was not found.`, { recoverable: true });
    return projectFromRow(row);
  }

  listProjects(): readonly ProjectRecord[] {
    return this.storage.listProjects().map(projectFromRow);
  }

  indexProject(projectId: string): { project: ProjectRecord; documents: readonly DocumentIndex[]; assets: readonly AssetRecord[] } {
    const project = this.getProject(projectId);
    const documents = project.document_paths.map((path) => {
      const absolute = ensureInside(project.canonical_root, path);
      const bytes = readFileSync(absolute);
      const index: DocumentIndex = { relative_path: path, sha256: sha256(bytes), size_bytes: bytes.length, ...(documentTitle(bytes.toString("utf8")) ? { title: documentTitle(bytes.toString("utf8")) } : {}) };
      return index;
    });
    const assets: AssetRecord[] = [];
    for (const assetRoot of project.asset_roots) {
      for (const absolute of walkFiles(ensureInside(project.canonical_root, assetRoot))) {
        assets.push(this.registerAsset(projectId, portablePath(relative(project.canonical_root, absolute)), []));
      }
    }
    const now = new Date().toISOString();
    this.storage.saveProject({
      id: project.id,
      schema_version: "1",
      canonical_root: project.canonical_root,
      backend_profile_id: project.backend_profile_id,
      documents_json: JSON.stringify(documents),
      asset_roots_json: JSON.stringify(project.asset_roots),
      output_root: project.output_root,
      policy_revision: project.policy_revision,
      created_at: now,
      updated_at: now,
    });
    return { project: this.getProject(projectId), documents, assets };
  }

  registerAsset(projectId: string, relativePath: string, roles: readonly string[], source = "project") : AssetRecord {
    const project = this.getProject(projectId);
    const storedPath = portablePath(relativePath);
    const absolute = ensureInside(project.canonical_root, storedPath);
    if (!existsSync(absolute) || !lstatSync(absolute).isFile()) throw new AppError("ASSET_MISSING", `Asset ${relativePath} does not exist.`, { recoverable: true });
    const bytes = readFileSync(absolute);
    const contentHash = sha256(bytes);
    const assetId = `${projectId}:${contentHash}`;
    const now = new Date().toISOString();
    this.storage.saveAsset({
      id: assetId,
      project_id: projectId,
      schema_version: "1",
      relative_path: storedPath,
      content_hash: contentHash,
      mime: mimeFor(storedPath),
      size_bytes: bytes.length,
      roles_json: JSON.stringify([...new Set(roles)]),
      source,
      usage_policy_json: JSON.stringify({}),
      review_reference_json: null,
      created_at: now,
      updated_at: now,
    });
    const row = this.storage.listAssets(projectId).find((item) => item.id === assetId);
    if (!row) throw new Error(`Asset ${assetId} was not persisted`);
    return assetFromRow(row);
  }

  listAssets(projectId: string): readonly AssetRecord[] {
    return this.storage.listAssets(projectId).map(assetFromRow);
  }

  discoverWorkflowFiles(projectId: string): readonly WorkflowFileRecord[] {
    const project = this.getProject(projectId);
    const excludedRoots = new Set([
      ".runninghub",
      project.output_root,
      ...project.asset_roots,
    ].filter(Boolean).map((path) => portablePath(path).replace(/\/$/, "")));
    const candidates: WorkflowFileRecord[] = [];
    for (const absolute of walkFiles(project.canonical_root)) {
      if (extname(absolute).toLowerCase() !== ".json") continue;
      const relativePath = portablePath(relative(project.canonical_root, absolute));
      const firstSegment = relativePath.split("/")[0] ?? "";
      if (excludedRoots.has(firstSegment) || relativePath.startsWith(".runninghub/")) continue;
      try {
        const graph = importApiGraph(readFileSync(absolute, "utf8"));
        candidates.push({ relative_path: relativePath, graph_hash: hashGraph(graph), ...(workflowIdHint(relativePath) ? { workflow_id_hint: workflowIdHint(relativePath) } : {}) });
      } catch {
        // Project JSON that is not an API-format graph is not a workflow candidate.
      }
    }
    return candidates.sort((left, right) => left.relative_path.localeCompare(right.relative_path));
  }

  readWorkflowFile(projectId: string, relativePath: string): WorkflowSource {
    const project = this.getProject(projectId);
    const absolute = ensureInside(project.canonical_root, portablePath(relativePath));
    if (!existsSync(absolute) || !lstatSync(absolute).isFile()) throw new AppError("ASSET_MISSING", `Workflow file ${relativePath} does not exist.`, { recoverable: true });
    const real = realpathSync(absolute);
    const realRelative = relative(project.canonical_root, real);
    if (realRelative.startsWith(`..${sep}`) || realRelative === "..") throw new AppError("ASSET_MISSING", `Workflow file ${relativePath} escapes the project root.`, { recoverable: true });
    const apiGraph = readFileSync(real, "utf8");
    const graph = importApiGraph(apiGraph);
    const storedPath = portablePath(relative(project.canonical_root, real));
    return { relative_path: storedPath, api_graph: apiGraph, graph_hash: hashGraph(graph), ...(workflowIdHint(storedPath) ? { workflow_id_hint: workflowIdHint(storedPath) } : {}) };
  }

  upsertScene(scene: Omit<SceneRecord, "sources_hash"> & { readonly sources_hash?: string }): SceneRecord {
    this.getProject(scene.project_id);
    const sourcesHash = scene.sources_hash ?? sha256(Buffer.from(JSON.stringify(scene.dependencies)));
    const now = new Date().toISOString();
    this.storage.saveScene({
      id: scene.scene_id,
      project_id: scene.project_id,
      schema_version: "1",
      aliases_json: JSON.stringify(scene.aliases),
      action_text: scene.action_text,
      output_kind: scene.output_kind,
      constraints_json: JSON.stringify(scene.constraints),
      required_asset_roles_json: JSON.stringify(scene.required_asset_roles),
      dependencies_json: JSON.stringify(scene.dependencies),
      sources_hash: sourcesHash,
      created_at: now,
      updated_at: now,
    });
    const row = this.storage.getScene(scene.project_id, scene.scene_id);
    if (!row) throw new Error(`Scene ${scene.scene_id} was not persisted`);
    return sceneFromRow(row);
  }

  getScene(projectId: string, sceneId: string): SceneRecord {
    this.getProject(projectId);
    const row = this.storage.getScene(projectId, sceneId);
    if (!row) throw new AppError("SCENE_AMBIGUOUS", `Scene ${sceneId} was not found in project ${projectId}.`, { recoverable: true });
    return sceneFromRow(row);
  }

  resolveScene(projectId: string, alias: string): { scene: SceneRecord; assets: readonly AssetRecord[] } {
    const candidates = this.storage.listScenes(projectId).map(sceneFromRow).filter((scene) => [scene.scene_id, ...scene.aliases].some((value) => normalizeAlias(value) === normalizeAlias(alias)));
    if (candidates.length === 0) throw new AppError("SCENE_AMBIGUOUS", `No scene matches ${alias} in project ${projectId}.`, { recoverable: true, suggestedFix: "Use rh_scene read/list to inspect registered scene IDs and aliases." });
    if (candidates.length > 1) throw new AppError("SCENE_AMBIGUOUS", `Alias ${alias} matches multiple scenes: ${candidates.map((scene) => scene.scene_id).join(", ")}.`, { recoverable: true });
    const scene = candidates[0];
    if (!scene) throw new Error("Scene candidate unexpectedly missing");
    const assets = this.listAssets(projectId);
    const required = scene.required_asset_roles.map((role) => assets.filter((asset) => asset.roles.includes(role)));
    for (const roleAssets of required) {
      const byPath = new Map<string, AssetRecord[]>();
      for (const asset of roleAssets) byPath.set(asset.relative_path, [...(byPath.get(asset.relative_path) ?? []), asset]);
      const changed = [...byPath.entries()].find(([, versions]) => new Set(versions.map((asset) => asset.content_hash)).size > 1);
      if (changed) throw new AppError("ASSET_CHANGED", `Asset ${changed[0]} has multiple content hashes; prior bindings are stale.`, { recoverable: true, suggestedFix: "Register the current bytes explicitly and update the scene binding." });
    }
    const missing = scene.required_asset_roles.filter((role, index) => required[index]?.length === 0);
    if (missing.length) throw new AppError("ASSET_MISSING", `Required asset roles are missing: ${missing.join(", ")}.`, { recoverable: true });
    const uniqueAssets = [...new Map(required.flat().map((asset) => [asset.asset_id, asset])).values()];
    return { scene, assets: uniqueAssets };
  }

  createWorkItem(input: { readonly project_id: string; readonly scene_id?: string; readonly chain_id?: string; readonly user_request: string; readonly request_kind: string; readonly allowed_outputs?: readonly string[] }): WorkItemRecord {
    this.getProject(input.project_id);
    if (input.scene_id && !this.storage.getScene(input.project_id, input.scene_id)) throw new AppError("SCENE_AMBIGUOUS", `Scene ${input.scene_id} was not found.`, { recoverable: true });
    const record: WorkItemRecord = {
      id: randomUUID(), project_id: input.project_id, chain_id: input.chain_id ?? "production", ...(input.scene_id ? { scene_id: input.scene_id } : {}),
      user_request: input.user_request, request_kind: input.request_kind, allowed_outputs: input.allowed_outputs ?? ["image", "video"], state: "REQUESTED",
    };
    const now = new Date().toISOString();
    const row: WorkItemRow = { id: record.id, project_id: record.project_id, chain_id: record.chain_id, scene_id: record.scene_id ?? null, schema_version: "1", user_request: record.user_request, request_kind: record.request_kind, allowed_outputs_json: JSON.stringify(record.allowed_outputs), state: record.state, created_at: now, updated_at: now };
    this.storage.saveWorkItem(row);
    return record;
  }

  getWorkItem(id: string): WorkItemRecord {
    const row = this.storage.getWorkItem(id);
    if (!row) throw new AppError("PROJECT_NOT_FOUND", `Work item ${id} was not found.`, { recoverable: true });
    return { id: row.id, project_id: row.project_id, chain_id: row.chain_id, ...(row.scene_id ? { scene_id: row.scene_id } : {}), user_request: row.user_request, request_kind: row.request_kind, allowed_outputs: JSON.parse(row.allowed_outputs_json) as string[], state: row.state as WorkItemRecord["state"] };
  }

  closeWorkItem(id: string): WorkItemRecord {
    this.getWorkItem(id);
    this.storage.closeWorkItem(id);
    return this.getWorkItem(id);
  }
}

export class WorkflowLibrary {
  constructor(private readonly cards: readonly WorkflowCard[]) {}

  search(input: { readonly output_kind?: string; readonly required_roles?: readonly string[]; readonly backend_profile_id?: string; readonly hard_constraints?: Readonly<Record<string, unknown>> }): WorkflowSearchResult {
    const selected: Array<WorkflowCard & { score: number; reasons: string[] }> = [];
    const rejected: Array<{ workflow_id: string; reason: string }> = [];
    for (const card of this.cards) {
      if (input.output_kind && card.output_kind !== input.output_kind) { rejected.push({ workflow_id: card.workflow_id, reason: `output_kind ${card.output_kind} does not satisfy ${input.output_kind}` }); continue; }
      if (input.backend_profile_id && card.backend_profile_id !== input.backend_profile_id) { rejected.push({ workflow_id: card.workflow_id, reason: "backend profile mismatch" }); continue; }
      const missingRoles = (input.required_roles ?? []).filter((role) => !card.input_roles.includes(role));
      if (missingRoles.length) { rejected.push({ workflow_id: card.workflow_id, reason: `missing required roles: ${missingRoles.join(", ")}` }); continue; }
      const conflicts = Object.entries(input.hard_constraints ?? {}).filter(([key, value]) => card.hard_constraints[key] !== undefined && card.hard_constraints[key] !== "any" && JSON.stringify(card.hard_constraints[key]) !== JSON.stringify(value));
      if (conflicts.length) { rejected.push({ workflow_id: card.workflow_id, reason: `hard constraint mismatch: ${conflicts.map(([key]) => key).join(", ")}` }); continue; }
      selected.push({ ...card, score: (card.input_roles.length === (input.required_roles ?? []).length ? 2 : 0) + (card.availability === "verified" ? 1 : 0), reasons: ["passed hard constraints", card.availability === "verified" ? "profile evidence is verified" : "availability remains unknown"] });
    }
    selected.sort((a, b) => b.score - a.score || a.workflow_id.localeCompare(b.workflow_id));
    return { selected, rejected };
  }
}
