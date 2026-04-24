import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Hono } from "hono";
import { createRedisClient, type BatonRedis } from "../redis/client.js";
import { createMcpRouter } from "./mcp.js";

const TEST_URL = "redis://localhost:6379/15";
const VALID_ROOM = "room_dispatch_test_ok";
const OTHER_ROOM = "room_dispatch_test_other";

async function post(
  app: Hono,
  path: string,
  body: unknown,
  roomId?: string,
): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (roomId !== undefined) headers.Authorization = `Bearer ${roomId}`;
  return app.request(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/mcp/:tool dispatcher (integration)", () => {
  let redis: BatonRedis;
  let app: Hono;

  beforeAll(async () => {
    redis = await createRedisClient(TEST_URL);
    await redis.flushDb();
    // Seed two rooms for auth + forbidden-mismatch coverage.
    for (const roomId of [VALID_ROOM, OTHER_ROOM]) {
      await redis.json.set(`room:${roomId}`, "$", {
        room_id: roomId,
        project_id: "proj_dispatch",
        title: "dispatch test",
        created_at: Date.now(),
      });
    }
    app = createMcpRouter(redis);
  });

  afterAll(async () => {
    if (redis.isReady) {
      await redis.flushDb();
      await redis.quit();
    }
  });

  it("returns 404 for an unknown tool", async () => {
    const res = await post(app, "/bogus_tool", {});
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("unknown_tool");
  });

  it("create_room: unauthenticated happy path returns 200 with data envelope", async () => {
    const res = await post(app, "/create_room", { title: "via dispatcher" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { room_id: string } };
    expect(body.data.room_id).toMatch(/^room_/);
  });

  it("create_room: 400 on invalid body (missing title)", async () => {
    const res = await post(app, "/create_room", {});
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("validation_error");
  });

  it("get_feature_card: 401 when Authorization header is missing", async () => {
    const res = await post(app, "/get_feature_card", {
      room_id: VALID_ROOM,
      feature_id: "feat_x",
    });
    expect(res.status).toBe(401);
  });

  it("get_feature_card: 403 when authed room_id does not match input room_id", async () => {
    const res = await post(
      app,
      "/get_feature_card",
      { room_id: OTHER_ROOM, feature_id: "feat_x" },
      VALID_ROOM, // authed as VALID_ROOM but asking about OTHER_ROOM
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("forbidden");
  });

  it("get_feature_card: 404 when card does not exist (correct auth)", async () => {
    const res = await post(
      app,
      "/get_feature_card",
      { room_id: VALID_ROOM, feature_id: "feat_missing" },
      VALID_ROOM,
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("not_found");
  });

  it("append_event → get_feature_card full round-trip", async () => {
    const appendRes = await post(
      app,
      "/append_event",
      {
        room_id: VALID_ROOM,
        feature_id: "feat_dispatch_rt",
        type: "action.branch",
        payload: {
          branch: "feat/dispatch",
          parent_branch: "main",
          base_sha: "aaa1111",
        },
        actor_id: "tester",
      },
      VALID_ROOM,
    );
    expect(appendRes.status).toBe(200);

    const getRes = await post(
      app,
      "/get_feature_card",
      { room_id: VALID_ROOM, feature_id: "feat_dispatch_rt" },
      VALID_ROOM,
    );
    expect(getRes.status).toBe(200);
    const body = (await getRes.json()) as {
      data: { git: { branch: string; base_sha: string } };
    };
    expect(body.data.git.branch).toBe("feat/dispatch");
    expect(body.data.git.base_sha).toBe("aaa1111");
  });

  it("returns 400 on non-JSON body", async () => {
    const res = await app.request("/append_event", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VALID_ROOM}`,
        "Content-Type": "application/json",
      },
      body: "not-json{",
    });
    expect(res.status).toBe(400);
  });
});
