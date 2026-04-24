import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BatonRedis } from "./client.js";
import { createRedisClient } from "./client.js";
import {
  listCheckpointKeys,
  listFeatureKeys,
  listRoomKeys,
  loadRecentDecisions,
} from "./queries.js";

const TEST_URL = "redis://localhost:6379/15";

async function seed(redis: BatonRedis): Promise<void> {
  await redis.flushDb();
  // Two rooms
  await redis.json.set("room:room_q_a", "$", {
    room_id: "room_q_a",
    project_id: "proj_q_a",
    title: "queries A",
    created_at: 1,
  });
  await redis.json.set("room:room_q_b", "$", {
    room_id: "room_q_b",
    project_id: "proj_q_b",
    title: "queries B",
    created_at: 2,
  });
  // Two features in room A, one in room B
  for (const fid of ["feat_one", "feat_two"]) {
    await redis.json.set(`feature:room_q_a:${fid}`, "$", {
      feature_id: fid,
      room_id: "room_q_a",
      purpose: "test",
      state: "in_progress",
      confidence: 0.5,
      git: {
        branch: `feat/${fid}`,
        parent_branch: "main",
        base_sha: "x",
        head_sha: "x",
        commits_ahead: 0,
        dirty_files: [],
        remote: "origin",
      },
      surface: { files: [], services: [] },
      invariants: [],
      hypotheses: [],
      failed_attempts: [],
      open_blockers: [],
      next_action: "",
    });
  }
  await redis.json.set("feature:room_q_b:feat_lonely", "$", {
    feature_id: "feat_lonely",
    room_id: "room_q_b",
    purpose: "",
    state: "in_progress",
    confidence: 0.5,
    git: {
      branch: "feat/lonely",
      parent_branch: "main",
      base_sha: "x",
      head_sha: "x",
      commits_ahead: 0,
      dirty_files: [],
      remote: "origin",
    },
    surface: { files: [], services: [] },
    invariants: [],
    hypotheses: [],
    failed_attempts: [],
    open_blockers: [],
    next_action: "",
  });
  // Two checkpoints for room A
  for (const sess of ["sess_x", "sess_y"]) {
    await redis.json.set(`checkpoint:room_q_a:${sess}`, "$", {
      checkpoint_id: `ck_${sess}`,
      room_id: "room_q_a",
      feature_id: "feat_one",
      session_id: sess,
      next_action: "",
      blockers: [],
      ts: 1,
    });
  }
}

describe("redis/queries (integration)", () => {
  let redis: BatonRedis;

  beforeAll(async () => {
    redis = await createRedisClient(TEST_URL);
    await seed(redis);
  });

  afterAll(async () => {
    if (redis.isReady) {
      await redis.flushDb();
      await redis.quit();
    }
  });

  describe("listRoomKeys", () => {
    it("returns every room: key (sorted, deduped)", async () => {
      const keys = await listRoomKeys(redis);
      expect(keys).toEqual(["room:room_q_a", "room:room_q_b"]);
    });
  });

  describe("listFeatureKeys", () => {
    it("returns features only for the requested room", async () => {
      const a = await listFeatureKeys(redis, "room_q_a");
      expect(a.sort()).toEqual([
        "feature:room_q_a:feat_one",
        "feature:room_q_a:feat_two",
      ]);
      const b = await listFeatureKeys(redis, "room_q_b");
      expect(b).toEqual(["feature:room_q_b:feat_lonely"]);
    });

    it("returns [] for an unknown room", async () => {
      const empty = await listFeatureKeys(redis, "room_nonexistent");
      expect(empty).toEqual([]);
    });
  });

  describe("listCheckpointKeys", () => {
    it("returns all checkpoint keys for a room", async () => {
      const keys = await listCheckpointKeys(redis, "room_q_a");
      expect(keys.sort()).toEqual([
        "checkpoint:room_q_a:sess_x",
        "checkpoint:room_q_a:sess_y",
      ]);
    });
  });

  describe("loadRecentDecisions", () => {
    it("returns up to 3 decisions newest-first, ignoring other event types", async () => {
      // Append 4 decisions interleaved with non-decision events.
      const rid = "room_q_a";
      const fid = "feat_one";
      const evts = [
        { type: "action.edit", payload: { files: ["a.ts"] } },
        { type: "decision.made", payload: { text: "d1", next_action: "" } },
        { type: "hypothesis.raised", payload: { hypothesis: "h1" } },
        { type: "decision.made", payload: { text: "d2", next_action: "" } },
        { type: "decision.made", payload: { text: "d3", next_action: "" } },
        { type: "decision.made", payload: { text: "d4", next_action: "" } },
      ];
      let ts = 1_700_000_000_000;
      for (let i = 0; i < evts.length; i++) {
        const e = evts[i]!;
        await redis.xAdd(`events:${rid}:${fid}`, "*", {
          data: JSON.stringify({
            event_id: `evt_${i}`,
            room_id: rid,
            feature_id: fid,
            actor_id: "tester",
            type: e.type,
            payload: e.payload,
            ts: ts++,
          }),
        });
      }
      const out = await loadRecentDecisions(redis, rid, fid, 3);
      expect(out.map((d) => d.text)).toEqual(["d4", "d3", "d2"]);
    });

    it("returns [] when there are no events", async () => {
      const out = await loadRecentDecisions(redis, "room_q_a", "feat_two", 3);
      expect(out).toEqual([]);
    });
  });
});
