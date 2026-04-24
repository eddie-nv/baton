import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { countTokens, PACKET_BUDGET } from "@baton/shared";
import { createRedisClient, type BatonRedis } from "../redis/client.js";
import { appendEvent } from "./append_event.js";
import { getResumePacket } from "./get_resume_packet.js";
import { writeCheckpoint } from "./write_checkpoint.js";
import { ToolError } from "./types.js";

const TEST_URL = "redis://localhost:6379/15";
const ROOM = "room_packet_test";
const FEATURE = "feat_packet_test";

describe("get_resume_packet handler (integration)", () => {
  let redis: BatonRedis;

  beforeAll(async () => {
    redis = await createRedisClient(TEST_URL);
    await redis.flushDb();

    // Seed a feature via append_event so the compactor fills the card realistically.
    await appendEvent(
      {
        room_id: ROOM,
        feature_id: FEATURE,
        type: "action.branch",
        payload: {
          branch: "feat/packet-test",
          parent_branch: "main",
          base_sha: "aaa1111",
        },
        actor_id: "alice@claude-code",
      },
      { redis, authedRoomId: ROOM },
    );

    // Three decisions, emitted oldest-first so XREVRANGE returns newest-first.
    for (const text of ["decision_1", "decision_2", "decision_3"]) {
      await appendEvent(
        {
          room_id: ROOM,
          feature_id: FEATURE,
          type: "decision.made",
          payload: { text, next_action: `next_after_${text}` },
          actor_id: "alice@claude-code",
        },
        { redis, authedRoomId: ROOM },
      );
    }
  });

  afterAll(async () => {
    if (redis.isReady) {
      await redis.flushDb();
      await redis.quit();
    }
  });

  it("returns a packet whose card matches the stored feature card", async () => {
    const packet = await getResumePacket(
      { room_id: ROOM, feature_id: FEATURE },
      { redis, authedRoomId: ROOM },
    );
    expect(packet.feature_card.feature_id).toBe(FEATURE);
    expect(packet.feature_card.git.branch).toBe("feat/packet-test");
  });

  it("returns up to 3 last_decisions, newest first", async () => {
    const packet = await getResumePacket(
      { room_id: ROOM, feature_id: FEATURE },
      { redis, authedRoomId: ROOM },
    );
    expect(packet.last_decisions).toHaveLength(3);
    const texts = packet.last_decisions.map((d) => d.text);
    expect(texts[0]).toBe("decision_3");
    expect(texts[2]).toBe("decision_1");
  });

  it("packet stays at or under the 1500-token budget", async () => {
    const packet = await getResumePacket(
      { room_id: ROOM, feature_id: FEATURE },
      { redis, authedRoomId: ROOM },
    );
    expect(countTokens(packet)).toBeLessThanOrEqual(PACKET_BUDGET);
  });

  it("merges a matching checkpoint's next_action and blockers when session_id is provided", async () => {
    const sessionId = "sess_resume_merge";
    await writeCheckpoint(
      {
        room_id: ROOM,
        feature_id: FEATURE,
        session_id: sessionId,
        next_action: "pick up where we paused",
        blockers: ["waiting on infra"],
      },
      { redis, authedRoomId: ROOM },
    );

    const packet = await getResumePacket(
      { room_id: ROOM, feature_id: FEATURE, session_id: sessionId },
      { redis, authedRoomId: ROOM },
    );
    expect(packet.next_action).toBe("pick up where we paused");
    expect(packet.open_blockers).toContain("waiting on infra");
  });

  it("throws 404 when the feature has no card", async () => {
    await expect(
      getResumePacket(
        { room_id: ROOM, feature_id: "feat_nonexistent" },
        { redis, authedRoomId: ROOM },
      ),
    ).rejects.toBeInstanceOf(ToolError);
  });
});
