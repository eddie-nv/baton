import { describe, expect, it } from "vitest";
import { countTokens } from "../util/tokens.js";
import { truncateCard, CARD_BUDGET } from "../util/truncate.js";
import {
  maximalCard,
  minimalCard,
  overBudgetCard,
} from "./__fixtures__.js";

describe("FeatureCard token budget (500)", () => {
  it("exposes a CARD_BUDGET constant of 500", () => {
    expect(CARD_BUDGET).toBe(500);
  });

  it("a minimal valid card is well under 500 tokens", () => {
    expect(countTokens(minimalCard())).toBeLessThanOrEqual(CARD_BUDGET);
  });

  it("a maximal realistic card (3 hypotheses, 2 failed_attempts) stays ≤ 500 tokens", () => {
    expect(countTokens(maximalCard())).toBeLessThanOrEqual(CARD_BUDGET);
  });

  it("countTokens returns a positive number for a card", () => {
    expect(countTokens(minimalCard())).toBeGreaterThan(0);
  });
});

describe("truncateCard", () => {
  it("returns the card unchanged when already under budget", () => {
    const card = minimalCard();
    const out = truncateCard(card);
    expect(out).toEqual(card);
  });

  it("brings an over-budget card under 500 tokens", () => {
    const out = truncateCard(overBudgetCard());
    expect(countTokens(out)).toBeLessThanOrEqual(CARD_BUDGET);
  });

  it("drops oldest failed_attempts first (index 0)", () => {
    const src = overBudgetCard();
    const originalSignatures = src.failed_attempts.map((a) => a.signature);
    const out = truncateCard(src);
    const keptSignatures = out.failed_attempts.map((a) => a.signature);
    // If any were dropped, the kept set is a trailing suffix of the original (oldest removed).
    if (keptSignatures.length < originalSignatures.length) {
      const droppedCount = originalSignatures.length - keptSignatures.length;
      expect(keptSignatures).toEqual(originalSignatures.slice(droppedCount));
    }
  });

  it("only trims hypotheses after failed_attempts are exhausted", () => {
    const src = overBudgetCard();
    const out = truncateCard(src);
    // If hypotheses were touched, failed_attempts must be empty.
    if (out.hypotheses.length < src.hypotheses.length) {
      expect(out.failed_attempts.length).toBe(0);
    }
  });

  it("does not mutate the input card", () => {
    const src = overBudgetCard();
    const snapshot = JSON.parse(JSON.stringify(src));
    truncateCard(src);
    expect(src).toEqual(snapshot);
  });
});
