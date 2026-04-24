import { describe, expect, it } from "vitest";
import {
  createRoomInput,
  createRoomOutput,
  appendEventInput,
  appendEventOutput,
  writeCheckpointInput,
  writeCheckpointOutput,
  getFeatureCardInput,
  featureCardSchema,
  getResumePacketInput,
  resumePacketSchema,
  eventTypeSchema,
} from "./schemas.js";
import { minimalCard, minimalPacket } from "../types/__fixtures__.js";

describe("eventTypeSchema", () => {
  it("accepts all declared event types", () => {
    const types = [
      "action.branch",
      "action.edit",
      "action.commit",
      "error.test",
      "hypothesis.raised",
      "decision.made",
      "session.pause",
      "feature.merged",
    ];
    for (const t of types) {
      expect(eventTypeSchema.safeParse(t).success).toBe(true);
    }
  });

  it("rejects unknown event types", () => {
    expect(eventTypeSchema.safeParse("action.squash").success).toBe(false);
    expect(eventTypeSchema.safeParse("").success).toBe(false);
  });
});

describe("create_room schemas", () => {
  it("input: title required, project_id optional", () => {
    expect(createRoomInput.safeParse({ title: "Payments v2" }).success).toBe(true);
    expect(
      createRoomInput.safeParse({ title: "Payments v2", project_id: "proj_x" })
        .success,
    ).toBe(true);
    expect(createRoomInput.safeParse({}).success).toBe(false);
    expect(createRoomInput.safeParse({ title: "" }).success).toBe(false);
  });

  it("output: returns room_id and project_id", () => {
    const ok = createRoomOutput.safeParse({
      room_id: "room_abc",
      project_id: "proj_x",
    });
    expect(ok.success).toBe(true);
  });
});

describe("append_event schemas", () => {
  it("input requires room_id, feature_id, type, payload, actor_id", () => {
    const valid = {
      room_id: "room_abc",
      feature_id: "feat_foo",
      type: "action.commit",
      payload: { sha: "def5678" },
      actor_id: "alice@claude-code",
    };
    expect(appendEventInput.safeParse(valid).success).toBe(true);

    const { room_id, ...missing } = valid;
    expect(appendEventInput.safeParse(missing).success).toBe(false);
    expect(room_id).toBe("room_abc");
  });

  it("rejects unknown event types", () => {
    expect(
      appendEventInput.safeParse({
        room_id: "room_abc",
        feature_id: "feat_foo",
        type: "bogus.type",
        payload: {},
        actor_id: "a",
      }).success,
    ).toBe(false);
  });

  it("output has event_id and card_updated boolean", () => {
    expect(
      appendEventOutput.safeParse({ event_id: "evt_1", card_updated: true }).success,
    ).toBe(true);
    expect(
      appendEventOutput.safeParse({ event_id: "evt_1", card_updated: "yes" })
        .success,
    ).toBe(false);
  });
});

describe("write_checkpoint schemas", () => {
  it("input accepts a full checkpoint spec", () => {
    const ok = writeCheckpointInput.safeParse({
      room_id: "room_abc",
      feature_id: "feat_foo",
      session_id: "sess_1",
      next_action: "write integration test",
      blockers: ["need clarity on 24h window"],
    });
    expect(ok.success).toBe(true);
  });

  it("output returns checkpoint_id and expires_at", () => {
    expect(
      writeCheckpointOutput.safeParse({
        checkpoint_id: "ck_1",
        expires_at: 1_700_000_000_000,
      }).success,
    ).toBe(true);
  });
});

describe("get_feature_card schemas", () => {
  it("input requires room_id + feature_id", () => {
    expect(
      getFeatureCardInput.safeParse({ room_id: "r", feature_id: "f" }).success,
    ).toBe(true);
    expect(getFeatureCardInput.safeParse({ room_id: "r" }).success).toBe(false);
  });

  it("output matches FeatureCard TS shape (round-trips a real fixture)", () => {
    const parsed = featureCardSchema.safeParse(minimalCard());
    expect(parsed.success).toBe(true);
  });

  it("output rejects state outside the allowed enum", () => {
    const bad = { ...minimalCard(), state: "frozen" };
    expect(featureCardSchema.safeParse(bad).success).toBe(false);
  });

  it("output rejects confidence outside [0, 1]", () => {
    const bad = { ...minimalCard(), confidence: 1.5 };
    expect(featureCardSchema.safeParse(bad).success).toBe(false);
  });
});

describe("get_resume_packet schemas", () => {
  it("input requires room_id + feature_id; session_id optional", () => {
    expect(
      getResumePacketInput.safeParse({ room_id: "r", feature_id: "f" }).success,
    ).toBe(true);
    expect(
      getResumePacketInput.safeParse({
        room_id: "r",
        feature_id: "f",
        session_id: "sess_1",
      }).success,
    ).toBe(true);
  });

  it("output matches ResumePacket TS shape (round-trips a real fixture)", () => {
    const parsed = resumePacketSchema.safeParse(minimalPacket());
    expect(parsed.success).toBe(true);
  });
});
