/**
 * Redis key/channel helpers. Baton uses a single Redis instance; keys are
 * namespaced by kind first then scoped by room_id + feature_id.
 *
 * Scheme summary:
 *   room:<room_id>                          — JSON, the room doc
 *   feature:<room_id>:<feature_id>          — JSON, the feature card
 *   events:<room_id>:<feature_id>           — Stream, the event ledger
 *   checkpoint:<room_id>:<session_id>       — JSON, TTL 7d
 *   session:<session_id>                    — pointer to room + feature
 *   lock:<room_id>:<feature_id>             — SET NX for compactor races
 *   room:<room_id>:sessions                 — Pub/Sub channel for pauses
 */
export const k = {
  room: (roomId: string): string => `room:${roomId}`,
  feature: (roomId: string, featureId: string): string =>
    `feature:${roomId}:${featureId}`,
  events: (roomId: string, featureId: string): string =>
    `events:${roomId}:${featureId}`,
  checkpoint: (roomId: string, sessionId: string): string =>
    `checkpoint:${roomId}:${sessionId}`,
  session: (sessionId: string): string => `session:${sessionId}`,
  lock: (roomId: string, featureId: string): string =>
    `lock:${roomId}:${featureId}`,
  sessionChannel: (roomId: string): string => `room:${roomId}:sessions`,
} as const;
