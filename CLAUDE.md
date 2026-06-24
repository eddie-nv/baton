# Baton

**Version:** 0.1.0 | **Port:** 3000 (backend + SPA) / 5173 (web dev) | **Stack:** TypeScript monorepo, Node 20+, Hono, Redis Stack, React 18 + Vite

## What

Shared, persistent memory layer for multi-agent coding sessions. Agents join "rooms" via MCP, append typed events, write session-pause checkpoints, and resume each other's work via token-budgeted ResumePackets (≤1,500 tokens, exact enforcement via js-tiktoken).

## Quick Start

```bash
./setup.sh                                                  # install deps, copy .env
docker compose -f deploy/docker-compose.yml up -d redis    # Redis Stack
npm run dev:backend                                         # API + SPA on :3000
npm run dev:web                                             # Vite HMR on :5173
npm run seed                                                # demo data + MCP registration command
```

## Commands

```bash
npm install                             # install all workspace deps
npm run dev:backend                     # tsx watch, port 3000
npm run dev:web                         # Vite HMR, port 5173 (proxies /api → :3000)
npm run build                           # tsc: shared + backend + mcp-shim
npm run build:web                       # Vite → packages/backend/public/
npm run build:all                       # both builds
npm run clean                           # remove all dist/ artifacts
npm run test                            # Vitest across all workspaces
npm run seed                            # 3-room demo seed (wipes Redis first)
npm run seed:baton                      # additive seed from this repo's commits
npm run verify                          # E2E HTTP smoke (backend must be running)
npm run verify:shim                     # MCP shim smoke test
NODE_ENV=production npm run start --workspace @baton/backend   # prod: :3000 serves API + SPA
```

## Architecture

```
packages/
  shared/    Types, Zod schemas, js-tiktoken counting, truncation routines
  backend/   Hono server: src/tools/ (5 handlers), src/compactor/ (pure),
             src/redis/, src/routes/ (/api/mcp/:tool, /api/admin/*, /health)
             src/util/tokens.ts — SOLE write boundary for FeatureCards
  mcp-shim/  stdio MCP server (baton-mcp binary) → forwards to backend HTTP
  web/       React 18 + Vite + Tailwind; build output → backend/public/
scripts/     seed.ts, seed-baton.ts, verify.ts, verify-shim.ts
deploy/      docker-compose.yml (Redis Stack), EC2 runbook
mcp-configs/ claude-code.mcp.json, cursor.mcp.json
```

IDE → stdio → `mcp-shim` → HTTP Bearer → `backend /api/mcp/:tool` → compactor → Redis (Streams + JSON). Dashboard reads `backend /api/admin/*`. Production: single process, single port.

## Key Files

```
packages/shared/src/types/card.ts          FeatureCard + 500-token cap rationale
packages/shared/src/tools/schemas.ts       All 5 MCP tool Zod schemas (source of truth)
packages/backend/src/util/tokens.ts        setFeatureCardSafely — sole write boundary
packages/backend/src/compactor/handlers.ts Pure event→card dispatch table
packages/backend/src/routes/mcp.ts         MCP HTTP dispatcher
packages/mcp-shim/src/server.ts            McpServer tool registration
packages/mcp-shim/src/config.ts            Env-only config (§1: no client-side secrets)
packages/web/src/lib/api.ts                Typed fetch wrappers for admin endpoints
```

## MCP Tools

| Tool | Auth | Description |
|------|------|-------------|
| `create_room` | none | Create room; returns `room_id` (bearer token) |
| `append_event` | Bearer | Append typed event; triggers compactor |
| `get_feature_card` | Bearer | FeatureCard ≤500 tokens |
| `write_checkpoint` | Bearer | Session-pause next_action + blockers (TTL 7d) |
| `get_resume_packet` | Bearer | ResumePacket ≤1,500 tokens for session-start |

Event types: `action.branch` `action.edit` `action.commit` `error.test` `hypothesis.raised` `decision.made` `session.pause` `feature.merged`

## Configuration (`.env.example`)

| Variable | Required | Description |
|----------|----------|-------------|
| `BATON_PORT` | No | Backend port (default `3000`) |
| `REDIS_URL` | No | Redis URL (default `redis://localhost:6379`) |
| `BATON_API_URL` | Yes (shim) | Backend URL the shim calls |
| `BATON_ROOM_ID` | Yes (shim) | Bearer token / room ID |
| `BATON_ACTOR_ID` | Yes (shim) | Identity in emitted events |
| `BATON_FEATURE_ID` | No (shim) | Default feature ID |

## Design Notes

- Token caps are **architectural**: `setFeatureCardSafely` is the only write path — it always runs `truncateCard` before `JSON.SET`. No alternative write path exists.
- `"CLAUDE.md §N"` comments in source refer to numbered invariants; §1 = no client-side secrets in the shim. See the source file docstrings for full rationale.
- Compactor handlers are pure: return new object or same reference on no-op. Never mutate.
- Integration tests need Redis on db=15: `docker compose -f deploy/docker-compose.yml up -d redis`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
