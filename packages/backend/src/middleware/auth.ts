import type { Context, MiddlewareHandler, Next } from "hono";
import type { BatonRedis } from "../redis/client.js";
import { k } from "../redis/keys.js";

/**
 * Bearer-room authentication middleware.
 *
 * Reads `Authorization: Bearer <room_id>`, verifies that the room JSON
 * doc exists in Redis (`EXISTS room:<id>`), and on success exposes
 * `roomId` on the Hono context via `c.get("roomId")`.
 *
 * On failure returns 401 with the project's standard error envelope.
 *
 * Post-hackathon this is swapped for per-user tokens (see CLAUDE.md §1).
 */
export function createRoomAuth(redis: BatonRedis): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    const header = c.req.header("Authorization");

    if (header === undefined || !header.startsWith("Bearer ")) {
      return c.json(
        { error: { code: "unauthorized", message: "Missing bearer token" } },
        401,
      );
    }

    const roomId = header.slice("Bearer ".length).trim();
    if (roomId.length === 0) {
      return c.json(
        { error: { code: "unauthorized", message: "Empty room_id" } },
        401,
      );
    }

    const exists = await redis.exists(k.room(roomId));
    if (exists === 0) {
      return c.json(
        { error: { code: "unauthorized", message: "Unknown room_id" } },
        401,
      );
    }

    c.set("roomId", roomId);
    await next();
    return undefined;
  };
}
