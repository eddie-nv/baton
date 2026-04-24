import { Link } from "react-router-dom";

interface Feature {
  title: string;
  body: string;
}

const FEATURES: Feature[] = [
  {
    title: "Branch-anchored memory",
    body: "Features are 1:1 with git branches. Switch branches, switch context — the right state shows up automatically.",
  },
  {
    title: "≤ 500 token feature card",
    body: "Compactor folds events into a token-budgeted card. Hard cap, enforced at write time. Real measurement, not vibes.",
  },
  {
    title: "≤ 1,500 token resume packet",
    body: "Newest decisions, current blockers, next action. Fits in any model's prompt without churning context.",
  },
  {
    title: "MCP shim ships zero secrets",
    body: "Thin stdio forwarder. Auth lives on the backend. Bearer room id is the only thing your IDE knows.",
  },
  {
    title: "Redis is the whole data plane",
    body: "RedisJSON for cards, Streams for events, Pub/Sub for live signals, RediSearch for find. No Postgres, no Supabase.",
  },
  {
    title: "Cross-IDE handoff",
    body: "Pause a session in Claude Code. Resume mid-sentence in Cursor. No cold boot on branch switch.",
  },
];

export function Landing(): JSX.Element {
  return (
    <div className="mx-auto max-w-6xl px-6">
      <section className="py-20 md:py-28">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">
          state fabric for coding agents
        </p>
        <h1 className="mt-3 text-4xl md:text-6xl font-bold tracking-tight">
          Git moves your code.
          <br />
          <span className="text-accent">Baton passes the why.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-ink-500">
          Close a laptop mid-refactor, open another, switch IDEs, hand off to a
          teammate — the session continues mid-sentence. No cold boot when you
          <code className="mx-1 px-1.5 py-0.5 bg-ink-100 rounded text-ink-900">
            git checkout
          </code>
          .
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Link to="/dashboard" className="btn-primary">
            Open dashboard
          </Link>
          <a
            href="https://github.com/eddie-nv/baton"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost"
          >
            View on GitHub
          </a>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
        {FEATURES.map((f) => (
          <article key={f.title} className="card">
            <h3 className="font-semibold text-ink-900">{f.title}</h3>
            <p className="mt-2 text-sm text-ink-500">{f.body}</p>
          </article>
        ))}
      </section>

      <section className="card mb-20">
        <h2 className="text-lg font-semibold text-ink-900">How it works</h2>
        <ol className="mt-3 space-y-2 text-sm text-ink-500">
          <li>
            <span className="font-mono text-ink-900">1.</span> Your IDE registers a
            tiny stdio MCP shim (<code>npx baton-mcp</code>). It speaks five
            tools: create_room, append_event, get_feature_card,
            write_checkpoint, get_resume_packet.
          </li>
          <li>
            <span className="font-mono text-ink-900">2.</span> Every relevant action
            (branching, editing, raising a hypothesis, deciding) becomes a typed
            event on a Redis stream.
          </li>
          <li>
            <span className="font-mono text-ink-900">3.</span> A pure compactor
            folds the stream into a feature card. Hypotheses cap at 3, failed
            attempts dedupe by signature, the whole thing stays under 500 tokens.
          </li>
          <li>
            <span className="font-mono text-ink-900">4.</span> Resume in any IDE on
            any machine. The packet hands the next agent everything it needs and
            nothing it doesn’t.
          </li>
        </ol>
      </section>
    </div>
  );
}
