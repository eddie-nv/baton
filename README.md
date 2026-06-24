# Baton

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

> Git moves your code between machines. Baton passes the *why* — branch by branch.

**Baton is a shared, persistent memory layer for AI coding agents.** It's an
[MCP](https://modelcontextprotocol.io) server that lets agents — Claude Code,
Cursor, Codex, Claude Desktop, Windsurf — join a "room", record what they're
doing, and resume each other's work from a small, token-budgeted handoff packet.

Close a laptop mid-refactor, switch IDEs, or hand off to a teammate's agent, and
the next session continues mid-sentence instead of starting cold.

---

## Why

Coding agents have no memory across sessions. Close the laptop, switch branches,
or change IDE and the next agent re-reads the same files, re-derives the same
hypotheses, re-discovers the same dead ends, and re-asks you decisions you
already made an hour ago.

The usual fixes don't solve it: project memory files (`CLAUDE.md`,
`.cursor/rules`) capture conventions, not the live state of an in-progress
branch; long context windows just delay the loss; chat exports preserve dialogue
but not *structured* state (which files are dirty, which hypotheses are live,
what to do next).

Baton fills that gap with a small, branch-scoped, agent-agnostic packet that any
agent on any machine can read at session start and continue from.

## Features

- 🔌 **MCP-native** — works with any MCP client (Claude Code, Cursor, Codex,
  Claude Desktop, Windsurf) via a thin stdio shim.
- 📦 **Token-budgeted handoffs** — a `FeatureCard` (≤ 500 tokens) and a
  `ResumePacket` (≤ 1,500 tokens), enforced *exactly* with `js-tiktoken`, never
  estimated.
- 🧾 **Event-sourced** — every action (edit, test failure, hypothesis, decision,
  commit, pause) is an append-only event; the card is compacted from the stream.
- 🤝 **Multi-agent & multi-IDE** — many agents share one room; handoffs surface
  live in the dashboard.
- 📊 **Read-only web dashboard** — inspect cards, packets, the event timeline,
  and active checkpoints in real time.
- 🦺 **Deterministic & immutable** — pure compactor, fixed-order truncation, one
  enforced write boundary. Same input, same card.

## How it works

Agents get three primitives over MCP:

1. **Append events** as work happens — the stream is the source of truth.
2. **Compact** the stream into a **FeatureCard**: branch, dirty files, surface
   area, live hypotheses, deduplicated failed attempts, open blockers, next
   action (≤ 500 tokens, hard cap).
3. **Resume** by assembling a **ResumePacket** on demand — the current card plus
   the last three decisions plus an optional checkpoint's next-action and
   blockers (≤ 1,500 tokens, hard cap).

An agent walking into an in-progress branch reads ~1,500 tokens and knows what's
been tried, what's been decided, what's blocked, and what to do next — no
re-reading the diff, no re-asking the human.

## Quick start

```sh
git clone https://github.com/eddie-nv/baton.git
cd baton
./setup.sh        # installs deps, copies .env.example → .env
```

```sh
# 1. Start Redis Stack (Streams + RedisJSON)
docker compose -f deploy/docker-compose.yml up -d redis

# 2. Run the backend — serves /api and the web SPA on :3000
npm run dev:backend

# 3. (optional) Run the web dev server with HMR on :5173
npm run dev:web

# 4. Health check
curl http://localhost:3000/health
```

**Prerequisites:** Node.js 20+, npm 9+, Docker (for Redis Stack).

### Seed demo data

```sh
npm run seed        # synthetic 3-room scenario (payments, auth, search); wipes Redis first
npm run seed:baton  # additive seed grounded in this repo's own dev history
```

Each script prints a `claude mcp add baton ...` one-liner with the room id baked
in — paste it to register Claude Code against the seeded room.

### Register an MCP client

Every IDE uses some flavor of this:

```sh
claude mcp add baton \
  --env BATON_API_URL=http://localhost:3000 \
  --env BATON_ROOM_ID=<room_id_from_seed_output> \
  --env BATON_ACTOR_ID=you@claude-code \
  --env BATON_FEATURE_ID=<optional_feature_id> \
  -- node /absolute/path/to/packages/mcp-shim/dist/bin.js
```

Restart the IDE so the env vars are picked up. The dashboard at
`http://localhost:5173` (dev) or `:3000` (prod) shows every event the agent
appends, live.

## Architecture

```
┌──────────────────┐  stdio MCP   ┌──────────────────┐
│ Claude Code,     │ ───────────▶ │ baton-mcp shim   │
│ Cursor, Codex,   │ ◀─────────── │ (per client)     │
│ Claude Desktop   │              └──────┬───────────┘
└──────────────────┘                     │ HTTP + Bearer <room_id>
                                         ▼
                              ┌──────────────────────┐         ┌──────────────────┐
                              │  @baton/backend      │────────▶│  Redis Stack     │
                              │  (Hono on Node)      │ JSON +  │  - Streams       │
                              │  /api/mcp/:tool      │ Streams │  - RedisJSON     │
                              │  /api/admin/*        │ pub/sub │  - pub/sub       │
                              │  static web bundle   │         └──────────────────┘
                              └──────────┬───────────┘
                                         │ same process serves the SPA
                                         ▼
                              ┌──────────────────────┐
                              │  @baton/web (React)  │
                              │  read-only dashboard │
                              └──────────────────────┘
```

Agents talk MCP; humans talk HTTP/HTML. The dashboard is read-only — the only
writes flow from agents through the shim.

## Tech stack

| Layer | What | Package |
|-------|------|---------|
| **Storage** | Redis Stack — Streams (event log) + RedisJSON (cards, checkpoints) + pub/sub | — |
| **Backend** | Node + [Hono](https://hono.dev) + TypeScript; MCP dispatcher, admin API, pure immutable compactor, exact token counting at the write boundary | `packages/backend` |
| **Shared types** | `Event` / `FeatureCard` / `ResumePacket` + Zod schemas + deterministic truncation, shared by every package so the wire format can't drift | `packages/shared` |
| **MCP shim** | Thin stdio MCP server (`@modelcontextprotocol/sdk`) that forwards tool calls to the backend; config is env-only | `packages/mcp-shim` |
| **Web** | React 18 + Vite + Tailwind read-only dashboard; backend serves the built bundle in prod (single process, single port) | `packages/web` |
| **Tests** | Vitest across all packages — unit (compactor), integration (real Redis on `db=15`), and end-to-end smoke (`scripts/verify.ts`) | — |

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
deploy/        docker-compose, deploy runbook
```

## Development

```sh
npm install              # install all workspaces
npm run dev:backend      # backend + static web on :3000
npm run dev:web          # web dev server with HMR on :5173
npm run build:all        # build every package
npm test                 # run the test suites
npm run verify           # end-to-end HTTP smoke test
```

## Using with Claude Code

This repo ships a [`CLAUDE.md`](./CLAUDE.md) that gives Claude Code full context
— architecture, every verified command, the MCP tool reference, and design
notes. Claude Code reads it automatically.

```sh
claude    # reads CLAUDE.md on startup
```

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, the
branch/PR workflow, and code style. Bug reports and feature requests go through
the [issue templates](.github/ISSUE_TEMPLATE).

## License

[MIT](LICENSE) © Baton Contributors
