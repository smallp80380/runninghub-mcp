import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { isIP } from "node:net";
import { isAbsolute, join, relative, resolve } from "node:path";
import { AppError } from "../errors.js";
import { Storage } from "../storage/database.js";
import {} from "./types.js";
const DEFAULT_MAX_OUTPUT_BYTES = 512 * 1024 * 1024;
function sha256(bytes) {
    return createHash("sha256").update(bytes).digest("hex");
}
function textMime(value) {
    const mime = value?.split(";", 1)[0]?.trim().toLowerCase();
    return mime && mime !== "application/octet-stream" ? mime : undefined;
}
function normalizedHostname(hostname) {
    return hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
}
function isPrivateOutputHost(hostname) {
    const host = normalizedHostname(hostname);
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal"))
        return true;
    const version = isIP(host);
    if (version === 4) {
        const octets = host.split(".").map(Number);
        const first = octets[0] ?? -1;
        const second = octets[1] ?? -1;
        return first === 0 || first === 10 || first === 127 || (first === 169 && second === 254)
            || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
    }
    if (version === 6) {
        return host === "::1" || host === "::" || /^f[cd]/i.test(host) || /^fe[89ab]/i.test(host)
            || host.startsWith("::ffff:127.") || host.startsWith("::ffff:10.") || host.startsWith("::ffff:192.168.");
    }
    return false;
}
function isAllowedOutputUrl(url) {
    const host = normalizedHostname(url.hostname);
    const loopback = host === "localhost" || host === "127.0.0.1" || host === "::1";
    if (url.username || url.password)
        return false;
    if (url.protocol === "http:")
        return loopback;
    return url.protocol === "https:" && !isPrivateOutputHost(host);
}
function safeDownloadError(value, fallback) {
    if (!(value instanceof Error) || !value.message.trim())
        return fallback;
    return value.message.trim().replace(/https?:\/\/[^\s"']+/gi, "[REDACTED_URL]").slice(0, 1000);
}
function uint32Be(bytes, offset) {
    return ((bytes[offset] ?? 0) * 0x1000000) + ((bytes[offset + 1] ?? 0) << 16) + ((bytes[offset + 2] ?? 0) << 8) + (bytes[offset + 3] ?? 0);
}
function uint32Le(bytes, offset) {
    return (bytes[offset] ?? 0) + ((bytes[offset + 1] ?? 0) << 8) + ((bytes[offset + 2] ?? 0) << 16) + ((bytes[offset + 3] ?? 0) * 0x1000000);
}
function ascii(bytes, offset, length) {
    return String.fromCharCode(...bytes.slice(offset, offset + length));
}
function isPng(bytes) {
    if (bytes.length < 33 || !bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index]))
        return false;
    let offset = 8;
    let hasHeader = false;
    while (offset + 12 <= bytes.length) {
        const length = uint32Be(bytes, offset);
        const type = ascii(bytes, offset + 4, 4);
        const end = offset + 12 + length;
        if (end > bytes.length)
            return false;
        if (type === "IHDR") {
            if (hasHeader || length !== 13 || uint32Be(bytes, offset + 8) === 0 || uint32Be(bytes, offset + 12) === 0)
                return false;
            if (bytes[offset + 18] !== 0 || bytes[offset + 19] !== 0 || (bytes[offset + 20] ?? 2) > 1)
                return false;
            hasHeader = true;
        }
        if (type === "IEND")
            return hasHeader && length === 0 && end === bytes.length;
        offset = end;
    }
    return false;
}
function isJpeg(bytes) {
    return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
}
function isWebp(bytes) {
    return bytes.length >= 16 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP" && uint32Le(bytes, 4) + 8 <= bytes.length;
}
function isWav(bytes) {
    return bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WAVE" && uint32Le(bytes, 4) + 8 <= bytes.length;
}
function isMp3(bytes) {
    if (bytes.length >= 10 && ascii(bytes, 0, 3) === "ID3")
        return bytes[3] !== undefined && bytes[3] < 0xff;
    return bytes.length >= 2 && bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0;
}
function isMp4(bytes) {
    if (bytes.length < 16 || ascii(bytes, 4, 4) !== "ftyp")
        return false;
    const boxSize = uint32Be(bytes, 0);
    return boxSize >= 16 && boxSize <= bytes.length;
}
function detectMedia(bytes) {
    if (isPng(bytes))
        return { mime: "image/png", extension: ".png" };
    if (isJpeg(bytes))
        return { mime: "image/jpeg", extension: ".jpg" };
    if (isWebp(bytes))
        return { mime: "image/webp", extension: ".webp" };
    if (isMp4(bytes)) {
        return { mime: ascii(bytes, 8, 4) === "qt  " ? "video/quicktime" : "video/mp4", extension: ascii(bytes, 8, 4) === "qt  " ? ".mov" : ".mp4" };
    }
    if (isWav(bytes))
        return { mime: "audio/wav", extension: ".wav" };
    if (isMp3(bytes))
        return { mime: "audio/mpeg", extension: ".mp3" };
    throw new AppError("DOWNLOAD_FAILED", "Downloaded output is not a supported, decodable media container.", { recoverable: true });
}
function compatibleMime(declared, detected) {
    return declared === detected
        || (declared === "video/mp4" && detected === "video/quicktime")
        || (declared === "video/quicktime" && detected === "video/mp4");
}
function assertOutputMime(output, responseMime, detected) {
    const declared = textMime(output.mime);
    if (declared && !compatibleMime(declared, detected.mime)) {
        throw new AppError("DOWNLOAD_FAILED", `Output ${output.id} declares ${declared}, but its bytes are ${detected.mime}.`, { recoverable: true });
    }
    if (responseMime && !compatibleMime(responseMime, detected.mime)) {
        throw new AppError("DOWNLOAD_FAILED", `Downloaded output ${output.id} has MIME ${responseMime}, but its bytes are ${detected.mime}.`, { recoverable: true });
    }
}
function inside(root, candidate) {
    const value = relative(root, candidate);
    return value !== "" && !value.startsWith("..") && !isAbsolute(value);
}
function portablePath(value) {
    return value.replaceAll("\\", "/");
}
function resultFromRow(row) {
    return {
        result_id: row.id,
        job_id: row.job_id,
        output_id: row.output_id,
        relative_path: row.relative_path,
        mime: row.mime,
        size_bytes: row.size_bytes,
        content_hash: row.content_hash,
    };
}
export class ResultDownloadService {
    storage;
    backend;
    fetchImpl;
    maxOutputBytes;
    constructor(storage, backend, options = {}) {
        this.storage = storage;
        this.backend = backend;
        this.fetchImpl = options.fetch_impl ?? fetch;
        this.maxOutputBytes = options.max_output_bytes ?? DEFAULT_MAX_OUTPUT_BYTES;
    }
    async download(jobId) {
        const job = this.storage.getJob(jobId);
        if (!job)
            throw new AppError("PROJECT_NOT_FOUND", `Job ${jobId} was not found.`, { recoverable: true });
        if (job.execution_state !== "SUCCEEDED" || !job.provider_task_id) {
            throw new AppError("DOWNLOAD_FAILED", `Job ${jobId} has no confirmed successful provider task to download.`, { recoverable: true, suggestedFix: "Wait for a successful provider status before requesting results." });
        }
        const plan = this.storage.getExecutionPlan(job.plan_id);
        if (!plan)
            throw new AppError("PROJECT_NOT_FOUND", `Execution plan ${job.plan_id} was not found.`, { recoverable: false });
        const project = this.storage.getProject(plan.project_id);
        if (!project)
            throw new AppError("PROJECT_NOT_FOUND", `Project ${plan.project_id} was not found.`, { recoverable: true });
        if (!project.canonical_root || !project.output_root)
            throw new AppError("INVALID_CONFIGURATION", `Project ${project.id} has no configured output root.`, { recoverable: true });
        this.storage.markArtifact(jobId, "PENDING");
        try {
            const outputs = await this.backend.outputs(job.provider_task_id);
            if (!outputs.outputs.length)
                throw new AppError("DOWNLOAD_FAILED", `Provider task ${job.provider_task_id} returned no outputs.`, { recoverable: true });
            const outputDirectory = this.prepareOutputDirectory(project, job);
            const results = [];
            for (const output of outputs.outputs) {
                results.push(await this.downloadOne(project, job, outputDirectory, output));
            }
            this.storage.markArtifact(jobId, "READY");
            return results;
        }
        catch (error) {
            this.storage.markArtifact(jobId, "FAILED");
            throw error;
        }
    }
    prepareOutputDirectory(project, job) {
        const projectRoot = realpathSync(resolve(project.canonical_root));
        const outputRoot = resolve(projectRoot, project.output_root);
        mkdirSync(outputRoot, { recursive: true });
        const realOutputRoot = realpathSync(outputRoot);
        if (!inside(projectRoot, realOutputRoot))
            throw new AppError("INVALID_CONFIGURATION", "Project output root escapes the project root.", { recoverable: false });
        const directory = join(realOutputRoot, "runninghub", job.id, "original");
        mkdirSync(directory, { recursive: true });
        const realDirectory = realpathSync(directory);
        if (!inside(projectRoot, realDirectory))
            throw new AppError("INVALID_CONFIGURATION", "Result output directory escapes the project root.", { recoverable: false });
        return realDirectory;
    }
    async downloadOne(project, job, outputDirectory, output) {
        const resultId = createHash("sha256").update(`${job.id}\0${output.id}`, "utf8").digest("hex");
        const existing = this.storage.getResult(job.id, output.id);
        if (existing) {
            const existingPath = resolve(project.canonical_root, existing.relative_path);
            const projectRoot = realpathSync(resolve(project.canonical_root));
            if (inside(projectRoot, existingPath) && existsSync(existingPath)) {
                const realExistingPath = realpathSync(existingPath);
                if (!inside(projectRoot, realExistingPath))
                    throw new AppError("DOWNLOAD_FAILED", `Stored result ${existing.id} escapes the project root.`, { recoverable: false });
                const existingBytes = readFileSync(existingPath);
                if (existingBytes.length === existing.size_bytes && sha256(existingBytes) === existing.content_hash)
                    return resultFromRow(existing);
            }
        }
        const downloaded = await this.readOutput(output);
        const detected = detectMedia(downloaded.bytes);
        assertOutputMime(output, downloaded.responseMime, detected);
        const filename = `${resultId}${detected.extension}`;
        const absolutePath = join(outputDirectory, filename);
        const projectRoot = realpathSync(resolve(project.canonical_root));
        if (!inside(projectRoot, absolutePath))
            throw new AppError("INVALID_CONFIGURATION", "Result path escapes the project root.", { recoverable: false });
        const temporaryPath = join(outputDirectory, `.${filename}.${randomUUID()}.tmp`);
        try {
            writeFileSync(temporaryPath, downloaded.bytes, { flag: "wx" });
            renameSync(temporaryPath, absolutePath);
        }
        catch (error) {
            rmSync(temporaryPath, { force: true });
            throw new AppError("DOWNLOAD_FAILED", error instanceof Error ? error.message : "Could not atomically store downloaded output.", { recoverable: true });
        }
        const now = new Date().toISOString();
        const row = {
            id: resultId,
            job_id: job.id,
            output_id: output.id,
            schema_version: "1",
            relative_path: portablePath(relative(projectRoot, absolutePath)),
            mime: detected.mime,
            size_bytes: downloaded.bytes.length,
            content_hash: sha256(downloaded.bytes),
            created_at: existing?.created_at ?? now,
            updated_at: now,
        };
        this.storage.saveResult(row);
        return resultFromRow(row);
    }
    async readOutput(output) {
        if (output.bytes) {
            if (output.bytes.length > this.maxOutputBytes)
                throw new AppError("DOWNLOAD_FAILED", `Output ${output.id} exceeds the ${this.maxOutputBytes}-byte limit.`, { recoverable: true });
            return { bytes: output.bytes };
        }
        if (!output.url)
            throw new AppError("DOWNLOAD_FAILED", `Provider output ${output.id} has neither bytes nor a download URL.`, { recoverable: true });
        let source;
        try {
            source = new URL(output.url);
        }
        catch {
            throw new AppError("DOWNLOAD_FAILED", `Provider output ${output.id} has an invalid download URL.`, { recoverable: true });
        }
        if (!isAllowedOutputUrl(source)) {
            throw new AppError("DOWNLOAD_FAILED", `Provider output ${output.id} uses a disallowed download URL scheme or host.`, { recoverable: true });
        }
        let response;
        try {
            response = await this.fetchImpl(source, { method: "GET", redirect: "error", headers: { Accept: "*/*" } });
        }
        catch (error) {
            throw new AppError("DOWNLOAD_FAILED", safeDownloadError(error, "Provider output download failed."), { recoverable: true });
        }
        let finalUrl;
        try {
            finalUrl = response.url ? new URL(response.url) : source;
        }
        catch {
            throw new AppError("DOWNLOAD_FAILED", `Provider output ${output.id} returned an invalid final URL.`, { recoverable: true });
        }
        if (!isAllowedOutputUrl(finalUrl)) {
            throw new AppError("DOWNLOAD_FAILED", `Provider output ${output.id} redirected to a disallowed URL.`, { recoverable: true });
        }
        if (!response.ok)
            throw new AppError("DOWNLOAD_FAILED", `Provider output ${output.id} returned HTTP ${response.status}.`, { recoverable: true });
        const length = Number(response.headers.get("content-length") ?? 0);
        if (Number.isFinite(length) && length > this.maxOutputBytes)
            throw new AppError("DOWNLOAD_FAILED", `Output ${output.id} exceeds the ${this.maxOutputBytes}-byte limit.`, { recoverable: true });
        try {
            const bytes = new Uint8Array(await response.arrayBuffer());
            if (bytes.length > this.maxOutputBytes)
                throw new AppError("DOWNLOAD_FAILED", `Output ${output.id} exceeds the ${this.maxOutputBytes}-byte limit.`, { recoverable: true });
            const responseMime = textMime(response.headers.get("content-type"));
            return { bytes, ...(responseMime ? { responseMime } : {}) };
        }
        catch (error) {
            if (error instanceof AppError)
                throw error;
            throw new AppError("DOWNLOAD_FAILED", safeDownloadError(error, "Provider output body could not be read."), { recoverable: true });
        }
    }
}
//# sourceMappingURL=results.js.map