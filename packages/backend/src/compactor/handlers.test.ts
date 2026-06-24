import { describe, expect, it } from "vitest";
import type { Event, FeatureCard } from "@baton/shared";
import { dispatch } from "./index.js";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function baseCard(overrides: Partial<FeatureCard> = {}): FeatureCard {
  return {
    feature_id: "feat_payments_idempotency",
    room_id: "room_abc",
    purpose: "make payment retries idempotent",
    state: "in_progress",
    confidence: 0.5,
    git: {
      branch: "feat/payments-idempotency",
      parent_branch: "main",
      base_sha: "aaa1111",
      head_sha: "aaa1111",
      commits_ahead: 0,
      dirty_files: [],
      remote: "origin",
    },
    surface: {
      files: [],
      services: [],
    },
    invariants: [],
    hypotheses: [],
    failed_attempts: [],
    open_blockers: [],
    next_action: "scaffold middleware",
    ...overrides,
  };
}

function makeEvent<T extends Event["type"]>(
  type: T,
  payload: Record<string, unknown>,
): Event {
  return {
    event_id: `evt_${Math.random().toString(36).slice(2, 8)}`,
    room_id: "room_abc",
    feature_id: "feat_payments_idempotency",
    actor_id: "alice@claude-code",
    type,
    payload,
    ts: 1_700_000_000_000,
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("compactor.dispatch — action.branch", () => {
  it("sets git.branch, parent_branch, base_sha", () => {
    const card = baseCard();
    const event = makeEvent("action.branch", {
      branch: "feat/new-thing",
      parent_branch: "release/v2",
      base_sha: "def5678",
    });
    const out = dispatch(event, card);
    expect(out.git.branch).toBe("feat/new-thing");
    expect(out.git.parent_branch).toBe("release/v2");
    expect(out.git.base_sha).toBe("def5678");
    expect(out.git.head_sha).toBe("def5678");
  });

  it("does not mutate the input card", () => {
    const card = baseCard();
    const snap = JSON.parse(JSON.stringify(card));
    dispatch(
      makeEvent("action.branch", {
        branch: "feat/x",
        parent_branch: "main",
        base_sha: "abc",
      }),
      card,
    );
    expect(card).toEqual(snap);
  });
});

describe("compactor.dispatch — action.commit", () => {
  it("updates head_sha, commits_ahead, dirty_files", () => {
    const card = baseCard({
      git: { ...baseCard().git, commits_ahead: 1 },
    });
    const event = makeEvent("action.commit", {
      sha: "new1234",
      dirty_files: ["src/a.ts"],
    });
    const out = dispatch(event, card);
    expect(out.git.head_sha).toBe("new1234");
    expect(out.git.commits_ahead).toBe(2);
    expect(out.git.dirty_files).toContain("src/a.ts");
  });

  it("deduplicates dirty_files entries", () => {
    const card = baseCard({
      git: { ...baseCard().git, dirty_files: ["src/a.ts"] },
    });
    const out = dispatch(
      makeEvent("action.commit", { sha: "x", dirty_files: ["src/a.ts", "src/b.ts"] }),
      card,
    );
    expect(out.git.dirty_files).toEqual(["src/a.ts", "src/b.ts"]);
  });
});

describe("compactor.dispatch — action.edit", () => {
  it("appends edited files to surface.files (deduped)", () => {
    const card = baseCard({
      surface: { files: ["src/a.ts"], services: [] },
    });
    const out = dispatch(
      makeEvent("action.edit", { files: ["src/a.ts", "src/b.ts"] }),
      card,
    );
    expect(out.surface.files).toEqual(["src/a.ts", "src/b.ts"]);
  });
});

describe("compactor.dispatch — error.test", () => {
  it("creates a new failed_attempt when signature is novel", () => {
    const card = baseCard();
    const event = makeEvent("error.test", {
      signature: "ledger_double_write",
      summary: "swap write order breaks audit",
    });
    const out = dispatch(event, card);
    expect(out.failed_attempts).toHaveLength(1);
    expect(out.failed_attempts[0]!.signature).toBe("ledger_double_write");
    expect(out.failed_attempts[0]!.event_ids).toEqual([event.event_id]);
  });

  it("dedupes by signature: appends event_id to existing entry, does not add duplicate", () => {
    const existing = {
      signature: "sig_a",
      summary: "old summary",
      event_ids: ["evt_old"],
    };
    const card = baseCard({ failed_attempts: [existing] });
    const event = makeEvent("error.test", {
      signature: "sig_a",
      summary: "new summary",
    });
    const out = dispatch(event, card);
    expect(out.failed_attempts).toHaveLength(1);
    expect(out.failed_attempts[0]!.event_ids).toEqual(["evt_old", event.event_id]);
  });
});

describe("compactor.dispatch — hypothesis.raised", () => {
  it("appends a hypothesis to the array", () => {
    const card = baseCard();
    const out = dispatch(
      makeEvent("hypothesis.raised", { hypothesis: "cache ttl wrong" }),
      card,
    );
    expect(out.hypotheses).toEqual(["cache ttl wrong"]);
  });

  it("caps hypotheses at 3, dropping the oldest (index 0)", () => {
    const card = baseCard({ hypotheses: ["h1", "h2", "h3"] });
    const out = dispatch(
      makeEvent("hypothesis.raised", { hypothesis: "h4" }),
      card,
    );
    expect(out.hypotheses).toEqual(["h2", "h3", "h4"]);
  });

  it("is a no-op when the same hypothesis is raised again", () => {
    const card = baseCard({ hypotheses: ["already_there"] });
    const out = dispatch(
      makeEvent("hypothesis.raised", { hypothesis: "already_there" }),
      card,
    );
    expect(out.hypotheses).toEqual(["already_there"]);
    // same reference — no change
    expect(out).toBe(card);
  });
});

describe("compactor.dispatch — decision.made", () => {
  it("sets next_action and clears hypotheses", () => {
    const card = baseCard({ hypotheses: ["h1", "h2"] });
    const out = dispatch(
      makeEvent("decision.made", {
        text: "go with approach A",
        next_action: "write migration",
      }),
      card,
    );
    expect(out.next_action).toBe("write migration");
    expect(out.hypotheses).toEqual([]);
  });

  it("can update state when provided (e.g. to 'blocked')", () => {
    const card = baseCard();
    const out = dispatch(
      makeEvent("decision.made", {
        text: "need finance signoff",
        next_action: "file ticket",
        state: "blocked",
      }),
      card,
    );
    expect(out.state).toBe("blocked");
  });
});

describe("compactor.dispatch — session.pause", () => {
  it("does not change the card (returns same reference)", () => {
    const card = baseCard({ hypotheses: ["h1"] });
    const out = dispatch(makeEvent("session.pause", {}), card);
    expect(out).toBe(card);
  });
});

describe("compactor.dispatch — feature.merged", () => {
  it("sets state to 'merged'", () => {
    const card = baseCard();
    const out = dispatch(
      makeEvent("feature.merged", { merged_sha: "def999" }),
      card,
    );
    expect(out.state).toBe("merged");
  });
});

describe("compactor.dispatch — unknown type", () => {
  it("throws when the event type is not recognized", () => {
    const card = baseCard();
    // @ts-expect-error intentional bogus type
    const bogus = makeEvent("bogus.type", {});
    expect(() => dispatch(bogus, card)).toThrow();
  });
});

describe("compactor.dispatch — payload validation", () => {
  it("throws when action.branch payload is missing required fields", () => {
    const card = baseCard();
    expect(() =>
      dispatch(makeEvent("action.branch", { branch: "feat/x" }), card),
    ).toThrow();
  });

  it("throws when hypothesis.raised payload lacks hypothesis string", () => {
    const card = baseCard();
    expect(() =>
      dispatch(makeEvent("hypothesis.raised", {}), card),
    ).toThrow();
  });
});
