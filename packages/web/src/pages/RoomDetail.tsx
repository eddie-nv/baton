import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ApiError,
  getRoom,
  listFeatures,
  type Room,
} from "../lib/api.js";
import type { FeatureCard } from "@baton/shared";
import { EmptyState } from "../components/EmptyState.js";
import { formatDate, relativeTime } from "../lib/format.js";

type Status =
  | { kind: "loading" }
  | { kind: "ok"; room: Room; features: FeatureCard[] }
  | { kind: "error"; message: string };

export function RoomDetail(): JSX.Element {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId ?? "";
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    Promise.all([getRoom(roomId), listFeatures(roomId)])
      .then(([roomRes, featuresRes]) => {
        if (cancelled) return;
        setStatus({
          kind: "ok",
          room: roomRes.room,
          features: featuresRes.features,
        });
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
  }, [roomId]);

  if (status.kind === "loading") {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm text-ink-500">Loading room…</p>
      </div>
    );
  }
  if (status.kind === "error") {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link to="/dashboard" className="text-sm text-accent hover:underline">
          ← back to dashboard
        </Link>
        <div className="mt-4">
          <EmptyState title="Failed to load room" description={status.message} />
        </div>
      </div>
    );
  }

  const { room, features } = status;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
      <div>
        <Link to="/dashboard" className="text-sm text-accent hover:underline">
          ← back to dashboard
        </Link>
      </div>

      <header className="card">
        <h1 className="text-2xl font-bold tracking-tight">{room.title}</h1>
        <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Field label="room_id" value={room.room_id} mono />
          <Field label="project_id" value={room.project_id} mono />
          <Field
            label="created"
            value={`${formatDate(room.created_at)} (${relativeTime(room.created_at)})`}
          />
          <Field label="features" value={`${features.length}`} />
        </dl>
      </header>

      <section>
        <h2 className="text-lg font-semibold mb-3">Features</h2>
        {features.length === 0 ? (
          <EmptyState
            title="No features yet"
            description="A feature exists once you fire an event for it (e.g. action.branch)."
          />
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {features.map((f) => (
              <li key={f.feature_id} className="card">
                <p className="font-mono text-sm text-ink-900">{f.feature_id}</p>
                <p className="mt-1 text-xs text-ink-500">
                  {f.git.branch || "(no branch yet)"} · state: {f.state}
                </p>
                <p className="mt-2 text-sm text-ink-700">
                  {f.purpose || <span className="text-ink-500">(no purpose set)</span>}
                </p>
                <p className="mt-3 text-xs text-ink-500">
                  Phase 4 will add the events timeline + resume packet view here.
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  mono?: boolean;
}

function Field({ label, value, mono }: FieldProps): JSX.Element {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-500">{label}</dt>
      <dd
        className={`mt-0.5 ${mono === true ? "font-mono text-xs break-all" : "text-sm"} text-ink-900`}
      >
        {value}
      </dd>
    </div>
  );
}
