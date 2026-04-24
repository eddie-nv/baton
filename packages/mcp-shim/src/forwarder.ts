import type { ShimConfig } from "./config.js";

interface ApiEnvelope<T> {
  data?: T;
  error?: { code: string; message: string };
}

/** Tools that do NOT receive default-ID merging (no scope established yet). */
const NO_MERGE_TOOLS = new Set<string>(["create_room"]);

/** Tools whose input includes `actor_id` and should default to BATON_ACTOR_ID. */
const ACTOR_MERGE_TOOLS = new Set<string>(["append_event"]);

/** Tools whose input includes `feature_id` and should default to BATON_FEATURE_ID. */
const FEATURE_MERGE_TOOLS = new Set<string>([
  "append_event",
  "get_feature_card",
  "write_checkpoint",
  "get_resume_packet",
]);

/**
 * Thin HTTP client between the MCP shim and the Baton backend.
 *
 * Responsibilities:
 *   1. Merge default IDs (room, actor, feature) from env when the MCP
 *      caller omits them — makes the MCP surface pleasant to use from
 *      inside an IDE agent that already knows its branch.
 *   2. Attach the bearer room_id (if configured).
 *   3. POST to /api/mcp/<tool> and unwrap the backend's envelope.
 *
 * Zero secrets are owned here — every credential value comes from
 * ShimConfig, which is populated from the environment by loadConfig().
 */
export class Forwarder {
  constructor(private readonly config: ShimConfig) {}

  async call(tool: string, args: Record<string, unknown>): Promise<unknown> {
    const body = this.mergeDefaults(tool, args);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.config.roomId !== undefined) {
      headers["Authorization"] = `Bearer ${this.config.roomId}`;
    }

    const url = `${this.config.apiUrl}/api/mcp/${tool}`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const parsed = (await res.json().catch(() => ({}))) as ApiEnvelope<unknown>;
    if (!res.ok) {
      const detail = parsed.error
        ? `${parsed.error.code}: ${parsed.error.message}`
        : JSON.stringify(parsed);
      throw new Error(`${tool} failed: HTTP ${res.status} — ${detail}`);
    }
    return parsed.data;
  }

  private mergeDefaults(
    tool: string,
    args: Record<string, unknown>,
  ): Record<string, unknown> {
    if (NO_MERGE_TOOLS.has(tool)) return { ...args };

    const out: Record<string, unknown> = { ...args };
    if (out["room_id"] === undefined && this.config.roomId !== undefined) {
      out["room_id"] = this.config.roomId;
    }
    if (
      FEATURE_MERGE_TOOLS.has(tool) &&
      out["feature_id"] === undefined &&
      this.config.featureId !== undefined
    ) {
      out["feature_id"] = this.config.featureId;
    }
    if (
      ACTOR_MERGE_TOOLS.has(tool) &&
      out["actor_id"] === undefined &&
      this.config.actorId !== undefined
    ) {
      out["actor_id"] = this.config.actorId;
    }
    return out;
  }
}
