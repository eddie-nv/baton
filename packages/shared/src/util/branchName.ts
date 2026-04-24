/**
 * Canonical branch-name normalizer for Baton.
 *
 * `feature_id` is a normalized git branch name and this function is the
 * single source of truth for that mapping. Defined once, imported by shim
 * and backend so both sides produce identical IDs.
 *
 * Normalization steps (idempotent):
 *   1. Lowercase
 *   2. Replace [/, ., -, whitespace] with `_`
 *   3. Collapse repeated underscores
 *   4. Trim leading/trailing underscores
 */

const SEPARATOR_RE = /[\\/.\-\s]+/g;
const REPEATED_UNDERSCORE_RE = /_{2,}/g;
const TRIM_UNDERSCORE_RE = /^_+|_+$/g;

export function normalizeBranchName(branch: string): string {
  if (typeof branch !== "string") {
    throw new TypeError("branch must be a string");
  }

  const normalized = branch
    .toLowerCase()
    .replace(SEPARATOR_RE, "_")
    .replace(REPEATED_UNDERSCORE_RE, "_")
    .replace(TRIM_UNDERSCORE_RE, "");

  if (normalized.length === 0) {
    throw new Error(`branch normalizes to empty string: ${JSON.stringify(branch)}`);
  }

  return normalized;
}
