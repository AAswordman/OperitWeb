---
fork_repository: local main
issue: https://github.com/AAswordman/Operit/issues/858
---

# Issue 858 MCP Tool Argument Integrity

## Current Status

Long text arguments received by remote MCP write tools develop `U+FFFD` at around a 7.8 KB UTF-8 byte offset. The caller has confirmed at the MCP service entry point that the corrupted data arrives before the server-side business code.

`RemoteMcpRuntimeSession` hands structured arguments directly to the Kotlin MCP SDK, which hands them to the Ktor request body as a complete JSON string. The only 8 KB buffer in the project is used for MCP ZIP downloads and is unrelated to tool calls. Model streaming tool arguments have already been converted to strings before this point, so once original characters become replacement characters they cannot be recovered.

## Goal

Reject arguments containing `U+FFFD` before the MCP call leaves the app, to avoid remote write tools silently persisting corrupted text. Errors and logs report only the argument name, the number of replacement characters, and the offset, and do not record the original argument content.

## Scope

- `app/src/main/java/com/ai/assistance/operit/core/tools/mcp/MCPToolExecutor.kt`
- Investigation and completion records in this directory

## PR

To be created
