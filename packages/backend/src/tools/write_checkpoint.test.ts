import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRedisClient, type BatonRedis } from "../redis/client.js";
import { k } from "../redis/keys.js";
import {
  CHECKPOINT_TTL_SECONDS,
  writeCheckpoint,
} from "./write_checkpoint.js";

const TEST_URL = "redis://localhost:6379/15";
const ROOM = "room_ck_test";
const FEATURE = "feat_ck_test";
const SESSION = "sess_ck_test";

describe("write_checkpoint handler (integration)", () => {
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

  it("stores a checkpoint JSON doc keyed by (room, session)", async () => {
    const before = Date.now();
    const out = await writeCheckpoint(
      {
        room_id: ROOM,
        feature_id: FEATURE,
        session_id: SESSION,
        next_action: "write migration",
        blockers: ["waiting on finance"],
      },
      { redis, authedRoomId: ROOM },
    );
    expect(out.checkpoint_id).toMatch(/^ck_/);
    expect(out.expires_at).toBeGreaterThan(before);

    const stored = (await redis.json.get(k.checkpoint(ROOM, SESSION))) as {
      checkpoint_id: string;
      feature_id: string;
      session_id: string;
      next_action: string;
      blockers: string[];
      ts: number;
    } | null;
    expect(stored).not.toBeNull();
    expect(stored!.checkpoint_id).toBe(out.checkpoint_id);
    expect(stored!.feature_id).toBe(FEATURE);
    expect(stored!.session_id).toBe(SESSION);
    expect(stored!.next_action).toBe("write migration");
    expect(stored!.blockers).toEqual(["waiting on finance"]);
  });

  it("sets a 7-day TTL on the checkpoint key", async () => {
    await writeCheckpoint(
      {
        room_id: ROOM,
        feature_id: FEATURE,
        session_id: "sess_ttl_check",
        next_action: "",
        blockers: [],
      },
      { redis, authedRoomId: ROOM },
    );
    const ttl = await redis.ttl(k.checkpoint(ROOM, "sess_ttl_check"));
    expect(ttl).toBeGreaterThan(CHECKPOINT_TTL_SECONDS - 10);
    expect(ttl).toBeLessThanOrEqual(CHECKPOINT_TTL_SECONDS);
  });

  it("reports expires_at roughly 7 days in the future", async () => {
    const before = Date.now();
    const out = await writeCheckpoint(
      {
        room_id: ROOM,
        feature_id: FEATURE,
        session_id: "sess_exp",
        next_action: "",
        blockers: [],
      },
      { redis, authedRoomId: ROOM },
    );
    const sevenDaysMs = CHECKPOINT_TTL_SECONDS * 1000;
    expect(out.expires_at).toBeGreaterThanOrEqual(before + sevenDaysMs - 5000);
    expect(out.expires_at).toBeLessThanOrEqual(Date.now() + sevenDaysMs + 5000);
  });
});
