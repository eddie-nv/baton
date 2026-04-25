#!/usr/bin/env tsx
/**
 * Seed Baton with realistic, narratively-coherent demo data.
 *
 * Three rooms × six features × ~50 events. Includes blocked, merged, and
 * in-progress features, multi-actor handoffs, dead-end hypotheses, and
 * session checkpoints — i.e. the kind of state you actually want a
 * dashboard to render.
 *
 * Wipes ALL existing Baton keys (rooms, features, event streams,
 * checkpoints) before re-seeding so repeated runs are idempotent.
 *
 *   npm run seed
 *   BATON_API_URL=https://mcp.baton npm run seed
 */

import { createClient } from "redis";
import {
  countTokens,
  CARD_BUDGET,
  PACKET_BUDGET,
  type ResumePacket,
} from "@baton/shared";

const BASE_URL = process.env["BATON_API_URL"] ?? "http://localhost:3000";
const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

interface ApiSuccess<T> {
  data: T;
}

async function mcp<T>(
  tool: string,
  body: unknown,
  bearerRoomId?: string,
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (bearerRoomId !== undefined) headers["Authorization"] = `Bearer ${bearerRoomId}`;
  const res = await fetch(`${BASE_URL}/api/mcp/${tool}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${tool} failed (${res.status}): ${await res.text()}`);
  }
  return ((await res.json()) as ApiSuccess<T>).data;
}

// ─────────────────────────────────────────────────────────────
// Wipe — direct Redis since the backend exposes no destructive admin API
// ─────────────────────────────────────────────────────────────

async function wipe(): Promise<void> {
  const client = createClient({ url: REDIS_URL });
  await client.connect();
  try {
    const patterns = ["room:*", "feature:*", "events:*", "checkpoint:*", "session:*", "lock:*"];
    let deleted = 0;
    for (const pattern of patterns) {
      let cursor: number = 0;
      do {
        const reply = await client.scan(cursor, { MATCH: pattern, COUNT: 500 });
        cursor = Number(reply.cursor);
        if (reply.keys.length > 0) {
          await client.del(reply.keys);
          deleted += reply.keys.length;
        }
      } while (cursor !== 0);
    }
    console.log(`[seed] wiped ${deleted} key${deleted === 1 ? "" : "s"} from Redis\n`);
  } finally {
    await client.quit();
  }
}

// ─────────────────────────────────────────────────────────────
// Scenario types
// ─────────────────────────────────────────────────────────────

interface EventSpec {
  type: string;
  actor: string;
  payload: Record<string, unknown>;
}

interface CheckpointSpec {
  session_id: string;
  next_action: string;
  blockers: string[];
}

interface FeatureScenario {
  feature_id: string;
  events: EventSpec[];
  checkpoint?: CheckpointSpec;
}

interface RoomScenario {
  title: string;
  project_id: string;
  features: FeatureScenario[];
}

// ─────────────────────────────────────────────────────────────
// Scenarios
// ─────────────────────────────────────────────────────────────

// Agent actors — surface (claude-code | cursor | codex | claude-desktop | windsurf)
const ALICE = "alice@claude-code";
const BOB = "bob@cursor";
const CAROL = "carol@claude-code";
const DAN = "dan@cursor";
const EDDIE = "eddie@claude-code";       // staff-eng / architect persona
const MIRA = "mira@windsurf";             // frontend / DX
const JONAH = "jonah@codex";              // codex CLI agent
const SAMI = "sami@claude-desktop";       // pairs from desktop, no IDE
// Humans + automation join the same rooms via the same MCP tools.
const OLIVIA = "olivia@human";            // PM, ratifies architectural decisions
const SECBOT = "secbot@github-actions";   // security CI bot, opens fixes from scans
const PRIYA = "priya@human";              // staff backend reviewer (human)

const SCENARIOS: RoomScenario[] = [
  {
    title: "release/payments-v2",
    project_id: "proj_payments",
    features: [
      {
        feature_id: "feat_payments_idempotency",
        events: [
          {
            type: "action.branch",
            actor: ALICE,
            payload: {
              branch: "feat/payments-idempotency",
              parent_branch: "release/payments-v2",
              base_sha: "abc1234",
            },
          },
          {
            type: "action.edit",
            actor: ALICE,
            payload: { files: ["src/payments/charge.ts"] },
          },
          {
            type: "error.test",
            actor: ALICE,
            payload: {
              signature: "duplicate_charge_on_retry",
              summary:
                "POST /charge with the same Idempotency-Key replayed within 200ms produces two ledger rows; SDK retry policy is the trigger seen in prod incident INC-2811",
            },
          },
          {
            type: "hypothesis.raised",
            actor: ALICE,
            payload: {
              hypothesis:
                "ledger double-write under retry — the dedupe check reads from a replica that hasn't seen the first INSERT yet, so both requests pass the 'no prior charge' guard",
            },
          },
          {
            type: "action.edit",
            actor: ALICE,
            payload: { files: ["src/payments/ledger.ts"] },
          },
          {
            type: "error.test",
            actor: ALICE,
            payload: {
              signature: "audit_log_invariant_broken",
              summary:
                "swapping ledger write order so the audit row writes first breaks the invariant that audit_id == ledger_id; downstream reconciliation job crashes on the unmatched audit row",
            },
          },
          {
            type: "hypothesis.raised",
            actor: ALICE,
            payload: {
              hypothesis:
                "middleware order is wrong: dedupe currently runs after request logging, so logger.info already emits before we can short-circuit duplicates with a 409",
            },
          },
          {
            type: "action.edit",
            actor: ALICE,
            payload: { files: ["src/payments/middleware.ts", "src/payments/charge.ts"] },
          },
          {
            type: "decision.made",
            actor: ALICE,
            payload: {
              text: "adopt an Idempotency-Key middleware in front of /charge, mounted before logging; key persisted to Redis with a 24h TTL and a SET NX guard, with the original 200 response cached so retries get the same body",
              next_action:
                "write the integration test that asserts 409 on a duplicate Idempotency-Key within the TTL window and verify the cached body is byte-identical",
            },
          },
          {
            type: "action.commit",
            actor: ALICE,
            payload: {
              sha: "a1b2c3d",
              dirty_files: ["src/payments/middleware.ts", "src/payments/charge.ts"],
            },
          },
          {
            type: "session.pause",
            actor: ALICE,
            payload: { session_id: "sess_alice_pay_idem" },
          },
          // Bob (cursor) picks up the test work overnight.
          {
            type: "action.edit",
            actor: BOB,
            payload: { files: ["test/payments/charge.integration.test.ts"] },
          },
          {
            type: "error.test",
            actor: BOB,
            payload: {
              signature: "redis_eviction_under_memory_pressure",
              summary:
                "when the Redis maxmemory policy is allkeys-lru the Idempotency-Key entry can be evicted before the TTL expires; staging repro shows this happens within ~6 minutes under the synthetic load test",
            },
          },
          {
            type: "action.commit",
            actor: BOB,
            payload: {
              sha: "d4e5f6a",
              dirty_files: ["test/payments/charge.integration.test.ts"],
            },
          },
          // Priya (human reviewer) lands a code-review nit during async review.
          {
            type: "hypothesis.raised",
            actor: PRIYA,
            payload: {
              hypothesis:
                "switch the eviction policy on the payments Redis to volatile-ttl so Idempotency-Key entries can never be evicted before their TTL — payments shouldn't share a Redis with anything that would push it under memory pressure anyway",
            },
          },
        ],
        checkpoint: {
          session_id: "sess_alice_pay_idem",
          next_action:
            "land the volatile-ttl eviction-policy change on the payments Redis, then re-run the soak test that reproduced the eviction issue and confirm zero Idempotency-Key losses over a 30m window",
          blockers: [],
        },
      },
      {
        feature_id: "feat_refund_audit_trail",
        events: [
          {
            type: "action.branch",
            actor: ALICE,
            payload: {
              branch: "feat/refund-audit-trail",
              parent_branch: "release/payments-v2",
              base_sha: "abc1234",
            },
          },
          {
            type: "action.edit",
            actor: ALICE,
            payload: { files: ["src/payments/refund.ts"] },
          },
          {
            type: "hypothesis.raised",
            actor: ALICE,
            payload: {
              hypothesis:
                "every refund needs actor_id + reason recorded so support can answer 'who refunded this and why' without paging the on-call engineer who pulled the SQL last quarter",
            },
          },
          // PM (human) raises the compliance constraint that becomes the blocker.
          {
            type: "hypothesis.raised",
            actor: OLIVIA,
            payload: {
              hypothesis:
                "actor_id is PII when the actor is a human support agent, so retention rules apply — legal needs to confirm the GDPR window before we lock in the schema",
            },
          },
          {
            type: "decision.made",
            actor: ALICE,
            payload: {
              text: "block on legal confirming PII retention rules for actor_id storage; the refund flow itself is ready, but the audit row schema can't be frozen until we know whether actor_id needs hashing or a separate PII table with a retention TTL",
              next_action:
                "wait on legal's response on the GDPR retention window for support-agent identifiers; once unblocked, decide between hashed actor_id inline vs. a separate pii.actors table referenced by FK",
              state: "blocked",
            },
          },
        ],
      },
      {
        feature_id: "feat_currency_conversion",
        events: [
          {
            type: "action.branch",
            actor: BOB,
            payload: {
              branch: "feat/currency-conversion",
              parent_branch: "release/payments-v2",
              base_sha: "abc1234",
            },
          },
          {
            type: "action.edit",
            actor: BOB,
            payload: { files: ["src/payments/currency.ts"] },
          },
          {
            type: "hypothesis.raised",
            actor: BOB,
            payload: {
              hypothesis:
                "ECB reference rates published daily at 16:00 CET with a 1h Redis cache covers 99% of volume — the missing 1% is JPY/SGD pairs traded outside ECB hours, which we already settle T+1",
            },
          },
          // Mira (windsurf) reviews the API surface for the dashboard chip.
          {
            type: "action.edit",
            actor: MIRA,
            payload: { files: ["src/web/components/CurrencyChip.tsx"] },
          },
          {
            type: "action.commit",
            actor: BOB,
            payload: { sha: "e5f6a78", dirty_files: ["src/payments/currency.ts"] },
          },
          {
            type: "decision.made",
            actor: BOB,
            payload: {
              text: "use European Central Bank reference rates with a 1h Redis cache, fall back to the previous day's snapshot if the ECB feed 4xx's, and surface the rate timestamp on the receipt so support can reconcile after the fact",
              next_action: "ship behind the existing ff_currency_v2 flag, ramp 5% → 25% → 100% over a week",
            },
          },
          {
            type: "action.commit",
            actor: BOB,
            payload: { sha: "f6a7b89", dirty_files: [] },
          },
          {
            type: "feature.merged",
            actor: BOB,
            payload: { merged_sha: "deadbeef" },
          },
        ],
      },
      // ─────────────────────────────────────────────────────────
      // Multi-agent collaboration designed to overflow the 1500-token
      // ResumePacket budget. Five actors hand off across 25+ events;
      // three verbose decisions populate last_decisions; failed_attempts
      // and hypotheses fill the embedded card. truncatePacket should
      // drop the oldest decision before return.
      // ─────────────────────────────────────────────────────────
      {
        feature_id: "feat_webhook_replay_protection",
        events: [
          {
            type: "action.branch",
            actor: ALICE,
            payload: {
              branch: "feat/webhook-replay-protection",
              parent_branch: "release/payments-v2",
              base_sha: "abc1234",
            },
          },
          {
            type: "action.edit",
            actor: ALICE,
            payload: { files: ["src/payments/webhooks/stripe.ts"] },
          },
          {
            type: "error.test",
            actor: ALICE,
            payload: {
              signature: "duplicate_webhook_double_credit",
              summary:
                "Stripe redelivers charge.succeeded within 30s when our 200 races their internal timeout; the duplicate webhook re-credits the customer wallet because event_id dedupe is missing on the wallet path",
            },
          },
          {
            type: "hypothesis.raised",
            actor: ALICE,
            payload: {
              hypothesis:
                "process the wallet credit inside the same transaction as the audit row insert, keyed on stripe_event_id with a UNIQUE constraint, so the second delivery 23505's harmlessly",
            },
          },
          {
            type: "action.edit",
            actor: ALICE,
            payload: { files: ["src/payments/wallet/credit.ts"] },
          },
          {
            type: "error.test",
            actor: ALICE,
            payload: {
              signature: "hmac_signature_mismatch_on_retry",
              summary:
                "Stripe's retried webhook carries a fresh signature header but the same body; our verifier was caching the (body, signature) tuple and failing the second delivery as 'replay' even though it's legitimate",
            },
          },
          {
            type: "hypothesis.raised",
            actor: ALICE,
            payload: {
              hypothesis:
                "verify HMAC against the body alone and treat the signature header as a freshness check (5min skew); idempotency must live one layer above signature verification",
            },
          },
          {
            type: "action.commit",
            actor: ALICE,
            payload: {
              sha: "11aa22b",
              dirty_files: ["src/payments/webhooks/stripe.ts", "src/payments/wallet/credit.ts"],
            },
          },
          {
            type: "session.pause",
            actor: ALICE,
            payload: { session_id: "sess_alice_webhook" },
          },
          // Eddie (architect) joins, frames the broader design.
          {
            type: "action.edit",
            actor: EDDIE,
            payload: {
              files: [
                "src/payments/webhooks/stripe.ts",
                "src/payments/webhooks/dedupe.ts",
                "migrations/0042_webhook_records.sql",
              ],
            },
          },
          {
            type: "hypothesis.raised",
            actor: EDDIE,
            payload: {
              hypothesis:
                "two-layer dedupe: hot Redis SET NX on stripe_event_id with 24h TTL serves the fast path, and a permanent webhook_records table written inside the wallet transaction is the correctness anchor for replica failovers",
            },
          },
          {
            type: "error.test",
            actor: EDDIE,
            payload: {
              signature: "redis_lock_held_after_replica_failover",
              summary:
                "after a Redis primary failover the SET NX key is gone but the records table still has the row; the cold path must fall through to the table or we'll double-process anything that was in flight during the failover window",
            },
          },
          // Decision #1 — eddie (architect) lays out the full design.
          {
            type: "decision.made",
            actor: EDDIE,
            payload: {
              text:
                "Adopt a two-layer webhook dedupe. Hot path: Redis SET NX on stripe_event_id with a 24h TTL acts as the fast cache; cold path: every webhook handler writes (event_id, processed_at, payload_hash) to a new webhook_records table inside the same transaction that mutates wallet or ledger state. The records table is authoritative — Redis is the cache, never the source of truth. HMAC verification uses crypto.timingSafeEqual against the raw body bytes (not the parsed JSON, since whitespace and key ordering may differ across Stripe SDK versions) and is decoupled from idempotency entirely; signature validity is a 401 condition, duplicate event_id is a 200 with the cached response body. This design survives Redis primary failovers (records table is the source of truth, Redis cold is acceptable), bounds memory growth (24h TTL plus Stripe's 3-day retry window caps worst-case backfill at ~3 days), and unblocks the wallet-credit path that ALICE was stuck on. Failure modes worth calling out: (1) records table grows unboundedly — partition by processed_at month once we cross 5M rows, projected ~9 months out; (2) the wallet-mutation transaction now holds a row lock on webhook_records for its duration, which is fine for synchronous handlers but unsafe for async (deferred capture, dispute lifecycle) — those need a separate pattern that SAMI flagged below. Reject this design and revisit if records table grows past 50M rows or if Stripe changes their retry policy beyond 3 days.",
              next_action:
                "land migration 0042_webhook_records with a UNIQUE constraint on (source, event_id), dual-write through both Redis and Postgres behind ff_webhook_dedupe_v2 for one week, then flip reads to the records table and remove the inline event_id check in src/payments/webhooks/stripe.ts:127; also wire a Datadog metric on the records-table fall-through rate so SRE sees Redis-cache misses without parsing logs",
            },
          },
          {
            type: "action.commit",
            actor: EDDIE,
            payload: {
              sha: "33cc44d",
              dirty_files: [
                "src/payments/webhooks/dedupe.ts",
                "migrations/0042_webhook_records.sql",
              ],
            },
          },
          // Bob (cursor) picks up implementation, hits a snag.
          {
            type: "action.edit",
            actor: BOB,
            payload: { files: ["src/payments/webhooks/dedupe.ts"] },
          },
          {
            type: "error.test",
            actor: BOB,
            payload: {
              signature: "stripe_event_id_collides_with_legacy_v1",
              summary:
                "legacy v1 webhook events use a non-prefixed UUID for event_id; Stripe's current evt_ prefix collides with a row backfilled by the 2023 migration when only the suffix is compared — UNIQUE constraint fires on legitimately-new webhooks",
            },
          },
          {
            type: "hypothesis.raised",
            actor: BOB,
            payload: {
              hypothesis:
                "store event_id with its source prefix (stripe:evt_..., legacy:uuid:...) so v1 and v2 IDs share a column without collisions; UNIQUE on (source, event_id) instead of (event_id) alone",
            },
          },
          {
            type: "action.commit",
            actor: BOB,
            payload: {
              sha: "55ee66f",
              dirty_files: ["src/payments/webhooks/dedupe.ts", "migrations/0042_webhook_records.sql"],
            },
          },
          // Decision #2 — olivia (PM/human) signs off on rollout shape.
          {
            type: "decision.made",
            actor: OLIVIA,
            payload: {
              text:
                "Approve EDDIE's two-layer design with three product constraints. (1) Rollout cadence is 1% → 10% → 50% → 100% over 14 days, gated on the wallet-reconciliation dashboard staying flat-to-green for at least 24h between each step; if reconciliation drift exceeds $250 at any tier we hold and re-evaluate. (2) We will NOT carry forward the legacy v1 webhook events into the new records table during the migration — they are pre-2024 and outside the 24-month audit window finance cares about, and backfilling them would force a column-type compromise that's not worth carrying forever. (3) Support has been briefed that during the dual-write week, duplicate-webhook alerts in #payments-oncall will spike for the expected reason (each event hits both layers, both fire the dashboard alert); SAMI will mute the duplicate-webhook detector at the alerting layer through 2026-05-09 and re-enable it post-migration so we don't drop a real signal. Compliance signed off via legal review on 2026-04-22 contingent on payload_hash being a SHA-256 of the raw HTTP body bytes — not the parsed JSON — so we can prove byte-equivalence on chargeback disputes; this is the same body-bytes that HMAC verification operates on, so no new code path. The product/legal asks together mean we cannot ship this with payload_hash defined as JSON.stringify(parsed) shortcut even if it's faster — the audit-trail integrity matters more than the few microseconds of hashing.",
              next_action:
                "publish the rollout schedule to #payments and #engineering by EOD 2026-04-25, mute the duplicate-webhook alert through 2026-05-09 in PagerDuty, confirm with finance in writing that the v1 backfill exclusion is acceptable for the audit window, and add a CI assertion that payload_hash is computed from the raw body buffer and not the parsed JSON object",
            },
          },
          // SecBot opens an automated PR for the timing oracle.
          {
            type: "action.edit",
            actor: SECBOT,
            payload: { files: ["src/payments/webhooks/hmac.ts"] },
          },
          {
            type: "error.test",
            actor: SECBOT,
            payload: {
              signature: "hmac_constant_time_compare_missing",
              summary:
                "hmac.ts:42 uses === to compare the computed and provided signatures; CodeQL flags this as a timing oracle (CWE-208) because the comparison short-circuits on the first byte mismatch — exploitable to forge signatures byte-by-byte over enough requests",
            },
          },
          {
            type: "action.commit",
            actor: SECBOT,
            payload: {
              sha: "77aa88b",
              dirty_files: ["src/payments/webhooks/hmac.ts"],
            },
          },
          // Sami (claude-desktop, no IDE) reviews from a tablet, raises ops concern.
          {
            type: "hypothesis.raised",
            actor: SAMI,
            payload: {
              hypothesis:
                "the webhook_records write should NOT be in the same transaction as the wallet mutation when the webhook is for a deferred capture — those run async and the long-running tx will hold a row lock that blocks reconciliation queries",
            },
          },
          // Decision #3 — alice ratifies the final shape and unpauses the original session.
          {
            type: "decision.made",
            actor: ALICE,
            payload: {
              text:
                "Final shape: synchronous webhooks (charge.succeeded, charge.refunded, charge.failed) write the webhook_records row inside the same wallet transaction that mutates ledger state — atomic, replica-failover safe, locks held briefly. Async webhooks (deferred capture, dispute lifecycle, payout updates) write the webhook_records row first, COMMIT, then enqueue the wallet mutation as a job keyed on records.id; the queue worker re-reads the record by id at runtime, so a worker restart or a duplicate enqueue still produces exactly-once semantics on the wallet side. This addresses SAMI's lock-contention concern (the records-row write is short, and we never hold a row lock during async work) without losing the dedupe guarantee — the records row is itself the idempotency token, and the queue worker is idempotent on records.id by re-reading. We're keeping EDDIE's UNIQUE on (source, event_id) per BOB's legacy-v1 collision finding so the column can host both stripe:evt_* and legacy:uuid:* without ambiguity, and we're keeping crypto.timingSafeEqual per SECBOT's CWE-208 finding because constant-time comparison is non-negotiable for HMAC. OLIVIA's rollout schedule stands as written; the only delta is that async-webhook coverage ships in week 2 rather than day 1 to give the queue worker time to bake against synthetic load before it carries real traffic. Open follow-ups: (a) the queue worker needs its own dead-letter handling that routes records older than 24h to manual review rather than retrying forever; (b) reconciliation needs a new query that compares webhook_records.processed_at against ledger.created_at to detect any case where the wallet job runs but never commits.",
              next_action:
                "split src/payments/webhooks/dedupe.ts into syncDedupe (in-transaction, used by charge.* handlers) and asyncDedupe (records-then-enqueue, used by deferred capture and dispute handlers), wire the queue handler at src/payments/jobs/webhook_apply.ts with idempotent re-read semantics, and add a contract test in test/payments/webhooks/failover.spec.ts that simulates a Redis primary failover during an async webhook and asserts exactly-once wallet credit",
            },
          },
          {
            type: "action.commit",
            actor: ALICE,
            payload: {
              sha: "99cc11a",
              dirty_files: [
                "src/payments/webhooks/dedupe.ts",
                "src/payments/jobs/webhook_apply.ts",
              ],
            },
          },
          {
            type: "session.pause",
            actor: ALICE,
            payload: { session_id: "sess_alice_webhook_pt2" },
          },
        ],
        checkpoint: {
          session_id: "sess_alice_webhook_pt2",
          next_action:
            "split dedupe.ts into syncDedupe (in-tx) and asyncDedupe (records-then-queue), wire src/payments/jobs/webhook_apply.ts, and add the failover-during-async-webhook contract test before flipping ff_webhook_dedupe_v2 reads to the records table",
          blockers: [
            "finance must confirm in writing that excluding pre-2024 v1 webhook events from the records backfill is acceptable for the audit window",
            "SRE needs to size the webhook_records partitioning plan before we cross 5M rows; current projection puts us there in ~9 months at present volume",
          ],
        },
      },
    ],
  },
  {
    title: "release/auth-rewrite",
    project_id: "proj_auth",
    features: [
      {
        feature_id: "feat_oauth_pkce_migration",
        events: [
          {
            type: "action.branch",
            actor: CAROL,
            payload: {
              branch: "feat/oauth-pkce-migration",
              parent_branch: "release/auth-rewrite",
              base_sha: "5678def",
            },
          },
          {
            type: "action.edit",
            actor: CAROL,
            payload: { files: ["src/auth/oauth.ts", "src/auth/state.ts"] },
          },
          {
            type: "hypothesis.raised",
            actor: CAROL,
            payload: {
              hypothesis:
                "Google's PKCE callback drops state when session middleware reorders cookies — the SameSite=Lax change we shipped last sprint may have changed the cookie order on the redirect response",
            },
          },
          {
            type: "error.test",
            actor: CAROL,
            payload: {
              signature: "oauth_state_mismatch_in_callback",
              summary:
                "callback receives the oauth state query param but the matching cookie is missing by the time we read it; reproduces 100% on Safari 17 ITP, intermittently on Chrome with strict SameSite",
            },
          },
          {
            type: "hypothesis.raised",
            actor: CAROL,
            payload: {
              hypothesis:
                "session middleware runs before oauth state validation, so it overwrites the Set-Cookie response with its own session cookie and the state cookie never reaches the browser",
            },
          },
          {
            type: "action.edit",
            actor: CAROL,
            payload: { files: ["src/auth/middleware.ts"] },
          },
          // Jonah (codex agent) jumps in to add the regression test.
          {
            type: "action.edit",
            actor: JONAH,
            payload: { files: ["test/auth/oauth-callback.spec.ts"] },
          },
          {
            type: "error.test",
            actor: JONAH,
            payload: {
              signature: "state_cookie_evicted_by_session_set",
              summary:
                "Playwright repro: when middleware order is session→oauth, the second Set-Cookie for __session strips the prior __oauth_state cookie from the response on Safari/WebKit; Chrome accepts both but only because we got lucky with header order",
            },
          },
          {
            type: "decision.made",
            actor: CAROL,
            payload: {
              text:
                "extract oauth state validation into its own middleware mounted before session — the state cookie is short-lived (5min) and must not share a write path with the long-lived session cookie; also add an explicit Vary: Cookie on the callback response so CDN caching doesn't leak state across users",
              next_action:
                "rip out the inline state check in src/auth/oauth.ts and re-run the Google + GitHub flows end-to-end on Safari 17, Chrome stable, and Firefox; merge JONAH's Playwright spec as a regression guard",
            },
          },
          {
            type: "action.commit",
            actor: CAROL,
            payload: { sha: "1234abc", dirty_files: ["src/auth/middleware.ts"] },
          },
          {
            type: "session.pause",
            actor: CAROL,
            payload: { session_id: "sess_carol_oauth" },
          },
        ],
        checkpoint: {
          session_id: "sess_carol_oauth",
          next_action:
            "rip out the inline state check in src/auth/oauth.ts and re-test Google + GitHub flows on Safari 17, Chrome, and Firefox; verify JONAH's Playwright regression spec is green before requesting review",
          blockers: [],
        },
      },
      {
        feature_id: "feat_session_token_rotation",
        events: [
          {
            type: "action.branch",
            actor: DAN,
            payload: {
              branch: "feat/session-token-rotation",
              parent_branch: "release/auth-rewrite",
              base_sha: "5678def",
            },
          },
          {
            type: "action.edit",
            actor: DAN,
            payload: { files: ["src/auth/session.ts"] },
          },
          {
            type: "hypothesis.raised",
            actor: DAN,
            payload: {
              hypothesis:
                "rotation needs to be idempotent across the 3 web replicas — right now each replica decides independently when a session is 'old enough' to rotate, so a request load-balanced across two replicas in the rotation window mints two new tokens and invalidates both",
            },
          },
          {
            type: "action.edit",
            actor: DAN,
            payload: { files: ["src/auth/rotate.ts"] },
          },
          {
            type: "error.test",
            actor: DAN,
            payload: {
              signature: "double_rotation_invalidates_active_sessions",
              summary:
                "concurrent rotation across replicas: replica-1 mints token-B and writes it as current, replica-2 (still seeing token-A as current) mints token-C and overwrites; user's next request carries token-B which is now stale, so they get logged out",
            },
          },
          {
            type: "hypothesis.raised",
            actor: DAN,
            payload: {
              hypothesis:
                "use Redis SET NX with a rotation_in_progress lock keyed by session_id and a 2s TTL — only the replica that wins the lock rotates; everyone else reads the freshly-rotated token",
            },
          },
          // Eddie (architect) reviews and pushes back on the lock-based design.
          {
            type: "hypothesis.raised",
            actor: EDDIE,
            payload: {
              hypothesis:
                "skip the lock entirely: store token_version on the session row and have rotation use UPDATE ... WHERE token_version = $expected; the loser of the race simply re-reads the new version and uses it — no lock, no TTL to tune, and the conflict is resolved by the database not by us",
            },
          },
          {
            type: "decision.made",
            actor: DAN,
            payload: {
              text:
                "Adopt EDDIE's optimistic-version approach over the SET NX lock: token_version monotonic counter on the session row, UPDATE...WHERE version=$expected returns 0 rows for losers, losers re-fetch and use the winner's token. Avoids a Redis-only correctness dependency, removes the TTL-tuning footgun, and the SQL pattern matches what we already do for ledger writes — one idiom across the codebase.",
              next_action:
                "add token_version to the session schema (migration 0044), update rotate.ts to use the optimistic UPDATE pattern, and add a property test that runs N concurrent rotations and asserts exactly one survives with all losers converging on it",
            },
          },
        ],
      },
    ],
  },
  {
    title: "exp/redis-search",
    project_id: "proj_exp",
    features: [
      {
        feature_id: "feat_redis_vector_index",
        events: [
          {
            type: "action.branch",
            actor: ALICE,
            payload: {
              branch: "feat/redis-vector-index",
              parent_branch: "main",
              base_sha: "9abcdef",
            },
          },
          {
            type: "action.edit",
            actor: ALICE,
            payload: { files: ["src/search/embeddings.ts", "src/search/index.ts"] },
          },
          {
            type: "hypothesis.raised",
            actor: ALICE,
            payload: {
              hypothesis:
                "cosine distance with 1536-dim text-embedding-3-small vectors gives us recall comparable to ada-002 at ~1/5 the embedding cost; the dimensionality fits Redis Stack's HNSW limits without quantization",
            },
          },
          {
            type: "action.commit",
            actor: ALICE,
            payload: { sha: "abcdef0", dirty_files: ["src/search/embeddings.ts"] },
          },
          // Jonah (codex) benchmarks alternatives in parallel.
          {
            type: "action.edit",
            actor: JONAH,
            payload: { files: ["bench/embeddings_recall.ts"] },
          },
          {
            type: "hypothesis.raised",
            actor: JONAH,
            payload: {
              hypothesis:
                "INT8 quantization on the HNSW index drops recall@10 by <1% on our eval set and cuts the index from 6.2GB to 1.6GB — worth doing before we hit the per-pod memory ceiling",
            },
          },
          {
            type: "decision.made",
            actor: ALICE,
            payload: {
              text:
                "FT.CREATE with VECTOR HNSW field type, COSINE distance, 1536 dims, INT8 quantization per JONAH's bench (recall@10 unchanged, 4x memory reduction); EF_CONSTRUCTION=200 and M=16 from the Redis Stack defaults — we'll tune after we have prod query latencies",
              next_action: "ship behind ff_search_vector_v1, dark-launch reads for a week and compare top-10 overlap with the current BM25 results",
            },
          },
          {
            type: "action.commit",
            actor: ALICE,
            payload: { sha: "bcdef01", dirty_files: [] },
          },
          {
            type: "feature.merged",
            actor: ALICE,
            payload: { merged_sha: "cafebabe" },
          },
        ],
      },
      {
        feature_id: "feat_query_planner_v2",
        events: [
          {
            type: "action.branch",
            actor: ALICE,
            payload: {
              branch: "feat/query-planner-v2",
              parent_branch: "main",
              base_sha: "9abcdef",
            },
          },
          {
            type: "action.edit",
            actor: ALICE,
            payload: { files: ["src/search/planner.ts"] },
          },
          {
            type: "hypothesis.raised",
            actor: ALICE,
            payload: {
              hypothesis:
                "two-stage retrieval: vector for candidate generation (top 200), BM25 rerank to top 50 — the BM25 step grounds the result on exact-match signals (doc IDs, slugs) that the embedding misses",
            },
          },
          {
            type: "hypothesis.raised",
            actor: ALICE,
            payload: {
              hypothesis:
                "fall back to text-only on embedding API outage; the planner should detect circuit-breaker-open and skip stage 1, returning BM25-only results with a degraded=true flag in the response so the UI can hint at it",
            },
          },
          // Sami (claude-desktop) reviews, raises a UX concern.
          {
            type: "hypothesis.raised",
            actor: SAMI,
            payload: {
              hypothesis:
                "a 'degraded' flag in the response is invisible to most clients; better to keep the response shape stable and emit a structured log + Datadog metric so SRE sees the fallback rather than expecting every UI to handle a new field",
            },
          },
        ],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`[seed] backend: ${BASE_URL}`);
  console.log(`[seed] redis:   ${REDIS_URL}\n`);

  await wipe();

  const summary: Array<{ room: string; room_id: string; features: number; events: number }> = [];

  for (const room of SCENARIOS) {
    const created = await mcp<{ room_id: string; project_id: string }>(
      "create_room",
      { title: room.title, project_id: room.project_id },
    );
    console.log(`✓ room  ${created.room_id.padEnd(20)}  ${room.title}`);

    let eventCount = 0;
    for (const feature of room.features) {
      for (const evt of feature.events) {
        await mcp("append_event", {
          room_id: created.room_id,
          feature_id: feature.feature_id,
          type: evt.type,
          payload: evt.payload,
          actor_id: evt.actor,
        }, created.room_id);
        eventCount += 1;
      }
      if (feature.checkpoint !== undefined) {
        await mcp("write_checkpoint", {
          room_id: created.room_id,
          feature_id: feature.feature_id,
          session_id: feature.checkpoint.session_id,
          next_action: feature.checkpoint.next_action,
          blockers: feature.checkpoint.blockers,
        }, created.room_id);
      }
      console.log(`    ↳ ${feature.feature_id.padEnd(35)}  ${feature.events.length} events`);
    }

    summary.push({
      room: room.title,
      room_id: created.room_id,
      features: room.features.length,
      events: eventCount,
    });
  }

  // ─── token sanity sweep ─────────────────────────────────────
  console.log("\nfeature card token sweep:");
  const featureIdsByRoom = new Map<string, string[]>();
  for (const row of summary) {
    const features = await fetch(
      `${BASE_URL}/api/admin/rooms/${row.room_id}/features`,
    ).then((r) => r.json() as Promise<ApiSuccess<{ features: unknown[] }>>);
    const ids: string[] = [];
    for (const f of features.data.features) {
      const tokens = countTokens(f);
      const tag = tokens <= CARD_BUDGET ? "ok" : "OVER";
      const fid = (f as { feature_id: string }).feature_id;
      ids.push(fid);
      console.log(`  ${tag.padEnd(4)} ${tokens.toString().padStart(4)} / ${CARD_BUDGET}  ${fid}`);
    }
    featureIdsByRoom.set(row.room_id, ids);
  }

  // ─── resume packet token sweep ──────────────────────────────
  // The packet returned by get_resume_packet is post-truncation, so a
  // packet that fits exactly because oldest decisions were dropped is
  // the signal we want to see — last_decisions < emitted decisions or
  // headroom < 50 tokens both indicate the packet was clamped.
  //
  // Where a feature has a checkpoint, we sweep WITH session_id so the
  // checkpoint's blockers/next_action are merged into the packet — that's
  // the path agents actually take when resuming.
  console.log("\nresume packet token sweep:");
  for (const room of SCENARIOS) {
    const roomId = summary.find((r) => r.room === room.title)!.room_id;
    for (const feature of room.features) {
      const decisionsEmitted = feature.events.filter(
        (e) => e.type === "decision.made",
      ).length;
      const url =
        feature.checkpoint !== undefined
          ? `${BASE_URL}/api/mcp/get_resume_packet`
          : `${BASE_URL}/api/admin/rooms/${roomId}/features/${feature.feature_id}/resume`;
      let packet: ResumePacket;
      if (feature.checkpoint !== undefined) {
        packet = await mcp<ResumePacket>(
          "get_resume_packet",
          {
            room_id: roomId,
            feature_id: feature.feature_id,
            session_id: feature.checkpoint.session_id,
          },
          roomId,
        );
      } else {
        const res = await fetch(url);
        if (!res.ok) continue;
        const body = (await res.json()) as ApiSuccess<{ packet: ResumePacket }>;
        packet = body.data.packet;
      }
      const tokens = countTokens(packet);
      const headroom = PACKET_BUDGET - tokens;
      const truncated = packet.last_decisions.length < Math.min(decisionsEmitted, 3);
      const tag = truncated ? "TRUNC" : headroom < 50 ? "AT-CAP" : "ok";
      const ckpt = feature.checkpoint !== undefined ? "+ckpt" : "     ";
      console.log(
        `  ${tag.padEnd(6)} ${tokens.toString().padStart(4)} / ${PACKET_BUDGET}  decisions=${packet.last_decisions.length}/${Math.min(decisionsEmitted, 3)} ${ckpt}  ${feature.feature_id}`,
      );
    }
  }

  // ─── paste-ready snippets ────────────────────────────────────
  const inProgressRoom = summary.find((r) => r.room.includes("payments")) ?? summary[0]!;
  const localBin =
    "/Users/eddie/Documents/business/baton/packages/mcp-shim/dist/bin.js";
  const claudeCmd = [
    "claude mcp remove baton 2>/dev/null;",
    "claude mcp add baton",
    `--env BATON_API_URL=${BASE_URL}`,
    `--env BATON_ROOM_ID=${inProgressRoom.room_id}`,
    "--env BATON_ACTOR_ID=you@claude-code",
    "--env BATON_FEATURE_ID=feat_payments_idempotency",
    `-- node ${localBin}`,
  ].join(" ");

  console.log("\n──────────────────────────────────────────────");
  console.log(`Summary — ${summary.length} rooms, ${summary.reduce((s, r) => s + r.features, 0)} features, ${summary.reduce((s, r) => s + r.events, 0)} events`);
  console.log("──────────────────────────────────────────────");
  for (const row of summary) {
    console.log(`  ${row.room.padEnd(28)}  ${row.room_id}`);
  }

  console.log("\n──────────────────────────────────────────────");
  console.log("Re-register Claude Code (one line):");
  console.log("──────────────────────────────────────────────");
  console.log(claudeCmd);
  console.log("\nAfter pasting, restart Claude Code so the new BATON_ROOM_ID is picked up.");
  console.log("Open the dashboard at http://localhost:5173 (dev) or :3000 (prod).");
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[seed] fatal: ${msg}`);
  process.exit(1);
});
