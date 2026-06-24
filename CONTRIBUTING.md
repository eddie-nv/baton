# Contributing to Baton

Thank you for your interest in contributing. This document covers how to set up a development environment, the branch and PR workflow, code style, and issue reporting.

## Development Setup

### Prerequisites

- Node.js 20+
- npm 9+
- Docker (for Redis Stack)

### First-time setup

```bash
git clone https://github.com/eddie-nv/baton.git
cd baton
./setup.sh
docker compose -f deploy/docker-compose.yml up -d redis
npm run dev:backend    # terminal 1 — backend on :3000
npm run dev:web        # terminal 2 — web dev server on :5173
```

The `setup.sh` script installs all workspace dependencies and builds the TypeScript packages. See `CLAUDE.md` for the full command reference.

## Using Claude Code

This project ships `CLAUDE.md`, which gives Claude Code full context about the codebase. Run `claude` in the project root to start a session with complete architecture awareness — all commands, key files, MCP tool reference, and design rationale are pre-loaded.

## Workspace Structure

Baton is an npm workspaces monorepo:

```
packages/shared      — types, Zod schemas, token counting (consumed by all packages)
packages/backend     — Hono server, MCP tool handlers, compactor, Redis layer
packages/mcp-shim    — stdio MCP server binary (baton-mcp)
packages/web         — React 18 + Vite dashboard
```

Always build `shared` first if you make type changes — the other packages depend on it:

```bash
npm run build          # compiles shared + backend + mcp-shim in correct order
npm run build:web      # Vite build for the dashboard
```

## Branch and PR Workflow

1. Fork the repo and create a feature branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. Write tests first (the project enforces 80% coverage via vitest thresholds).

3. Make your changes, keeping commits focused and using the conventional commit format:
   ```
   feat: add resume packet pagination
   fix: prevent double-write when compactor returns same card reference
   refactor: extract truncation helpers into shared util
   docs: clarify 500-token cap enforcement in CONTRIBUTING
   test: add integration test for write_checkpoint TTL
   ```

4. Run the full test suite before pushing:
   ```bash
   npm run test
   npm run verify    # requires backend running on :3000
   ```

5. Open a pull request against `main`. Include:
   - What the change does and why
   - Test plan
   - Any new environment variables added

## Code Style

The project uses TypeScript strict mode (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). No linter is currently configured — follow the patterns in the existing code.

**Key invariants to uphold:**

- **Immutability** — all compactor handlers must return a new object or the same reference on no-op. Never mutate the `card` argument.
- **Single write boundary** — all feature card writes must go through `setFeatureCardSafely` in `packages/backend/src/util/tokens.ts`. Do not call `redis.json.set` for feature documents anywhere else.
- **Token caps** — `FeatureCard` ≤ 500 tokens, `ResumePacket` ≤ 1,500 tokens, counted by `js-tiktoken`. The `truncateCard` and `truncatePacket` functions in `@baton/shared` are the only approved truncation paths.
- **Schema ownership** — `packages/shared/src/tools/schemas.ts` is the source of truth for all MCP tool wire formats. Changes there affect the backend, the shim, and the web client simultaneously.
- **No client-side secrets in the shim** — `mcp-shim` configuration is environment-only. Do not add config files or persistent state to the shim package.

## Testing

Tests use [Vitest](https://vitest.dev/) with 80% coverage thresholds on statements, branches, functions, and lines.

**Integration tests** (backend, mcp-shim) use a real Redis instance on database 15. Start Redis before running:

```bash
docker compose -f deploy/docker-compose.yml up -d redis
npm run test
```

**Unit tests** (shared, compactor handlers, middleware) run without Redis.

**End-to-end smoke tests** require the backend to be running:

```bash
npm run dev:backend &
npm run verify         # exercises all 5 MCP tools over HTTP
npm run verify:shim    # tests the MCP shim layer
```

Write tests in the Arrange-Act-Assert pattern. Test file names follow `*.test.ts` placed next to the file under test.

## Adding a New MCP Tool

1. Add input/output Zod schemas to `packages/shared/src/tools/schemas.ts` and export them from `packages/shared/src/index.ts`.
2. Add a handler in `packages/backend/src/tools/`.
3. Register the handler in `packages/backend/src/tools/index.ts` and the route dispatch in `packages/backend/src/routes/mcp.ts`.
4. Add the tool description to `packages/mcp-shim/src/server.ts`.
5. Write unit and integration tests. Integration tests go in `packages/backend/src/tools/*.test.ts`.

## Reporting Issues

When filing a bug, include:

- Node.js version (`node --version`)
- npm version (`npm --version`)
- Redis Stack version (`docker ps` image tag)
- Steps to reproduce
- Expected vs actual behavior
- Relevant log output

Use the GitHub issue templates in `.github/ISSUE_TEMPLATE/` — they prompt for the right information automatically.

## Questions

Open a GitHub Discussion or file an issue tagged `question`. For design questions touching token budgets, compactor invariants, or the Redis schema, please read the inline docstrings in `packages/shared/src/types/card.ts` and `packages/backend/src/util/tokens.ts` first — the rationale is captured there.
