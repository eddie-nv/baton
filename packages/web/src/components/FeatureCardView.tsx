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
    <section className="card space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-edge">
        <div className="min-w-0">
          <p className="font-mono text-2xs uppercase tracking-widest text-signal">
            feature_card
          </p>
          <p className="mt-1 font-mono text-xs text-ink-300 break-all">
            {card.feature_id}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-ink-50 leading-snug">
            {card.purpose || (
              <span className="text-ink-500 italic">no purpose set</span>
            )}
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge tone={card.state}>{card.state.replace("_", " ")}</Badge>
          <span
            className={`pill border ${
              overBudget
                ? "border-evt-error/40 bg-evt-error/10 text-evt-error"
                : "border-edge text-ink-300"
            }`}
            title={`approximate token count ${tokens} of ${CARD_BUDGET} budget (server enforces exactly with js-tiktoken)`}
          >
            ~{tokens} / {CARD_BUDGET} tok
          </span>
        </div>
      </header>

      <Section label="git">
        <KV k="branch" v={card.git.branch || "—"} />
        <KV k="parent" v={card.git.parent_branch || "—"} />
        <KV
          k="head"
          v={`${card.git.head_sha || "—"} · ${card.git.commits_ahead} ahead`}
        />
        {card.git.dirty_files.length > 0 ? (
          <KV k="dirty" v={card.git.dirty_files.join(", ")} />
        ) : null}
      </Section>

      <Section label="surface">
        <KV
          k="files"
          v={card.surface.files.length === 0 ? "—" : card.surface.files.join(", ")}
        />
        <KV
          k="services"
          v={
            card.surface.services.length === 0
              ? "—"
              : card.surface.services.join(", ")
          }
        />
      </Section>

      {card.invariants.length > 0 ? (
        <Section label="invariants">
          <BulletList items={card.invariants} />
        </Section>
      ) : null}

      {card.hypotheses.length > 0 ? (
        <Section label={`hypotheses (${card.hypotheses.length}/3)`}>
          <BulletList items={card.hypotheses} tone="hypothesis" />
        </Section>
      ) : null}

      {card.failed_attempts.length > 0 ? (
        <Section label={`failed attempts (${card.failed_attempts.length})`}>
          <ul className="space-y-1.5">
            {card.failed_attempts.map((a) => (
              <li
                key={a.signature}
                className="grid grid-cols-[160px_1fr] gap-3 items-baseline font-mono text-xs"
              >
                <span className="text-evt-error truncate">{a.signature}</span>
                <span className="text-ink-300">{a.summary}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {card.open_blockers.length > 0 ? (
        <Section label="open blockers">
          <BulletList items={card.open_blockers} tone="error" />
        </Section>
      ) : null}

      <Section label="next action">
        <p className="text-sm text-ink-50">
          {card.next_action || <span className="text-ink-500 italic">none</span>}
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
      <p className="font-mono text-2xs uppercase tracking-widest text-signal mb-2">
        {label}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

interface KVProps {
  k: string;
  v: string;
}
function KV({ k, v }: KVProps): JSX.Element {
  return (
    <p className="grid grid-cols-[100px_1fr] gap-3 items-baseline font-mono text-xs">
      <span className="text-ink-500">{k}</span>
      <span className="text-ink-50 break-all">{v}</span>
    </p>
  );
}

interface BulletListProps {
  items: string[];
  tone?: "default" | "hypothesis" | "error";
}
function BulletList({ items, tone = "default" }: BulletListProps): JSX.Element {
  const dotTone =
    tone === "hypothesis"
      ? "text-evt-hypothesis"
      : tone === "error"
        ? "text-evt-error"
        : "text-signal";
  return (
    <ul className="space-y-1 text-sm text-ink-100">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className={`${dotTone} font-mono select-none`}>●</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
