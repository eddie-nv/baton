import type { Decision, Event } from "@baton/shared";
import type { BatonRedis } from "./client.js";
import { k } from "./keys.js";

/** Hard cap on SCAN results per call to bound memory and latency. */
const MAX_KEYS = 2000;
/** Per-iteration COUNT hint for SCAN (server-side; not a hard limit). */
const SCAN_COUNT = 500;

/**
 * Iterate every key matching `pattern` until SCAN's cursor returns to 0.
 * Deduplicates and caps the result at MAX_KEYS to keep responses small.
 */
async function scanAll(redis: BatonRedis, pattern: string): Promise<string[]> {
  const seen = new Set<string>();
  let cursor: number = 0;
  do {
    const reply = await redis.scan(cursor, {
      MATCH: pattern,
      COUNT: SCAN_COUNT,
    });
    cursor = Number(reply.cursor);
    for (const key of reply.keys) {
      seen.add(key);
      if (seen.size >= MAX_KEYS) return [...seen].sort();
    }
  } while (cursor !== 0);
  return [...seen].sort();
}

export function listRoomKeys(redis: BatonRedis): Promise<string[]> {
  return scanAll(redis, "room:*");
}

export function listFeatureKeys(
  redis: BatonRedis,
  roomId: string,
): Promise<string[]> {
  return scanAll(redis, `feature:${roomId}:*`);
}

export function listCheckpointKeys(
  redis: BatonRedis,
  roomId: string,
): Promise<string[]> {
  return scanAll(redis, `checkpoint:${roomId}:*`);
}

/**
 * Scan the events stream backwards (XREVRANGE) and return up to `keep`
 * decision.made entries, newest first. Extracted from get_resume_packet.ts
 * so admin routes can reuse it.
 */
export async function loadRecentDecisions(
  redis: BatonRedis,
  roomId: string,
  featureId: string,
  keep: number,
  scanCount: number = 40,
): Promise<Decision[]> {
  const entries = await redis.xRevRange(
    k.events(roomId, featureId),
    "+",
    "-",
    { COUNT: scanCount },
  );

  const decisions: Decision[] = [];
  for (const entry of entries) {
    if (decisions.length >= keep) break;
    const raw = entry.message["data"];
    if (typeof raw !== "string") continue;
    let parsed: Event;
    try {
      parsed = JSON.parse(raw) as Event;
    } catch {
      continue;
    }
    if (parsed.type !== "decision.made") continue;
    const text = (parsed.payload["text"] ?? "") as string;
    decisions.push({ event_id: parsed.event_id, text, ts: parsed.ts });
  }
  return decisions;
}
