# Blocking Corrupted MCP Arguments

## Old Implementation

`MCPToolExecutor.validateParameters` only validated the tool name format. Any arguments continued on to
`RemoteMcpRuntimeSession.callTool`, and long text containing `U+FFFD` was also sent to the remote MCP service.

## Intent of the Fix

A replacement character means bytes were already lost when decoding UTF-8, and the application cannot infer the original content. Retrying would trigger the write again,
so it cannot serve as a data repair method. The call should be rejected before connecting to the remote service, with a locatable error containing no sensitive content.

## New Implementation

- Check each MCP tool argument for `U+FFFD`
- Record the character offset and UTF-8 byte offset of the first corrupted position
- On validation failure, do not create or call a remote MCP session

## Verification

No build or test was run, following the repository's execution rules. A code-path review confirmed that argument validation happens
before `getOrCreateSession` and `callTool`.

[DONE]
