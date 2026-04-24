# Two-agent handoff demo (M5)

Goal: pause a session in one IDE, resume mid-sentence in another. The
demo line is "no cold boot on branch switch."

## 0. Prereqs

```sh
docker compose -f deploy/docker-compose.yml up -d redis
npm install
npm run build
```

## 1. Start the backend

```sh
npm run dev:backend
```

Leave it running. It listens on `:3000` and writes to Redis on `:6379`.

## 2. Seed the demo room

In a second terminal:

```sh
npm run seed
```

The seed creates a room + feature, fires 6 events (branch, edit, two
hypotheses, a test failure, a decision), then prints two paste-ready
snippets:

- A `claude mcp add baton …` one-liner for Claude Code
- A `.cursor/mcp.json` block for Cursor

Both reference the same `BATON_ROOM_ID` and the same
`BATON_FEATURE_ID=feat_payments_idempotency`. **That same-room sharing
is the whole point — both IDEs read and write the same feature card.**

## 3. Wire Claude Code

Paste the `claude mcp add baton …` one-line command into your shell.
Restart Claude Code. Verify:

```sh
claude mcp list
```

`baton` should show up. Send Claude Code a message like:

> Use the baton tool to fetch the feature card for the configured feature.

You should see the seeded card with the decision, hypotheses cleared,
git.branch populated, and ~162 tokens.

## 4. Wire Cursor

Paste the `.cursor/mcp.json` block into Cursor's MCP config (Settings →
MCP). Restart Cursor.

## 5. Pause in Claude Code

In Claude Code, run `/baton-save` (or just prompt: "save a Baton
checkpoint with next_action 'write the 409 integration test' and no
blockers, session id sess_demo_1").

Claude Code will:
1. Call `write_checkpoint` (returns a `checkpoint_id`)
2. Call `append_event` with `session.pause`
3. Tell you the `session_id` to use on the other side

## 6. Resume in Cursor

In Cursor, run `/baton-resume sess_demo_1` (or prompt: "use baton
get_resume_packet for the configured feature, session_id sess_demo_1").

Cursor pulls the resume packet (≤1,500 tokens) and should orient you
in 3 lines, ending with "writing the 409 integration test" — the
exact `next_action` you set in Claude Code, no re-explanation needed.

## 7. Exit gate

The demo passes when the agent in Cursor proceeds with the work
**without re-asking what the task is, what the branch is, or what was
already tried**. That is "no cold boot on branch switch" working
end-to-end across IDEs.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `baton ✗ Disconnected` in `claude mcp list` | backend not running, or `BATON_API_URL` wrong in the env passed to `claude mcp add` |
| `unknown room_id` 401 from any tool | `BATON_ROOM_ID` does not match a row in `room:<id>`. Re-run `npm run seed` and re-paste the snippet. |
| Cursor doesn't see baton | Cursor uses `.cursor/mcp.json` (project-local), not `~/.claude.json`. Make sure you pasted into the right file and restarted. |
| Tool calls 404 with "feature not found" | You pointed at a feature_id that has no events. `npm run seed` creates only `feat_payments_idempotency`. |
