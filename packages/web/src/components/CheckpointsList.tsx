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
      <header className="flex items-center justify-between mb-4 pb-3 border-b border-edge">
        <div>
          <p className="font-mono text-2xs uppercase tracking-widest text-signal">
            checkpoints
          </p>
          <p className="mt-0.5 text-xs text-ink-500">
            session-pause snapshots · ttl 7d
          </p>
        </div>
        <span className="pill-bordered">
          {items === null ? "—" : `${items.length}`}
        </span>
      </header>

      {error !== null ? (
        <p className="font-mono text-xs text-evt-error">↳ failed: {error}</p>
      ) : items === null ? (
        <p className="font-mono text-2xs uppercase tracking-widest text-ink-500">
          loading…
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-500 italic">
          no checkpoints — run write_checkpoint to create one
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((c) => (
            <li
              key={c.checkpoint_id}
              className="border-l-2 border-signal/60 pl-3"
            >
              <p className="font-mono text-2xs uppercase tracking-widest text-ink-500">
                {c.checkpoint_id} · sess {c.session_id} ·{" "}
                <span title={formatDate(c.ts)}>{relativeTime(c.ts)}</span>
              </p>
              <p className="mt-1 text-sm text-ink-50">
                {c.next_action || (
                  <span className="text-ink-500 italic">no next action</span>
                )}
              </p>
              {c.blockers.length > 0 ? (
                <ul className="mt-2 space-y-0.5 text-sm text-ink-100">
                  {c.blockers.map((b, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-evt-error font-mono select-none">
                        ●
                      </span>
                      <span>{b}</span>
                    </li>
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
