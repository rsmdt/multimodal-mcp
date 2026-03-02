#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createServer } from "./server.js";

async function main() {
  console.error("[multimodal-mcp] Starting server...");

  const config = loadConfig();
  const server = createServer(config);
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error("[multimodal-mcp] Server connected and ready");
}

main().catch((error) => {
  console.error("[multimodal-mcp] Fatal error:", error);
  process.exit(1);
});
