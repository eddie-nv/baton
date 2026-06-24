/**
 * FeatureCard — hard-capped at 500 tokens.
 *
 * The cap is architecturally enforceable, not aspirational, because four
 * properties hold simultaneously. First, the card has a fixed shape: every
 * non-array field (purpose, state, git, surface, next_action) has a known
 * upper bound from domain rules, so unbounded growth can only come from the
 * three array fields (hypotheses, failed_attempts, open_blockers). Second,
 * each array has an explicit overflow policy encoded in the compactor —
 * hypotheses cap at 3 by construction, failed_attempts dedupe by signature
 * before insert, and on over-cap the truncation order is deterministic
 * (oldest failed_attempts first, then oldest hypotheses). Third, enforcement
 * sits at a single chokepoint: the JSON.SET write boundary in
 * util/tokens.ts, which every card mutation must pass through — there is no
 * alternative write path. Fourth, js-tiktoken gives us exact counts against
 * a deterministic tokenizer, so the cap is measured, not estimated. The
 * ResumePacket (1,500 tokens) uses the same pattern: assembled fresh in
 * get_resume_packet from already-compacted state, counted before return,
 * and truncated in a fixed order (last_decisions oldest-first, then the
 * card copy's failed_attempts) if over budget. Because the packet is
 * derived, not stored, truncation never mutates persisted state.
 */

export type FeatureState = "in_progress" | "blocked" | "merged" | "abandoned";

export interface FailedAttempt {
  /** Stable hash — dedupe key. Two attempts with the same signature collapse. */
  signature: string;
  /** ≤ 10 words summary. */
  summary: string;
  /** Refs to the originating events in the stream. */
  event_ids: string[];
}

export interface FeatureGit {
  branch: string;
  parent_branch: string;
  base_sha: string;
  head_sha: string;
  commits_ahead: number;
  dirty_files: string[];
  remote: string;
}

export interface FeatureSurface {
  files: string[];
  services: string[];
}

export interface FeatureCard {
  feature_id: string;
  room_id: string;
  /** One sentence. */
  purpose: string;
  state: FeatureState;
  /** 0..1 */
  confidence: number;
  git: FeatureGit;
  surface: FeatureSurface;
  invariants: string[];
  /** Cap 3, drop oldest. */
  hypotheses: string[];
  /** Dedupe by signature. Truncation drops oldest (index 0) first. */
  failed_attempts: FailedAttempt[];
  open_blockers: string[];
  next_action: string;
}
