import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BatonRedis } from "./client.js";
import { createRedisClient } from "./client.js";
import { ensureFeaturesIndex, FEATURES_INDEX_NAME } from "./schema.js";

// RediSearch only operates on DB 0, so schema tests cannot use DB 15 like
// the other integration suites. We scope all writes under a test-specific
// key pattern and clean them up at afterAll to keep DB 0 pristine.
const TEST_URL = "redis://localhost:6379/0";
const TEST_FEATURE_KEY = "feature:test_idx_room:feat_search_demo";

describe("ensureFeaturesIndex (integration)", () => {
  let client: BatonRedis;

  async function cleanup(c: BatonRedis): Promise<void> {
    await c.del(TEST_FEATURE_KEY);
    try {
      await c.ft.dropIndex(FEATURES_INDEX_NAME);
    } catch {
      /* no-op */
    }
  }

  beforeAll(async () => {
    client = await createRedisClient(TEST_URL);
    await cleanup(client);
  });

  afterAll(async () => {
    if (client.isReady) {
      await cleanup(client);
      await client.quit();
    }
  });

  it("creates the index on first run", async () => {
    await ensureFeaturesIndex(client);
    const info = await client.ft.info(FEATURES_INDEX_NAME);
    expect(info.indexName).toBe(FEATURES_INDEX_NAME);
  });

  it("is idempotent — second call does not throw", async () => {
    await ensureFeaturesIndex(client);
    await expect(ensureFeaturesIndex(client)).resolves.toBeUndefined();
  });

  it("indexes JSON docs under the feature: prefix and they are searchable", async () => {
    await ensureFeaturesIndex(client);
    await client.json.set(TEST_FEATURE_KEY, "$", {
      feature_id: "feat_search_demo",
      room_id: "test_idx_room",
      purpose: "demonstrate that the features index picks up new cards",
      state: "in_progress",
    });
    // Allow RediSearch to index asynchronously.
    await new Promise((r) => setTimeout(r, 50));
    const result = await client.ft.search(FEATURES_INDEX_NAME, "demonstrate");
    expect(result.total).toBeGreaterThan(0);
  });
});
