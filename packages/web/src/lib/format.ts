/** Format a unix-ms timestamp as a relative time ("3m ago"). */
export function relativeTime(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

/** Format a unix-ms timestamp as an ISO date in the user's locale. */
export function formatDate(ts: number): string {
  return new Date(ts).toLocaleString();
}

/** Truncate a string to `max` chars with an ellipsis. */
export function truncate(s: string, max: number = 80): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
