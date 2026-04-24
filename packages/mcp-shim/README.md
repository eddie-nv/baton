# baton-mcp

Thin MCP shim that forwards tool calls to a Baton backend.

## Install

```sh
npx baton-mcp
```

## MCP config (Claude Code / Cursor)

```json
{
  "mcpServers": {
    "baton": {
      "command": "npx",
      "args": ["baton-mcp"],
      "env": {
        "BATON_API_URL": "https://mcp.baton",
        "BATON_ROOM_ID": "room_...",
        "BATON_ACTOR_ID": "alice@claude-code",
        "BATON_FEATURE_ID": "feat_payments_idempotency"
      }
    }
  }
}
```

The shim ships zero secrets of its own. `BATON_ROOM_ID` is the bearer
capability that authenticates every request to the backend — treat it like
a password.
