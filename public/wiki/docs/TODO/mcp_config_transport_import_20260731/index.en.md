---
title: MCP standard config transport import
status: implemented-verification-pending
fork: https://github.com/AAswordman/Operit.git
---

# MCP standard configuration transport import

## Original state

- The published `mcp_config.json` stores local stdio configurations in `mcpServers`.
- Published remote configurations are stored in `pluginMetadata`, read by the Kotlin MCP runtime.
- Standard MCP configurations write remote items as `type` and `url`, while the existing `ServerConfig` only represents `command`.
- Page import and MCP marketplace installation each judge based on `command`, so remote configurations are misjudged and cleaned up.

## Intent

- Keep the published internal configuration structure and remote fields unchanged.
- Add a single standard configuration parsing boundary that explicitly distinguishes stdio, Streamable HTTP, and SSE.
- Write local items to `mcpServers` and remote items to `pluginMetadata`, without stuffing remote URLs into the local command model.
- Page import and marketplace installation reuse the same parsing result.
- When the same ID changes transport type, remove the other type's record and clean up the tool cache.
- Logs no longer output configuration text, URL credentials, or authentication tokens.

## Scope

- The standard MCP configuration parser and structured validation.
- `MCPLocalServer.mergeConfigFromJson` and the remote/local write boundaries.
- `MCPRepository.checkConfigNeedsPhysicalInstallation` and the marketplace installation flow.
- Sensitive remote configuration logs and the remote details configuration entry point.

## Verification

- Standard stdio configurations can still be imported and deployed.
- `type=streamable_http` and `type=sse` configurations can be imported as remote metadata.
- Mixed configurations are saved separately by transport type, and replacing under the same name leaves no residual record of the other type.
- Marketplace remote configurations no longer enter the repository installation branch.

Static checking and parser unit test writing have been completed in this round. In accordance with the workspace execution guidelines, no compile or test commands were actively executed.
