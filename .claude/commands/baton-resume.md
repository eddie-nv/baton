---
description: Resume a Baton session in this IDE. Calls get_resume_packet for the configured (room, feature), optionally with a session_id from a prior /baton-save, and orients you to where the previous agent left off.
---

# /baton-resume

Pick up where the previous agent paused. Single MCP call:

## Step 1 — get_resume_packet

Use the `baton` MCP server. Call `get_resume_packet` with:

- `room_id` — defaults from `BATON_ROOM_ID` env
- `feature_id` — defaults from `BATON_FEATURE_ID` env
- `session_id` — if the user gave you one (from a `/baton-save` in another IDE), pass it. Otherwise omit and you'll get the card-only view.

The packet is hard-capped at 1,500 tokens and contains:
- `feature_card` — the current state of this feature: branch, files, hypotheses, failed attempts, etc.
- `last_decisions` — up to 3 most recent `decision.made` events, newest first
- `open_blockers` — merged from card + checkpoint
- `next_action` — what the previous agent said to do next

## Step 2 — orient the user

After loading the packet, write a short orientation (under 100 words) for the user:

1. **Where we are** — one sentence, drawn from `feature_card.purpose` + `feature_card.git.branch`
2. **What was decided** — the top decision from `last_decisions`, if any
3. **What's blocking** — bullets from `open_blockers`, if any
4. **What's next** — quote `next_action` verbatim

Then proceed with `next_action` directly. Do NOT re-explain the task or ask "where would you like to start" — the entire point of Baton is to skip cold-boot, so begin executing or asking the next concrete question immediately.

## When this fails

If `get_resume_packet` returns 404, the feature has no card yet. Tell the user that no events have been recorded for `(room_id, feature_id)` and offer to fire `action.branch` to initialize it.
