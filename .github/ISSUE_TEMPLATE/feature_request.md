---
name: Feature request
about: Propose a new feature or an improvement to an existing one
title: 'feat: '
labels: enhancement
assignees: ''
---

## Problem

A clear, concise description of the problem this feature would solve.

Example: "When an agent calls `get_resume_packet` on a feature that has never had any events appended, it returns a 404. It would be more useful to return an empty skeleton card so agents can start appending events without a separate `create_feature` step."

## Proposed Solution

Describe the solution you have in mind.

If the change touches MCP tool schemas, describe the updated input/output shape. If it touches token budgets or truncation order, explain how the cap invariant is preserved.

## Alternatives Considered

Other approaches you thought about and why you ruled them out.

## Affected Components

- [ ] `packages/shared` — types or schemas
- [ ] `packages/backend` — tool handlers, compactor, Redis layer, routes
- [ ] `packages/mcp-shim` — the stdio MCP server
- [ ] `packages/web` — dashboard UI
- [ ] `deploy/` — Docker / infra
- [ ] `scripts/` — seed, verify scripts
- [ ] Documentation only

## Design Constraints to Keep in Mind

- **Token caps are architectural, not aspirational.** Any change that adds fields to `FeatureCard` or `ResumePacket` must account for the 500/1,500-token budgets and update `truncateCard` / `truncatePacket` accordingly.
- **`setFeatureCardSafely` is the sole write boundary.** No new path to `redis.json.set` for feature documents.
- **Compactor handlers must be pure.** They return a new card object or the same reference — no mutation.
- **Shim is config-only.** No persistent state or new config files in `mcp-shim`.

## Additional Context

Links to related issues, relevant prior art, or any other context that would help evaluate the proposal.
