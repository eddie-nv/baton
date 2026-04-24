import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRedisClient, type BatonRedis } from "../redis/client.js";
import { k } from "../redis/keys.js";
import { createRoom } from "./create_room.js";

const TEST_URL = "redis://localhost:6379/15";

describe("create_room handler (integration)", () => {
  let redis: BatonRedis;

  beforeAll(async () => {
    redis = await createRedisClient(TEST_URL);
    await redis.flushDb();
  });

  afterAll(async () => {
    if (redis.isReady) {
      await redis.flushDb();
      await redis.quit();
    }
  });

  it("creates a room doc with a generated room_id and returns it", async () => {
    const out = await createRoom({ title: "Payments v2" }, { redis });
    expect(out.room_id).toMatch(/^room_[A-Za-z0-9_-]+$/);
    expect(out.project_id).toMatch(/^proj_[A-Za-z0-9_-]+$/);

    const stored = (await redis.json.get(k.room(out.room_id))) as {
      room_id: string;
      project_id: string;
      title: string;
      created_at: number;
    } | null;
    expect(stored).not.toBeNull();
    expect(stored!.room_id).toBe(out.room_id);
    expect(stored!.project_id).toBe(out.project_id);
    expect(stored!.title).toBe("Payments v2");
    expect(typeof stored!.created_at).toBe("number");
  });

  it("accepts an optional project_id and reuses it", async () => {
    const out = await createRoom(
      { title: "Ledger", project_id: "proj_ledger_static" },
      { redis },
    );
    expect(out.project_id).toBe("proj_ledger_static");
  });

  it("generates a unique room_id per call", async () => {
    const a = await createRoom({ title: "A" }, { redis });
    const b = await createRoom({ title: "B" }, { redis });
    expect(a.room_id).not.toBe(b.room_id);
  });
});
