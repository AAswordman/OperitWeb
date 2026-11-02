# 01 Protocol Boundary

## Current State

`ExternalChatHttpServer` routes REST, SSE, and Web Chat directly. Request execution is handled by `ExternalChatRequestExecutor`.

## Changes

- Place A2A routes in the same HTTP Server, but move protocol parsing and task management into `integrations/a2a/`.
- `/.well-known/agent-card.json` generates the `/a2a` JSON-RPC URL usable for this visit from the request Host.
- `/a2a` uses the existing Bearer Token authentication except for `OPTIONS`.
- A2A 1.0 text Parts use `{ "text": "..." }`; no other Part types are accepted.

## Expected Result

The existing REST API and A2A JSON-RPC routes have no implementation coupling, sharing nothing but the HTTP Server, Token, and chat executor — no shared protocol objects.

[DONE]
