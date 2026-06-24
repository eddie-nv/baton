import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { toolSchemas } from "@baton/shared";
import type { Forwarder } from "./forwarder.js";

const DESCRIPTIONS: Record<string, string> = {
  create_room:
    "Create a new Baton room — the shared collaboration scope for a team working on an initiative. Returns { room_id, project_id }. The room_id is a bearer capability; guard it like a secret.",
  append_event:
    "Append a typed event to a feature (action.branch, action.edit, action.commit, error.test, hypothesis.raised, decision.made, session.pause, feature.merged). Triggers the compactor and may publish session signals.",
  get_feature_card:
    "Get the current feature card (≤ 500 tokens). The card summarises what this feature is about: git state, files, hypotheses, failed attempts, next action.",
  write_checkpoint:
    "Save a session-pause checkpoint with next_action + blockers. TTL is 7 days — checkpoints are disposable.",
  get_resume_packet:
    "Get the resume packet (≤ 1,500 tokens): the feature card + last 3 decisions + optional checkpoint. This is what you load at session-start to avoid cold-boot.",
};

/**
 * Register all 5 MCP tools on a fresh McpServer. Each handler body
 * simply forwards to the backend via Forwarder.call — zero business
 * logic on the shim side, per CLAUDE.md §3.
 *
 * The MCP SDK v1.29 registerTool API expects inputSchema as a raw
 * `{ [key]: ZodSchema }` object, which is exactly the shape we exported
 * from @baton/shared as `toolSchemas[name].inputShape`.
 */
export function createMcpServer(forwarder: Forwarder): McpServer {
  const server = new McpServer({ name: "baton-mcp", version: "0.1.0" });

  for (const [name, spec] of Object.entries(toolSchemas)) {
    // SDK v1.29 infers handler args from inputSchema. Our handlers are
    // uniform (forward everything as-is), so a single generic handler
    // cast at the boundary avoids duplicating logic for every tool.
    const handler = async (args: unknown): Promise<{
      content: Array<{ type: "text"; text: string }>;
    }> => {
      const result = await forwarder.call(name, args as Record<string, unknown>);
      return {
        content: [
          { type: "text", text: JSON.stringify(result, null, 2) },
        ],
      };
    };

    server.registerTool(
      name,
      {
        description: DESCRIPTIONS[name] ?? name,
        inputSchema: spec.inputShape,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handler as any,
    );
  }

  return server;
}
