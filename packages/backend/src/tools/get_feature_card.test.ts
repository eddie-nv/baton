import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FeatureCard } from "@baton/shared";
import type { RedisJSON } from "@redis/json/dist/commands";
import { createRedisClient, type BatonRedis } from "../redis/client.js";
import { k } from "../redis/keys.js";
import { getFeatureCard } from "./get_feature_card.js";
import { ToolError } from "./types.js";

const TEST_URL = "redis://localhost:6379/15";

function sampleCard(roomId: string, featureId: string): FeatureCard {
  return {
    feature_id: featureId,
    room_id: roomId,
    purpose: "test card",
    state: "in_progress",
    confidence: 0.3,
    git: {
      branch: "feat/x",
      parent_branch: "main",
      base_sha: "aaa",
      head_sha: "aaa",
      commits_ahead: 0,
      dirty_files: [],
      remote: "origin",
    },
    surface: { files: [], services: [] },
    invariants: [],
    hypotheses: [],
    failed_attempts: [],
    open_blockers: [],
    next_action: "",
  };
}

describe("get_feature_card handler (integration)", () => {
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

  it("returns the stored card", async () => {
    const card = sampleCard("room_get_ok", "feat_get_ok");
    await redis.json.set(
      k.feature(card.room_id, card.feature_id),
      "$",
      card as unknown as RedisJSON,
    );

    const out = await getFeatureCard(
      { room_id: card.room_id, feature_id: card.feature_id },
      { redis, authedRoomId: card.room_id },
    );
    expect(out).toEqual(card);
  });

  it("throws 404 when no card exists for (room, feature)", async () => {
    await expect(
      getFeatureCard(
        { room_id: "room_get_ok", feature_id: "feat_does_not_exist" },
        { redis, authedRoomId: "room_get_ok" },
      ),
    ).rejects.toBeInstanceOf(ToolError);
  });
});
