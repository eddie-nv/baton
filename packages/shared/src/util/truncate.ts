import type { FeatureCard } from "../types/card.js";
import type { ResumePacket } from "../types/packet.js";
import { countTokens } from "./tokens.js";

export const CARD_BUDGET = 500;
export const PACKET_BUDGET = 1500;

/**
 * Returns a copy of `card` that fits within `budget` tokens.
 *
 * Truncation order (deterministic):
 *   1. Drop oldest `failed_attempts` (index 0) one at a time.
 *   2. Drop oldest `hypotheses` (index 0) one at a time.
 *
 * Never mutates `card`. If already under budget, returns the input
 * reference unchanged.
 */
export function truncateCard(card: FeatureCard, budget: number = CARD_BUDGET): FeatureCard {
  if (countTokens(card) <= budget) return card;

  let working: FeatureCard = card;

  while (countTokens(working) > budget && working.failed_attempts.length > 0) {
    working = {
      ...working,
      failed_attempts: working.failed_attempts.slice(1),
    };
  }

  while (countTokens(working) > budget && working.hypotheses.length > 0) {
    working = {
      ...working,
      hypotheses: working.hypotheses.slice(1),
    };
  }

  return working;
}

/**
 * Returns a copy of `packet` that fits within `budget` tokens.
 *
 * Truncation order (deterministic):
 *   1. Drop oldest `last_decisions` (end of the array, since newest-first)
 *      one at a time.
 *   2. Drop oldest `failed_attempts` from the embedded card *copy*. The
 *      persisted card is not mutated — this only affects what's returned
 *      in the packet.
 *
 * Never mutates `packet`.
 */
export function truncatePacket(packet: ResumePacket, budget: number = PACKET_BUDGET): ResumePacket {
  if (countTokens(packet) <= budget) return packet;

  let working: ResumePacket = packet;

  while (countTokens(working) > budget && working.last_decisions.length > 0) {
    working = {
      ...working,
      last_decisions: working.last_decisions.slice(0, -1),
    };
  }

  while (
    countTokens(working) > budget &&
    working.feature_card.failed_attempts.length > 0
  ) {
    working = {
      ...working,
      feature_card: {
        ...working.feature_card,
        failed_attempts: working.feature_card.failed_attempts.slice(1),
      },
    };
  }

  return working;
}
