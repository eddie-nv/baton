import { Link } from "react-router-dom";

export function Landing(): JSX.Element {
  return (
    <div className="relative">
      <Backdrop />

      <div className="mx-auto max-w-6xl px-6 relative">
        <Hero />
        <Stats />

        <NumberedSection
          num="01"
          tag="the cold-boot problem"
          title={
            <>
              Git checkout swaps your code.
              <br />
              <span className="text-signal">It does not swap your context.</span>
            </>
          }
          body="Open the same branch on a different laptop, or a different IDE, or with a different agent — and the model is born again. It re-reads files, re-asks what the bug was, re-tries the same dead-end, re-explains the same thing it just heard yesterday. The cost compounds: tokens, time, the patience of whoever is paired with the agent."
          aside={<ColdBootDiagram />}
        />

        <NumberedSection
          num="02"
          tag="features = branches"
          title={
            <>
              One feature card per branch.
              <br />
              <span className="text-signal">Five hundred tokens. Hard cap.</span>
            </>
          }
          body="Every git branch your team touches has exactly one card. The card is the compacted, deduped, token-budgeted view of what this feature is about: purpose, git state, files in play, hypotheses on the table, attempts that failed, blockers, next action. Truncation is deterministic at the JSON.SET boundary, measured against a real tokenizer — not vibes."
          aside={<FeatureCardMock />}
        />

        <NumberedSection
          num="03"
          tag="the event ledger"
          title={
            <>
              Append-only stream.
              <br />
              <span className="text-signal">Compactor writes the card.</span>
            </>
          }
          body="Eight typed event kinds — branch, edit, commit, error.test, hypothesis.raised, decision.made, session.pause, feature.merged — flow into a Redis stream. A pure compactor folds them into the card with explicit dedupe rules: hypotheses cap at 3 (drop oldest), failed attempts dedupe by signature, decisions clear hypotheses. Events are never mutated. The card is."
          aside={<EventLogMock />}
        />

        <NumberedSection
          num="04"
          tag="resume packets"
          title={
            <>
              Pause here.
              <br />
              <span className="text-signal">Continue mid-sentence anywhere.</span>
            </>
          }
          body="A resume packet is the card plus the last three decisions plus your blockers plus your next action — all assembled fresh, capped at 1,500 tokens. The receiving agent reads it once and proceeds. No ‘where would you like to start.’ No re-explaining the bug. The whole point is that the second agent should be indistinguishable from the first."
          aside={<HandoffMock />}
        />

        <NumberedSection
          num="05"
          tag="the data plane"
          title={
            <>
              Redis is the whole backend.
              <br />
              <span className="text-signal">JSON · Streams · Pub/Sub · Search.</span>
            </>
          }
          body="No Postgres. No Supabase. No external vector DB. RedisJSON for cards and checkpoints. Streams for the event ledger. Pub/Sub for live pause signals across IDEs. RediSearch for cross-room semantic lookup. One stateful service. One docker compose."
          aside={<RedisStack />}
        />

        <CTA />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────

function Hero(): JSX.Element {
  return (
    <section className="pt-20 pb-12 md:pt-28 md:pb-16">
      <div className="flex items-center gap-2 mb-6 font-mono text-2xs uppercase tracking-widest text-ink-500">
        <span className="live-dot" />
        <span className="text-signal">live from claude × jetbrains hackathon</span>
      </div>
      <h1 className="text-4xl md:text-6xl font-bold tracking-tightest leading-[1.05]">
        No cold boot
        <br />
        between laptops, agents,
        <br />
        or <span className="italic font-medium text-signal">teammates.</span>
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-ink-300">
        Git moves code between machines.{" "}
        <span className="text-ink-50">Baton moves working state.</span>{" "}
        Close a laptop mid-refactor, open another, switch IDEs, hand off — the
        session continues mid-sentence.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link to="/dashboard" className="btn-primary">
          open dashboard →
        </Link>
        <a
          href="https://github.com/eddie-nv/baton"
          target="_blank"
          rel="noreferrer"
          className="btn-ghost"
        >
          npx baton-mcp ↗
        </a>
        <span className="font-mono text-2xs uppercase tracking-widest text-ink-500">
          mit · single redis · zero secrets in shim
        </span>
      </div>
    </section>
  );
}

function Stats(): JSX.Element {
  const items = [
    { kpi: "≤ 500", label: "tokens per feature card" },
    { kpi: "≤ 1500", label: "tokens per resume packet" },
    { kpi: "8", label: "typed event kinds" },
    { kpi: "5", label: "MCP tools" },
  ];
  return (
    <section className="grid grid-cols-2 md:grid-cols-4 gap-px bg-edge border-y border-edge mb-20">
      {items.map((item) => (
        <div key={item.label} className="bg-canvas px-5 py-6 flex flex-col gap-1">
          <p className="font-mono text-3xl font-semibold text-ink-50 tracking-tight">
            {item.kpi}
          </p>
          <p className="font-mono text-2xs uppercase tracking-widest text-ink-500">
            {item.label}
          </p>
        </div>
      ))}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Numbered section scaffold
// ─────────────────────────────────────────────────────────────

interface NumberedSectionProps {
  num: string;
  tag: string;
  title: React.ReactNode;
  body: string;
  aside: React.ReactNode;
}

function NumberedSection({
  num,
  tag,
  title,
  body,
  aside,
}: NumberedSectionProps): JSX.Element {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 py-16 border-t border-edge">
      <div className="lg:col-span-5 lg:sticky lg:top-24 lg:self-start">
        <div className="flex items-baseline gap-3 mb-4">
          <span className="font-mono text-2xs text-signal tracking-widest">
            #{num}
          </span>
          <span className="font-mono text-2xs uppercase tracking-widest text-ink-500">
            {tag}
          </span>
        </div>
        <h2 className="text-2xl md:text-4xl font-bold tracking-tightest leading-tight">
          {title}
        </h2>
        <p className="mt-4 text-ink-300 leading-relaxed">{body}</p>
      </div>
      <div className="lg:col-span-7 min-w-0">{aside}</div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Backdrop / mocks
// ─────────────────────────────────────────────────────────────

function Backdrop(): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-[600px] bg-grid-fade"
    />
  );
}

function ColdBootDiagram(): JSX.Element {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Mock title="laptop a" subtitle="22:14 · alice@claude-code">
        <ol className="space-y-1.5">
          <LogLine type="action.branch">feat/payments-idempotency</LogLine>
          <LogLine type="hypothesis.raised">cache ttl wrong</LogLine>
          <LogLine type="error.test">duplicate_charge_on_retry</LogLine>
          <LogLine type="session.pause" muted>paused — closes laptop</LogLine>
        </ol>
      </Mock>
      <Mock title="laptop b" subtitle="08:02 · bob@cursor">
        <ol className="space-y-1.5">
          <LogLine type="—" muted>new chat</LogLine>
          <LogLine type="—" muted>re-reads charge.ts, refund.ts, ledger.ts</LogLine>
          <LogLine type="—" muted>asks: "what were we trying to do?"</LogLine>
        </ol>
        <p className="mt-3 font-mono text-2xs uppercase tracking-widest text-evt-error">
          ↳ cold boot · 3,200 tokens wasted
        </p>
      </Mock>
    </div>
  );
}

function FeatureCardMock(): JSX.Element {
  return (
    <Mock
      title="feature_card · feat_payments_idempotency"
      subtitle="312 / 500 tokens · ok"
      tone="signal"
    >
      <pre className="text-2xs leading-5 text-ink-100 whitespace-pre overflow-x-auto">
{`{
  "feature_id":   "feat_payments_idempotency",
  "state":        "in_progress",
  "purpose":      "make POST /charge idempotent across POS retries",
  "git": {
    "branch":         "feat/payments-idempotency",
    "parent_branch":  "release/payments-v2",
    "head_sha":       "a1b2c3d",
    "commits_ahead":  3
  },
  "hypotheses": [
    "middleware order: dedupe runs after request logging",
    "ledger double-write under retry — race in commit ordering"
  ],
  "failed_attempts": [
    { "signature": "audit_log_invariant_broken",
      "summary":   "swapping ledger write order breaks audit",
      "event_ids": ["evt_…", "evt_…"] }
  ],
  "next_action":  "write integration test for 409 on duplicate Idempotency-Key"
}`}
      </pre>
    </Mock>
  );
}

function EventLogMock(): JSX.Element {
  return (
    <Mock
      title="events:room_payments:feat_payments_idempotency"
      subtitle="redis stream · 13 entries"
    >
      <ol className="space-y-1.5">
        <LogLine type="action.branch" ts="22:14:03">
          alice → feat/payments-idempotency from release/payments-v2 @ abc1234
        </LogLine>
        <LogLine type="action.edit" ts="22:14:51">
          alice → src/payments/charge.ts
        </LogLine>
        <LogLine type="error.test" ts="22:18:09">
          duplicate_charge_on_retry — POST /charge twice yields two ledger entries
        </LogLine>
        <LogLine type="hypothesis.raised" ts="22:18:32">
          ledger double-write under retry — race in commit ordering
        </LogLine>
        <LogLine type="action.edit" ts="22:21:47">
          alice → src/payments/ledger.ts
        </LogLine>
        <LogLine type="error.test" ts="22:24:11">
          audit_log_invariant_broken — swap broke audit
        </LogLine>
        <LogLine type="hypothesis.raised" ts="22:24:55">
          middleware order: dedupe runs after request logging
        </LogLine>
        <LogLine type="decision.made" ts="22:31:02">
          adopt Idempotency-Key middleware in front of /charge
        </LogLine>
        <LogLine type="action.commit" ts="22:33:47">
          a1b2c3d · charge.ts middleware.ts
        </LogLine>
        <LogLine type="session.pause" ts="22:34:00" muted>
          alice paused → sess_alice_pay_idem
        </LogLine>
      </ol>
    </Mock>
  );
}

function HandoffMock(): JSX.Element {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Mock title="claude code · alice" subtitle="22:34 · sess_alice_pay_idem">
        <pre className="text-2xs leading-5 text-ink-300 whitespace-pre">
{`> /baton-save
  next_action: write integration test
    for 409 on duplicate Idempotency-Key
  blockers: []
  → checkpoint_id ck_3kPq…
  → publishing room:…:sessions`}
        </pre>
      </Mock>
      <Mock title="cursor · bob" subtitle="08:02 next morning" tone="signal">
        <pre className="text-2xs leading-5 text-ink-100 whitespace-pre">
{`> /baton-resume sess_alice_pay_idem
  ⤷ feature_card.git.branch
      feat/payments-idempotency
  ⤷ last decision
      adopt Idempotency-Key middleware
      in front of /charge
  ⤷ next_action
      write integration test for 409
      on duplicate Idempotency-Key

  let me write that test now…`}
        </pre>
      </Mock>
    </div>
  );
}

function RedisStack(): JSX.Element {
  const rows = [
    { k: "RedisJSON", v: "feature cards · room metadata · checkpoints (TTL 7d)" },
    { k: "Streams", v: "events:<room>:<feature> · append-only ledger" },
    { k: "Pub/Sub", v: "room:<id>:sessions · session.pause broadcasts" },
    { k: "RediSearch", v: "idx:features · text + vector for cross-room lookup" },
  ];
  return (
    <Mock
      title="redis-stack · single instance"
      subtitle="docker compose up -d redis"
    >
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.k} className="border-b border-edge last:border-0">
              <td className="py-2 pr-4 font-mono text-signal text-2xs uppercase tracking-widest whitespace-nowrap align-top">
                {r.k}
              </td>
              <td className="py-2 text-ink-300 font-mono text-xs">{r.v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Mock>
  );
}

function CTA(): JSX.Element {
  return (
    <section className="my-20">
      <div className="rounded-md border border-edge bg-canvas-raised p-8 md:p-12 relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-signal/10 blur-3xl"
        />
        <p className="section-num">→ try it</p>
        <h2 className="mt-2 text-2xl md:text-3xl font-bold tracking-tightest">
          The dashboard is reading the same Redis your IDE is writing to.
        </h2>
        <p className="mt-3 text-ink-300 max-w-2xl">
          Three rooms, seven features, fifty events seeded. Open it and watch
          the cards stay under budget while the events keep flowing.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/dashboard" className="btn-primary">
            open dashboard →
          </Link>
          <a
            href="https://github.com/eddie-nv/baton"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost"
          >
            read the source ↗
          </a>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Reusable mock surface (terminal-window aesthetic)
// ─────────────────────────────────────────────────────────────

interface MockProps {
  title: string;
  subtitle?: string;
  tone?: "default" | "signal";
  children: React.ReactNode;
}

function Mock({
  title,
  subtitle,
  tone = "default",
  children,
}: MockProps): JSX.Element {
  return (
    <div
      className={`terminal ${
        tone === "signal"
          ? "ring-1 ring-signal/30 shadow-[0_0_40px_-10px_rgba(34,211,238,0.4)]"
          : ""
      }`}
    >
      <div className="terminal-bar justify-between">
        <div className="flex items-center gap-1.5">
          <span className="terminal-dot bg-evt-error/70" />
          <span className="terminal-dot bg-evt-decision/70" />
          <span className="terminal-dot bg-evt-commit/70" />
        </div>
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-2xs uppercase tracking-widest text-ink-300 truncate max-w-[260px] sm:max-w-none">
            {title}
          </span>
          {subtitle !== undefined ? (
            <span className="hidden lg:inline font-mono text-2xs uppercase tracking-widest text-ink-500">
              {subtitle}
            </span>
          ) : null}
        </div>
        <span />
      </div>
      <div className="terminal-body">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Log line — used in event ledger and cold-boot diagram
// ─────────────────────────────────────────────────────────────

interface LogLineProps {
  type: string;
  ts?: string;
  muted?: boolean;
  children: React.ReactNode;
}

const TYPE_TONE: Record<string, string> = {
  "action.branch": "text-evt-branch",
  "action.edit": "text-evt-edit",
  "action.commit": "text-evt-commit",
  "error.test": "text-evt-error",
  "hypothesis.raised": "text-evt-hypothesis",
  "decision.made": "text-evt-decision",
  "session.pause": "text-evt-pause",
  "feature.merged": "text-evt-merged",
};

function LogLine({
  type,
  ts,
  muted = false,
  children,
}: LogLineProps): JSX.Element {
  const tone = TYPE_TONE[type] ?? "text-ink-500";
  return (
    <li
      className={`grid grid-cols-[80px_140px_1fr] gap-3 items-baseline font-mono text-xs ${
        muted ? "opacity-60" : ""
      }`}
    >
      <span className="text-ink-500 tabular-nums">{ts ?? ""}</span>
      <span className={`${tone} truncate`}>{type}</span>
      <span className="text-ink-100 break-words">{children}</span>
    </li>
  );
}
