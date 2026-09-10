import { spawn } from "node:child_process";
import { accessSync, constants, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { loadRunningHubData } from "./dist/mcp/upstream/data.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const catalogDir = join(packageRoot, "data", "upstream");
const requiredFiles = [
  "package.json",
  "package-lock.json",
  "dist/index.js",
  "dist/mcp/server.js",
  "data/upstream/manifest.json",
  "data/upstream/model-registry.public.json",
  "data/upstream/pricing.public.json",
  "data/upstream/rh-api-contract.md",
  "data/upstream/llms.txt",
];

for (const file of requiredFiles) {
  accessSync(join(packageRoot, file), constants.R_OK);
}

const packageJson = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
if (packageJson.bin?.["runninghub-mcp"] !== "./dist/index.js") {
  throw new Error("package.json does not point runninghub-mcp at dist/index.js.");
}

const manifest = JSON.parse(readFileSync(join(catalogDir, "manifest.json"), "utf8"));
if (typeof manifest.revision !== "string" || !manifest.revision.trim()) {
  throw new Error("The catalog manifest has no recorded upstream revision.");
}

const data = loadRunningHubData(catalogDir);
if (data.registry.models.length === 0 || data.pricing.pricing.length === 0) {
  throw new Error("The packaged catalog is empty.");
}

function frame(message) {
  return `${JSON.stringify(message)}\n`;
}

async function stopChild(child) {
  child.stdin.destroy();
  if (child.exitCode !== null) return;
  if (!child.killed) child.kill();
  await new Promise((resolveResult) => {
    const timeout = setTimeout(resolveResult, 2_000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolveResult();
    });
  });
}

function initializeServer() {
  const verifyDataDir = mkdtempSync(join(tmpdir(), "runninghub-mcp-verify-"));
  const childEnv = { ...process.env };
  delete childEnv.RUNNINGHUB_WORKFLOW_API_KEY;
  childEnv.RUNNINGHUB_DATA_DIR = verifyDataDir;
  childEnv.RUNNINGHUB_CATALOG_DIR = catalogDir;
  const child = spawn(process.execPath, ["dist/index.js"], {
    cwd: packageRoot,
    env: childEnv,
    stdio: ["pipe", "pipe", "pipe"],
  });

  return new Promise((resolveResult, rejectResult) => {
    let buffer = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      rejectResult(new Error(`MCP initialize timed out. ${stderr.trim()}`));
      child.kill();
    }, 10_000);

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      while (true) {
        const separator = buffer.indexOf("\n");
        if (separator < 0) return;
        const line = buffer.slice(0, separator).replace(/\r$/, "");
        buffer = buffer.slice(separator + 1);
        if (!line.trim()) continue;
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          clearTimeout(timeout);
          rejectResult(new Error(`MCP emitted invalid JSON: ${line}`));
          child.kill();
          return;
        }
        if (message.id !== 1) continue;
        clearTimeout(timeout);
        if (message.error) {
          rejectResult(new Error(`MCP initialize failed: ${JSON.stringify(message.error)}`));
        } else if (message.result?.serverInfo?.name !== "runninghub-mcp") {
          rejectResult(new Error("MCP initialize returned an unexpected server name."));
        } else if (!String(message.result?.instructions ?? "").includes("rh_prepare_generation")) {
          rejectResult(new Error("MCP initialize did not return the expected server instructions."));
        } else {
          resolveResult();
        }
        child.kill();
        return;
      }
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      rejectResult(error);
    });
    child.once("exit", (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timeout);
        rejectResult(new Error(`MCP process exited with code ${code}. ${stderr.trim()}`));
      }
    });

    child.stdin.write(frame({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "runninghub-mcp-verify", version: "1.0.0" },
      },
    }));
  }).finally(async () => {
    await stopChild(child);
    rmSync(verifyDataDir, { recursive: true, force: true });
  });
}

await initializeServer();
console.log(`runninghub-mcp verify: OK (Node ${process.versions.node}, ${data.registry.models.length} catalog models, upstream ${manifest.revision.slice(0, 12)})`);
