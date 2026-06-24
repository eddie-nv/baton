import { createClient, type RedisClientType } from "redis";

/**
 * Type alias for the Redis client shape Baton uses. Exported so tests and
 * tool handlers can type their client parameters without re-specifying
 * the full redis@4 generics.
 */
export type BatonRedis = RedisClientType;

/**
 * Construct and connect a fresh Redis client. Prefer `getRedis()` for
 * production paths — this factory is for tests and one-off scripts that
 * need a client scoped to a non-default DB.
 */
export async function createRedisClient(url?: string): Promise<BatonRedis> {
  const resolved =
    url ?? process.env["REDIS_URL"] ?? "redis://localhost:6379";

  const client: BatonRedis = createClient({ url: resolved });
  client.on("error", (err) => {
    console.error("[redis] error:", err);
  });
  await client.connect();
  return client;
}

// ─────────────────────────────────────────────────────────────
// Singleton for production use
// ─────────────────────────────────────────────────────────────

let singleton: BatonRedis | null = null;

export async function getRedis(): Promise<BatonRedis> {
  if (singleton !== null && singleton.isReady) return singleton;
  singleton = await createRedisClient();
  return singleton;
}

export async function disconnectRedis(): Promise<void> {
  if (singleton === null) return;
  if (singleton.isReady) {
    await singleton.quit();
  }
  singleton = null;
}
