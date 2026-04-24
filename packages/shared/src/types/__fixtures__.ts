import type { FeatureCard, FailedAttempt } from "./card.js";
import type { ResumePacket, Decision } from "./packet.js";

export function minimalCard(): FeatureCard {
  return {
    feature_id: "feat_payments_idempotency",
    room_id: "room_abc123",
    purpose: "Make payment retries idempotent across POS terminals.",
    state: "in_progress",
    confidence: 0.6,
    git: {
      branch: "feat/payments-idempotency",
      parent_branch: "release/payments-v2",
      base_sha: "abc1234",
      head_sha: "def5678",
      commits_ahead: 3,
      dirty_files: ["src/payments/charge.ts"],
      remote: "origin",
    },
    surface: {
      files: ["src/payments/charge.ts"],
      services: ["payments"],
    },
    invariants: ["every POST /charge must carry an Idempotency-Key"],
    hypotheses: [],
    failed_attempts: [],
    open_blockers: [],
    next_action: "add idempotency-key middleware to /charge",
  };
}

export function maximalCard(): FeatureCard {
  return {
    feature_id: "feat_payments_idempotency",
    room_id: "room_abc123",
    purpose: "Make payment retries idempotent across POS terminals.",
    state: "in_progress",
    confidence: 0.72,
    git: {
      branch: "feat/payments-idempotency",
      parent_branch: "release/payments-v2",
      base_sha: "abc1234",
      head_sha: "def5678",
      commits_ahead: 4,
      dirty_files: [
        "src/payments/charge.ts",
        "src/payments/middleware.ts",
        "src/payments/types.ts",
      ],
      remote: "origin",
    },
    surface: {
      files: [
        "src/payments/charge.ts",
        "src/payments/middleware.ts",
        "src/payments/types.ts",
      ],
      services: ["payments", "ledger"],
    },
    invariants: [
      "every POST /charge must carry an Idempotency-Key",
      "duplicate keys must return the cached response within 24h",
    ],
    hypotheses: [
      "bug is in the ledger double-write under retry",
      "middleware order places dedupe after logging",
      "cache TTL is the wrong key granularity",
    ],
    failed_attempts: [
      {
        signature: "ledger_double_write_v1",
        summary: "swap write order — breaks audit log",
        event_ids: ["evt_1", "evt_2"],
      },
      {
        signature: "dedupe_before_validate",
        summary: "dedupe first — rejects legit retries",
        event_ids: ["evt_3"],
      },
    ],
    open_blockers: ["need clarity on 24h window from finance"],
    next_action: "write integration test for 409 on duplicate key",
  };
}

export function overBudgetCard(): FeatureCard {
  const many: FailedAttempt[] = Array.from({ length: 30 }, (_, i) => ({
    signature: `attempt_${i}`,
    summary: "a previously tried fix that did not work for various detailed reasons",
    event_ids: [`evt_${i * 2}`, `evt_${i * 2 + 1}`],
  }));
  return {
    ...maximalCard(),
    failed_attempts: many,
    hypotheses: [
      "a very long hypothesis string describing one possible root cause in careful detail",
      "another long hypothesis string describing a different possible root cause with context",
      "a third hypothesis that also contributes meaningfully to the token count total",
    ],
  };
}

export function decisionsNewestFirst(): Decision[] {
  return [
    { event_id: "evt_100", text: "adopt idempotency-key middleware approach", ts: 1000 },
    { event_id: "evt_090", text: "scope to POST /charge only for now", ts: 900 },
    { event_id: "evt_080", text: "use redis for dedupe cache, 24h ttl", ts: 800 },
  ];
}

export function minimalPacket(): ResumePacket {
  return {
    feature_card: minimalCard(),
    last_decisions: [],
    open_blockers: [],
    next_action: "add idempotency-key middleware to /charge",
  };
}

export function maximalPacket(): ResumePacket {
  return {
    feature_card: maximalCard(),
    last_decisions: decisionsNewestFirst(),
    open_blockers: [
      "need clarity on 24h window from finance",
      "waiting on infra approval for redis access",
    ],
    next_action: "write integration test for 409 on duplicate key",
  };
}

export function overBudgetPacket(): ResumePacket {
  return {
    feature_card: overBudgetCard(),
    last_decisions: decisionsNewestFirst(),
    open_blockers: [
      "need clarity on 24h window from finance",
      "waiting on infra approval for redis access",
    ],
    next_action: "write integration test for 409 on duplicate key",
  };
}
