import { useCallback, useEffect, useState } from "react";
import { ApiError, listEvents, type EventRow } from "../lib/api.js";
import { formatDate, relativeTime } from "../lib/format.js";

interface EventTimelineProps {
  roomId: string;
  featureId: string;
}

const PAGE_SIZE = 50;

const EVENT_TONE: Record<string, string> = {
  "action.branch": "text-evt-branch",
  "action.edit": "text-evt-edit",
  "action.commit": "text-evt-commit",
  "error.test": "text-evt-error",
  "hypothesis.raised": "text-evt-hypothesis",
  "decision.made": "text-evt-decision",
  "session.pause": "text-evt-pause",
  "feature.merged": "text-evt-merged",
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
      <header className="flex items-center justify-between mb-4 pb-3 border-b border-edge">
        <div>
          <p className="font-mono text-2xs uppercase tracking-widest text-signal">
            event_ledger
          </p>
          <p className="mt-0.5 text-xs text-ink-500">
            redis stream · oldest first · cursor paginated
          </p>
        </div>
        <span className="pill-bordered">
          {events.length} loaded{cursor !== null ? " · more →" : ""}
        </span>
      </header>

      {error !== null ? (
        <p className="font-mono text-xs text-evt-error">↳ failed: {error}</p>
      ) : null}

      {events.length === 0 && !loading ? (
        <p className="text-sm text-ink-500 italic">
          no events for this feature
        </p>
      ) : (
        <ol className="space-y-1.5">
          {events.map((evt) => (
            <li
              key={evt.event_id}
              className="grid grid-cols-[64px_150px_1fr] gap-3 items-baseline font-mono text-xs hover:bg-canvas-inset px-2 -mx-2 py-1 rounded transition"
            >
              <span
                className="text-ink-500 tabular-nums"
                title={formatDate(evt.ts)}
              >
                {formatTime(evt.ts)}
              </span>
              <span
                className={`${EVENT_TONE[evt.type] ?? "text-ink-500"} truncate`}
                title={evt.type}
              >
                {evt.type}
              </span>
              <span className="text-ink-100 break-words leading-relaxed">
                {summarize(evt)}
                <span className="ml-2 text-ink-500 text-2xs">
                  · {evt.actor_id} · {relativeTime(evt.ts)}
                </span>
              </span>
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
            className="btn-ghost disabled:opacity-50"
          >
            {loading ? "loading…" : "load older →"}
          </button>
        ) : loading && events.length === 0 ? (
          <p className="font-mono text-2xs uppercase tracking-widest text-ink-500">
            loading…
          </p>
        ) : null}
      </div>
    </section>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
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
