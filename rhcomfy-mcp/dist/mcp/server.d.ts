import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type AppConfig } from "../config.js";
import { Storage } from "../storage/database.js";
export declare function createServer(config: AppConfig, storage: Storage): McpServer;
