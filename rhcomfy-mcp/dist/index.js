#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createServer } from "./mcp/server.js";
import { Storage } from "./storage/database.js";
let storage;
try {
    const config = loadConfig();
    storage = new Storage(config.dbPath);
    const server = createServer(config, storage);
    const transport = new StdioServerTransport();
    const close = () => {
        storage?.close();
        storage = undefined;
    };
    process.once("SIGINT", close);
    process.once("SIGTERM", close);
    await server.connect(transport);
}
catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`runninghub-mcp startup failed: ${message}\n`);
    storage?.close();
    process.exitCode = 1;
}
//# sourceMappingURL=index.js.map