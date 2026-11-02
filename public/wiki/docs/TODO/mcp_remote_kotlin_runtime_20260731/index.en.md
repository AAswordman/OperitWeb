---
title: MCP remote Kotlin runtime
status: in-progress
---

# MCP Remote Kotlin Runtime Refactor

## Original State

- Local stdio MCP and remote HTTP/SSE MCP both register through the Node bridge.
- `MCPManager` caches `MCPBridgeClient`, so upper-layer tool calls cannot distinguish local from remote transports.
- Batch startup unconditionally initializes terminal, pnpm, and the bridge, so remote services also go through the bridge's spawn/unspawn flow.
- Remote config already contains `endpoint`, `connectionType`, `bearerToken`, and `headers`; these fields stay unchanged in this change.

## Intent

- Only local stdio MCP keeps using the Node bridge.
- Remote MCP uses the official Kotlin MCP SDK's Streamable HTTP/SSE client transport.
- A unified runtime session isolates upper-layer tool calls from the underlying transport implementation.
- Runtime and tool registration use only `pluginId`; display names do not participate in addressing.
- Delete remote bridge registration, spawn, unspawn, and cache forwarding code, without adding compatibility or fallback paths.

## Scope

- Android dependencies: Kotlin MCP SDK, Ktor client, and version alignment.
- MCP runtime session, manager, launcher, tool cache, and tool registration.
- `MCPToolExecutor`, `MCPPackage`, `MCPRepository`, and the MCP details page.
- Remote Streamable HTTP/SSE connection, requests, and SSE idle timeout.
- Config model and config file format unchanged.

## Verification

- Statically confirm the remote path no longer references `MCPBridgeClient` or the bridge service registry.
- Statically confirm the local path still registers and starts stdio services through the bridge.
- The bridge TypeScript build passes, and Android bridge assets have been synced.
- [DONE] marks the corresponding step as complete.
