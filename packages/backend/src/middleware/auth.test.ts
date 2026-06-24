import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { BatonRedis } from "../redis/client.js";
import { createRedisClient } from "../redis/client.js";
import { k } from "../redis/keys.js";
import { createRoomAuth } from "./auth.js";

type AuthVars = { Variables: { roomId: string } };

const TEST_URL = "redis://localhost:6379/15";
const VALID_ROOM = "room_auth_test_ok";

describe("createRoomAuth middleware (integration)", () => {
  let client: BatonRedis;
  let app: Hono<AuthVars>;

  beforeAll(async () => {
    client = await createRedisClient(TEST_URL);
    await client.flushDb();
    await client.json.set(k.room(VALID_ROOM), "$", {
      room_id: VALID_ROOM,
      title: "auth test",
      created_at: Date.now(),
    });

    app = new Hono<AuthVars>();
    app.use("/protected/*", createRoomAuth(client));
    app.get("/protected/ping", (c) => {
      const roomId = c.get("roomId");
      return c.json({ ok: true, roomId });
    });
  });

  afterAll(async () => {
    if (client.isReady) {
      await client.flushDb();
      await client.quit();
    }
  });

  it("rejects with 401 when Authorization header is missing", async () => {
    const res = await app.request("/protected/ping");
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("unauthorized");
  });

  it("rejects with 401 when header is not a Bearer token", async () => {
    const res = await app.request("/protected/ping", {
      headers: { Authorization: "Basic abc123" },
    });
    expect(res.status).toBe(401);
  });

  it("rejects with 401 when Bearer token is empty", async () => {
    const res = await app.request("/protected/ping", {
      headers: { Authorization: "Bearer " },
    });
    expect(res.status).toBe(401);
  });

  it("rejects with 401 when room_id does not exist in Redis", async () => {
    const res = await app.request("/protected/ping", {
      headers: { Authorization: "Bearer room_does_not_exist" },
    });
    expect(res.status).toBe(401);
  });

  it("allows the request through and exposes roomId on context when valid", async () => {
    const res = await app.request("/protected/ping", {
      headers: { Authorization: `Bearer ${VALID_ROOM}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: true; roomId: string };
    expect(body.ok).toBe(true);
    expect(body.roomId).toBe(VALID_ROOM);
  });
});
