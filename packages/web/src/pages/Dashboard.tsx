import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, listRooms, type Room } from "../lib/api.js";
import { relativeTime, truncate } from "../lib/format.js";
import { EmptyState } from "../components/EmptyState.js";

type Status =
  | { kind: "loading" }
  | { kind: "ok"; rooms: Room[] }
  | { kind: "error"; message: string };

export function Dashboard(): JSX.Element {
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    listRooms()
      .then((res) => {
        if (cancelled) return;
        const sorted = [...res.rooms].sort((a, b) => b.created_at - a.created_at);
        setStatus({ kind: "ok", rooms: sorted });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof ApiError
            ? `${err.code}: ${err.message}`
            : err instanceof Error
              ? err.message
              : "unknown error";
        setStatus({ kind: "error", message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <header className="flex items-end justify-between gap-4 mb-8 border-b border-edge pb-6">
        <div>
          <p className="section-num">/dashboard</p>
          <h1 className="mt-1 text-3xl md:text-4xl font-bold tracking-tightest">
            Rooms
          </h1>
          <p className="mt-2 max-w-xl text-ink-300">
            Every initiative your team is working on. Click a room to see its
            features, the event ledger, and live resume packets.
          </p>
        </div>
        {status.kind === "ok" ? (
          <span className="pill-bordered">
            {status.rooms.length} room{status.rooms.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </header>

      {status.kind === "loading" ? (
        <SkeletonGrid />
      ) : status.kind === "error" ? (
        <EmptyState
          title="Failed to load rooms"
          description={status.message}
          hint="check that the backend is running on port 3000"
        />
      ) : status.rooms.length === 0 ? (
        <EmptyState
          title="No rooms yet"
          description="Create one with the create_room MCP tool, or run npm run seed."
          hint="npm run seed"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-edge border border-edge">
          {status.rooms.map((room) => (
            <Link
              key={room.room_id}
              to={`/rooms/${encodeURIComponent(room.room_id)}`}
              className="bg-canvas-raised p-5 hover:bg-canvas-inset transition group relative overflow-hidden"
            >
              <span className="absolute top-3 right-3 font-mono text-2xs uppercase tracking-widest text-ink-500 group-hover:text-signal transition">
                open →
              </span>
              <p className="font-mono text-2xs uppercase tracking-widest text-signal">
                {room.project_id}
              </p>
              <p className="mt-2 text-base font-semibold text-ink-50 group-hover:text-signal transition">
                {truncate(room.title, 60)}
              </p>
              <p className="mt-3 font-mono text-2xs text-ink-500 break-all">
                {room.room_id}
              </p>
              <p className="mt-4 font-mono text-2xs uppercase tracking-widest text-ink-500">
                created {relativeTime(room.created_at)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function SkeletonGrid(): JSX.Element {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-edge border border-edge">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-canvas-raised p-5 animate-pulse">
          <div className="h-3 bg-edge rounded w-1/3" />
          <div className="mt-4 h-4 bg-edge rounded w-2/3" />
          <div className="mt-3 h-3 bg-edge rounded w-1/2" />
          <div className="mt-4 h-3 bg-edge rounded w-1/3" />
        </div>
      ))}
    </div>
  );
}
