import type { Context, Next } from "hono";

const REDACT_KEEP = 6;

/**
 * Redact a room_id (or any bearer token) down to the first few chars
 * plus `***`. Used by `requestLogger` — never log raw room_ids, they
 * are bearer capabilities.
 */
export function redactRoomId(value: string | undefined): string {
  if (value === undefined || value.length === 0) return "-";
  if (value.length <= REDACT_KEEP) return value;
  return `${value.slice(0, REDACT_KEEP)}***`;
}

/**
 * Minimal structured request logger. Emits one JSON line per request
 * with method, path, status, duration, and a redacted room id.
 */
export async function requestLogger(c: Context, next: Next): Promise<void> {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  const header = c.req.header("Authorization");
  const bearer =
    header !== undefined && header.startsWith("Bearer ")
      ? header.slice("Bearer ".length).trim()
      : undefined;

  await next();

  const line = JSON.stringify({
    ts: new Date().toISOString(),
    method,
    path,
    status: c.res.status,
    dur_ms: Date.now() - start,
    room: redactRoomId(bearer),
  });
  console.log(line);
}
