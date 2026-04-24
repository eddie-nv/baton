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
              className={`w-full text-left card transition ${
                active
                  ? "border-accent ring-2 ring-accent/20"
                  : "hover:border-ink-300"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm text-ink-900 truncate">
                    {f.feature_id}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500 truncate">
                    {f.git.branch || "(no branch yet)"}
                  </p>
                </div>
                <Badge tone={f.state}>{f.state.replace("_", " ")}</Badge>
              </div>
              {f.purpose !== "" ? (
                <p className="mt-2 text-xs text-ink-500 line-clamp-2">
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
