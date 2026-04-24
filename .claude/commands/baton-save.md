---
description: Pause the current Baton session. Calls write_checkpoint with next_action + blockers, then appends a session.pause event so any other agent in the same room is notified.
---

# /baton-save

Save your current Baton session so another agent (or another machine, another IDE, another teammate) can pick up the thread. Two MCP calls, in order:

## Step 1 — write_checkpoint

Use the `baton` MCP server. Call `write_checkpoint` with these fields:

- `room_id` — defaults from `BATON_ROOM_ID` env if you omit it
- `feature_id` — defaults from `BATON_FEATURE_ID` env if you omit it
- `session_id` — pick something stable for this session (e.g. `sess_<short-id>`). If the user gave one, use theirs.
- `next_action` — one sentence: what you are about to do next, in the imperative. e.g. "write the integration test for 409 on duplicate Idempotency-Key"
- `blockers` — array of strings, things you are stuck on. Empty array if none.

Pull the `next_action` and `blockers` from this conversation. Be concrete and short — this is what the next agent reads first.

## Step 2 — append_event session.pause

After the checkpoint succeeds, call `append_event` with:

- `type: "session.pause"`
- `payload: { session_id: <same as above> }`
- `actor_id` defaults from `BATON_ACTOR_ID` env

This emits the pub/sub signal so a subscriber knows you've paused. The compactor doesn't change the card on this event — that's by design.

## Step 3 — confirm

Show the user:
- The `checkpoint_id` returned
- The `session_id` they should pass to `/baton-resume` (in the other IDE)
- A one-line summary of `next_action` so they remember what they were doing
