#!/usr/bin/env tsx
/**
 * Demo seed grounded in THIS repo (baton itself).
 *
 * One room (`baton/main`), three features that reference real files,
 * commits, and decisions from the project's own history. Designed to be
 * the easy on-stage demo: "this is Baton tracking its own development".
 *
 * Additive: does NOT wipe existing rooms — appends a new `baton/main` room
 * alongside whatever is already there. Safe to run after `npm run seed`.
 *
 *   npm run seed:baton
 */

const BASE_URL = process.env["BATON_API_URL"] ?? "http://localhost:3000";

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

// Two agents pairing on baton itself.
const ED = "ed@claude-code";
const CLAUDE = "claude@claude-code";

const PARENT = "main";
// `a0d0652` is the current HEAD on main at the time of seeding.
const BASE_SHA = "a0d0652";

const FEATURES: FeatureScenario[] = [
  // ─────────────────────────────────────────────────────────────
  // 1. Merged: the seed script itself (commit 07ca974).
  // ─────────────────────────────────────────────────────────────
  {
    feature_id: "feat_realistic_seed",
    events: [
      {
        type: "action.branch",
        actor: ED,
        payload: {
          branch: "feat/realistic-seed",
          parent_branch: PARENT,
          base_sha: "f541beb",
        },
      },
      {
        type: "action.edit",
        actor: ED,
        payload: { files: ["scripts/seed.ts"] },
      },
      {
        type: "hypothesis.raised",
        actor: ED,
        payload: {
          hypothesis:
            "the demo needs to feel like real branch-state, not a list — multi-actor handoffs, dead-end hypotheses, blocked features, and at least one merged result",
        },
      },
      {
        type: "hypothesis.raised",
        actor: CLAUDE,
        payload: {
          hypothesis:
            "wipe Baton's Redis keys before seeding rather than diffing — the seed already represents a snapshot, so repeated runs should be idempotent the simple way",
        },
      },
      {
        type: "decision.made",
        actor: ED,
        payload: {
          text:
            "ship the seed as three rooms × six features × ~50 events with explicit wipe-first behavior; this is the data shape we want to optimize the dashboard against",
          next_action: "wire the seed npm script and a token-budget sanity sweep at the end so over-cap cards fail loudly",
        },
      },
      {
        type: "action.commit",
        actor: ED,
        payload: { sha: "07ca974", dirty_files: [] },
      },
      {
        type: "feature.merged",
        actor: ED,
        payload: { merged_sha: "07ca974" },
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────
  // 2. In-progress: extending the demo seed with multi-agent context
  //    (this conversation — uses real files we just edited).
  // ─────────────────────────────────────────────────────────────
  {
    feature_id: "feat_multi_agent_demo_seed",
    events: [
      {
        type: "action.branch",
        actor: ED,
        payload: {
          branch: "feat/multi-agent-demo-seed",
          parent_branch: PARENT,
          base_sha: BASE_SHA,
        },
      },
      {
        type: "action.edit",
        actor: ED,
        payload: { files: ["scripts/seed.ts"] },
      },
      {
        type: "hypothesis.raised",
        actor: ED,
        payload: {
          hypothesis:
            "the existing four actors (alice/bob/carol/dan) under-sell the multi-agent story — add an architect, a codex agent, a desktop pair, a PM, a security bot, and a human reviewer to show the same MCP tools serving very different participants",
        },
      },
      {
        type: "action.edit",
        actor: CLAUDE,
        payload: { files: ["scripts/seed.ts"] },
      },
      {
        type: "hypothesis.raised",
        actor: CLAUDE,
        payload: {
          hypothesis:
            "to demo a packet hitting its 1500-token cap, the bloated feature needs three verbose decisions plus a near-cap card — three ~350-token decisions on top of a ~450-token card overflows enough that truncatePacket drops the oldest decision",
        },
      },
      {
        type: "error.test",
        actor: CLAUDE,
        payload: {
          signature: "packet_under_cap_at_1095_tokens",
          summary:
            "first pass on feat_webhook_replay_protection landed at 1095/1500 tokens with all 3 decisions intact — substantive, but didn't actually trigger truncation, so the demo needed bigger decisions",
        },
      },
      {
        type: "action.edit",
        actor: CLAUDE,
        payload: { files: ["scripts/seed.ts"] },
      },
      {
        type: "decision.made",
        actor: ED,
        payload: {
          text:
            "expand the three decisions on feat_webhook_replay_protection until the packet truncates, and add a packet token sweep that calls get_resume_packet WITH session_id (the realistic agent-resume path) so the checkpoint blockers are merged in",
          next_action:
            "verify the sweep tags the webhook feature TRUNC and shows decisions=2/3 in the seed output, then capture a screenshot of the dashboard's packet card showing the at-cap pill",
        },
      },
      {
        type: "action.commit",
        actor: CLAUDE,
        payload: {
          sha: "WIP",
          dirty_files: ["scripts/seed.ts"],
        },
      },
      {
        type: "session.pause",
        actor: ED,
        payload: { session_id: "sess_ed_seed_demo" },
      },
    ],
    checkpoint: {
      session_id: "sess_ed_seed_demo",
      next_action:
        "commit the enriched seed once the packet sweep prints TRUNC for feat_webhook_replay_protection, then update the runbook so the demo script references the new room ids and the new actor cast",
      blockers: [],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // 3. In-progress: a baton-on-baton feature — wiring this very seed.
  // ─────────────────────────────────────────────────────────────
  {
    feature_id: "feat_baton_self_seed",
    events: [
      {
        type: "action.branch",
        actor: CLAUDE,
        payload: {
          branch: "feat/baton-self-seed",
          parent_branch: PARENT,
          base_sha: BASE_SHA,
        },
      },
      {
        type: "action.edit",
        actor: CLAUDE,
        payload: { files: ["scripts/seed-baton.ts", "package.json"] },
      },
      {
        type: "hypothesis.raised",
        actor: ED,
        payload: {
          hypothesis:
            "the on-stage demo lands harder if the seeded data is THIS repo — viewers can tab between the dashboard and the source files, see real branch names, and feel the dogfooding directly",
        },
      },
      {
        type: "hypothesis.raised",
        actor: CLAUDE,
        payload: {
          hypothesis:
            "keep this seed separate from scripts/seed.ts (don't merge them) — the synthetic three-room seed exercises the dashboard's diversity, the baton-on-baton seed sells the story; both have a place",
        },
      },
      {
        type: "decision.made",
        actor: ED,
        payload: {
          text:
            "ship scripts/seed-baton.ts as a standalone script with its own npm entry, one room, three features grounded in real commits and real file paths from this repo; keep the synthetic seed for QA/dashboard testing",
          next_action:
            "add the `seed:baton` npm script, run it against the local backend, and confirm the dashboard renders the new room with file paths the user can grep",
        },
      },
    ],
  },
];

async function main(): Promise<void> {
  console.log(`[seed-baton] backend: ${BASE_URL} (additive — no wipe)\n`);

  const room = await mcp<{ room_id: string; project_id: string }>(
    "create_room",
    { title: "baton/main", project_id: "proj_baton" },
  );
  console.log(`✓ room  ${room.room_id}  baton/main`);

  let total = 0;
  for (const feature of FEATURES) {
    for (const evt of feature.events) {
      await mcp(
        "append_event",
        {
          room_id: room.room_id,
          feature_id: feature.feature_id,
          type: evt.type,
          payload: evt.payload,
          actor_id: evt.actor,
        },
        room.room_id,
      );
      total += 1;
    }
    if (feature.checkpoint !== undefined) {
      await mcp(
        "write_checkpoint",
        {
          room_id: room.room_id,
          feature_id: feature.feature_id,
          session_id: feature.checkpoint.session_id,
          next_action: feature.checkpoint.next_action,
          blockers: feature.checkpoint.blockers,
        },
        room.room_id,
      );
    }
    console.log(`    ↳ ${feature.feature_id.padEnd(35)}  ${feature.events.length} events`);
  }

  const localBin =
    "/Users/eddie/Documents/business/baton/packages/mcp-shim/dist/bin.js";
  const claudeCmd = [
    "claude mcp remove baton 2>/dev/null;",
    "claude mcp add baton",
    `--env BATON_API_URL=${BASE_URL}`,
    `--env BATON_ROOM_ID=${room.room_id}`,
    "--env BATON_ACTOR_ID=you@claude-code",
    "--env BATON_FEATURE_ID=feat_multi_agent_demo_seed",
    `-- node ${localBin}`,
  ].join(" ");

  console.log("\n──────────────────────────────────────────────");
  console.log(`Summary — 1 room, ${FEATURES.length} features, ${total} events`);
  console.log("──────────────────────────────────────────────");
  console.log(`  baton/main                    ${room.room_id}`);

  console.log("\n──────────────────────────────────────────────");
  console.log("Re-register Claude Code (one line):");
  console.log("──────────────────────────────────────────────");
  console.log(claudeCmd);
  console.log("\nAfter pasting, restart Claude Code so the new BATON_ROOM_ID is picked up.");
  console.log("Open the dashboard at http://localhost:5173 (dev) or :3000 (prod).");
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[seed-baton] fatal: ${msg}`);
  process.exit(1);
});
