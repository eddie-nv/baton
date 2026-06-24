import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import { Hono } from "hono";
import { requestLogger, redactRoomId } from "./log.js";

describe("redactRoomId", () => {
  it("returns '-' for undefined", () => {
    expect(redactRoomId(undefined)).toBe("-");
  });

  it("masks a typical room_id to the first 6 chars + '***'", () => {
    expect(redactRoomId("room_abcd1234xyz")).toBe("room_a***");
  });

  it("leaves very short tokens unredacted (nothing useful to mask)", () => {
    expect(redactRoomId("abc")).toBe("abc");
  });
});

describe("requestLogger middleware", () => {
  let logSpy!: MockInstance<Parameters<typeof console.log>, ReturnType<typeof console.log>>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {
      /* swallow */
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("logs one JSON line per request with method, path, status, dur_ms", async () => {
    const app = new Hono();
    app.use("*", requestLogger);
    app.get("/hello", (c) => c.json({ ok: true }));

    const res = await app.request("/hello");
    expect(res.status).toBe(200);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = logSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(line) as {
      method: string;
      path: string;
      status: number;
      dur_ms: number;
      room: string;
    };
    expect(parsed.method).toBe("GET");
    expect(parsed.path).toBe("/hello");
    expect(parsed.status).toBe(200);
    expect(typeof parsed.dur_ms).toBe("number");
    expect(parsed.room).toBe("-");
  });

  it("redacts the bearer token in logs", async () => {
    const app = new Hono();
    app.use("*", requestLogger);
    app.get("/secret", (c) => c.json({ ok: true }));

    await app.request("/secret", {
      headers: { Authorization: "Bearer room_supersecretvalue" },
    });
    const line = logSpy.mock.calls[0]![0] as string;
    expect(line).not.toContain("supersecret");
    expect(line).toContain("room_s***");
  });
});
