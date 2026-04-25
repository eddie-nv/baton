# Baton

> Git moves your code between machines. Baton passes the *why* — branch by branch.

A state fabric for coding agents. Close a laptop mid-refactor, open another,
switch IDEs, hand off to a teammate — the session continues mid-sentence.

---

## The problem

Coding agents have no memory across sessions. Every time you close the laptop,
switch branches, change IDE, or hand the work to a teammate, the next agent
starts cold. The replacement re-reads the same files, re-derives the same
hypotheses, re-discovers the same dead ends, and asks you to explain decisions
that were already made an hour ago. The cost isn't tokens — it's the lost
context about *why* the previous agent did what it did.

The usual workarounds don't fix it:

- **Project-level memory files** (`CLAUDE.md`, `.cursor/rules`) capture conventions,
  not the live state of an in-progress branch. They go stale the moment you
  start writing code.
- **Long context windows** delay the problem instead of solving it. Once you
  cross the cache TTL or hit compaction, the working set is gone, and the
  context isn't portable to a different agent or a different machine.
- **Chat exports / "save my session"** preserve the dialogue but not the
  *structured* state — what files are dirty, which hypotheses are still live,
  which were ruled out, what the next concrete action is.
- **Ad-hoc PR descriptions** capture the outcome but not the in-flight state,
  and they only exist after the work is done.

What's missing is a small, structured handoff packet — branch-scoped, agent-
agnostic, bounded in size — that any agent on any machine can read at session
start and continue from.

## What Baton does

Baton is an MCP server that gives agents three primitives:

1. **Append events** as work happens — branch creation, edits, test failures,
   hypotheses, decisions, commits, session pauses. The event stream is the
   source of truth.
2. **Compact** the stream into a small **FeatureCard** (≤ 500 tokens, hard cap)
   that captures the current state of one feature: branch, dirty files,
   surface area, live hypotheses, deduplicated failed attempts, open blockers,
   next action.
3. **Resume** — assemble a **ResumePacket** (≤ 1,500 tokens, hard cap) on
   demand: the current FeatureCard plus the last three decisions plus an
   optional checkpoint's next-action and blockers. This is what the next
   agent reads at session start.

Token budgets are enforced exactly (`js-tiktoken`), not estimated. Every write
goes through a single boundary that re-counts and refuses to persist a card
that exceeds the cap; the compactor drops oldest-first deterministically when
arrays grow. The packet is derived, not stored — assembled fresh from already-
compacted state and truncated in a fixed order before return.

The result: an agent walking into an in-progress branch reads ~1,500 tokens
and knows what's been tried, what's been decided, what's blocked, and what to
do next. No re-reading the diff. No re-asking the human.

### Why agents need this and humans don't

Humans hold context in their head between sessions. Agents reset on every
session boundary, every branch switch, every hand-off. The state that lives
implicitly in a developer's working memory has to live *explicitly* somewhere
for agents — and it has to fit in a context window. Hence the hard caps.

## The stack

**Storage — Redis Stack** (with RedisJSON + Streams):

- `events:<room>:<feature>` is a Redis Stream — append-only, totally ordered,
  one entry per appended event. The compactor reads forward from the stream to
  build the card; admin queries `XREVRANGE` to find recent decisions.
- `feature:<room>:<feature>` is a RedisJSON document — the compacted card.
  One write per appended event, atomic via `JSON.SET`.
- `checkpoint:<room>:<session>` is a RedisJSON document — the optional
  next-action + blockers a paused session leaves behind for the next pickup.
- `room:<room>` holds room metadata.

**Backend — Node + Hono + TypeScript** (`packages/backend`):

- Hono on `@hono/node-server` for HTTP. Two route trees: `/api/mcp/:tool` for
  the MCP dispatcher and `/api/admin/*` for read-only inspection used by the
  web UI.
- Per-tool handlers in `src/tools/` (`create_room`, `append_event`,
  `get_feature_card`, `get_resume_packet`, `write_checkpoint`).
- A pure, immutable compactor (`src/compactor/`) — one handler per event type,
  every handler returns a new card or the same reference on no-op. Handlers
  validate their own payload with Zod sub-schemas.
- `js-tiktoken` does the exact counting at the JSON.SET write boundary
  (`src/util/tokens.ts`). This is the single chokepoint that enforces the
  500-token cap; there is no alternative write path.
- Auth: simple bearer-token-as-room-id check on every MCP call (`Authorization:
  Bearer <room_id>`). Room IDs are unguessable nanoids.

**Shared types — `@baton/shared`** (`packages/shared`):

- Source of truth for `Event`, `FeatureCard`, `ResumePacket`, and the Zod
  schemas for every MCP tool's input/output.
- `truncateCard` / `truncatePacket` — deterministic, immutable truncation
  routines used by both the backend write boundary and the resume assembly.
- Consumed by backend, web, and the MCP shim, so the wire format and the
  in-memory shape can never drift.

**MCP shim — `@baton/mcp-shim`** (`packages/mcp-shim`):

- A thin stdio MCP server built on `@modelcontextprotocol/sdk`. Forwards each
  tool call to the backend's HTTP endpoint with the configured `BATON_ROOM_ID`
  as the bearer token.
- Distributed as the `baton-mcp` binary; clients (Claude Code, Cursor, Codex,
  Claude Desktop, Windsurf) register it with their MCP config.
- Configuration is environment-only: `BATON_API_URL`, `BATON_ROOM_ID`,
  `BATON_ACTOR_ID`, optional `BATON_FEATURE_ID`. No client-side state, no
  config file to drift.

**Web — `@baton/web`** (`packages/web`):

- React 18 + Vite + Tailwind. React Router for the dashboard / room-detail /
  feature-detail views.
- Renders the FeatureCard, the ResumePacket (with the same token-budget pill
  the agents see), the event timeline (paginated cursor over the Redis stream),
  and the active checkpoints list.
- In production the backend serves the built bundle as static assets — single
  process, single port.

**Deploy — single-process Node + Redis Stack**:

- Backend serves `/api/*` and the static web bundle.
- `deploy/docker-compose.yml` boots Redis Stack locally; `deploy/README.md`
  has the EC2 runbook.

**Observability**:

- Structured request logging middleware on every HTTP route.
- Redis pub/sub on `room:<room>:sessions` channel, published whenever a
  `session.pause` event is appended — the web UI subscribes to surface
  hand-off events live.

**Testing**:

- Vitest across all packages. Unit tests for the compactor's pure handlers,
  integration tests for tool handlers (real Redis on `db=15`), end-to-end
  smoke (`scripts/verify.ts`) that exercises the full MCP HTTP surface.

## Architecture in one diagram

```
┌──────────────────┐  stdio MCP   ┌──────────────────┐
│ Claude Code,     │ ───────────▶ │ baton-mcp shim   │
│ Cursor, Codex,   │ ◀─────────── │ (per client)     │
│ Claude Desktop   │              └──────┬───────────┘
└──────────────────┘                     │ HTTP + Bearer<room_id>
                                         ▼
                              ┌──────────────────────┐         ┌──────────────────┐
                              │  @baton/backend      │────────▶│  Redis Stack     │
                              │  (Hono on Node)      │ JSON+   │  - Streams       │
                              │  /api/mcp/:tool      │ Streams │  - RedisJSON     │
                              │  /api/admin/*        │  pub/sub│  - pub/sub       │
                              │  static web bundle   │         └──────────────────┘
                              └──────────┬───────────┘
                                         │ same process serves the SPA
                                         ▼
                              ┌──────────────────────┐
                              │  @baton/web (React)  │
                              │  dashboards          │
                              └──────────────────────┘
```

The arrow from the IDE *isn't* through the web UI — agents talk MCP, humans
talk HTTP/HTML. The dashboard is read-only; the only writes flow from agents
through the MCP shim.

## Quick start

```sh
# Start Redis Stack
docker compose -f deploy/docker-compose.yml up -d redis

# Install + build everything
npm install
npm run build

# Run the backend (serves /api and the web SPA on :3000)
npm run dev:backend

# In another terminal, run the web dev server (HMR on :5173)
npm run dev:web

# Health check
curl http://localhost:3000/health
```

### Seed demo data

Two seed scripts ship in `scripts/`:

```sh
# Synthetic three-room scenario (payments, auth, search) — wipes Redis first.
# Includes a feature engineered to push a ResumePacket over its 1500-token cap
# so you can see truncatePacket in action.
npm run seed

# Additive seed of THIS repo's own development history. Adds a `baton/main`
# room alongside whatever's already there. Safe after `seed`.
npm run seed:baton
```

Both scripts print a `claude mcp add baton ...` one-liner at the end with the
room id baked in — paste that to register Claude Code against the seeded room.

### Register an MCP client

Generic shape (every IDE uses some flavor of this):

```sh
claude mcp add baton \
  --env BATON_API_URL=http://localhost:3000 \
  --env BATON_ROOM_ID=<room_id_from_seed_output> \
  --env BATON_ACTOR_ID=you@claude-code \
  --env BATON_FEATURE_ID=<optional_feature_id> \
  -- node /absolute/path/to/packages/mcp-shim/dist/bin.js
```

After registering, restart the IDE so the new env vars are picked up. The
dashboard at `http://localhost:5173` (dev) or `:3000` (prod) will show every
event the agent appends, in real time.

## Repo layout

```
packages/
  shared/      types, Zod schemas, token-budget enforcement (used by all)
  backend/     Hono server, MCP tool handlers, compactor, Redis layer
  mcp-shim/    stdio MCP server that forwards to the backend
  web/         React dashboard

scripts/
  seed.ts        synthetic three-room demo seed (wipes first)
  seed-baton.ts  additive seed grounded in this repo's own commits
  verify.ts      end-to-end HTTP smoke test
  verify-shim.ts MCP-shim-level smoke test

deploy/        docker-compose, EC2 runbook
```

## Further reading

- [CLAUDE.md](./CLAUDE.md) — architecture, invariants, and the build milestones.
- [deploy/README.md](./deploy/README.md) — EC2 runbook.
- The token-cap rationale lives in the docstring at the top of
  [`packages/shared/src/types/card.ts`](./packages/shared/src/types/card.ts).
