import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { disconnectRedis, getRedis } from "./redis/client.js";
import { ensureFeaturesIndex } from "./redis/schema.js";

async function main(): Promise<void> {
  const port = Number(process.env["BATON_PORT"] ?? 3000);

  const redis = await getRedis();
  await ensureFeaturesIndex(redis);
  const app = createApp(redis);

  const server = serve({ fetch: app.fetch, port }, (info) => {
    console.log(`baton backend listening on :${info.port}`);
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
