import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Hono } from "hono";
import type { BatonRedis } from "../redis/client.js";
import { createRedisClient } from "../redis/client.js";
import { createAdminRouter } from "./admin.js";
import { appendEvent } from "../tools/append_event.js";
import { createRoom } from "../tools/create_room.js";
import { writeCheckpoint } from "../tools/write_checkpoint.js";

const TEST_URL = "redis://localhost:6379/15";

interface TestSeed {
  roomId: string;
  featureId: string;
  otherRoomId: string;
}

async function seed(redis: BatonRedis): Promise<TestSeed> {
  await redis.flushDb();
  const room = await createRoom({ title: "admin demo" }, { redis });
  const otherRoom = await createRoom({ title: "other room" }, { redis });
  const featureId = "feat_admin_test";
  const ctx = { redis, authedRoomId: room.room_id };

  // Three events on the feature: branch, hypothesis, decision.
  await appendEvent(
    {
      room_id: room.room_id,
      feature_id: featureId,
      type: "action.branch",
      payload: { branch: "feat/admin", parent_branch: "main", base_sha: "abc1" },
      actor_id: "test",
    },
    ctx,
  );
  await appendEvent(
    {
      room_id: room.room_id,
      feature_id: featureId,
      type: "hypothesis.raised",
      payload: { hypothesis: "this is a test hypothesis" },
      actor_id: "test",
    },
    ctx,
  );
  await appendEvent(
    {
      room_id: room.room_id,
      feature_id: featureId,
      type: "decision.made",
      payload: { text: "go with A", next_action: "ship A" },
      actor_id: "test",
    },
    ctx,
  );

  await writeCheckpoint(
    {
      room_id: room.room_id,
      feature_id: featureId,
      session_id: "sess_admin_test",
      next_action: "wrap it up",
      blockers: [],
    },
    ctx,
  );

  return { roomId: room.room_id, featureId, otherRoomId: otherRoom.room_id };
}

describe("admin routes (integration)", () => {
  let redis: BatonRedis;
  let app: Hono;
  let s: TestSeed;

  beforeAll(async () => {
    redis = await createRedisClient(TEST_URL);
    s = await seed(redis);
    app = createAdminRouter(redis);
  });

  afterAll(async () => {
    if (redis.isReady) {
      await redis.flushDb();
      await redis.quit();
    }
  });

  it("GET /rooms returns all rooms", async () => {
    const res = await app.request("/rooms");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { rooms: Array<{ room_id: string }> } };
    const ids = body.data.rooms.map((r) => r.room_id).sort();
    expect(ids).toContain(s.roomId);
    expect(ids).toContain(s.otherRoomId);
  });

  it("GET /rooms/:id returns the room", async () => {
    const res = await app.request(`/rooms/${s.roomId}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { room: { room_id: string; title: string } };
    };
    expect(body.data.room.room_id).toBe(s.roomId);
    expect(body.data.room.title).toBe("admin demo");
  });

  it("GET /rooms/:id returns 404 when missing", async () => {
    const res = await app.request("/rooms/room_nonexistent");
    expect(res.status).toBe(404);
  });

  it("GET /rooms/:id/features returns features for the room", async () => {
    const res = await app.request(`/rooms/${s.roomId}/features`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { features: Array<{ feature_id: string }> };
    };
    expect(body.data.features.map((f) => f.feature_id)).toEqual([s.featureId]);
  });

  it("GET /rooms/:id/features/:fid returns the feature card", async () => {
    const res = await app.request(`/rooms/${s.roomId}/features/${s.featureId}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { feature: { feature_id: string; git: { branch: string } } };
    };
    expect(body.data.feature.feature_id).toBe(s.featureId);
    expect(body.data.feature.git.branch).toBe("feat/admin");
  });

  it("GET /rooms/:id/features/:fid returns 404 when missing", async () => {
    const res = await app.request(`/rooms/${s.roomId}/features/feat_missing`);
    expect(res.status).toBe(404);
  });

  it("GET /rooms/:id/features/:fid/events returns oldest-first events", async () => {
    const res = await app.request(
      `/rooms/${s.roomId}/features/${s.featureId}/events`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        events: Array<{ type: string }>;
        next_cursor: string | null;
      };
    };
    expect(body.data.events.map((e) => e.type)).toEqual([
      "action.branch",
      "hypothesis.raised",
      "decision.made",
    ]);
    expect(body.data.next_cursor).toBeNull();
  });

  it("GET /rooms/:id/features/:fid/events respects ?limit", async () => {
    const res = await app.request(
      `/rooms/${s.roomId}/features/${s.featureId}/events?limit=2`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { events: Array<unknown>; next_cursor: string | null };
    };
    expect(body.data.events).toHaveLength(2);
    expect(body.data.next_cursor).not.toBeNull();
  });

  it("GET /rooms/:id/features/:fid/resume returns the resume packet", async () => {
    const res = await app.request(
      `/rooms/${s.roomId}/features/${s.featureId}/resume`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { packet: { feature_card: { feature_id: string }; last_decisions: unknown[] } };
    };
    expect(body.data.packet.feature_card.feature_id).toBe(s.featureId);
    expect(body.data.packet.last_decisions).toHaveLength(1);
  });

  it("GET /rooms/:id/checkpoints returns all checkpoints", async () => {
    const res = await app.request(`/rooms/${s.roomId}/checkpoints`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { checkpoints: Array<{ session_id: string }> };
    };
    expect(body.data.checkpoints.map((c) => c.session_id)).toEqual([
      "sess_admin_test",
    ]);
  });
});
