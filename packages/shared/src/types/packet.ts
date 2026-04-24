import type { FeatureCard } from "./card.js";

export interface Decision {
  event_id: string;
  text: string;
  /** unix ms */
  ts: number;
}

/**
 * ResumePacket — hard-capped at 1,500 tokens, fixed shape.
 *
 * Assembled fresh in get_resume_packet from already-compacted state. Never
 * stored. Truncation order if over cap: last_decisions oldest-first (end
 * of the array, since it is ordered newest-first), then failed_attempts on
 * a copy of the feature_card (the persisted card is not touched).
 */
export interface ResumePacket {
  feature_card: FeatureCard;
  /** Up to 3, newest first. */
  last_decisions: Decision[];
  open_blockers: string[];
  next_action: string;
}
