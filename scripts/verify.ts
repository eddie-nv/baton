#!/usr/bin/env tsx
/**
 * End-to-end smoke test over HTTP.
 *
 * Exercises all 5 tools in sequence against a running Baton backend,
 * asserts response shapes, and enforces token caps (500/1500) against
 * the real tokenizer. Exits non-zero on the first failure.
 *
 * Usage:
 *   npm run verify                  # hits BATON_API_URL or localhost:3000
 *   BATON_API_URL=https://mcp.baton npm run verify
 *
 * Prereqs:
 *   - Redis Stack running (docker compose up -d redis)
 *   - Backend running (npm run dev:backend)
 */

import {
  countTokens,
  CARD_BUDGET,
  PACKET_BUDGET,
  type FeatureCard,
  type ResumePacket,
} from "@baton/shared";

const BASE_URL = process.env["BATON_API_URL"] ?? "http://localhost:3000";

interface ApiSuccess<T> {
  data: T;
}
interface ApiError {
  error: { code: string; message: string };
}

async function mcp<T>(
  tool: string,
  body: unknown,
  bearerRoomId?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (bearerRoomId !== undefined) {
    headers["Authorization"] = `Bearer ${bearerRoomId}`;
  }
  const res = await fetch(`${BASE_URL}/api/mcp/${tool}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${tool} failed: HTTP ${res.status} — ${text}`);
  }
  const json = (await res.json()) as ApiSuccess<T>;
  return json.data;
}

let failures = 0;
function check(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`);
    failures += 1;
  }
}

async function main(): Promise<void> {
  console.log(`[verify] backend: ${BASE_URL}\n`);

  // ── Health ────────────────────────────────────────────────
  console.log("GET /health");
  const healthRes = await fetch(`${BASE_URL}/health`);
  const health = (await healthRes.json()) as { ok: boolean };
  check(healthRes.status === 200 && health.ok === true, "returns {ok:true}");

  // ── create_room ───────────────────────────────────────────
  console.log("\ncreate_room");
  const room = await mcp<{ room_id: string; project_id: string }>(
    "create_room",
    { title: "verify script run" },
  );
  check(/^room_[A-Za-z0-9_-]+$/.test(room.room_id), `room_id = ${room.room_id}`);
  check(
    /^proj_[A-Za-z0-9_-]+$/.test(room.project_id),
    `project_id = ${room.project_id}`,
  );

  const featureId = `feat_verify_${Date.now()}`;

  // ── append_event × 3 ──────────────────────────────────────
  console.log("\nappend_event (action.branch, hypothesis.raised, decision.made)");
  const branchEvent = await mcp<{ event_id: string; card_updated: boolean }>(
    "append_event",
    {
      room_id: room.room_id,
      feature_id: featureId,
      type: "action.branch",
      payload: {
        branch: "feat/verify-branch",
        parent_branch: "main",
        base_sha: "abc1234",
      },
      actor_id: "verify-script",
    },
    room.room_id,
  );
  check(
    branchEvent.card_updated === true,
    "action.branch → card_updated: true",
  );
  check(
    /^evt_[A-Za-z0-9_-]+$/.test(branchEvent.event_id),
    `event_id = ${branchEvent.event_id}`,
  );

  await mcp("append_event", {
    room_id: room.room_id,
    feature_id: featureId,
    type: "hypothesis.raised",
    payload: { hypothesis: "verify suspects the cache ttl" },
    actor_id: "verify-script",
  }, room.room_id);

  await mcp("append_event", {
    room_id: room.room_id,
    feature_id: featureId,
    type: "decision.made",
    payload: {
      text: "adopt approach A",
      next_action: "write migration script",
    },
    actor_id: "verify-script",
  }, room.room_id);

  // ── get_feature_card ──────────────────────────────────────
  console.log("\nget_feature_card");
  const card = await mcp<FeatureCard>(
    "get_feature_card",
    { room_id: room.room_id, feature_id: featureId },
    room.room_id,
  );
  check(card.feature_id === featureId, "card.feature_id matches");
  check(card.git.branch === "feat/verify-branch", "card.git.branch is set");
  check(
    card.next_action === "write migration script",
    "card.next_action reflects the decision",
  );
  check(
    card.hypotheses.length === 0,
    "decision.made cleared hypotheses (compactor verified end-to-end)",
  );
  const cardTokens = countTokens(card);
  check(
    cardTokens <= CARD_BUDGET,
    `card fits budget: ${cardTokens} ≤ ${CARD_BUDGET}`,
  );

  // ── write_checkpoint ──────────────────────────────────────
  console.log("\nwrite_checkpoint");
  const before = Date.now();
  const ck = await mcp<{ checkpoint_id: string; expires_at: number }>(
    "write_checkpoint",
    {
      room_id: room.room_id,
      feature_id: featureId,
      session_id: "sess_verify_1",
      next_action: "resume from the verify script checkpoint",
      blockers: ["needs infra approval"],
    },
    room.room_id,
  );
  check(
    /^ck_[A-Za-z0-9_-]+$/.test(ck.checkpoint_id),
    `checkpoint_id = ${ck.checkpoint_id}`,
  );
  check(
    ck.expires_at > before + 6 * 24 * 60 * 60 * 1000,
    "expires_at ≈ 7 days out",
  );

  // ── get_resume_packet ─────────────────────────────────────
  console.log("\nget_resume_packet");
  const packet = await mcp<ResumePacket>(
    "get_resume_packet",
    {
      room_id: room.room_id,
      feature_id: featureId,
      session_id: "sess_verify_1",
    },
    room.room_id,
  );
  check(
    packet.feature_card.feature_id === featureId,
    "packet wraps the right feature_card",
  );
  check(packet.last_decisions.length >= 1, "packet has at least 1 decision");
  check(
    packet.next_action === "resume from the verify script checkpoint",
    "packet picks up the checkpoint's next_action",
  );
  check(
    packet.open_blockers.includes("needs infra approval"),
    "packet surfaces the checkpoint's blockers",
  );
  const packetTokens = countTokens(packet);
  check(
    packetTokens <= PACKET_BUDGET,
    `packet fits budget: ${packetTokens} ≤ ${PACKET_BUDGET}`,
  );

  // ── Error paths ───────────────────────────────────────────
  console.log("\nerror paths");
  const bogus = await fetch(`${BASE_URL}/api/mcp/bogus_tool`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  check(bogus.status === 404, "unknown tool → 404");

  const unauth = await fetch(`${BASE_URL}/api/mcp/get_feature_card`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ room_id: "x", feature_id: "y" }),
  });
  check(unauth.status === 401, "missing bearer → 401");
  const unauthBody = (await unauth.json()) as ApiError;
  check(unauthBody.error.code === "unauthorized", "error envelope: unauthorized");

  // ── Summary ───────────────────────────────────────────────
  if (failures > 0) {
    console.error(`\n✗ verify failed: ${failures} check(s) did not pass`);
    process.exit(1);
  }
  console.log("\n✓ all verify checks passed");
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[verify] fatal: ${msg}`);
  process.exit(1);
});
