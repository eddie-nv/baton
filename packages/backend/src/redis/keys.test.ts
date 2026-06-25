import { describe, expect, it } from "vitest";
import { k } from "./keys.js";

describe("redis key helpers", () => {
  it("builds room key", () => {
    expect(k.room("room_abc")).toBe("room:room_abc");
  });

  it("builds feature card key", () => {
    expect(k.feature("room_abc", "feat_foo")).toBe("feature:room_abc:feat_foo");
  });

  it("builds events stream key", () => {
    expect(k.events("room_abc", "feat_foo")).toBe("events:room_abc:feat_foo");
  });

  it("builds checkpoint key", () => {
    expect(k.checkpoint("room_abc", "sess_1")).toBe("checkpoint:room_abc:sess_1");
  });

  it("builds session pub/sub channel for a room", () => {
    expect(k.sessionChannel("room_abc")).toBe("room:room_abc:sessions");
  });

  it("all keys for a (room, feature) share the room namespace prefix", () => {
    const r = "room_test";
    const f = "feat_test";
    expect(k.feature(r, f).startsWith(`feature:${r}:`)).toBe(true);
    expect(k.events(r, f).startsWith(`events:${r}:`)).toBe(true);
  });
});
