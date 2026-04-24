import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { requestLogger } from "./middleware/log.js";
import type { BatonRedis } from "./redis/client.js";
import { health } from "./routes/health.js";
import { createAdminRouter } from "./routes/admin.js";
import { createMcpRouter } from "./routes/mcp.js";

/**
 * Build the full Hono app: secure headers, request logger, health, MCP
 * dispatcher, admin routes for the web UI, and (in production) static
 * SPA serving from ./public.
 */
export function createApp(redis: BatonRedis): Hono {
  const app = new Hono();

  app.use("*", secureHeaders());
  app.use("*", requestLogger);

  app.route("/", health);
  app.route("/api/mcp", createMcpRouter(redis));
  app.route("/api/admin", createAdminRouter(redis));

  // SPA static serving — only enabled in production so dev mode doesn't
  // shadow the Vite dev server. Mounted last so /api/* and /health win.
  if (process.env["NODE_ENV"] === "production") {
    app.use("/*", serveStatic({ root: "./public" }));
    // SPA fallback: any unmatched route returns index.html so React Router
    // can take over client-side. Hono's serveStatic does not auto-fallback.
    app.get("/*", serveStatic({ path: "./public/index.html" }));
  }

  return app;
}
