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
import { countTokens, CARD_BUDGET } from "@baton/shared";

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

const ALICE = "alice@claude-code";
const BOB = "bob@cursor";
const CAROL = "carol@claude-code";
const DAN = "dan@cursor";

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
              summary: "POST /charge twice yields two ledger entries",
            },
          },
          {
            type: "hypothesis.raised",
            actor: ALICE,
            payload: { hypothesis: "ledger double-write under retry — race in commit ordering" },
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
              summary: "swapping ledger write order breaks the audit invariant",
            },
          },
          {
            type: "hypothesis.raised",
            actor: ALICE,
            payload: { hypothesis: "middleware order: dedupe runs after request logging" },
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
              text: "adopt Idempotency-Key middleware in front of /charge, before logging",
              next_action: "write integration test for 409 on duplicate Idempotency-Key",
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
          {
            type: "action.edit",
            actor: BOB,
            payload: { files: ["test/payments/charge.integration.test.ts"] },
          },
          {
            type: "action.commit",
            actor: BOB,
            payload: {
              sha: "d4e5f6a",
              dirty_files: ["test/payments/charge.integration.test.ts"],
            },
          },
        ],
        checkpoint: {
          session_id: "sess_alice_pay_idem",
          next_action: "write integration test for 409 on duplicate Idempotency-Key",
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
            payload: { hypothesis: "every refund needs actor_id + reason recorded" },
          },
          {
            type: "decision.made",
            actor: ALICE,
            payload: {
              text: "block until legal confirms PII retention rules for actor_id storage",
              next_action: "follow up with legal on GDPR retention window",
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
            payload: { hypothesis: "ECB rates with 1h cache covers 99% of volume" },
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
              text: "use European Central Bank rates with 1h Redis cache",
              next_action: "ship",
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
            payload: { hypothesis: "Google's PKCE callback drops state when session middleware reorders cookies" },
          },
          {
            type: "error.test",
            actor: CAROL,
            payload: {
              signature: "oauth_state_mismatch_in_callback",
              summary: "callback receives oauth state but cookie is gone by then",
            },
          },
          {
            type: "hypothesis.raised",
            actor: CAROL,
            payload: { hypothesis: "session middleware runs before oauth state validation — wrong order" },
          },
          {
            type: "action.edit",
            actor: CAROL,
            payload: { files: ["src/auth/middleware.ts"] },
          },
          {
            type: "decision.made",
            actor: CAROL,
            payload: {
              text: "extract oauth state validation into its own middleware, run before session",
              next_action: "rip out the inline state check in oauth.ts and re-test the Google flow end-to-end",
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
          next_action: "rip out the inline state check in oauth.ts and re-test the Google flow end-to-end",
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
            payload: { hypothesis: "rotation needs to be idempotent across the 3 web replicas" },
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
              summary: "concurrent rotation across replicas invalidates legit sessions",
            },
          },
          {
            type: "hypothesis.raised",
            actor: DAN,
            payload: { hypothesis: "use Redis SET NX with rotation_in_progress lock per session" },
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
            payload: { hypothesis: "use cosine distance with 1536-dim text-embedding-3-small vectors" },
          },
          {
            type: "action.commit",
            actor: ALICE,
            payload: { sha: "abcdef0", dirty_files: ["src/search/embeddings.ts"] },
          },
          {
            type: "decision.made",
            actor: ALICE,
            payload: {
              text: "FT.CREATE with VECTOR field type, COSINE distance, 1536 dims",
              next_action: "ship behind a feature flag",
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
            payload: { hypothesis: "two-stage retrieval: vector first, BM25 rerank top 50" },
          },
          {
            type: "hypothesis.raised",
            actor: ALICE,
            payload: { hypothesis: "fall back to text-only on embedding API outage" },
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
  for (const row of summary) {
    const features = await fetch(
      `${BASE_URL}/api/admin/rooms/${row.room_id}/features`,
    ).then((r) => r.json() as Promise<ApiSuccess<{ features: unknown[] }>>);
    for (const f of features.data.features) {
      const tokens = countTokens(f);
      const tag = tokens <= CARD_BUDGET ? "ok" : "OVER";
      const fid = (f as { feature_id: string }).feature_id;
      console.log(`  ${tag.padEnd(4)} ${tokens.toString().padStart(4)} / ${CARD_BUDGET}  ${fid}`);
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
