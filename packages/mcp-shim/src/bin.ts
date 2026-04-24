#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { Forwarder } from "./forwarder.js";
import { createMcpServer } from "./server.js";

/**
 * npx baton-mcp — stdio MCP server that forwards tool calls to the
 * Baton backend. Lives on the user's laptop; ships zero secrets; every
 * auth material comes from the environment.
 *
 * stdout is reserved for JSON-RPC. All logs go to stderr.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const forwarder = new Forwarder(config);
  const server = createMcpServer(forwarder);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `[baton-mcp] connected — backend=${config.apiUrl}, room=${
      config.roomId ?? "(none)"
    }`,
  );
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[baton-mcp] fatal: ${msg}`);
  process.exit(1);
});
