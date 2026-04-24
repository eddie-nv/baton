import type { z } from "zod";
import {
  getResumePacketInput,
  truncatePacket,
  type Decision,
  type Event,
  type FeatureCard,
  type ResumePacket,
} from "@baton/shared";
import { k } from "../redis/keys.js";
import { notFound, type ToolHandler } from "./types.js";

type Input = z.infer<typeof getResumePacketInput>;
type Output = ResumePacket;

/** How many events to scan backwards when fishing for recent decisions. */
const DECISION_SCAN_COUNT = 40;
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

async function loadRecentDecisions(
  redis: import("../redis/client.js").BatonRedis,
  roomId: string,
  featureId: string,
): Promise<Decision[]> {
  // XREVRANGE returns newest first.
  const entries = await redis.xRevRange(
    k.events(roomId, featureId),
    "+",
    "-",
    { COUNT: DECISION_SCAN_COUNT },
  );

  const decisions: Decision[] = [];
  for (const entry of entries) {
    if (decisions.length >= DECISION_KEEP) break;
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
