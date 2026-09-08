import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { isAbsolute, join, relative, resolve } from "node:path";
import { AppError } from "../errors.js";
import { Storage, type DerivedResultRow, type ResultRow } from "../storage/database.js";

const DEFAULT_MAX_DERIVED_BYTES = 64 * 1024 * 1024;
const DEFAULT_PREVIEW_SIZE = 320;

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

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function inside(root: string, candidate: string): boolean {
  const value = relative(root, candidate);
  return value !== "" && !value.startsWith("..") && !isAbsolute(value);
}

function portablePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function derivedFromRow(row: DerivedResultRow): DerivedResult {
  return {
    derived_id: row.id,
    result_id: row.result_id,
    kind: row.kind,
    relative_path: row.relative_path,
    mime: row.mime,
    size_bytes: row.size_bytes,
    content_hash: row.content_hash,
  };
}

function validPng(bytes: Uint8Array): boolean {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
}

export class DerivedMediaService {
  private readonly ffmpegPath: string;
  private readonly maxDerivedBytes: number;
  private readonly previewSize: number;
  private readonly timeoutMs: number;

  constructor(private readonly storage: Storage, options: DerivedMediaOptions = {}) {
    this.ffmpegPath = options.ffmpeg_path ?? process.env.RUNNINGHUB_FFMPEG_PATH?.trim() ?? "ffmpeg";
    this.maxDerivedBytes = options.max_derived_bytes ?? DEFAULT_MAX_DERIVED_BYTES;
    this.previewSize = Math.max(1, Math.floor(options.preview_size ?? DEFAULT_PREVIEW_SIZE));
    this.timeoutMs = Math.max(1, options.timeout_ms ?? 30_000);
  }

  async derive(resultIds: readonly string[]): Promise<{ readonly results: readonly DerivedResult[]; readonly warnings: readonly string[] }> {
    const results: DerivedResult[] = [];
    const warnings: string[] = [];
    for (const resultId of resultIds) {
      const row = this.storage.getResultById(resultId);
      if (!row) {
        warnings.push(`Result ${resultId} disappeared before derivative generation.`);
        continue;
      }
      const kind = row.mime.startsWith("image/") ? "preview" : row.mime.startsWith("video/") ? "poster" : undefined;
      if (!kind) {
        warnings.push(`Result ${resultId} has no supported image preview or video poster derivative.`);
        continue;
      }
      try {
        results.push(await this.deriveOne(row, kind));
      } catch (error) {
        warnings.push(`Could not create ${kind} for result ${resultId}: ${error instanceof Error ? error.message : "media processing failed"}`);
      }
    }
    return { results, warnings };
  }

  private async deriveOne(result: ResultRow, kind: "preview" | "poster"): Promise<DerivedResult> {
    const context = this.resultContext(result);
    const existing = this.storage.getDerivedResult(result.id, kind);
    if (existing && existing.source_hash === result.content_hash && this.validStoredFile(context.projectRoot, existing)) {
      return derivedFromRow(existing);
    }

    const bytes = await this.renderPng(context.sourcePath, kind);
    if (!validPng(bytes)) throw new AppError("DOWNLOAD_FAILED", `Generated ${kind} is not a valid PNG.`, { recoverable: true });
    const derivedId = createHash("sha256").update(`${result.id}\0${kind}`, "utf8").digest("hex");
    const filename = `${derivedId}.png`;
    const absolutePath = join(context.outputDirectory, filename);
    if (!inside(context.projectRoot, absolutePath)) throw new AppError("INVALID_CONFIGURATION", "Derived result path escapes the project root.", { recoverable: false });
    const temporaryPath = join(context.outputDirectory, `.${filename}.${randomUUID()}.tmp`);
    try {
      writeFileSync(temporaryPath, bytes, { flag: "wx" });
      renameSync(temporaryPath, absolutePath);
    } catch (error) {
      rmSync(temporaryPath, { force: true });
      throw new AppError("DOWNLOAD_FAILED", error instanceof Error ? error.message : "Could not atomically store derived output.", { recoverable: true });
    }

    const now = new Date().toISOString();
    const row: DerivedResultRow = {
      id: derivedId,
      result_id: result.id,
      kind,
      schema_version: "1",
      source_hash: result.content_hash,
      relative_path: portablePath(relative(context.projectRoot, absolutePath)),
      mime: "image/png",
      size_bytes: bytes.length,
      content_hash: sha256(bytes),
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    this.storage.saveDerivedResult(row);
    return derivedFromRow(row);
  }

  private resultContext(result: ResultRow): { projectRoot: string; sourcePath: string; outputDirectory: string } {
    const job = this.storage.getJob(result.job_id);
    if (!job) throw new AppError("PROJECT_NOT_FOUND", `Job ${result.job_id} was not found.`, { recoverable: false });
    const plan = this.storage.getExecutionPlan(job.plan_id);
    if (!plan) throw new AppError("PROJECT_NOT_FOUND", `Execution plan ${job.plan_id} was not found.`, { recoverable: false });
    const project = this.storage.getProject(plan.project_id);
    if (!project?.canonical_root || !project.output_root) throw new AppError("INVALID_CONFIGURATION", `Project ${plan.project_id} has no configured output root.`, { recoverable: false });
    const projectRoot = realpathSync(resolve(project.canonical_root));
    const sourceCandidate = resolve(projectRoot, result.relative_path);
    if (!inside(projectRoot, sourceCandidate) || !existsSync(sourceCandidate)) throw new AppError("DOWNLOAD_FAILED", `Stored result ${result.id} is unavailable.`, { recoverable: true });
    const sourcePath = realpathSync(sourceCandidate);
    if (!inside(projectRoot, sourcePath)) throw new AppError("DOWNLOAD_FAILED", `Stored result ${result.id} escapes the project root.`, { recoverable: false });

    const outputRoot = resolve(projectRoot, project.output_root);
    mkdirSync(outputRoot, { recursive: true });
    const realOutputRoot = realpathSync(outputRoot);
    if (!inside(projectRoot, realOutputRoot)) throw new AppError("INVALID_CONFIGURATION", "Project output root escapes the project root.", { recoverable: false });
    const outputDirectory = join(realOutputRoot, "runninghub", job.id, "derived");
    mkdirSync(outputDirectory, { recursive: true });
    const realDirectory = realpathSync(outputDirectory);
    if (!inside(projectRoot, realDirectory)) throw new AppError("INVALID_CONFIGURATION", "Derived output directory escapes the project root.", { recoverable: false });
    return { projectRoot, sourcePath, outputDirectory: realDirectory };
  }

  private validStoredFile(projectRoot: string, row: DerivedResultRow): boolean {
    const candidate = resolve(projectRoot, row.relative_path);
    if (!inside(projectRoot, candidate) || !existsSync(candidate)) return false;
    try {
      const realPath = realpathSync(candidate);
      if (!inside(projectRoot, realPath)) throw new Error("path escapes project root");
      const bytes = readFileSync(realPath);
      return bytes.length === row.size_bytes && sha256(bytes) === row.content_hash;
    } catch {
      return false;
    }
  }

  private async renderPng(sourcePath: string, kind: "preview" | "poster"): Promise<Uint8Array> {
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      ...(kind === "poster" ? ["-ss", "0"] : []),
      "-i",
      sourcePath,
      "-vf",
      `scale=w=${this.previewSize}:h=${this.previewSize}:force_original_aspect_ratio=decrease`,
      "-frames:v",
      "1",
      "-f",
      "image2pipe",
      "-vcodec",
      "png",
      "pipe:1",
    ];
    return new Promise<Uint8Array>((resolveOutput, reject) => {
      const child = spawn(this.ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });
      const chunks: Buffer[] = [];
      let size = 0;
      let stderr = "";
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill();
        reject(new AppError("DOWNLOAD_FAILED", `Local ${kind} generation timed out.`, { recoverable: true }));
      }, this.timeoutMs);
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      };
      child.stdout.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > this.maxDerivedBytes) {
          child.kill();
          fail(new AppError("DOWNLOAD_FAILED", `Generated ${kind} exceeds the ${this.maxDerivedBytes}-byte limit.`, { recoverable: true }));
          return;
        }
        chunks.push(chunk);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr = `${stderr}${chunk.toString("utf8")}`.slice(-512);
      });
      child.once("error", (error: NodeJS.ErrnoException) => {
        fail(new AppError("CAPABILITY_UNSUPPORTED", error.code === "ENOENT" ? "Local ffmpeg is not configured for derived media." : "Local media processor could not start.", { recoverable: true }));
      });
      child.once("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (code !== 0) {
          const detail = stderr.trim().split(/\r?\n/).pop()?.slice(0, 160);
          reject(new AppError("DOWNLOAD_FAILED", detail ? `Local ${kind} generation failed: ${detail}` : `Local ${kind} generation failed.`, { recoverable: true }));
          return;
        }
        resolveOutput(Uint8Array.from(Buffer.concat(chunks)));
      });
    });
  }
}
