import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { disconnectRedis, getRedis } from "./redis/client.js";
import { ensureFeaturesIndex } from "./redis/schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// dist/main.js → ../public (sits next to dist/ inside the backend package)
const STATIC_ROOT = path.resolve(__dirname, "..", "public");

async function main(): Promise<void> {
  const port = Number(process.env["BATON_PORT"] ?? 3000);

  const redis = await getRedis();
  await ensureFeaturesIndex(redis);
  const app = createApp(redis, { staticRoot: STATIC_ROOT });

  const server = serve({ fetch: app.fetch, port }, (info) => {
    console.log(`baton backend listening on :${info.port}`);
    if (process.env["NODE_ENV"] === "production") {
      console.log(`serving SPA from ${STATIC_ROOT}`);
    }
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`received ${signal}, shutting down`);
    server.close();
    await disconnectRedis();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[baton] fatal boot error:", err);
  process.exit(1);
});
