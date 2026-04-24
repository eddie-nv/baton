import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────

export const eventTypeSchema = z.enum([
  "action.branch",
  "action.edit",
  "action.commit",
  "error.test",
  "hypothesis.raised",
  "decision.made",
  "session.pause",
  "feature.merged",
]);

export const failedAttemptSchema = z.object({
  signature: z.string().min(1),
  summary: z.string(),
  event_ids: z.array(z.string()),
});

export const featureGitSchema = z.object({
  branch: z.string(),
  parent_branch: z.string(),
  base_sha: z.string(),
  head_sha: z.string(),
  commits_ahead: z.number().int().nonnegative(),
  dirty_files: z.array(z.string()),
  remote: z.string(),
});

export const featureSurfaceSchema = z.object({
  files: z.array(z.string()),
  services: z.array(z.string()),
});

export const featureCardSchema = z.object({
  feature_id: z.string().min(1),
  room_id: z.string().min(1),
  purpose: z.string(),
  state: z.enum(["in_progress", "blocked", "merged", "abandoned"]),
  confidence: z.number().min(0).max(1),
  git: featureGitSchema,
  surface: featureSurfaceSchema,
  invariants: z.array(z.string()),
  hypotheses: z.array(z.string()).max(3),
  failed_attempts: z.array(failedAttemptSchema),
  open_blockers: z.array(z.string()),
  next_action: z.string(),
});

export const decisionSchema = z.object({
  event_id: z.string(),
  text: z.string(),
  ts: z.number().int().nonnegative(),
});

export const resumePacketSchema = z.object({
  feature_card: featureCardSchema,
  last_decisions: z.array(decisionSchema).max(3),
  open_blockers: z.array(z.string()),
  next_action: z.string(),
});

// ─────────────────────────────────────────────────────────────
// Per-tool input/output schemas
// ─────────────────────────────────────────────────────────────
// Each tool exposes both a `*Shape` raw-object form (for the MCP SDK's
// registerTool API which expects `{ [key: string]: ZodSchema }`, not a
// z.object wrapper) and a `*Input` / `*Output` z.object form for backend
// validation and type inference.

// create_room ------------------------------------------------------------
export const createRoomInputShape = {
  project_id: z.string().optional(),
  title: z.string().min(1),
};
export const createRoomInput = z.object(createRoomInputShape);
export const createRoomOutput = z.object({
  room_id: z.string(),
  project_id: z.string(),
});

// append_event -----------------------------------------------------------
export const appendEventInputShape = {
  room_id: z.string().min(1),
  feature_id: z.string().min(1),
  type: eventTypeSchema,
  payload: z.record(z.unknown()),
  actor_id: z.string().min(1),
};
export const appendEventInput = z.object(appendEventInputShape);
export const appendEventOutput = z.object({
  event_id: z.string(),
  card_updated: z.boolean(),
});

// write_checkpoint -------------------------------------------------------
export const writeCheckpointInputShape = {
  room_id: z.string().min(1),
  feature_id: z.string().min(1),
  session_id: z.string().min(1),
  next_action: z.string(),
  blockers: z.array(z.string()),
};
export const writeCheckpointInput = z.object(writeCheckpointInputShape);
export const writeCheckpointOutput = z.object({
  checkpoint_id: z.string(),
  expires_at: z.number().int().nonnegative(),
});

// get_feature_card -------------------------------------------------------
export const getFeatureCardInputShape = {
  room_id: z.string().min(1),
  feature_id: z.string().min(1),
};
export const getFeatureCardInput = z.object(getFeatureCardInputShape);
export const getFeatureCardOutput = featureCardSchema;

// get_resume_packet ------------------------------------------------------
export const getResumePacketInputShape = {
  room_id: z.string().min(1),
  feature_id: z.string().min(1),
  session_id: z.string().optional(),
};
export const getResumePacketInput = z.object(getResumePacketInputShape);
export const getResumePacketOutput = resumePacketSchema;

// ─────────────────────────────────────────────────────────────
// Tool name → { inputShape, outputSchema } map for the backend dispatcher
// and the MCP shim to iterate over.
// ─────────────────────────────────────────────────────────────

export const toolSchemas = {
  create_room: {
    inputShape: createRoomInputShape,
    input: createRoomInput,
    output: createRoomOutput,
    requiresAuth: false,
  },
  append_event: {
    inputShape: appendEventInputShape,
    input: appendEventInput,
    output: appendEventOutput,
    requiresAuth: true,
  },
  write_checkpoint: {
    inputShape: writeCheckpointInputShape,
    input: writeCheckpointInput,
    output: writeCheckpointOutput,
    requiresAuth: true,
  },
  get_feature_card: {
    inputShape: getFeatureCardInputShape,
    input: getFeatureCardInput,
    output: getFeatureCardOutput,
    requiresAuth: true,
  },
  get_resume_packet: {
    inputShape: getResumePacketInputShape,
    input: getResumePacketInput,
    output: getResumePacketOutput,
    requiresAuth: true,
  },
} as const;

export type ToolName = keyof typeof toolSchemas;
