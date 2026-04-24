import type { ToolHandler } from "./types.js";
import { appendEvent } from "./append_event.js";
import { createRoom } from "./create_room.js";
import { getFeatureCard } from "./get_feature_card.js";
import { getResumePacket } from "./get_resume_packet.js";
import { writeCheckpoint } from "./write_checkpoint.js";

/**
 * Tool name → handler registry. Used by the dispatcher in routes/mcp.ts
 * to look up a handler by the URL's `:tool` param.
 *
 * Keys MUST match the keys of `toolSchemas` in @baton/shared so the
 * dispatcher can validate input and select the handler from the same name.
 */
export const toolHandlers = {
  create_room: createRoom,
  append_event: appendEvent,
  get_feature_card: getFeatureCard,
  write_checkpoint: writeCheckpoint,
  get_resume_packet: getResumePacket,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} satisfies Record<string, ToolHandler<any, any>>;

export type ToolHandlerName = keyof typeof toolHandlers;

export { ToolError, badRequest, conflict, notFound } from "./types.js";
export type { ToolContext, ToolHandler } from "./types.js";
