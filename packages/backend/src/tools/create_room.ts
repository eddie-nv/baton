import type { z } from "zod";
import { createRoomInput, createRoomOutput } from "@baton/shared";
import { k } from "../redis/keys.js";
import { ids } from "../util/ids.js";
import type { ToolHandler } from "./types.js";

type Input = z.infer<typeof createRoomInput>;
type Output = z.infer<typeof createRoomOutput>;

/**
 * Create a new room. Unauthenticated — the returned room_id IS the
 * bearer capability for subsequent tool calls.
 */
export const createRoom: ToolHandler<Input, Output> = async (input, { redis }) => {
  const room_id = ids.room();
  const project_id = input.project_id ?? ids.project();

  await redis.json.set(k.room(room_id), "$", {
    room_id,
    project_id,
    title: input.title,
    created_at: Date.now(),
  });

  return { room_id, project_id };
};
