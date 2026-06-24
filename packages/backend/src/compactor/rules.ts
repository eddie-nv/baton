import { z } from "zod";

/**
 * Hard caps enforced by the compactor. These are the small end of the
 * card's overall token budget and are policy, not measurement — when a
 * cap is hit, we drop oldest-first at append time rather than letting
 * the budget throw at JSON.SET.
 */
export const HYPOTHESIS_CAP = 3;

// ─────────────────────────────────────────────────────────────
// Per-event-type payload schemas.
//
// Payloads on the wire are `Record<string, unknown>` (validated loosely
// by append_event's input schema). Each handler narrows the payload with
// its own schema so callers get useful errors instead of cryptic ones.
// ─────────────────────────────────────────────────────────────

export const actionBranchPayload = z.object({
  branch: z.string().min(1),
  parent_branch: z.string().min(1),
  base_sha: z.string().min(1),
});

export const actionCommitPayload = z.object({
  sha: z.string().min(1),
  dirty_files: z.array(z.string()).optional(),
});

export const actionEditPayload = z.object({
  files: z.array(z.string()).min(1),
});

export const errorTestPayload = z.object({
  signature: z.string().min(1),
  summary: z.string(),
});

export const hypothesisRaisedPayload = z.object({
  hypothesis: z.string().min(1),
});

export const decisionMadePayload = z.object({
  text: z.string(),
  next_action: z.string(),
  state: z.enum(["in_progress", "blocked", "merged", "abandoned"]).optional(),
});

export const sessionPausePayload = z.object({}).passthrough();

export const featureMergedPayload = z.object({
  merged_sha: z.string().optional(),
});

export function uniqueAppend<T>(existing: readonly T[], incoming: readonly T[]): T[] {
  const seen = new Set(existing);
  const next = [...existing];
  for (const item of incoming) {
    if (!seen.has(item)) {
      seen.add(item);
      next.push(item);
    }
  }
  return next;
}
