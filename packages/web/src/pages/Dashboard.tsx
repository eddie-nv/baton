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
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rooms</h1>
          <p className="mt-1 text-sm text-ink-500">
            Every initiative your team is working on. Click a room to see its
            features, events, and resume packets.
          </p>
        </div>
        {status.kind === "ok" ? (
          <p className="text-xs font-mono text-ink-500">
            {status.rooms.length} room{status.rooms.length === 1 ? "" : "s"}
          </p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {status.rooms.map((room) => (
            <Link
              key={room.room_id}
              to={`/rooms/${encodeURIComponent(room.room_id)}`}
              className="card hover:border-accent hover:shadow-md transition group"
            >
              <p className="text-sm font-semibold text-ink-900 group-hover:text-accent transition">
                {truncate(room.title, 60)}
              </p>
              <p className="mt-2 font-mono text-[11px] text-ink-500 break-all">
                {room.room_id}
              </p>
              <div className="mt-3 flex items-center justify-between text-xs text-ink-500">
                <span className="font-mono">{room.project_id}</span>
                <span>{relativeTime(room.created_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function SkeletonGrid(): JSX.Element {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card animate-pulse">
          <div className="h-4 bg-ink-100 rounded w-2/3" />
          <div className="mt-3 h-3 bg-ink-100 rounded w-1/2" />
          <div className="mt-3 h-3 bg-ink-100 rounded w-1/3" />
        </div>
      ))}
    </div>
  );
}
