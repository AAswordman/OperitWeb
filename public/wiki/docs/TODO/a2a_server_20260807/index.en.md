---
title: A2A Server
status: completed
---

# A2A Server

## Original State

- An external HTTP service has already been published and is used by third parties, providing `/api/health`, `/api/external-chat`, and Web Chat.
- The server already has Bearer Token authentication, a chat executor, and SSE infrastructure.
- The current HTTP routes have no A2A Agent Card, JSON-RPC methods, or A2A task resources.

## Intent

- Let Operit serve as an A2A 1.0 Server, discovered and called by other Agents over the LAN via the external HTTP service.
- Add a standard Agent Card and an A2A JSON-RPC entry point on the same listening port.
- Reuse the existing chat executor, but isolate each A2A request into an independent chat and an independent task.
- A2A routes reuse the existing Bearer Token; the Agent Card contains no credentials and can be discovered by clients.

## Compatibility Constraints

- Do not modify the paths, request fields, response fields, or authentication behavior of `/api/health`, `/api/external-chat`, `/api/web/*`, or `/`.
- Do not modify the external HTTP service's port, start/stop logic, listen address, or Token storage.
- A2A only adds `/.well-known/agent-card.json` and `/a2a`.

## Scope

- A2A 1.0 Agent Card, declaring JSON-RPC, Bearer authentication, text input/output, and streaming capability.
- `SendMessage`, `SendStreamingMessage`, `GetTask`, `ListTasks`, `CancelTask`, `SubscribeToTask`.
- Mapping of text Message/Artifact and A2A task states to the existing streaming chat executor.
- A2A address display in the Settings page and stable protocol documentation.

## Non-Goals

- No A2A Client is provided.
- No support for files, structured data, push notifications, extension negotiation, or persistence of remote tasks.
- A2A routes are not merged into MCP.

## Verification

- Statically confirm that existing external HTTP routes and documentation remain unchanged.
- Statically confirm that the A2A Agent Card uses the 1.0 `supportedInterfaces` and JSON-RPC declarations.
- Statically confirm that A2A messages accept only 1.0 text Parts, and that task states and SSE events use 1.0 object forms.
- [DONE] 01 Protocol Boundaries, 02 Task Lifecycle, 03 Documentation and Verification.
