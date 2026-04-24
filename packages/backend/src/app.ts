import { Hono } from "hono";
import { requestLogger } from "./middleware/log.js";
import type { BatonRedis } from "./redis/client.js";
import { health } from "./routes/health.js";
import { createMcpRouter } from "./routes/mcp.js";

/**
 * Build the full Hono app: request logger, health, MCP dispatcher.
 * Accepts a Redis client so tests and one-off scripts can wire a
 * non-default connection.
 */
export function createApp(redis: BatonRedis): Hono {
  const app = new Hono();
  app.use("*", requestLogger);
  app.route("/", health);
  app.route("/api/mcp", createMcpRouter(redis));
  return app;
}
