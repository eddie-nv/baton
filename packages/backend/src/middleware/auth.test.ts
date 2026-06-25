import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BatonRedis } from "../redis/client.js";
import { createRedisClient } from "../redis/client.js";
import { k } from "../redis/keys.js";
import { authenticateRoom } from "./auth.js";

const TEST_URL = "redis://localhost:6379/15";
const VALID_ROOM = "room_auth_test_ok";

describe("authenticateRoom (integration)", () => {
  let client: BatonRedis;

  beforeAll(async () => {
    client = await createRedisClient(TEST_URL);
    await client.flushDb();
    await client.json.set(k.room(VALID_ROOM), "$", {
      room_id: VALID_ROOM,
      title: "auth test",
      created_at: Date.now(),
    });
  });

  afterAll(async () => {
    if (client.isReady) {
      await client.flushDb();
      await client.quit();
    }
  });

  it("rejects when Authorization header is missing", async () => {
    const result = await authenticateRoom(client, undefined);
    expect(result).toEqual({ ok: false, message: "Missing bearer token" });
  });

  it("rejects when header is not a Bearer token", async () => {
    const result = await authenticateRoom(client, "Basic abc123");
    expect(result.ok).toBe(false);
  });

  it("rejects when Bearer token is empty", async () => {
    const result = await authenticateRoom(client, "Bearer ");
    expect(result.ok).toBe(false);
  });

  it("rejects when room_id does not exist in Redis", async () => {
    const result = await authenticateRoom(client, "Bearer room_does_not_exist");
    expect(result).toEqual({ ok: false, message: "Unknown room_id" });
  });

  it("returns the roomId when the bearer token is valid", async () => {
    const result = await authenticateRoom(client, `Bearer ${VALID_ROOM}`);
    expect(result).toEqual({ ok: true, roomId: VALID_ROOM });
  });
});
