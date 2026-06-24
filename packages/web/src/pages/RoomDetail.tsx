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
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p className="font-mono text-2xs uppercase tracking-widest text-ink-500">
          loading room…
        </p>
      </div>
    );
  }
  if (status.kind === "error") {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <Link
          to="/dashboard"
          className="font-mono text-2xs uppercase tracking-widest text-ink-300 hover:text-signal transition"
        >
          ← dashboard
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
      <Link
        to="/dashboard"
        className="font-mono text-2xs uppercase tracking-widest text-ink-300 hover:text-signal transition"
      >
        ← dashboard
      </Link>

      <header className="border-b border-edge pb-6">
        <p className="font-mono text-2xs uppercase tracking-widest text-signal">
          {room.project_id}
        </p>
        <h1 className="mt-1 text-3xl md:text-4xl font-bold tracking-tightest">
          {room.title}
        </h1>
        <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-px bg-edge border border-edge">
          <Field label="room_id" value={room.room_id} />
          <Field
            label="created"
            value={relativeTime(room.created_at)}
            tooltip={formatDate(room.created_at)}
          />
          <Field label="features" value={`${features.length}`} />
          <Field
            label="status"
            value={features.length > 0 ? "active" : "empty"}
          />
        </dl>
      </header>

      {features.length === 0 ? (
        <EmptyState
          title="No features yet"
          description="A feature exists once you fire an event for it (e.g. action.branch)."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <p className="font-mono text-2xs uppercase tracking-widest text-signal mb-3">
              features ({features.length})
            </p>
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
            <div className="space-y-5 min-w-0">
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
  tooltip?: string;
}

function Field({ label, value, tooltip }: FieldProps): JSX.Element {
  return (
    <div className="bg-canvas-raised px-4 py-3">
      <dt className="font-mono text-2xs uppercase tracking-widest text-ink-500">
        {label}
      </dt>
      <dd
        className="mt-1 font-mono text-xs text-ink-50 break-all"
        title={tooltip}
      >
        {value}
      </dd>
    </div>
  );
}
