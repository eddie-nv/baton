import { describe, expect, it } from "vitest";
import { countTokens } from "../util/tokens.js";
import { truncatePacket, PACKET_BUDGET } from "../util/truncate.js";
import {
  maximalPacket,
  minimalPacket,
  overBudgetPacket,
} from "./__fixtures__.js";

describe("ResumePacket token budget (1500)", () => {
  it("exposes a PACKET_BUDGET constant of 1500", () => {
    expect(PACKET_BUDGET).toBe(1500);
  });

  it("a minimal packet is well under 1500 tokens", () => {
    expect(countTokens(minimalPacket())).toBeLessThanOrEqual(PACKET_BUDGET);
  });

  it("a maximal realistic packet stays ≤ 1500 tokens", () => {
    expect(countTokens(maximalPacket())).toBeLessThanOrEqual(PACKET_BUDGET);
  });
});

describe("truncatePacket", () => {
  it("returns the packet unchanged when already under budget", () => {
    const p = minimalPacket();
    expect(truncatePacket(p)).toEqual(p);
  });

  it("brings an over-budget packet under 1500 tokens", () => {
    const out = truncatePacket(overBudgetPacket());
    expect(countTokens(out)).toBeLessThanOrEqual(PACKET_BUDGET);
  });

  it("drops oldest last_decisions first (end of array, since newest-first ordering)", () => {
    const src = overBudgetPacket();
    const originalIds = src.last_decisions.map((d) => d.event_id);
    const out = truncatePacket(src);
    const keptIds = out.last_decisions.map((d) => d.event_id);
    // Kept decisions must be a prefix of the original (we drop from the end).
    expect(originalIds.slice(0, keptIds.length)).toEqual(keptIds);
  });

  it("trims the embedded card's failed_attempts only after last_decisions are exhausted", () => {
    const src = overBudgetPacket();
    const out = truncatePacket(src);
    const cardTrimmed =
      out.feature_card.failed_attempts.length <
      src.feature_card.failed_attempts.length;
    if (cardTrimmed) {
      expect(out.last_decisions.length).toBe(0);
    }
  });

  it("does not mutate the input packet", () => {
    const src = overBudgetPacket();
    const snapshot = JSON.parse(JSON.stringify(src));
    truncatePacket(src);
    expect(src).toEqual(snapshot);
  });
});
