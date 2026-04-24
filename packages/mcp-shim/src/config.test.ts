import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clean slate per test.
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("BATON_")) delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("parses all BATON_* env vars into a config", () => {
    process.env["BATON_API_URL"] = "http://localhost:3000";
    process.env["BATON_ROOM_ID"] = "room_abc";
    process.env["BATON_ACTOR_ID"] = "alice@cc";
    process.env["BATON_FEATURE_ID"] = "feat_foo";

    const config = loadConfig();
    expect(config.apiUrl).toBe("http://localhost:3000");
    expect(config.roomId).toBe("room_abc");
    expect(config.actorId).toBe("alice@cc");
    expect(config.featureId).toBe("feat_foo");
  });

  it("throws a clear error when BATON_API_URL is missing", () => {
    expect(() => loadConfig()).toThrow(/BATON_API_URL/);
  });

  it("treats empty strings as undefined (not an empty room_id)", () => {
    process.env["BATON_API_URL"] = "http://localhost:3000";
    process.env["BATON_ROOM_ID"] = "";
    process.env["BATON_ACTOR_ID"] = "";
    process.env["BATON_FEATURE_ID"] = "";

    const config = loadConfig();
    expect(config.roomId).toBeUndefined();
    expect(config.actorId).toBeUndefined();
    expect(config.featureId).toBeUndefined();
  });

  it("strips a trailing slash from BATON_API_URL", () => {
    process.env["BATON_API_URL"] = "http://localhost:3000/";
    const config = loadConfig();
    expect(config.apiUrl).toBe("http://localhost:3000");
  });
});
