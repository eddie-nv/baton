#!/usr/bin/env tsx
/**
 * Seed a demo room for the two-agent handoff demo (M5).
 *
 * Creates a room titled "hackathon-demo", seeds one feature
 * (`feat_payments_idempotency`) with a realistic event trail, then
 * prints paste-ready MCP config snippets for Claude Code and Cursor.
 *
 * Usage:
 *   npm run seed                                    # localhost:3000
 *   BATON_API_URL=https://mcp.baton npm run seed
 */

import { countTokens, CARD_BUDGET } from "@baton/shared";

const BASE_URL = process.env["BATON_API_URL"] ?? "http://localhost:3000";
const ROOM_TITLE = "hackathon-demo";
const FEATURE_ID = "feat_payments_idempotency";
const ACTOR_ID = "seed-script";

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
    const text = await res.text();
    throw new Error(`${tool} failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as ApiSuccess<T>;
  return json.data;
}

async function main(): Promise<void> {
  console.log(`[seed] backend: ${BASE_URL}\n`);

  // 1. Room
  const room = await mcp<{ room_id: string; project_id: string }>(
    "create_room",
    { title: ROOM_TITLE },
  );
  console.log(`✓ created room  ${room.room_id}`);
  console.log(`  project_id     ${room.project_id}`);

  // 2. Seed events. Narrative:
  //    - branch: feat/payments-idempotency cut from release/payments-v2
  //    - two hypotheses raised, one failed test
  //    - decision made → next_action set, hypotheses cleared
  const events: Array<{
    type: string;
    payload: Record<string, unknown>;
  }> = [
    {
      type: "action.branch",
      payload: {
        branch: "feat/payments-idempotency",
        parent_branch: "release/payments-v2",
        base_sha: "abc1234",
      },
    },
    {
      type: "action.edit",
      payload: { files: ["src/payments/charge.ts"] },
    },
    {
      type: "hypothesis.raised",
      payload: { hypothesis: "bug is in the ledger double-write under retry" },
    },
    {
      type: "hypothesis.raised",
      payload: { hypothesis: "middleware order places dedupe after logging" },
    },
    {
      type: "error.test",
      payload: {
        signature: "duplicate_charge_on_retry",
        summary: "POST /charge twice yields two ledger entries",
      },
    },
    {
      type: "decision.made",
      payload: {
        text: "adopt Idempotency-Key middleware in front of /charge",
        next_action: "write integration test for 409 on duplicate key",
      },
    },
  ];

  for (const evt of events) {
    const out = await mcp<{ event_id: string; card_updated: boolean }>(
      "append_event",
      {
        room_id: room.room_id,
        feature_id: FEATURE_ID,
        type: evt.type,
        payload: evt.payload,
        actor_id: ACTOR_ID,
      },
      room.room_id,
    );
    console.log(`  + ${evt.type.padEnd(20)} ${out.event_id}`);
  }

  // 3. Sanity-check the card fits budget
  const card = await mcp<Record<string, unknown>>(
    "get_feature_card",
    { room_id: room.room_id, feature_id: FEATURE_ID },
    room.room_id,
  );
  const tokens = countTokens(card);
  console.log(
    `\n✓ feature card ${tokens} / ${CARD_BUDGET} tokens (${
      tokens <= CARD_BUDGET ? "ok" : "OVER BUDGET"
    })`,
  );

  // 4. Paste-ready snippets
  const localBinPath =
    "/Users/eddie/Documents/business/baton/packages/mcp-shim/dist/bin.js";
  const addLine = `claude mcp add baton --env BATON_API_URL=${BASE_URL} --env BATON_ROOM_ID=${room.room_id} --env BATON_ACTOR_ID=you@claude-code --env BATON_FEATURE_ID=${FEATURE_ID} -- node ${localBinPath}`;
  const cursorSnippet = JSON.stringify(
    {
      mcpServers: {
        baton: {
          command: "node",
          args: [localBinPath],
          env: {
            BATON_API_URL: BASE_URL,
            BATON_ROOM_ID: room.room_id,
            BATON_ACTOR_ID: "you@cursor",
            BATON_FEATURE_ID: FEATURE_ID,
          },
        },
      },
    },
    null,
    2,
  );

  console.log("\n──────────────────────────────────────────────");
  console.log("Paste-ready — Claude Code (run from your shell)");
  console.log("──────────────────────────────────────────────");
  console.log(addLine);
  console.log("\n──────────────────────────────────────────────");
  console.log("Paste-ready — Cursor (add to .cursor/mcp.json)");
  console.log("──────────────────────────────────────────────");
  console.log(cursorSnippet);
  console.log("");
  console.log("After pasting, restart both editors. Same BATON_ROOM_ID");
  console.log("in both means they share the feature card live.");
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[seed] fatal: ${msg}`);
  process.exit(1);
});
