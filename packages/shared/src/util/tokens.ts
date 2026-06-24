import { getEncoding, type Tiktoken } from "js-tiktoken";

/**
 * Token counter wrapping js-tiktoken. We use `cl100k_base` as a
 * deterministic stand-in tokenizer — exact counts don't need to match
 * Claude's proprietary tokenizer byte-for-byte; what matters is that the
 * count is stable, measured (not estimated), and well-correlated with
 * actual model context usage. If we ever need per-model accuracy we can
 * swap encoders without touching callers.
 */
let cachedEncoder: Tiktoken | null = null;

function encoder(): Tiktoken {
  if (cachedEncoder === null) {
    cachedEncoder = getEncoding("cl100k_base");
  }
  return cachedEncoder;
}

export function countTokens(value: unknown): number {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return encoder().encode(text).length;
}
