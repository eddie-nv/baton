import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BatonRedis } from "./client.js";
import { createRedisClient } from "./client.js";

/**
 * Integration tests — require Redis Stack on localhost:6379 (see
 * deploy/docker-compose.yml). All test keys go to DB 15 and the DB
 * is FLUSHDB'd at start and end so we never touch app data in DB 0.
 */
const TEST_URL = "redis://localhost:6379/15";

describe("redis client (integration)", () => {
  let client: BatonRedis;

  beforeAll(async () => {
    client = await createRedisClient(TEST_URL);
    await client.flushDb();
  });

  afterAll(async () => {
    if (client.isReady) {
      await client.flushDb();
      await client.quit();
    }
  });

  it("PINGs", async () => {
    expect(await client.ping()).toBe("PONG");
  });

  it("supports JSON.SET + JSON.GET (RedisJSON module loaded)", async () => {
    await client.json.set("test:doc:1", "$", { foo: "bar", n: 42 });
    const got = await client.json.get("test:doc:1");
    expect(got).toEqual({ foo: "bar", n: 42 });
  });

  it("supports XADD + XRANGE (Streams)", async () => {
    const id = await client.xAdd("test:stream:1", "*", {
      type: "test",
      value: "hello",
    });
    expect(id).toBeTruthy();
    const entries = await client.xRange("test:stream:1", "-", "+");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.message).toMatchObject({ type: "test", value: "hello" });
  });

  it("supports Pub/Sub (publish returns subscriber count)", async () => {
    const subscriber = client.duplicate();
    await subscriber.connect();
    try {
      const messages: string[] = [];
      await subscriber.subscribe("test:channel", (msg) => {
        messages.push(msg);
      });
      // give subscribe a microtask to settle
      await new Promise((r) => setTimeout(r, 20));
      const n = await client.publish("test:channel", "hello");
      expect(n).toBe(1);
      await new Promise((r) => setTimeout(r, 20));
      expect(messages).toEqual(["hello"]);
    } finally {
      await subscriber.quit();
    }
  });
});
