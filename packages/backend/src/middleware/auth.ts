import type { Context, MiddlewareHandler, Next } from "hono";
import type { BatonRedis } from "../redis/client.js";
import { k } from "../redis/keys.js";

export type AuthResult =
  | { ok: true; roomId: string }
  | { ok: false; message: string };

/**
 * Pure bearer-room check. Returns either the authenticated roomId or
 * a reason string. Used both by the Hono middleware below and by the
 * dispatcher in routes/mcp.ts (which applies auth conditionally per
 * tool).
 */
export async function authenticateRoom(
  redis: BatonRedis,
  authHeader: string | undefined,
): Promise<AuthResult> {
  if (authHeader === undefined || !authHeader.startsWith("Bearer ")) {
    return { ok: false, message: "Missing bearer token" };
  }
  const roomId = authHeader.slice("Bearer ".length).trim();
  if (roomId.length === 0) {
    return { ok: false, message: "Empty room_id" };
  }
  const exists = await redis.exists(k.room(roomId));
  if (exists === 0) {
    return { ok: false, message: "Unknown room_id" };
  }
  return { ok: true, roomId };
}

/**
 * Bearer-room authentication middleware. Thin wrapper around
 * authenticateRoom — verifies and sets `roomId` on context, otherwise
 * returns 401 with the standard error envelope.
 *
 * Post-hackathon this is swapped for per-user tokens (see CLAUDE.md §1).
 */
export function createRoomAuth(redis: BatonRedis): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const result = await authenticateRoom(redis, c.req.header("Authorization"));
    if (!result.ok) {
      return c.json(
        { error: { code: "unauthorized", message: result.message } },
        401,
      );
    }
    c.set("roomId", result.roomId);
    await next();
    return undefined;
  };
}
