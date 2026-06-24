import { Hono } from "hono";
import { z } from "zod";
import { toolSchemas, type ToolName } from "@baton/shared";
import { authenticateRoom } from "../middleware/auth.js";
import type { BatonRedis } from "../redis/client.js";
import { toolHandlers, ToolError, type ToolHandlerName } from "../tools/index.js";

interface InputWithRoomId {
  room_id?: string;
}

/**
 * Build the MCP dispatcher router. Mounts `POST /:tool` under whatever
 * base path the caller routes it at (canonically `/api/mcp`).
 *
 * Per tool:
 *   1. Look up the tool in `toolSchemas` — 404 if unknown.
 *   2. If tool.requiresAuth, verify `Authorization: Bearer <room_id>`.
 *   3. Parse + validate body with the tool's zod input schema.
 *   4. For authed tools, enforce that input.room_id matches the authed
 *      room_id (403 otherwise) — bearer capabilities are room-scoped.
 *   5. Invoke the handler, wrap the result in `{ data }`.
 *   6. Catch ToolError → HTTP status + error envelope. ZodError → 400.
 *      Anything else → 500 with a redacted message.
 */
export function createMcpRouter(redis: BatonRedis): Hono {
  const app = new Hono();

  app.post("/:tool", async (c) => {
    const toolName = c.req.param("tool");
    const spec = toolSchemas[toolName as ToolName];
    if (spec === undefined) {
      return c.json(
        {
          error: {
            code: "unknown_tool",
            message: `Unknown tool: ${toolName}`,
          },
        },
        404,
      );
    }

    let authedRoomId: string | undefined;
    if (spec.requiresAuth) {
      const authResult = await authenticateRoom(
        redis,
        c.req.header("Authorization"),
      );
      if (!authResult.ok) {
        return c.json(
          { error: { code: "unauthorized", message: authResult.message } },
          401,
        );
      }
      authedRoomId = authResult.roomId;
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        { error: { code: "bad_request", message: "Request body must be JSON" } },
        400,
      );
    }

    const parsed = spec.input.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          error: {
            code: "validation_error",
            message: "Request validation failed",
            details: parsed.error.issues.map((i) => ({
              field: i.path.join("."),
              message: i.message,
              code: i.code,
            })),
          },
        },
        400,
      );
    }

    if (spec.requiresAuth) {
      const input = parsed.data as InputWithRoomId;
      if (
        input.room_id !== undefined &&
        input.room_id !== authedRoomId
      ) {
        return c.json(
          {
            error: {
              code: "forbidden",
              message: "room_id does not match authenticated room",
            },
          },
          403,
        );
      }
    }

    // `toolHandlers[name]` resolves to the intersection of every handler's
    // input type, which has no valid argument. We've already validated
    // `parsed.data` against `spec.input` so a broadening cast is safe.
    const handler = toolHandlers[toolName as ToolHandlerName] as unknown as (
      input: unknown,
      ctx: { redis: BatonRedis; authedRoomId?: string },
    ) => Promise<unknown>;
    const ctx =
      authedRoomId !== undefined
        ? { redis, authedRoomId }
        : { redis };
    try {
      const result = await handler(parsed.data, ctx);
      return c.json({ data: result });
    } catch (err) {
      if (err instanceof ToolError) {
        return c.json(
          { error: { code: err.code, message: err.message } },
          // Hono's c.json status is narrowly typed; cast is fine here
          // since ToolError.status is always a valid HTTP status.
          err.status as 400 | 401 | 403 | 404 | 409 | 500,
        );
      }
      if (err instanceof z.ZodError) {
        return c.json(
          {
            error: {
              code: "validation_error",
              message: "Payload validation failed",
              details: err.issues.map((i) => ({
                field: i.path.join("."),
                message: i.message,
                code: i.code,
              })),
            },
          },
          400,
        );
      }
      console.error("[mcp] unhandled error:", err);
      return c.json(
        { error: { code: "internal_error", message: "Internal server error" } },
        500,
      );
    }
  });

  return app;
}
