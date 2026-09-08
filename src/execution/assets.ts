import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";
import { AppError } from "../errors.js";
import { Storage, type AssetRow } from "../storage/database.js";
import { isLoraAsset } from "./lora.js";
import type { ProviderAssetReference, ProviderLoraReference, ProviderUploadInput, WorkflowBackend } from "./types.js";

export interface LocalAssetBytes {
  readonly row: AssetRow;
  readonly filename: string;
  readonly bytes: Uint8Array;
}

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !rel.includes(`${sep}..${sep}`);
}

function providerReference(row: { readonly provider_kind: string; readonly provider_value: string }): ProviderAssetReference {
  if ((row.provider_kind === "provider_file" || row.provider_kind === "provider_url") && row.provider_value.trim()) {
    return { kind: row.provider_kind, value: row.provider_value };
  }
  throw new AppError("PROVIDER_ERROR", "Cached provider upload has an invalid tagged reference.", { recoverable: true });
}

function providerLoraReference(row: { readonly provider_kind: string; readonly provider_value: string }): ProviderLoraReference {
  if (row.provider_kind === "provider_lora" && row.provider_value.trim()) {
    return { kind: "provider_lora", value: row.provider_value };
  }
  throw new AppError("PROVIDER_ERROR", "Cached provider LoRA upload has an invalid tagged reference.", { recoverable: true });
}

export class AssetProvider {
  constructor(private readonly storage: Storage) {}

  inspect(projectId: string, assetId?: string): AssetRow | AssetRow[] {
    if (assetId) {
      const asset = this.storage.getAsset(projectId, assetId);
      if (!asset) throw new AppError("ASSET_MISSING", `Asset ${assetId} is not registered in project ${projectId}.`, { recoverable: true });
      return asset;
    }
    return this.storage.listAssets(projectId);
  }

  read(projectId: string, assetId: string, expectedHash: string): LocalAssetBytes {
    const row = this.storage.getAsset(projectId, assetId);
    if (!row) throw new AppError("ASSET_MISSING", `Asset ${assetId} is not registered in project ${projectId}.`, { recoverable: true });
    const project = this.storage.getProject(projectId);
    if (!project) throw new AppError("PROJECT_NOT_FOUND", `Project ${projectId} was not found.`, { recoverable: true });

    const root = realpathSync(project.canonical_root);
    const candidate = resolve(root, row.relative_path);
    if (!isInside(root, candidate) || !existsSync(candidate) || !lstatSync(candidate).isFile()) {
      throw new AppError("ASSET_MISSING", `Registered asset path ${row.relative_path} is not available inside the project root.`, { recoverable: true });
    }
    const resolved = realpathSync(candidate);
    if (!isInside(root, resolved)) {
      throw new AppError("ASSET_MISSING", `Registered asset path ${row.relative_path} resolves outside the project root.`, { recoverable: true });
    }
    const bytes = readFileSync(resolved);
    const actualHash = createHash("sha256").update(bytes).digest("hex");
    if (actualHash.toLowerCase() !== row.content_hash.toLowerCase() || actualHash.toLowerCase() !== expectedHash.toLowerCase()) {
      throw new AppError("ASSET_CHANGED", `Asset ${assetId} no longer matches its registered content hash.`, {
        recoverable: true,
        suggestedFix: "Re-index the project and prepare a new plan with the current asset hash.",
      });
    }
    return { row, filename: basename(row.relative_path) || assetId, bytes };
  }

  async upload(input: {
    readonly project_id: string;
    readonly asset_id: string;
    readonly content_hash: string;
    readonly profile_id: string;
    readonly backend: WorkflowBackend;
  }): Promise<ProviderAssetReference> {
    if (input.backend.profile_id !== input.profile_id) {
      throw new AppError("CAPABILITY_UNKNOWN", `Asset upload profile ${input.profile_id} does not match backend ${input.backend.profile_id}.`, { recoverable: true });
    }
    const local = this.read(input.project_id, input.asset_id, input.content_hash);
    if (isLoraAsset(local.row)) {
      throw new AppError("CAPABILITY_UNSUPPORTED", "LoRA assets require the dedicated rh_upload_lora flow and RHLoraLoader binding.", { recoverable: true });
    }
    const cached = this.storage.getProviderUpload(input.profile_id, input.backend.api_family, input.asset_id, input.content_hash);
    if (cached) return providerReference(cached);
    if (typeof input.backend.upload !== "function") {
      throw new AppError("CAPABILITY_UNSUPPORTED", "The selected backend does not support asset upload.", { recoverable: true });
    }

    const uploadInput: ProviderUploadInput = {
      asset_id: input.asset_id,
      content_hash: input.content_hash,
      filename: local.filename,
      mime: local.row.mime,
      bytes: local.bytes,
    };
    const uploaded = await input.backend.upload(uploadInput);
    if (!uploaded.value.trim()) throw new AppError("PROVIDER_ERROR", "Provider returned an empty asset reference.", { recoverable: true });
    const now = new Date().toISOString();
    const stored = this.storage.saveProviderUpload({
      profile_id: input.profile_id,
      api_family: input.backend.api_family,
      asset_id: input.asset_id,
      content_hash: input.content_hash,
      mime: local.row.mime,
      provider_kind: uploaded.kind,
      provider_value: uploaded.value,
      created_at: now,
      updated_at: now,
    });
    return providerReference(stored);
  }

  async uploadLora(input: {
    readonly project_id: string;
    readonly asset_id: string;
    readonly content_hash: string;
    readonly profile_id: string;
    readonly backend: WorkflowBackend;
  }): Promise<ProviderLoraReference> {
    if (input.backend.profile_id !== input.profile_id) {
      throw new AppError("CAPABILITY_UNKNOWN", `LoRA upload profile ${input.profile_id} does not match backend ${input.backend.profile_id}.`, { recoverable: true });
    }
    const local = this.read(input.project_id, input.asset_id, input.content_hash);
    if (!isLoraAsset(local.row)) {
      throw new AppError("INVALID_CONFIGURATION", `Asset ${input.asset_id} is not registered with the lora role.`, { recoverable: true, suggestedFix: "Register the LoRA asset with role lora before uploading it." });
    }
    const cached = this.storage.getLoraUpload(input.profile_id, input.backend.api_family, input.content_hash);
    if (cached) return providerLoraReference(cached);
    if (typeof input.backend.uploadLora !== "function") {
      throw new AppError("CAPABILITY_UNSUPPORTED", "The selected backend does not support the dedicated LoRA upload flow.", { recoverable: true });
    }
    const uploaded = await input.backend.uploadLora({
      asset_id: input.asset_id,
      content_hash: input.content_hash,
      filename: local.filename,
      mime: local.row.mime,
      bytes: local.bytes,
    });
    if (uploaded.kind !== "provider_lora" || !uploaded.value.trim()) {
      throw new AppError("PROVIDER_ERROR", "Provider returned an invalid tagged LoRA reference.", { recoverable: true });
    }
    const now = new Date().toISOString();
    const stored = this.storage.saveLoraUpload({
      profile_id: input.profile_id,
      api_family: input.backend.api_family,
      asset_id: input.asset_id,
      content_hash: input.content_hash,
      provider_kind: uploaded.kind,
      provider_value: uploaded.value,
      created_at: now,
      updated_at: now,
    });
    return providerLoraReference(stored);
  }
}
