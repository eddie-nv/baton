---
name: Bug report
about: Something is broken or behaving unexpectedly
title: 'bug: '
labels: bug
assignees: ''
---

## Description

A clear, concise description of what the bug is.

## Steps to Reproduce

1. Start Redis and the backend: `docker compose -f deploy/docker-compose.yml up -d redis && npm run dev:backend`
2. ...
3. ...

## Expected Behavior

What you expected to happen.

## Actual Behavior

What actually happened. Include any error messages, stack traces, or log output.

```
paste output here
```

## Token Budget (if relevant)

If the bug involves a FeatureCard or ResumePacket exceeding its token cap, include:
- Output of `npm run verify` (token counts are printed per check)
- The raw JSON of the card/packet if possible

## Environment

| Field | Value |
|-------|-------|
| Node.js version (`node --version`) | |
| npm version (`npm --version`) | |
| Redis Stack image tag (`docker ps`) | |
| OS | |
| Package version (from `package.json`) | |
| Affected package (`backend` / `mcp-shim` / `shared` / `web`) | |

## Additional Context

Any other context, links to related issues, or screenshots.
