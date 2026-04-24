import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRedisClient, type BatonRedis } from "../redis/client.js";
import { k } from "../redis/keys.js";
import { appendEvent } from "./append_event.js";

const TEST_URL = "redis://localhost:6379/15";
const ROOM = "room_append_test";
const FEATURE = "feat_append_test";

async function call(
  redis: BatonRedis,
  type: string,
  payload: Record<string, unknown>,
  featureId: string = FEATURE,
): ReturnType<typeof appendEvent> {
  return appendEvent(
    {
      room_id: ROOM,
      feature_id: featureId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: type as any,
      payload,
      actor_id: "alice@claude-code",
    },
    { redis, authedRoomId: ROOM },
  );
}

describe("append_event handler (integration)", () => {
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

  it("appends to the stream and initializes the card on first event", async () => {
    const out = await call(redis, "action.branch", {
      branch: "feat/append-test",
      parent_branch: "main",
      base_sha: "aaa1111",
    });
    expect(out.event_id).toMatch(/^evt_/);
    expect(out.card_updated).toBe(true);

    const entries = await redis.xRange(k.events(ROOM, FEATURE), "-", "+");
    expect(entries).toHaveLength(1);

    const card = await redis.json.get(k.feature(ROOM, FEATURE)) as {
      git: { branch: string; base_sha: string };
    } | null;
    expect(card).not.toBeNull();
    expect(card!.git.branch).toBe("feat/append-test");
    expect(card!.git.base_sha).toBe("aaa1111");
  });

  it("runs the compactor: hypothesis.raised appends to card.hypotheses", async () => {
    await call(redis, "hypothesis.raised", { hypothesis: "cache ttl wrong" });
    const card = await redis.json.get(k.feature(ROOM, FEATURE)) as {
      hypotheses: string[];
    };
    expect(card.hypotheses).toContain("cache ttl wrong");
  });

  it("returns card_updated=false for session.pause (no card change)", async () => {
    const out = await call(redis, "session.pause", {});
    expect(out.card_updated).toBe(false);
  });

  it("publishes on session.pause to the room's session channel", async () => {
    const feature2 = "feat_pubsub_test";
    // Seed a card for feature2 so the initial publish path is stable.
    await call(redis, "action.branch", {
      branch: "feat/pub",
      parent_branch: "main",
      base_sha: "bbb",
    }, feature2);

    const subscriber = redis.duplicate();
    await subscriber.connect();
    try {
      const received: string[] = [];
      await subscriber.subscribe(k.sessionChannel(ROOM), (msg) => {
        received.push(msg);
      });
      await new Promise((r) => setTimeout(r, 20));
      await call(redis, "session.pause", {}, feature2);
      await new Promise((r) => setTimeout(r, 30));
      expect(received).toHaveLength(1);
      const parsed = JSON.parse(received[0]!) as { feature_id: string; type: string };
      expect(parsed.feature_id).toBe(feature2);
      expect(parsed.type).toBe("session.pause");
    } finally {
      await subscriber.quit();
    }
  });

  it("rejects bogus payloads via zod validation in the compactor", async () => {
    await expect(
      call(redis, "action.branch", { branch: "only_this_field" }),
    ).rejects.toThrow();
  });
});
