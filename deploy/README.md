# Deploy

## Local

```sh
docker compose -f deploy/docker-compose.yml up -d redis
```

Redis Stack listens on `localhost:6379` with:
- AOF appendonly persistence
- RDB snapshots every 60 seconds (if ≥1000 writes)
- Data volume at `./deploy/data` (gitignored)

## Production (EC2)

Populated in M7 — will cover:
- EC2 provisioning
- Docker Compose with `redis-stack` + `baton-backend`
- Caddy reverse proxy (auto-TLS) at `mcp.baton`
