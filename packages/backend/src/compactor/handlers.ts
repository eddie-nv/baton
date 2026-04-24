import type { Event, FailedAttempt, FeatureCard } from "@baton/shared";
import {
  actionBranchPayload,
  actionCommitPayload,
  actionEditPayload,
  decisionMadePayload,
  errorTestPayload,
  featureMergedPayload,
  hypothesisRaisedPayload,
  HYPOTHESIS_CAP,
  uniqueAppend,
} from "./rules.js";

type Handler = (event: Event, card: FeatureCard) => FeatureCard;

// ─────────────────────────────────────────────────────────────
// Individual handlers — pure, immutable, return same ref on no-op
// ─────────────────────────────────────────────────────────────

const onActionBranch: Handler = (event, card) => {
  const p = actionBranchPayload.parse(event.payload);
  return {
    ...card,
    git: {
      ...card.git,
      branch: p.branch,
      parent_branch: p.parent_branch,
      base_sha: p.base_sha,
      head_sha: p.base_sha,
      commits_ahead: 0,
    },
  };
};

const onActionCommit: Handler = (event, card) => {
  const p = actionCommitPayload.parse(event.payload);
  return {
    ...card,
    git: {
      ...card.git,
      head_sha: p.sha,
      commits_ahead: card.git.commits_ahead + 1,
      dirty_files: uniqueAppend(card.git.dirty_files, p.dirty_files ?? []),
    },
  };
};

const onActionEdit: Handler = (event, card) => {
  const p = actionEditPayload.parse(event.payload);
  return {
    ...card,
    surface: {
      ...card.surface,
      files: uniqueAppend(card.surface.files, p.files),
    },
  };
};

const onErrorTest: Handler = (event, card) => {
  const p = errorTestPayload.parse(event.payload);
  const existingIdx = card.failed_attempts.findIndex(
    (a) => a.signature === p.signature,
  );

  if (existingIdx >= 0) {
    const existing = card.failed_attempts[existingIdx]!;
    const updated: FailedAttempt = {
      ...existing,
      event_ids: [...existing.event_ids, event.event_id],
    };
    const next = [...card.failed_attempts];
    next[existingIdx] = updated;
    return { ...card, failed_attempts: next };
  }

  const added: FailedAttempt = {
    signature: p.signature,
    summary: p.summary,
    event_ids: [event.event_id],
  };
  return { ...card, failed_attempts: [...card.failed_attempts, added] };
};

const onHypothesisRaised: Handler = (event, card) => {
  const p = hypothesisRaisedPayload.parse(event.payload);
  if (card.hypotheses.includes(p.hypothesis)) return card;

  const appended = [...card.hypotheses, p.hypothesis];
  const capped =
    appended.length > HYPOTHESIS_CAP
      ? appended.slice(appended.length - HYPOTHESIS_CAP)
      : appended;
  return { ...card, hypotheses: capped };
};

const onDecisionMade: Handler = (event, card) => {
  const p = decisionMadePayload.parse(event.payload);
  return {
    ...card,
    hypotheses: [],
    next_action: p.next_action,
    ...(p.state !== undefined ? { state: p.state } : {}),
  };
};

const onSessionPause: Handler = (_event, card) => card;

const onFeatureMerged: Handler = (event, card) => {
  featureMergedPayload.parse(event.payload);
  return { ...card, state: "merged" };
};

// ─────────────────────────────────────────────────────────────
// Dispatch table
// ─────────────────────────────────────────────────────────────

export const handlers = {
  "action.branch": onActionBranch,
  "action.commit": onActionCommit,
  "action.edit": onActionEdit,
  "error.test": onErrorTest,
  "hypothesis.raised": onHypothesisRaised,
  "decision.made": onDecisionMade,
  "session.pause": onSessionPause,
  "feature.merged": onFeatureMerged,
} satisfies Record<Event["type"], Handler>;
