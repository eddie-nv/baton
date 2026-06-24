#!/usr/bin/env bash
set -euo pipefail

# Baton — First-time setup
# Usage: ./setup.sh

echo "=== Baton Setup ==="
echo ""

# ── Prerequisite checks ──────────────────────────────────────────────────────

command -v node >/dev/null 2>&1 || {
  echo "Error: Node.js is required (v20+). Install from https://nodejs.org"
  exit 1
}

NODE_MAJOR=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
if [ "${NODE_MAJOR}" -lt 20 ]; then
  echo "Error: Node.js v20+ is required. Found: $(node --version)"
  echo "  Upgrade at https://nodejs.org or via nvm: nvm install 20"
  exit 1
fi

command -v npm >/dev/null 2>&1 || {
  echo "Error: npm is required. It ships with Node.js."
  exit 1
}

command -v docker >/dev/null 2>&1 || {
  echo "Warning: Docker not found. You will need Redis Stack running separately."
  echo "  Install Docker: https://docs.docker.com/get-docker/"
  echo ""
}

echo "Node: $(node --version)  npm: $(npm --version)"
echo ""

# ── Environment ──────────────────────────────────────────────────────────────

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
  echo "  -> Edit .env and set BATON_ROOM_ID + BATON_ACTOR_ID before using the MCP shim."
  echo ""
else
  echo ".env already exists — skipping copy."
  echo ""
fi

# ── Dependencies ─────────────────────────────────────────────────────────────

echo "Installing npm workspace dependencies..."
npm install

echo ""

# ── Build shared package (required by backend + mcp-shim) ───────────────────

echo "Building TypeScript packages (shared, backend, mcp-shim)..."
npm run build

echo ""

# ── Done ─────────────────────────────────────────────────────────────────────

echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo ""
echo "  1. Start Redis Stack:"
echo "       docker compose -f deploy/docker-compose.yml up -d redis"
echo ""
echo "  2. Start the backend:"
echo "       npm run dev:backend         # API + static SPA on :3000"
echo ""
echo "  3. (Optional) Start the web dev server with HMR:"
echo "       npm run dev:web             # :5173, proxies /api to :3000"
echo ""
echo "  4. Seed demo data (prints MCP registration command):"
echo "       npm run seed"
echo ""
echo "  5. Health check:"
echo "       curl http://localhost:3000/health"
echo ""
echo "  6. Using Claude Code? CLAUDE.md has all the context:"
echo "       claude"
echo ""
echo "  See CLAUDE.md and README.md for full documentation."
