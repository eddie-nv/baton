import type { FeatureCard } from "@baton/shared";
import { Badge } from "./Badge.js";

interface FeatureListProps {
  features: FeatureCard[];
  selectedFeatureId: string | null;
  onSelect: (featureId: string) => void;
}

export function FeatureList({
  features,
  selectedFeatureId,
  onSelect,
}: FeatureListProps): JSX.Element {
  return (
    <ul className="space-y-2">
      {features.map((f) => {
        const active = f.feature_id === selectedFeatureId;
        return (
          <li key={f.feature_id}>
            <button
              type="button"
              onClick={() => onSelect(f.feature_id)}
              className={`w-full text-left card-tight transition ${
                active
                  ? "border-signal/60 bg-signal/[0.04]"
                  : "hover:border-edge-strong"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p
                    className={`font-mono text-xs truncate ${
                      active ? "text-signal" : "text-ink-50"
                    }`}
                  >
                    {f.feature_id}
                  </p>
                  <p className="mt-0.5 font-mono text-2xs text-ink-500 truncate">
                    {f.git.branch || "—"}
                  </p>
                </div>
                <Badge tone={f.state}>{f.state.replace("_", " ")}</Badge>
              </div>
              {f.purpose !== "" ? (
                <p className="mt-2 text-xs text-ink-300 line-clamp-2">
                  {f.purpose}
                </p>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
