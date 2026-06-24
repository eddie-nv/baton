import type { z } from "zod";
import {
  writeCheckpointInput,
  writeCheckpointOutput,
} from "@baton/shared";
import { k } from "../redis/keys.js";
import { ids } from "../util/ids.js";
import type { ToolHandler } from "./types.js";

type Input = z.infer<typeof writeCheckpointInput>;
type Output = z.infer<typeof writeCheckpointOutput>;

/** 7 days, per CLAUDE.md — checkpoints decay; they are not permanent. */
export const CHECKPOINT_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Persist a session-pause checkpoint. The stored doc is the full
 * snapshot the caller supplied (next_action, blockers) plus the
 * generated checkpoint_id and a timestamp. TTL is 7 days.
 */
export const writeCheckpoint: ToolHandler<Input, Output> = async (
  input,
  { redis },
) => {
  const checkpoint_id = ids.checkpoint();
  const ts = Date.now();
  const expires_at = ts + CHECKPOINT_TTL_SECONDS * 1000;

  const key = k.checkpoint(input.room_id, input.session_id);
  await redis.json.set(key, "$", {
    checkpoint_id,
    room_id: input.room_id,
    feature_id: input.feature_id,
    session_id: input.session_id,
    next_action: input.next_action,
    blockers: input.blockers,
    ts,
  });
  await redis.expire(key, CHECKPOINT_TTL_SECONDS);

  return { checkpoint_id, expires_at };
};
