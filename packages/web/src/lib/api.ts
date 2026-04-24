import {
  featureCardSchema,
  resumePacketSchema,
  type FeatureCard,
  type ResumePacket,
} from "@baton/shared";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Schemas — local envelopes for the admin endpoints. Reused
// shared schemas where they exist (FeatureCard, ResumePacket).
// ─────────────────────────────────────────────────────────────

const roomSchema = z.object({
  room_id: z.string(),
  project_id: z.string(),
  title: z.string(),
  created_at: z.number(),
});
export type Room = z.infer<typeof roomSchema>;

const checkpointSchema = z.object({
  checkpoint_id: z.string(),
  room_id: z.string(),
  feature_id: z.string(),
  session_id: z.string(),
  next_action: z.string(),
  blockers: z.array(z.string()),
  ts: z.number(),
});
export type Checkpoint = z.infer<typeof checkpointSchema>;

const eventSchema = z.object({
  event_id: z.string(),
  room_id: z.string(),
  feature_id: z.string(),
  actor_id: z.string(),
  type: z.string(),
  payload: z.record(z.unknown()),
  ts: z.number(),
});
export type EventRow = z.infer<typeof eventSchema>;

const envelope = <T extends z.ZodTypeAny>(data: T) =>
  z.object({ data });

const errorEnvelope = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

// ─────────────────────────────────────────────────────────────
// Generic fetcher
// ─────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const res = await fetch(path);
  const json: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    const parsed = errorEnvelope.safeParse(json);
    const code = parsed.success ? parsed.data.error.code : "unknown_error";
    const message = parsed.success ? parsed.data.error.message : res.statusText;
    throw new ApiError(res.status, code, message);
  }

  const parsed = envelope(schema).safeParse(json);
  if (!parsed.success) {
    throw new ApiError(
      500,
      "schema_mismatch",
      `response from ${path} did not match expected shape: ${parsed.error.message}`,
    );
  }
  // zod's inferred type for envelope(schema) widens through `addQuestionMarks`;
  // cast back to T — the schema's runtime parse already validated the shape.
  return parsed.data.data as T;
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

export function listRooms(): Promise<{ rooms: Room[] }> {
  return apiFetch("/api/admin/rooms", z.object({ rooms: z.array(roomSchema) }));
}

export function getRoom(roomId: string): Promise<{ room: Room }> {
  return apiFetch(
    `/api/admin/rooms/${encodeURIComponent(roomId)}`,
    z.object({ room: roomSchema }),
  );
}

export function listFeatures(roomId: string): Promise<{ features: FeatureCard[] }> {
  return apiFetch(
    `/api/admin/rooms/${encodeURIComponent(roomId)}/features`,
    z.object({ features: z.array(featureCardSchema) }),
  );
}

export function getFeature(
  roomId: string,
  featureId: string,
): Promise<{ feature: FeatureCard }> {
  return apiFetch(
    `/api/admin/rooms/${encodeURIComponent(roomId)}/features/${encodeURIComponent(featureId)}`,
    z.object({ feature: featureCardSchema }),
  );
}

export function getResumePacket(
  roomId: string,
  featureId: string,
): Promise<{ packet: ResumePacket }> {
  return apiFetch(
    `/api/admin/rooms/${encodeURIComponent(roomId)}/features/${encodeURIComponent(featureId)}/resume`,
    z.object({ packet: resumePacketSchema }),
  );
}

export interface ListEventsParams {
  limit?: number;
  cursor?: string;
}

export function listEvents(
  roomId: string,
  featureId: string,
  params: ListEventsParams = {},
): Promise<{ events: EventRow[]; next_cursor: string | null }> {
  const qs = new URLSearchParams();
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  if (params.cursor !== undefined) qs.set("cursor", params.cursor);
  const query = qs.toString();
  const url = `/api/admin/rooms/${encodeURIComponent(roomId)}/features/${encodeURIComponent(featureId)}/events${query.length > 0 ? `?${query}` : ""}`;
  return apiFetch(
    url,
    z.object({
      events: z.array(eventSchema),
      next_cursor: z.string().nullable(),
    }),
  );
}

export function listCheckpoints(roomId: string): Promise<{ checkpoints: Checkpoint[] }> {
  return apiFetch(
    `/api/admin/rooms/${encodeURIComponent(roomId)}/checkpoints`,
    z.object({ checkpoints: z.array(checkpointSchema) }),
  );
}
