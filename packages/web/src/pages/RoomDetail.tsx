import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ApiError,
  getRoom,
  listFeatures,
  type Room,
} from "../lib/api.js";
import type { FeatureCard } from "@baton/shared";
import { EmptyState } from "../components/EmptyState.js";
import { FeatureList } from "../components/FeatureList.js";
import { FeatureCardView } from "../components/FeatureCardView.js";
import { ResumePacketView } from "../components/ResumePacketView.js";
import { EventTimeline } from "../components/EventTimeline.js";
import { CheckpointsList } from "../components/CheckpointsList.js";
import { formatDate, relativeTime } from "../lib/format.js";

type Status =
  | { kind: "loading" }
  | { kind: "ok"; room: Room; features: FeatureCard[] }
  | { kind: "error"; message: string };

export function RoomDetail(): JSX.Element {
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId ?? "";
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    setStatus({ kind: "loading" });
    Promise.all([getRoom(roomId), listFeatures(roomId)])
      .then(([roomRes, featuresRes]) => {
        if (cancelled) return;
        const features = [...featuresRes.features].sort((a, b) =>
          a.feature_id.localeCompare(b.feature_id),
        );
        setStatus({ kind: "ok", room: roomRes.room, features });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof ApiError
            ? `${err.code}: ${err.message}`
            : err instanceof Error
              ? err.message
              : "unknown";
        setStatus({ kind: "error", message });
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const features = status.kind === "ok" ? status.features : [];
  const requestedFeatureId = searchParams.get("feature");

  const selectedFeature = useMemo<FeatureCard | null>(() => {
    if (features.length === 0) return null;
    if (requestedFeatureId !== null) {
      const match = features.find((f) => f.feature_id === requestedFeatureId);
      if (match !== undefined) return match;
    }
    return features[0] ?? null;
  }, [features, requestedFeatureId]);

  // Sync URL with default selection so deep-links + back button work.
  useEffect(() => {
    if (requestedFeatureId === null && selectedFeature !== null) {
      const next = new URLSearchParams(searchParams);
      next.set("feature", selectedFeature.feature_id);
      setSearchParams(next, { replace: true });
    }
  }, [requestedFeatureId, selectedFeature, searchParams, setSearchParams]);

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

  const { room } = status;

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

      {features.length === 0 ? (
        <EmptyState
          title="No features yet"
          description="A feature exists once you fire an event for it (e.g. action.branch)."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          <aside>
            <h2 className="text-xs uppercase tracking-wide text-ink-500 mb-2">
              Features
            </h2>
            <FeatureList
              features={features}
              selectedFeatureId={selectedFeature?.feature_id ?? null}
              onSelect={(featureId) => {
                const next = new URLSearchParams(searchParams);
                next.set("feature", featureId);
                setSearchParams(next, { replace: false });
              }}
            />
          </aside>

          {selectedFeature !== null ? (
            <div className="space-y-6 min-w-0">
              <FeatureCardView card={selectedFeature} />
              <ResumePacketView
                roomId={room.room_id}
                featureId={selectedFeature.feature_id}
              />
              <CheckpointsList
                roomId={room.room_id}
                featureId={selectedFeature.feature_id}
              />
              <EventTimeline
                roomId={room.room_id}
                featureId={selectedFeature.feature_id}
              />
            </div>
          ) : null}
        </div>
      )}
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
