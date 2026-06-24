import type { BatonRedis } from "../redis/client.js";

/**
 * Every tool handler receives a ToolContext carrying the shared Redis
 * client. Authenticated tools also get the authenticated room id — the
 * dispatcher verifies that `input.room_id` (when present) matches
 * `ctx.authedRoomId` before invoking the handler, so handlers can trust
 * both and do not need to re-check.
 */
export interface ToolContext {
  redis: BatonRedis;
  authedRoomId?: string;
}

export type ToolHandler<In, Out> = (input: In, ctx: ToolContext) => Promise<Out>;

// ─────────────────────────────────────────────────────────────
// Error envelope — thrown by handlers, caught by the dispatcher.
// ─────────────────────────────────────────────────────────────

export class ToolError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ToolError";
  }
}

export const notFound = (resource: string): ToolError =>
  new ToolError(404, "not_found", `${resource} not found`);

export const conflict = (message: string): ToolError =>
  new ToolError(409, "conflict", message);

export const badRequest = (message: string): ToolError =>
  new ToolError(400, "bad_request", message);
