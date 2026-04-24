import { CARD_BUDGET, type FeatureCard } from "@baton/shared";
import { Badge } from "./Badge.js";
import { approximateTokens } from "../lib/format.js";

interface FeatureCardViewProps {
  card: FeatureCard;
}

export function FeatureCardView({ card }: FeatureCardViewProps): JSX.Element {
  const tokens = approximateTokens(card);
  const overBudget = tokens > CARD_BUDGET;

  return (
    <section className="card space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-ink-500">{card.feature_id}</p>
          <h3 className="mt-1 text-lg font-semibold text-ink-900">
            {card.purpose || "(no purpose set)"}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={card.state}>{card.state.replace("_", " ")}</Badge>
          <span
            className={`pill ${
              overBudget
                ? "bg-rose-50 text-rose-900 border border-rose-200"
                : "bg-ink-100 text-ink-700 border border-ink-200"
            }`}
            title={`approximate token count ${tokens} of ${CARD_BUDGET} budget (server enforces exactly with js-tiktoken)`}
          >
            ~{tokens} / {CARD_BUDGET} tok
          </span>
        </div>
      </header>

      <Section label="git">
        <KV k="branch" v={card.git.branch || "—"} mono />
        <KV k="parent" v={card.git.parent_branch || "—"} mono />
        <KV
          k="head"
          v={`${card.git.head_sha || "—"} (${card.git.commits_ahead} ahead)`}
          mono
        />
        {card.git.dirty_files.length > 0 ? (
          <KV k="dirty" v={card.git.dirty_files.join(", ")} mono />
        ) : null}
      </Section>

      <Section label="surface">
        <KV
          k="files"
          v={card.surface.files.length === 0 ? "—" : card.surface.files.join(", ")}
          mono
        />
        <KV
          k="services"
          v={
            card.surface.services.length === 0
              ? "—"
              : card.surface.services.join(", ")
          }
          mono
        />
      </Section>

      {card.invariants.length > 0 ? (
        <Section label="invariants">
          <ul className="list-disc pl-5 text-sm text-ink-700 space-y-1">
            {card.invariants.map((inv, i) => (
              <li key={i}>{inv}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {card.hypotheses.length > 0 ? (
        <Section label={`hypotheses (${card.hypotheses.length}/3)`}>
          <ul className="list-disc pl-5 text-sm text-ink-700 space-y-1">
            {card.hypotheses.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {card.failed_attempts.length > 0 ? (
        <Section label={`failed attempts (${card.failed_attempts.length})`}>
          <ul className="space-y-1.5 text-sm text-ink-700">
            {card.failed_attempts.map((a) => (
              <li key={a.signature}>
                <span className="font-mono text-xs text-ink-500">
                  {a.signature}
                </span>{" "}
                — {a.summary}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {card.open_blockers.length > 0 ? (
        <Section label="open blockers">
          <ul className="list-disc pl-5 text-sm text-ink-700 space-y-1">
            {card.open_blockers.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section label="next action">
        <p className="text-sm text-ink-900">
          {card.next_action || (
            <span className="text-ink-500">(none)</span>
          )}
        </p>
      </Section>
    </section>
  );
}

interface SectionProps {
  label: string;
  children: React.ReactNode;
}
function Section({ label, children }: SectionProps): JSX.Element {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink-500 mb-1.5">
        {label}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

interface KVProps {
  k: string;
  v: string;
  mono?: boolean;
}
function KV({ k, v, mono }: KVProps): JSX.Element {
  return (
    <p className="text-sm">
      <span className="text-ink-500">{k}: </span>
      <span className={mono === true ? "font-mono text-ink-900" : "text-ink-900"}>
        {v}
      </span>
    </p>
  );
}
