import type { z } from "zod";
import {
  appendEventInput,
  appendEventOutput,
  type Event,
  type FeatureCard,
} from "@baton/shared";
import { dispatch } from "../compactor/index.js";
import { k } from "../redis/keys.js";
import { ids } from "../util/ids.js";
import { setFeatureCardSafely } from "../util/tokens.js";
import type { ToolHandler } from "./types.js";

type Input = z.infer<typeof appendEventInput>;
type Output = z.infer<typeof appendEventOutput>;

function initCard(roomId: string, featureId: string): FeatureCard {
  return {
    feature_id: featureId,
    room_id: roomId,
    purpose: "",
    state: "in_progress",
    confidence: 0,
    git: {
      branch: "",
      parent_branch: "",
      base_sha: "",
      head_sha: "",
      commits_ahead: 0,
      dirty_files: [],
      remote: "origin",
    },
    surface: { files: [], services: [] },
    invariants: [],
    hypotheses: [],
    failed_attempts: [],
    open_blockers: [],
    next_action: "",
  };
}

/**
 * Append an event to the stream, compact it into the feature card, and
 * return whether the card changed.
 *
 * Side effects:
 *   1. XADD events:<room>:<feature>
 *   2. JSON.SET feature:<room>:<feature> (via setFeatureCardSafely — the
 *      500-token enforcement boundary) if the compactor changed the card
 *   3. PUBLISH room:<room>:sessions on session.pause
 *
 * Compactor handlers validate their own payload with zod sub-schemas,
 * so a bogus payload propagates as a thrown ZodError.
 */
export const appendEvent: ToolHandler<Input, Output> = async (
  input,
  { redis },
) => {
  const event: Event = {
    event_id: ids.event(),
    room_id: input.room_id,
    feature_id: input.feature_id,
    actor_id: input.actor_id,
    type: input.type,
    payload: input.payload,
    ts: Date.now(),
  };

  await redis.xAdd(k.events(event.room_id, event.feature_id), "*", {
    data: JSON.stringify(event),
  });

  const stored = (await redis.json.get(
    k.feature(event.room_id, event.feature_id),
  )) as FeatureCard | null;
  const current = stored ?? initCard(event.room_id, event.feature_id);

  const next = dispatch(event, current);
  const cardChanged = next !== current || stored === null;

  if (cardChanged) {
    await setFeatureCardSafely(redis, next);
  }

  if (event.type === "session.pause") {
    await redis.publish(k.sessionChannel(event.room_id), JSON.stringify(event));
  }

  return { event_id: event.event_id, card_updated: cardChanged };
};
