#!/usr/bin/env tsx
/**
 * End-to-end smoke for the MCP shim (packages/mcp-shim).
 *
 * Spawns `dist/bin.js` as a subprocess, speaks the MCP JSON-RPC protocol
 * over its stdio, and verifies:
 *   - initialize handshake completes
 *   - tools/list returns all 5 Baton tools
 *   - tools/call create_room end-to-end round-trips through the backend
 *
 * Prereqs:
 *   - Backend running at BATON_API_URL (default http://localhost:3000)
 *   - `npm run build` has compiled the shim
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";

const BIN = "packages/mcp-shim/dist/bin.js";
const API_URL = process.env["BATON_API_URL"] ?? "http://localhost:3000";

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

class McpClient {
  private child: ChildProcessWithoutNullStreams;
  private pending = new Map<number, (res: JsonRpcResponse) => void>();
  private nextId = 1;

  constructor() {
    this.child = spawn("node", [BIN], {
      env: { ...process.env, BATON_API_URL: API_URL },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child.stderr.on("data", (buf) => {
      process.stderr.write(`[shim stderr] ${buf}`);
    });
    const rl = createInterface({ input: this.child.stdout });
    rl.on("line", (line) => {
      try {
        const msg = JSON.parse(line) as JsonRpcResponse;
        const handler = this.pending.get(msg.id);
        if (handler !== undefined) {
          this.pending.delete(msg.id);
          handler(msg);
        }
      } catch {
        /* non-JSON log line — ignore */
      }
    });
  }

  async request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    const payload = { jsonrpc: "2.0", id, method, params };
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`timeout on ${method}`));
      }, 10_000);
      this.pending.set(id, (res) => {
        clearTimeout(timeout);
        if (res.error !== undefined) {
          reject(new Error(`${method}: ${res.error.message}`));
          return;
        }
        resolve(res.result);
      });
      this.child.stdin.write(`${JSON.stringify(payload)}\n`);
    });
  }

  close(): void {
    this.child.kill("SIGTERM");
  }
}

let failures = 0;
function check(cond: boolean, label: string): void {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ ${label}`);
    failures += 1;
  }
}

async function main(): Promise<void> {
  console.log(`[verify-shim] bin=${BIN}, backend=${API_URL}\n`);
  const client = new McpClient();

  try {
    // 1. initialize
    console.log("initialize");
    const init = (await client.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "verify-shim", version: "0.1.0" },
    })) as { serverInfo: { name: string; version: string } };
    check(
      init.serverInfo.name === "baton-mcp",
      `server advertises name: ${init.serverInfo.name}`,
    );

    // MCP requires a notifications/initialized after initialize
    await new Promise((r) => setTimeout(r, 50));

    // 2. tools/list
    console.log("\ntools/list");
    const list = (await client.request("tools/list", {})) as {
      tools: Array<{ name: string }>;
    };
    const names = list.tools.map((t) => t.name).sort();
    check(
      names.length === 5,
      `5 tools registered (got ${names.length}: ${names.join(", ")})`,
    );
    for (const expected of [
      "append_event",
      "create_room",
      "get_feature_card",
      "get_resume_packet",
      "write_checkpoint",
    ]) {
      check(names.includes(expected), `  includes ${expected}`);
    }

    // 3. tools/call create_room — full round trip to backend
    console.log("\ntools/call create_room");
    const call = (await client.request("tools/call", {
      name: "create_room",
      arguments: { title: "verify-shim smoke" },
    })) as {
      content: Array<{ type: string; text: string }>;
    };
    check(
      call.content.length === 1,
      "response has one content block",
    );
    const payload = JSON.parse(call.content[0]!.text) as {
      room_id: string;
      project_id: string;
    };
    check(
      /^room_/.test(payload.room_id),
      `room_id via shim: ${payload.room_id}`,
    );
    check(
      /^proj_/.test(payload.project_id),
      `project_id via shim: ${payload.project_id}`,
    );
  } finally {
    client.close();
    await new Promise((r) => setTimeout(r, 50));
  }

  if (failures > 0) {
    console.error(`\n✗ verify-shim failed: ${failures} check(s) did not pass`);
    process.exit(1);
  }
  console.log("\n✓ all verify-shim checks passed");
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[verify-shim] fatal: ${msg}`);
  process.exit(1);
});
