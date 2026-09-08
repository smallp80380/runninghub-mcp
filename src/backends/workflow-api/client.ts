import { createHash } from "node:crypto";
import { parse as parseLossless } from "lossless-json";
import { AppError } from "../../errors.js";
import { SubmitUnknownError, type ProviderAssetReference, type ProviderLoraReference, type ProviderLoraUploadInput, type ProviderOutput, type ProviderStatus, type ProviderUploadInput, type WorkflowBackend } from "../../execution/types.js";

export interface WorkflowApiRoutes {
  readonly submit: string;
  readonly status: string;
  readonly outputs: string;
  readonly upload?: string;
  readonly lora_upload_url?: string;
  readonly cancel?: string;
}

export interface WorkflowApiClientOptions {
  readonly profile_id: string;
  readonly base_url: string;
  readonly api_key: string;
  readonly routes: WorkflowApiRoutes;
  readonly timeout_ms?: number;
  readonly fetch_impl?: typeof fetch;
}

function pathValue(value: unknown, paths: readonly string[]): unknown {
  let current = value;
  for (const path of paths) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[path];
  }
  return current;
}

function errorFromBody(body: unknown): string | undefined {
  for (const path of [["errorMessage"], ["error"], ["message"], ["errorCode"], ["code"], ["data", "errorMessage"], ["data", "message"], ["data", "errorCode"]]) {
    const value = pathValue(body, path);
    if (typeof value === "string" && value.trim()) return value;
  }
  const code = pathValue(body, ["code"]) ?? pathValue(body, ["data", "code"]);
  const message = pathValue(body, ["msg"]) ?? pathValue(body, ["data", "msg"]);
  if (typeof message === "string" && message.trim() && code !== undefined && !["0", "200"].includes(String(code))) return message;
  return undefined;
}

function taskIdFromBody(body: unknown): string | undefined {
  for (const path of [["taskId"], ["task_id"], ["data", "taskId"], ["data", "task_id"]]) {
    const value = pathValue(body, path);
    if (typeof value === "string" || typeof value === "number" || (value && typeof value === "object" && "toString" in value)) return String(value);
  }
  return undefined;
}

function normalizeStatus(value: unknown): ProviderStatus["state"] | undefined {
  if (typeof value !== "string") return undefined;
  const status = value.toUpperCase();
  if (["CREATE", "QUEUED", "PENDING"].includes(status)) return "QUEUED";
  if (["RUNNING", "PROCESSING"].includes(status)) return "RUNNING";
  if (["SUCCESS", "SUCCEEDED", "DONE"].includes(status)) return "SUCCESS";
  if (["FAILED", "FAIL"].includes(status)) return "FAILED";
  if (["CANCEL", "CANCELLED"].includes(status)) return "CANCEL";
  return undefined;
}

function textValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function terminalTaskFailure(body: unknown): { code: string; message: string } | undefined {
  const status = textValue(
    pathValue(body, ["status"])
      ?? pathValue(body, ["taskStatus"])
      ?? pathValue(body, ["data", "status"])
      ?? pathValue(body, ["data", "taskStatus"]),
  );
  const codeValue = pathValue(body, ["errorCode"])
    ?? pathValue(body, ["code"])
    ?? pathValue(body, ["data", "errorCode"])
    ?? pathValue(body, ["data", "code"]);
  const code = textValue(codeValue === undefined ? undefined : String(codeValue));
  const message = textValue(
    pathValue(body, ["errorMessage"])
      ?? pathValue(body, ["message"])
      ?? pathValue(body, ["msg"])
      ?? pathValue(body, ["data", "errorMessage"])
      ?? pathValue(body, ["data", "message"])
      ?? pathValue(body, ["data", "msg"]),
  );
  const markers = [status, code, message].filter((value): value is string => Boolean(value)).map((value) => value.toUpperCase());
  const terminal = markers.some((value) => ["EXPIRED", "TASK_EXPIRED", "TASK_NOT_FOUND", "NOT_FOUND", "NOTFOUND"].includes(value)
    || /(?:TASK|JOB).*(?:EXPIRED|NOT FOUND|DOES NOT EXIST)/.test(value));
  if (!terminal) return undefined;
  return {
    code: code ?? (status?.toUpperCase() === "EXPIRED" ? "TASK_EXPIRED" : "TASK_NOT_FOUND"),
    message: message ?? status ?? "Provider task is no longer available.",
  };
}

function workflowSubmitPath(workflowId: string | undefined, fallback: string): string {
  return workflowId && /^\d+$/.test(workflowId)
    ? `/openapi/v2/run/workflow/${encodeURIComponent(workflowId)}`
    : fallback;
}

export class WorkflowApiClient implements WorkflowBackend {
  readonly api_family = "workflow_api" as const;
  readonly profile_id: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: WorkflowApiClientOptions) {
    this.profile_id = options.profile_id;
    this.fetchImpl = options.fetch_impl ?? fetch;
    if (!options.base_url.startsWith("https://") && !options.base_url.startsWith("http://localhost")) {
      throw new AppError("INVALID_CONFIGURATION", "Workflow API base URL must be HTTPS unless it targets localhost.", { recoverable: true });
    }
  }

  async submit(input: { workflow_json: string; plan_id: string; workflow_id?: string }): Promise<{ task_id: string; raw?: unknown }> {
    let response: Response;
    try {
      response = await this.request(workflowSubmitPath(input.workflow_id, this.options.routes.submit), { workflow: input.workflow_json, ...(input.workflow_id ? { workflowId: input.workflow_id } : {}) });
    } catch (error) {
      if (error instanceof AppError && error.code === "PROVIDER_ERROR" && error.context.outcome === "unknown") throw new SubmitUnknownError(error.message);
      throw error;
    }
    const body = await this.body(response);
    const applicationError = errorFromBody(body);
    if (applicationError && !taskIdFromBody(body)) throw new AppError("PROVIDER_ERROR", applicationError, { recoverable: false });
    const taskId = taskIdFromBody(body);
    if (!taskId) throw new SubmitUnknownError("HTTP submit response did not contain a provider task ID.");
    return { task_id: taskId, raw: body };
  }

  async upload(input: ProviderUploadInput): Promise<ProviderAssetReference> {
    if (!this.options.routes.upload) {
      throw new AppError("CAPABILITY_UNSUPPORTED", "Workflow API asset upload route is not configured.", { recoverable: true });
    }
    const form = new FormData();
    form.append("file", new Blob([input.bytes], { type: input.mime }), input.filename);
    const response = await this.requestMultipart(this.options.routes.upload, form);
    const body = await this.body(response);
    const fileName = pathValue(body, ["data", "fileName"]) ?? pathValue(body, ["data", "filename"]) ?? pathValue(body, ["fileName"]) ?? pathValue(body, ["filename"]);
    if (typeof fileName === "string" && fileName.trim()) return { kind: "provider_file", value: fileName };
    const url = pathValue(body, ["data", "download_url"]) ?? pathValue(body, ["data", "downloadUrl"]) ?? pathValue(body, ["download_url"]) ?? pathValue(body, ["downloadUrl"]);
    if (typeof url === "string" && url.trim()) return { kind: "provider_url", value: url };
    throw new AppError("PROVIDER_ERROR", "Workflow API upload response did not contain a tagged provider file or URL.", { recoverable: true });
  }

  async uploadLora(input: ProviderLoraUploadInput): Promise<ProviderLoraReference> {
    if (!this.options.routes.lora_upload_url) {
      throw new AppError("CAPABILITY_UNSUPPORTED", "Workflow API LoRA upload route is not configured.", { recoverable: true });
    }
    const md5Hex = createHash("md5").update(input.bytes).digest("hex");
    const loraName = input.filename.replace(/\.[^/.]+$/, "");
    const response = await this.request(this.options.routes.lora_upload_url, { loraName, md5Hex });
    const body = await this.body(response);
    const applicationError = errorFromBody(body);
    if (applicationError) throw new AppError("PROVIDER_ERROR", applicationError, { recoverable: false });
    const fileName = pathValue(body, ["data", "fileName"]) ?? pathValue(body, ["data", "filename"]);
    const uploadUrl = pathValue(body, ["data", "url"]);
    if (typeof fileName !== "string" || !fileName.trim() || typeof uploadUrl !== "string" || !uploadUrl.trim()) {
      throw new AppError("PROVIDER_ERROR", "Workflow API LoRA response did not contain fileName and upload URL.", { recoverable: true });
    }
    await this.putSignedLora(uploadUrl, input.bytes);
    return { kind: "provider_lora", value: fileName };
  }

  async status(taskId: string): Promise<ProviderStatus> {
    const response = await this.request(this.options.routes.status, { taskId });
    const body = await this.body(response);
    const applicationError = errorFromBody(body);
    const statusValue = pathValue(body, ["status"])
      ?? pathValue(body, ["taskStatus"])
      ?? pathValue(body, ["data", "status"])
      ?? pathValue(body, ["data", "taskStatus"]);
    const state = normalizeStatus(statusValue);
    const terminalFailure = terminalTaskFailure(body);
    if (terminalFailure) return { state: "FAILED", task_id: taskId, error_code: terminalFailure.code, error_message: terminalFailure.message, raw: body };
    if (applicationError && !state) throw new AppError("PROVIDER_ERROR", applicationError, { recoverable: false });
    if (!state) throw new AppError("PROVIDER_ERROR", "Workflow API response did not contain a recognized status.", { recoverable: true });
    return { state, task_id: taskId, error_message: errorFromBody(body), raw: body };
  }

  async outputs(taskId: string): Promise<ProviderOutput> {
    const response = await this.request(this.options.routes.outputs, { taskId });
    const body = await this.body(response);
    const applicationError = errorFromBody(body);
    if (applicationError) throw new AppError("PROVIDER_ERROR", applicationError, { recoverable: false });
    const data = pathValue(body, ["data"]);
    const values = pathValue(body, ["results"]) ?? pathValue(body, ["data", "results"]) ?? (Array.isArray(data) ? data : data && typeof data === "object" && ("fileUrl" in data || "url" in data) ? [data] : undefined);
    if (!Array.isArray(values)) return { outputs: [], raw: body };
    return {
      outputs: values.map((value, index) => {
        const item = value && typeof value === "object" ? value as Record<string, unknown> : {};
        const url = item.url ?? item.outputUrl ?? item.output_url ?? item.fileUrl;
        const mime = item.mime ?? item.fileType;
        return { id: String(item.id ?? item.nodeId ?? index), ...(typeof url === "string" ? { url } : {}), ...(typeof mime === "string" ? { mime } : {}) };
      }),
      raw: body,
    };
  }

  async cancel(taskId: string): Promise<ProviderStatus> {
    if (!this.options.routes.cancel) throw new AppError("CAPABILITY_UNSUPPORTED", "Workflow API cancel route is not configured.", { recoverable: true });
    const response = await this.request(this.options.routes.cancel, { taskId });
    const body = await this.body(response);
    const statusValue = pathValue(body, ["status"])
      ?? pathValue(body, ["taskStatus"])
      ?? pathValue(body, ["data", "status"])
      ?? pathValue(body, ["data", "taskStatus"]);
    const applicationError = errorFromBody(body);
    if (applicationError && !normalizeStatus(statusValue)) throw new AppError("PROVIDER_ERROR", applicationError, { recoverable: true });
    const state = normalizeStatus(statusValue) ?? "CANCEL";
    return { state, task_id: taskId, raw: body };
  }

  private async request(path: string, payload: Record<string, unknown>): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1, this.options.timeout_ms ?? 30_000));
    try {
      const url = new URL(path, this.options.base_url).toString();
      const response = await this.fetchImpl(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.options.api_key}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ apiKey: this.options.api_key, ...payload }),
        signal: controller.signal,
      });
      if (!response.ok) throw new AppError("PROVIDER_ERROR", `Workflow API HTTP ${response.status}.`, { recoverable: response.status === 429 || response.status >= 500 });
      return response;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("PROVIDER_ERROR", error instanceof Error ? error.message : "Workflow API request failed.", { recoverable: true, context: { outcome: "unknown" } });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async requestMultipart(path: string, body: FormData): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1, this.options.timeout_ms ?? 30_000));
    try {
      const url = new URL(path, this.options.base_url).toString();
      const response = await this.fetchImpl(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.options.api_key}`, Accept: "application/json" },
        body,
        signal: controller.signal,
      });
      if (!response.ok) throw new AppError("PROVIDER_ERROR", `Workflow API upload HTTP ${response.status}.`, { recoverable: response.status === 429 || response.status >= 500 });
      return response;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("PROVIDER_ERROR", error instanceof Error ? error.message : "Workflow API upload failed.", { recoverable: true, context: { outcome: "unknown" } });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async putSignedLora(uploadUrl: string, bytes: Uint8Array): Promise<void> {
    let url: URL;
    try {
      url = new URL(uploadUrl);
    } catch {
      throw new AppError("PROVIDER_ERROR", "Workflow API returned an invalid LoRA upload URL.", { recoverable: false });
    }
    if (url.protocol !== "https:") {
      throw new AppError("PROVIDER_ERROR", "Workflow API LoRA upload URL must use HTTPS.", { recoverable: false });
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1, this.options.timeout_ms ?? 30_000));
    try {
      const response = await this.fetchImpl(url.toString(), {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: new Blob([bytes], { type: "application/octet-stream" }),
        signal: controller.signal,
      });
      if (!response.ok) throw new AppError("PROVIDER_ERROR", `Workflow API LoRA upload HTTP ${response.status}.`, { recoverable: response.status === 429 || response.status >= 500 });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("PROVIDER_ERROR", error instanceof Error ? error.message : "Workflow API LoRA upload failed.", { recoverable: true, context: { outcome: "unknown" } });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async body(response: Response): Promise<unknown> {
    const text = await response.text();
    try {
      return parseLossless(text);
    } catch {
      throw new AppError("PROVIDER_ERROR", "Workflow API returned non-JSON content.", { recoverable: false });
    }
  }
}
