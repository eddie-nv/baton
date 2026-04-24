# Baton

> Git moves your code between machines. Baton passes the *why* — branch by branch.

A state fabric for coding agents. Close a laptop mid-refactor, open another,
switch IDEs, hand off to a teammate — the session continues mid-sentence.

See [CLAUDE.md](./CLAUDE.md) for architecture, invariants, and the build
milestones. See [deploy/README.md](./deploy/README.md) for the EC2 runbook.

## Quick start

```sh
# Start Redis Stack
docker compose -f deploy/docker-compose.yml up -d redis

# Install
npm install

# Build all packages
npm run build

# Run the backend
npm run dev:backend

# Health check
curl http://localhost:3000/health
```
