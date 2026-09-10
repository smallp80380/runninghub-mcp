import { createHash } from "node:crypto";
import { isLosslessNumber, parse as parseLossless } from "lossless-json";
import { AppError } from "../../errors.js";
import { SubmitUnknownError } from "../../execution/types.js";
function pathValue(value, paths) {
    let current = value;
    for (const path of paths) {
        if (!current || typeof current !== "object")
            return undefined;
        current = current[path];
    }
    return current;
}
function providerMessage(value, apiKey) {
    if (typeof value !== "string" || !value.trim())
        return undefined;
    let message = value.trim();
    try {
        const parsed = JSON.parse(message);
        if (typeof parsed === "string") {
            message = parsed;
        }
        else if (parsed && typeof parsed === "object") {
            const nested = pathValue(parsed, ["message"]) ?? pathValue(parsed, ["errorMessage"]) ?? pathValue(parsed, ["error", "message"]);
            const code = pathValue(parsed, ["code"]) ?? pathValue(parsed, ["errorCode"]);
            if (typeof nested === "string" && nested.trim())
                message = `${typeof code === "string" || typeof code === "number" ? `${String(code)}: ` : ""}${nested.trim()}`;
            else if (typeof code === "string" || typeof code === "number")
                message = String(code);
            else
                return "Provider rejected the request.";
        }
    }
    catch {
        // Ordinary provider messages are not JSON envelopes.
    }
    if (apiKey.trim())
        message = message.replaceAll(apiKey, "[REDACTED_API_KEY]");
    message = message
        .replace(/https?:\/\/[^\s"']+/gi, "[REDACTED_URL]")
        .replace(/\b(api[_-]?key|authorization|bearer|access[_-]?token|token|signature|secret)\s*[:=]\s*[^\s,;)}]+/gi, "$1=[REDACTED]");
    return message.slice(0, 1000);
}
function errorFromBody(body, apiKey) {
    const code = pathValue(body, ["code"]) ?? pathValue(body, ["data", "code"]);
    const successCode = ["0", "200"].includes(String(code));
    for (const path of [["errorMessage"], ["error", "message"], ["data", "errorMessage"], ["data", "error", "message"]]) {
        const message = providerMessage(pathValue(body, path), apiKey);
        if (message)
            return message;
    }
    if (!successCode) {
        for (const path of [["error"], ["message"], ["data", "message"], ["msg"], ["data", "msg"], ["errorCode"], ["code"], ["data", "errorCode"]]) {
            const message = providerMessage(pathValue(body, path), apiKey);
            if (message)
                return message;
        }
    }
    return undefined;
}
function taskIdFromBody(body) {
    for (const path of [["taskId"], ["task_id"], ["data", "taskId"], ["data", "task_id"]]) {
        const value = pathValue(body, path);
        const text = typeof value === "string" || typeof value === "number" || isLosslessNumber(value) ? String(value).trim() : "";
        if (text && text.length <= 256 && /^[A-Za-z0-9._:-]+$/.test(text))
            return text;
    }
    return undefined;
}
function boundedScalar(value) {
    if (!(typeof value === "string" || typeof value === "number" || isLosslessNumber(value)))
        return undefined;
    const text = String(value).trim();
    return text && text.length <= 256 ? text : undefined;
}
function normalizeStatus(value) {
    if (typeof value !== "string")
        return undefined;
    const status = value.toUpperCase();
    if (["CREATE", "QUEUED", "PENDING"].includes(status))
        return "QUEUED";
    if (["RUNNING", "PROCESSING"].includes(status))
        return "RUNNING";
    if (["SUCCESS", "SUCCEEDED", "DONE"].includes(status))
        return "SUCCESS";
    if (["FAILED", "FAIL"].includes(status))
        return "FAILED";
    if (["CANCEL", "CANCELLED"].includes(status))
        return "CANCEL";
    return undefined;
}
function textValue(value) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function epochExpiry(value) {
    if (!Number.isFinite(value) || value <= 0)
        return undefined;
    const milliseconds = value >= 1_000_000_000_000 ? value : value * 1000;
    const date = new Date(milliseconds);
    return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}
function absoluteExpiry(value) {
    if (typeof value === "number")
        return epochExpiry(value);
    if (isLosslessNumber(value))
        return epochExpiry(Number(value.toString()));
    const text = textValue(value);
    if (!text)
        return undefined;
    if (/^\d+(?:\.\d+)?$/.test(text))
        return epochExpiry(Number(text));
    const timestamp = Date.parse(text);
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}
function pathValues(value, paths) {
    return paths.map((path) => pathValue(value, path)).filter((candidate) => candidate !== undefined);
}
function responseExpiry(body) {
    const absolute = pathValues(body, [
        ["expiresAt"], ["expires_at"], ["expiration"], ["expireTime"],
        ["data", "expiresAt"], ["data", "expires_at"], ["data", "expiration"], ["data", "expireTime"],
    ]).map(absoluteExpiry).find((value) => Boolean(value));
    if (absolute)
        return absolute;
    const duration = pathValues(body, [
        ["expiresIn"], ["expires_in"], ["ttl"],
        ["data", "expiresIn"], ["data", "expires_in"], ["data", "ttl"],
    ]).map((value) => typeof value === "number" || typeof value === "string" || isLosslessNumber(value) ? Number(String(value)) : NaN)
        .find((value) => Number.isFinite(value) && value > 0);
    return duration === undefined ? undefined : new Date(Date.now() + duration * 1000).toISOString();
}
function urlExpiry(value) {
    let url;
    try {
        url = new URL(value);
    }
    catch {
        return undefined;
    }
    for (const key of ["expires", "Expires", "expires_at", "expiresAt", "expiration", "se"]) {
        const expiry = absoluteExpiry(url.searchParams.get(key));
        if (expiry)
            return expiry;
    }
    const signedAt = url.searchParams.get("X-Amz-Date") ?? url.searchParams.get("x-amz-date");
    const signedFor = Number(url.searchParams.get("X-Amz-Expires") ?? url.searchParams.get("x-amz-expires"));
    if (signedAt && Number.isFinite(signedFor) && signedFor > 0) {
        const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(signedAt);
        const timestamp = match ? Date.parse(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`) : NaN;
        if (Number.isFinite(timestamp))
            return new Date(timestamp + signedFor * 1000).toISOString();
    }
    return undefined;
}
function cacheExpiry(body, reference) {
    return responseExpiry(body) ?? urlExpiry(reference);
}
function fileCacheExpiry(body) {
    return pathValues(body, [
        ["fileExpiresAt"], ["file_expires_at"],
        ["data", "fileExpiresAt"], ["data", "file_expires_at"],
    ]).map(absoluteExpiry).find((value) => Boolean(value));
}
function cacheReferenceFailure(body) {
    const values = pathValues(body, [
        ["errorCode"], ["errorMessage"], ["error"], ["message"], ["msg"], ["code"],
        ["data", "errorCode"], ["data", "errorMessage"], ["data", "message"], ["data", "msg"], ["data", "code"],
    ]).map(textValue).filter((value) => Boolean(value)).map((value) => value.toUpperCase());
    return values.some((value) => /(?:FILE|MEDIA|ASSET|URL|UPLOAD|REFERENCE).*(?:EXPIRED|NOT[ _-]?FOUND|DOES NOT EXIST)/.test(value)
        || /^(?:EXPIRED|NOT_FOUND|NOTFOUND)$/.test(value)
        || /(?:FILE_NOT_FOUND|MEDIA_NOT_FOUND|ASSET_NOT_FOUND|URL_NOT_FOUND|REFERENCE_NOT_FOUND)/.test(value));
}
function terminalTaskFailure(body, apiKey) {
    const status = textValue(pathValue(body, ["status"])
        ?? pathValue(body, ["taskStatus"])
        ?? pathValue(body, ["data", "status"])
        ?? pathValue(body, ["data", "taskStatus"]));
    const codeValue = pathValue(body, ["errorCode"])
        ?? pathValue(body, ["code"])
        ?? pathValue(body, ["data", "errorCode"])
        ?? pathValue(body, ["data", "code"]);
    const code = boundedScalar(codeValue);
    const message = providerMessage(pathValue(body, ["errorMessage"])
        ?? pathValue(body, ["message"])
        ?? pathValue(body, ["msg"])
        ?? pathValue(body, ["data", "errorMessage"])
        ?? pathValue(body, ["error", "message"])
        ?? pathValue(body, ["data", "error", "message"])
        ?? pathValue(body, ["data", "message"])
        ?? pathValue(body, ["data", "msg"]), apiKey);
    const markers = [status, code, message].filter((value) => Boolean(value)).map((value) => value.toUpperCase());
    const terminal = markers.some((value) => ["EXPIRED", "TASK_EXPIRED", "TASK_NOT_FOUND", "NOT_FOUND", "NOTFOUND"].includes(value)
        || /(?:TASK|JOB).*(?:EXPIRED|NOT FOUND|DOES NOT EXIST)/.test(value));
    if (!terminal)
        return undefined;
    return {
        code: code ?? (status?.toUpperCase() === "EXPIRED" ? "TASK_EXPIRED" : "TASK_NOT_FOUND"),
        message: message ?? status ?? "Provider task is no longer available.",
    };
}
function appendPath(path, value) {
    return `${path.replace(/\/+$/, "")}/${encodeURIComponent(value)}`;
}
function isValidationError(message) {
    return /prompt_outputs_failed_validation|invalid image file|validation/i.test(message);
}
function sanitizeForLog(value, apiKey) {
    if (typeof value === "string") {
        return value
            .replaceAll(apiKey.trim() ? apiKey : "\u0000", "[REDACTED_API_KEY]")
            .replace(/https?:\/\/[^\s"']+/gi, "[REDACTED_URL]");
    }
    if (Array.isArray(value))
        return value.map((item) => sanitizeForLog(item, apiKey));
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => {
            const sensitive = /api[-_]?key|authorization|bearer|access[_-]?token|token|signature|secret/i.test(key);
            return [key, sensitive ? "[REDACTED]" : sanitizeForLog(item, apiKey)];
        }));
    }
    return value;
}
function providerResponseContext(body) {
    const code = pathValue(body, ["errorCode"])
        ?? pathValue(body, ["code"])
        ?? pathValue(body, ["data", "errorCode"])
        ?? pathValue(body, ["data", "code"]);
    return {
        ...(boundedScalar(code) ? { provider_code: boundedScalar(code) } : {}),
    };
}
async function httpProviderError(response, operation, apiKey) {
    let body;
    try {
        body = parseLossless(await response.text());
    }
    catch {
        body = undefined;
    }
    const outcome = [408, 425, 429].includes(response.status) || response.status >= 500 ? "unknown" : "rejected";
    return new AppError("PROVIDER_ERROR", errorFromBody(body, apiKey) ?? `${operation} HTTP ${response.status}.`, {
        recoverable: outcome === "unknown",
        context: { outcome, http_status: String(response.status), ...providerResponseContext(body) },
    });
}
const DEFAULT_SIGNED_UPLOAD_HOSTS = [
    "runninghub.ai",
    "runninghub.cn",
    "xiaoyaoyou.com",
    "myqcloud.com",
    "aliyuncs.com",
    "aliyun.com",
    "amazonaws.com",
];
function hostMatches(hostname, allowed) {
    const normalized = hostname.toLowerCase().replace(/\.$/, "");
    return allowed.some((candidate) => {
        const domain = candidate.toLowerCase().replace(/^\.+/, "").replace(/\.$/, "");
        return normalized === domain || normalized.endsWith(`.${domain}`);
    });
}
export class WorkflowApiClient {
    options;
    api_family = "workflow_api";
    profile_id;
    fetchImpl;
    baseUrl;
    signedUploadHosts;
    constructor(options) {
        this.options = options;
        this.profile_id = options.profile_id;
        this.fetchImpl = options.fetch_impl ?? fetch;
        let baseUrl;
        try {
            baseUrl = new URL(options.base_url);
        }
        catch {
            throw new AppError("INVALID_CONFIGURATION", "Workflow API base URL is invalid.", { recoverable: true });
        }
        const hostname = baseUrl.hostname.toLowerCase().replace(/^\[|\]$/g, "");
        const loopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
        if (baseUrl.username || baseUrl.password || (baseUrl.protocol !== "https:" && !(baseUrl.protocol === "http:" && loopback))) {
            throw new AppError("INVALID_CONFIGURATION", "Workflow API base URL must be HTTPS unless it targets localhost.", { recoverable: true });
        }
        for (const route of Object.values(options.routes)) {
            if (!route)
                continue;
            let resolved;
            try {
                resolved = new URL(route, baseUrl);
            }
            catch {
                throw new AppError("INVALID_CONFIGURATION", "Workflow API route is invalid.", { recoverable: true });
            }
            if (resolved.origin !== baseUrl.origin) {
                throw new AppError("INVALID_CONFIGURATION", "Workflow API routes must stay on the configured base URL.", { recoverable: true });
            }
        }
        this.baseUrl = baseUrl;
        this.signedUploadHosts = options.signed_upload_hosts ?? DEFAULT_SIGNED_UPLOAD_HOSTS;
    }
    async submit(input) {
        const nodeInfoList = input.node_info_list ?? [];
        const mode = input.submit_mode
            ?? (input.workflow_id && /^\d+$/.test(input.workflow_id)
                ? "v2_node_info"
                : input.workflow_json
                    ? "legacy_graph"
                    : "legacy_saved");
        const payload = { addMetadata: true };
        let route = this.options.routes.submit;
        if (mode === "v2_node_info") {
            if (!input.workflow_id || !/^\d+$/.test(input.workflow_id)) {
                throw new AppError("INVALID_CONFIGURATION", "V2 workflow submit requires a numeric provider workflow ID.", { recoverable: false });
            }
            if (!this.options.routes.submit_v2) {
                throw new AppError("CAPABILITY_UNSUPPORTED", "Workflow API V2 submit route is not configured.", { recoverable: true });
            }
            route = appendPath(this.options.routes.submit_v2, input.workflow_id);
            payload.workflowId = input.workflow_id;
            payload.nodeInfoList = nodeInfoList;
        }
        else {
            if (input.workflow_id)
                payload.workflowId = input.workflow_id;
            if (mode === "legacy_graph")
                payload.workflow = input.workflow_json;
        }
        this.log({ operation: "submit", route, plan_id: input.plan_id, workflow_id: input.workflow_id ?? null, submit_mode: mode, node_info_list: nodeInfoList });
        let body;
        try {
            body = await this.request(route, payload);
        }
        catch (error) {
            if (error instanceof AppError && error.code === "PROVIDER_ERROR" && error.context.outcome === "unknown")
                throw new SubmitUnknownError(error.message);
            throw error;
        }
        const applicationError = errorFromBody(body, this.options.api_key);
        if (applicationError && !taskIdFromBody(body)) {
            const cacheExpired = cacheReferenceFailure(body);
            throw new AppError("PROVIDER_ERROR", applicationError, {
                recoverable: cacheExpired,
                context: {
                    outcome: cacheExpired ? "cache_expired" : "rejected",
                    charge: "unknown_or_not_started",
                    ...providerResponseContext(body),
                    ...(isValidationError(applicationError) ? { retry: "never" } : {}),
                },
            });
        }
        const taskId = taskIdFromBody(body);
        if (!taskId) {
            throw new AppError("PROVIDER_ERROR", "HTTP submit response did not contain a provider task ID.", {
                recoverable: false,
                context: { outcome: "rejected", charge: "unknown_or_not_started" },
            });
        }
        return { task_id: taskId, raw: body };
    }
    async upload(input) {
        const route = this.options.routes.upload_legacy ?? this.options.routes.upload;
        if (!route) {
            throw new AppError("CAPABILITY_UNSUPPORTED", "Workflow API asset upload route is not configured.", { recoverable: true });
        }
        const form = new FormData();
        form.append("apiKey", this.options.api_key);
        form.append("fileType", "input");
        form.append("file", new Blob([input.bytes], { type: input.mime }), input.filename);
        this.log({ operation: "upload", route, upload_mode: "legacy", asset_id: input.asset_id, filename: input.filename, file_type: "input" });
        const body = await this.requestMultipart(route, form);
        return this.parseUploadResponse(body);
    }
    async uploadV2(input) {
        const route = this.options.routes.upload_v2;
        if (!route) {
            throw new AppError("CAPABILITY_UNSUPPORTED", "Workflow API V2 asset upload route is not configured.", { recoverable: true });
        }
        const form = new FormData();
        form.append("file", new Blob([input.bytes], { type: input.mime }), input.filename);
        this.log({ operation: "upload", route, upload_mode: "v2", asset_id: input.asset_id, filename: input.filename });
        const body = await this.requestMultipart(route, form);
        return this.parseUploadResponse(body);
    }
    async getWorkflowJson(workflowId) {
        const route = this.options.routes.workflow_json;
        if (!route) {
            throw new AppError("CAPABILITY_UNSUPPORTED", "Workflow JSON preflight route is not configured.", { recoverable: true });
        }
        this.log({ operation: "workflow_json_preflight", route, workflow_id: workflowId });
        const body = await this.request(route, { workflowId });
        const applicationError = errorFromBody(body, this.options.api_key);
        if (applicationError) {
            throw new AppError("PROVIDER_ERROR", applicationError, { recoverable: false, context: providerResponseContext(body) });
        }
        const prompt = pathValue(body, ["data", "prompt"]) ?? pathValue(body, ["prompt"]);
        if (typeof prompt === "string" && prompt.trim())
            return prompt;
        if (prompt && typeof prompt === "object")
            return JSON.stringify(prompt);
        throw new AppError("PROVIDER_ERROR", "Workflow JSON response did not contain data.prompt.", { recoverable: false });
    }
    parseUploadResponse(body) {
        const applicationError = errorFromBody(body, this.options.api_key);
        if (applicationError)
            throw new AppError("PROVIDER_ERROR", applicationError, { recoverable: false, context: providerResponseContext(body) });
        const fileName = pathValue(body, ["data", "fileName"]) ?? pathValue(body, ["data", "filename"]) ?? pathValue(body, ["fileName"]) ?? pathValue(body, ["filename"]);
        if (typeof fileName === "string" && fileName.trim()) {
            const expiresAt = responseExpiry(body);
            return { kind: "provider_file", value: fileName, ...(expiresAt ? { expires_at: expiresAt } : {}) };
        }
        const url = pathValue(body, ["data", "download_url"]) ?? pathValue(body, ["data", "downloadUrl"]) ?? pathValue(body, ["download_url"]) ?? pathValue(body, ["downloadUrl"]);
        if (typeof url === "string" && url.trim()) {
            const expiresAt = cacheExpiry(body, url);
            return { kind: "provider_url", value: url, ...(expiresAt ? { expires_at: expiresAt } : {}) };
        }
        throw new AppError("PROVIDER_ERROR", "Workflow API upload response did not contain a tagged provider file or URL.", { recoverable: true });
    }
    async uploadLora(input) {
        if (!this.options.routes.lora_upload_url) {
            throw new AppError("CAPABILITY_UNSUPPORTED", "Workflow API LoRA upload route is not configured.", { recoverable: true });
        }
        const md5Hex = createHash("md5").update(input.bytes).digest("hex");
        const loraName = input.filename.replace(/\.[^/.]+$/, "");
        const body = await this.request(this.options.routes.lora_upload_url, { loraName, md5Hex });
        const applicationError = errorFromBody(body, this.options.api_key);
        if (applicationError)
            throw new AppError("PROVIDER_ERROR", applicationError, { recoverable: false, context: providerResponseContext(body) });
        const fileName = pathValue(body, ["data", "fileName"]) ?? pathValue(body, ["data", "filename"]);
        const uploadUrl = pathValue(body, ["data", "url"]);
        if (typeof fileName !== "string" || !fileName.trim() || typeof uploadUrl !== "string" || !uploadUrl.trim()) {
            throw new AppError("PROVIDER_ERROR", "Workflow API LoRA response did not contain fileName and upload URL.", { recoverable: true });
        }
        await this.putSignedLora(uploadUrl, input.bytes);
        const expiresAt = fileCacheExpiry(body);
        return { kind: "provider_lora", value: fileName, ...(expiresAt ? { expires_at: expiresAt } : {}) };
    }
    async status(taskId) {
        const body = await this.request(this.options.routes.status, { taskId });
        const applicationError = errorFromBody(body, this.options.api_key);
        const statusValue = pathValue(body, ["status"])
            ?? pathValue(body, ["taskStatus"])
            ?? pathValue(body, ["data", "status"])
            ?? pathValue(body, ["data", "taskStatus"]);
        const state = normalizeStatus(statusValue);
        const terminalFailure = terminalTaskFailure(body, this.options.api_key);
        if (terminalFailure)
            return { state: "FAILED", task_id: taskId, error_code: terminalFailure.code, error_message: terminalFailure.message, raw: body };
        if (applicationError && !state) {
            const providerCode = boundedScalar(pathValue(body, ["errorCode"]) ?? pathValue(body, ["code"]) ?? pathValue(body, ["data", "errorCode"]) ?? pathValue(body, ["data", "code"]));
            throw new AppError("PROVIDER_ERROR", providerCode ? `${providerCode}: ${applicationError}` : applicationError, { recoverable: false, context: providerResponseContext(body) });
        }
        if (!state)
            throw new AppError("PROVIDER_ERROR", "Workflow API response did not contain a recognized status.", { recoverable: true });
        return { state, task_id: taskId, error_message: errorFromBody(body, this.options.api_key), raw: body };
    }
    async outputs(taskId) {
        const body = await this.request(this.options.routes.outputs, { taskId });
        const applicationError = errorFromBody(body, this.options.api_key);
        if (applicationError)
            throw new AppError("PROVIDER_ERROR", applicationError, { recoverable: false, context: providerResponseContext(body) });
        const data = pathValue(body, ["data"]);
        const values = pathValue(body, ["results"]) ?? pathValue(body, ["data", "results"]) ?? (Array.isArray(data) ? data : data && typeof data === "object" && ("fileUrl" in data || "url" in data) ? [data] : undefined);
        if (!Array.isArray(values))
            return { outputs: [], raw: body };
        return {
            outputs: values.flatMap((value, index) => {
                const item = value && typeof value === "object" ? value : {};
                const url = item.url ?? item.outputUrl ?? item.output_url ?? item.fileUrl;
                const mime = item.mime ?? item.fileType;
                if (typeof url !== "string" || !url.trim())
                    return [];
                return [{ id: boundedScalar(item.id ?? item.nodeId) ?? String(index), url, ...(typeof mime === "string" ? { mime } : {}) }];
            }),
            raw: body,
        };
    }
    async cancel(taskId) {
        if (!this.options.routes.cancel)
            throw new AppError("CAPABILITY_UNSUPPORTED", "Workflow API cancel route is not configured.", { recoverable: true });
        const body = await this.request(this.options.routes.cancel, { taskId });
        const statusValue = pathValue(body, ["status"])
            ?? pathValue(body, ["taskStatus"])
            ?? pathValue(body, ["data", "status"])
            ?? pathValue(body, ["data", "taskStatus"]);
        const applicationError = errorFromBody(body, this.options.api_key);
        if (applicationError && !normalizeStatus(statusValue))
            throw new AppError("PROVIDER_ERROR", applicationError, { recoverable: true, context: providerResponseContext(body) });
        const state = normalizeStatus(statusValue) ?? "CANCEL";
        return { state, task_id: taskId, raw: body };
    }
    async request(path, payload) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), Math.max(1, this.options.timeout_ms ?? 30_000));
        try {
            const url = new URL(path, this.baseUrl);
            const response = await this.fetchImpl(url.toString(), {
                method: "POST",
                headers: { Host: url.host, Authorization: `Bearer ${this.options.api_key}`, "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ apiKey: this.options.api_key, ...payload }),
                signal: controller.signal,
            });
            if (!response.ok)
                throw await httpProviderError(response, "Workflow API request", this.options.api_key);
            return await this.body(response);
        }
        catch (error) {
            if (error instanceof AppError)
                throw error;
            throw new AppError("PROVIDER_ERROR", providerMessage(error instanceof Error ? error.message : undefined, this.options.api_key) ?? "Workflow API request failed.", { recoverable: true, context: { outcome: "unknown" } });
        }
        finally {
            clearTimeout(timeout);
        }
    }
    async requestMultipart(path, body) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), Math.max(1, this.options.timeout_ms ?? 30_000));
        try {
            const url = new URL(path, this.baseUrl);
            const response = await this.fetchImpl(url.toString(), {
                method: "POST",
                headers: { Host: url.host, Authorization: `Bearer ${this.options.api_key}`, Accept: "application/json" },
                body,
                signal: controller.signal,
            });
            if (!response.ok)
                throw await httpProviderError(response, "Workflow API upload", this.options.api_key);
            return await this.body(response);
        }
        catch (error) {
            if (error instanceof AppError)
                throw error;
            throw new AppError("PROVIDER_ERROR", providerMessage(error instanceof Error ? error.message : undefined, this.options.api_key) ?? "Workflow API upload failed.", { recoverable: true, context: { outcome: "unknown" } });
        }
        finally {
            clearTimeout(timeout);
        }
    }
    async putSignedLora(uploadUrl, bytes) {
        let url;
        try {
            url = new URL(uploadUrl);
        }
        catch {
            throw new AppError("PROVIDER_ERROR", "Workflow API returned an invalid LoRA upload URL.", { recoverable: false });
        }
        if (url.protocol !== "https:" || url.username || url.password || !hostMatches(url.hostname, this.signedUploadHosts)) {
            throw new AppError("PROVIDER_ERROR", "Workflow API LoRA upload URL is not an allowed HTTPS storage endpoint.", { recoverable: false });
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), Math.max(1, this.options.timeout_ms ?? 30_000));
        try {
            const response = await this.fetchImpl(url.toString(), {
                method: "PUT",
                headers: { "Content-Type": "application/octet-stream" },
                body: new Blob([bytes], { type: "application/octet-stream" }),
                signal: controller.signal,
                redirect: "error",
            });
            if (!response.ok)
                throw new AppError("PROVIDER_ERROR", `Workflow API LoRA upload HTTP ${response.status}.`, { recoverable: response.status === 429 || response.status >= 500 });
        }
        catch (error) {
            if (error instanceof AppError)
                throw error;
            throw new AppError("PROVIDER_ERROR", providerMessage(error instanceof Error ? error.message : undefined, this.options.api_key) ?? "Workflow API LoRA upload failed.", { recoverable: true, context: { outcome: "unknown" } });
        }
        finally {
            clearTimeout(timeout);
        }
    }
    async body(response) {
        const text = await response.text();
        try {
            return parseLossless(text);
        }
        catch {
            throw new AppError("PROVIDER_ERROR", "Workflow API returned non-JSON content.", { recoverable: false });
        }
    }
    log(event) {
        this.options.logger?.(sanitizeForLog(event, this.options.api_key));
    }
}
//# sourceMappingURL=client.js.map