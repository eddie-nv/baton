import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Forwarder } from "./forwarder.js";

const fullConfig = {
  apiUrl: "http://localhost:3000",
  roomId: "room_default",
  actorId: "alice@cc",
  featureId: "feat_default",
};

function mockFetchOnce(status: number, body: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn() as ReturnType<typeof vi.fn>;
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("Forwarder.call", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs to /api/mcp/<tool> with the merged body and returns envelope.data", async () => {
    const fetchMock = mockFetchOnce(200, {
      data: { room_id: "room_new", project_id: "proj_new" },
    });

    const fwd = new Forwarder(fullConfig);
    const result = await fwd.call("create_room", { title: "Hi" });

    expect(result).toEqual({ room_id: "room_new", project_id: "proj_new" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3000/api/mcp/create_room");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string) as { title: string };
    expect(body.title).toBe("Hi");
  });

  it("sets Authorization: Bearer <room_id> when roomId is configured", async () => {
    const fetchMock = mockFetchOnce(200, { data: {} });
    const fwd = new Forwarder(fullConfig);
    await fwd.call("get_feature_card", { room_id: "room_default", feature_id: "f" });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer room_default",
    );
  });

  it("omits Authorization when no roomId is configured (e.g. initial create_room)", async () => {
    const fetchMock = mockFetchOnce(200, { data: {} });
    const fwd = new Forwarder({ ...fullConfig, roomId: undefined });
    await fwd.call("create_room", { title: "Fresh" });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Authorization"]).toBeUndefined();
  });

  it("merges default room_id and feature_id into authed tool calls when caller omits them", async () => {
    const fetchMock = mockFetchOnce(200, { data: {} });
    const fwd = new Forwarder(fullConfig);
    await fwd.call("get_feature_card", {});
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      room_id: string;
      feature_id: string;
    };
    expect(body.room_id).toBe("room_default");
    expect(body.feature_id).toBe("feat_default");
  });

  it("caller-provided values take precedence over defaults", async () => {
    const fetchMock = mockFetchOnce(200, { data: {} });
    const fwd = new Forwarder(fullConfig);
    await fwd.call("get_feature_card", {
      room_id: "room_override",
      feature_id: "feat_override",
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      room_id: string;
      feature_id: string;
    };
    expect(body.room_id).toBe("room_override");
    expect(body.feature_id).toBe("feat_override");
  });

  it("append_event gets actor_id merged from env", async () => {
    const fetchMock = mockFetchOnce(200, { data: { event_id: "evt_x" } });
    const fwd = new Forwarder(fullConfig);
    await fwd.call("append_event", {
      type: "action.commit",
      payload: { sha: "def5678" },
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { actor_id: string };
    expect(body.actor_id).toBe("alice@cc");
  });

  it("does NOT merge defaults for create_room (no room/feature context yet)", async () => {
    const fetchMock = mockFetchOnce(200, { data: { room_id: "r", project_id: "p" } });
    const fwd = new Forwarder(fullConfig);
    await fwd.call("create_room", { title: "Hi" });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.room_id).toBeUndefined();
    expect(body.feature_id).toBeUndefined();
    expect(body.actor_id).toBeUndefined();
  });

  it("throws a descriptive error on HTTP !ok responses", async () => {
    mockFetchOnce(401, { error: { code: "unauthorized", message: "nope" } });
    const fwd = new Forwarder(fullConfig);
    await expect(
      fwd.call("get_feature_card", { room_id: "r", feature_id: "f" }),
    ).rejects.toThrow(/401/);
  });
});
