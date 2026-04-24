import { Hono } from "hono";
import type {
  Event,
  FeatureCard,
  ResumePacket,
} from "@baton/shared";
import type { BatonRedis } from "../redis/client.js";
import { k } from "../redis/keys.js";
import {
  listCheckpointKeys,
  listFeatureKeys,
  listRoomKeys,
} from "../redis/queries.js";
import { getResumePacket } from "../tools/get_resume_packet.js";

interface RoomDoc {
  room_id: string;
  project_id: string;
  title: string;
  created_at: number;
}

interface CheckpointDoc {
  checkpoint_id: string;
  room_id: string;
  feature_id: string;
  session_id: string;
  next_action: string;
  blockers: string[];
  ts: number;
}

const DEFAULT_EVENT_LIMIT = 200;
const MAX_EVENT_LIMIT = 500;

function parseLimit(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_EVENT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_EVENT_LIMIT;
  return Math.min(Math.floor(n), MAX_EVENT_LIMIT);
}

async function jsonMGet<T>(
  redis: BatonRedis,
  keys: readonly string[],
): Promise<T[]> {
  if (keys.length === 0) return [];
  // node-redis exposes JSON.MGET; for v1 we keep it simple with a Promise.all
  // of single GETs. Acceptable at hackathon scale; swap to MGET if it bites.
  const results = await Promise.all(
    keys.map((key) => redis.json.get(key)),
  );
  return results.filter((v) => v !== null) as T[];
}

/**
 * Read-only admin/inspection routes for the Baton web UI.
 *
 * UNAUTHENTICATED — see CLAUDE.md non-goals and the M5+ web addendum:
 * any caller who can hit this backend can list room IDs (which are
 * bearer capabilities). Acceptable for the hackathon dev setup.
 * Production deployment should gate `/api/admin/*` behind a shared
 * BATON_ADMIN_TOKEN.
 */
export function createAdminRouter(redis: BatonRedis): Hono {
  const app = new Hono();

  app.get("/rooms", async (c) => {
    const keys = await listRoomKeys(redis);
    const rooms = await jsonMGet<RoomDoc>(redis, keys);
    return c.json({ data: { rooms } });
  });

  app.get("/rooms/:roomId", async (c) => {
    const roomId = c.req.param("roomId");
    const room = (await redis.json.get(k.room(roomId))) as RoomDoc | null;
    if (room === null) {
      return c.json(
        { error: { code: "not_found", message: `room ${roomId} not found` } },
        404,
      );
    }
    return c.json({ data: { room } });
  });

  app.get("/rooms/:roomId/features", async (c) => {
    const roomId = c.req.param("roomId");
    const keys = await listFeatureKeys(redis, roomId);
    const features = await jsonMGet<FeatureCard>(redis, keys);
    return c.json({ data: { features } });
  });

  app.get("/rooms/:roomId/features/:featureId", async (c) => {
    const roomId = c.req.param("roomId");
    const featureId = c.req.param("featureId");
    const feature = (await redis.json.get(
      k.feature(roomId, featureId),
    )) as FeatureCard | null;
    if (feature === null) {
      return c.json(
        {
          error: {
            code: "not_found",
            message: `feature ${featureId} not found in ${roomId}`,
          },
        },
        404,
      );
    }
    return c.json({ data: { feature } });
  });

  app.get("/rooms/:roomId/features/:featureId/events", async (c) => {
    const roomId = c.req.param("roomId");
    const featureId = c.req.param("featureId");
    const limit = parseLimit(c.req.query("limit"));
    const cursorRaw = c.req.query("cursor");
    const start = cursorRaw !== undefined && cursorRaw.length > 0
      ? `(${cursorRaw}` // Redis exclusive-start syntax
      : "-";

    // Fetch one extra to detect if more remain (next_cursor).
    const entries = await redis.xRange(
      k.events(roomId, featureId),
      start,
      "+",
      { COUNT: limit + 1 },
    );

    const events: Event[] = [];
    for (const entry of entries.slice(0, limit)) {
      const raw = entry.message["data"];
      if (typeof raw !== "string") continue;
      try {
        events.push(JSON.parse(raw) as Event);
      } catch {
        /* skip malformed */
      }
    }

    const hasMore = entries.length > limit;
    const next_cursor = hasMore ? entries[limit - 1]?.id ?? null : null;

    return c.json({ data: { events, next_cursor } });
  });

  app.get("/rooms/:roomId/features/:featureId/resume", async (c) => {
    const roomId = c.req.param("roomId");
    const featureId = c.req.param("featureId");
    try {
      const packet: ResumePacket = await getResumePacket(
        { room_id: roomId, feature_id: featureId },
        { redis, authedRoomId: roomId },
      );
      return c.json({ data: { packet } });
    } catch (err) {
      // getResumePacket throws ToolError(404) when no card.
      const message = err instanceof Error ? err.message : "unknown";
      return c.json(
        { error: { code: "not_found", message } },
        404,
      );
    }
  });

  app.get("/rooms/:roomId/checkpoints", async (c) => {
    const roomId = c.req.param("roomId");
    const keys = await listCheckpointKeys(redis, roomId);
    const checkpoints = await jsonMGet<CheckpointDoc>(redis, keys);
    return c.json({ data: { checkpoints } });
  });

  return app;
}
