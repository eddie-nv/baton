import { useEffect, useState } from "react";
import {
  ApiError,
  listCheckpoints,
  type Checkpoint,
} from "../lib/api.js";
import { formatDate, relativeTime } from "../lib/format.js";

interface CheckpointsListProps {
  roomId: string;
  featureId: string;
}

export function CheckpointsList({
  roomId,
  featureId,
}: CheckpointsListProps): JSX.Element {
  const [items, setItems] = useState<Checkpoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    listCheckpoints(roomId)
      .then((res) => {
        if (cancelled) return;
        const filtered = res.checkpoints
          .filter((c) => c.feature_id === featureId)
          .sort((a, b) => b.ts - a.ts);
        setItems(filtered);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof ApiError
            ? `${err.code}: ${err.message}`
            : err instanceof Error
              ? err.message
              : "unknown";
        setError(message);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId, featureId]);

  return (
    <section className="card">
      <header className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold">Checkpoints</h3>
        <span className="text-xs font-mono text-ink-500">
          {items === null ? "" : `${items.length}`}
        </span>
      </header>

      {error !== null ? (
        <p className="text-sm text-rose-700">Failed: {error}</p>
      ) : items === null ? (
        <p className="text-sm text-ink-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-500">
          No checkpoints for this feature. Run write_checkpoint to create one.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((c) => (
            <li key={c.checkpoint_id} className="border-l-2 border-ink-200 pl-3">
              <p className="font-mono text-[11px] text-ink-500">
                {c.checkpoint_id} · session {c.session_id} ·{" "}
                <span title={formatDate(c.ts)}>{relativeTime(c.ts)}</span>
              </p>
              <p className="mt-1 text-sm text-ink-900">
                next: {c.next_action || "—"}
              </p>
              {c.blockers.length > 0 ? (
                <ul className="mt-1 list-disc pl-5 text-sm text-ink-700">
                  {c.blockers.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
