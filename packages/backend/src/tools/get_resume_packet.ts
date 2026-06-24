import type { z } from "zod";
import {
  getResumePacketInput,
  truncatePacket,
  type FeatureCard,
  type ResumePacket,
} from "@baton/shared";
import { k } from "../redis/keys.js";
import { loadRecentDecisions } from "../redis/queries.js";
import { notFound, type ToolHandler } from "./types.js";

type Input = z.infer<typeof getResumePacketInput>;
type Output = ResumePacket;

/** How many decisions to include in the packet. */
const DECISION_KEEP = 3;

interface StoredCheckpoint {
  readonly checkpoint_id: string;
  readonly feature_id: string;
  readonly session_id: string;
  readonly next_action: string;
  readonly blockers: readonly string[];
}

/**
 * Assemble a ResumePacket for (room, feature): the current feature card,
 * the N most-recent decisions (newest first), and — if a session_id is
 * supplied and a checkpoint exists — the checkpoint's next_action and
 * blockers. The packet is truncated to PACKET_BUDGET (1,500 tokens)
 * before return.
 */
export const getResumePacket: ToolHandler<Input, Output> = async (
  input,
  { redis },
) => {
  const card = (await redis.json.get(
    k.feature(input.room_id, input.feature_id),
  )) as FeatureCard | null;
  if (card === null) throw notFound(`feature ${input.feature_id}`);

  const last_decisions = await loadRecentDecisions(
    redis,
    input.room_id,
    input.feature_id,
    DECISION_KEEP,
  );

  const checkpoint =
    input.session_id !== undefined
      ? ((await redis.json.get(
          k.checkpoint(input.room_id, input.session_id),
        )) as StoredCheckpoint | null)
      : null;

  const packet: ResumePacket = {
    feature_card: card,
    last_decisions,
    open_blockers:
      checkpoint !== null
        ? mergeBlockers(card.open_blockers, checkpoint.blockers)
        : card.open_blockers,
    next_action:
      checkpoint !== null && checkpoint.next_action !== ""
        ? checkpoint.next_action
        : card.next_action,
  };

  return truncatePacket(packet);
};

function mergeBlockers(
  fromCard: readonly string[],
  fromCheckpoint: readonly string[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const b of [...fromCheckpoint, ...fromCard]) {
    if (!seen.has(b)) {
      seen.add(b);
      out.push(b);
    }
  }
  return out;
}
