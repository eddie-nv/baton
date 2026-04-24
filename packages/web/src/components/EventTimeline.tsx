import { useCallback, useEffect, useState } from "react";
import { ApiError, listEvents, type EventRow } from "../lib/api.js";
import { formatDate, relativeTime } from "../lib/format.js";

interface EventTimelineProps {
  roomId: string;
  featureId: string;
}

const PAGE_SIZE = 50;

const EVENT_TONE: Record<string, string> = {
  "action.branch": "bg-sky-50 text-sky-900 border-sky-200",
  "action.edit": "bg-ink-100 text-ink-700 border-ink-200",
  "action.commit": "bg-emerald-50 text-emerald-900 border-emerald-200",
  "error.test": "bg-rose-50 text-rose-900 border-rose-200",
  "hypothesis.raised": "bg-violet-50 text-violet-900 border-violet-200",
  "decision.made": "bg-amber-50 text-amber-900 border-amber-200",
  "session.pause": "bg-ink-100 text-ink-500 border-ink-200",
  "feature.merged": "bg-emerald-50 text-emerald-900 border-emerald-200",
};

export function EventTimeline({
  roomId,
  featureId,
}: EventTimelineProps): JSX.Element {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (afterCursor: string | undefined) => {
      setLoading(true);
      setError(null);
      try {
        const params: { limit: number; cursor?: string } = { limit: PAGE_SIZE };
        if (afterCursor !== undefined) params.cursor = afterCursor;
        const res = await listEvents(roomId, featureId, params);
        setEvents((prev) =>
          afterCursor === undefined ? res.events : [...prev, ...res.events],
        );
        setCursor(res.next_cursor);
      } catch (err: unknown) {
        const message =
          err instanceof ApiError
            ? `${err.code}: ${err.message}`
            : err instanceof Error
              ? err.message
              : "unknown";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [roomId, featureId],
  );

  useEffect(() => {
    setEvents([]);
    setCursor(null);
    void loadPage(undefined);
  }, [loadPage]);

  return (
    <section className="card">
      <header className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold">Event timeline</h3>
        <span className="text-xs font-mono text-ink-500">
          {events.length} loaded{cursor !== null ? " · more available" : ""}
        </span>
      </header>

      {error !== null ? (
        <p className="text-sm text-rose-700">Failed: {error}</p>
      ) : null}

      {events.length === 0 && !loading ? (
        <p className="text-sm text-ink-500">No events for this feature.</p>
      ) : (
        <ol className="space-y-2.5">
          {events.map((evt) => (
            <li
              key={evt.event_id}
              className="grid grid-cols-[140px_1fr] gap-3 items-start"
            >
              <span
                className={`pill border ${
                  EVENT_TONE[evt.type] ?? "bg-ink-100 text-ink-700 border-ink-200"
                } font-mono text-[11px] truncate`}
                title={evt.type}
              >
                {evt.type}
              </span>
              <div className="min-w-0">
                <p className="text-sm text-ink-900 break-words">
                  {summarize(evt)}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-ink-500">
                  {evt.event_id} · {evt.actor_id} · {relativeTime(evt.ts)} ·{" "}
                  <span title={formatDate(evt.ts)}>{formatDate(evt.ts)}</span>
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-4">
        {cursor !== null ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadPage(cursor)}
            className="btn-ghost"
          >
            {loading ? "Loading…" : "Load older"}
          </button>
        ) : loading && events.length === 0 ? (
          <p className="text-xs text-ink-500">Loading…</p>
        ) : null}
      </div>
    </section>
  );
}

function summarize(evt: EventRow): string {
  const p = evt.payload;
  switch (evt.type) {
    case "action.branch":
      return `branched ${stringField(p, "branch")} from ${stringField(p, "parent_branch")} @ ${stringField(p, "base_sha")}`;
    case "action.commit":
      return `commit ${stringField(p, "sha")}${
        Array.isArray(p["dirty_files"]) && p["dirty_files"].length > 0
          ? ` (${(p["dirty_files"] as string[]).join(", ")})`
          : ""
      }`;
    case "action.edit":
      return `edited ${
        Array.isArray(p["files"]) ? (p["files"] as string[]).join(", ") : "—"
      }`;
    case "error.test":
      return `${stringField(p, "signature")}: ${stringField(p, "summary")}`;
    case "hypothesis.raised":
      return stringField(p, "hypothesis");
    case "decision.made":
      return `${stringField(p, "text")} → ${stringField(p, "next_action")}`;
    case "session.pause":
      return "session paused";
    case "feature.merged":
      return `merged ${stringField(p, "merged_sha")}`;
    default:
      return JSON.stringify(p);
  }
}

function stringField(p: Record<string, unknown>, key: string): string {
  const v = p[key];
  return typeof v === "string" ? v : "—";
}
