# 01 Parser And Market Decision

## Old Implementation

`MCPLocalServer.mergeConfigFromJson` first deserialized into a `ServerConfig` with only `command`, and remote items without a command were deleted. `MCPRepository.checkConfigNeedsPhysicalInstallation` separately parsed the JSON and judged items missing `command` as requiring physical installation.

## Fix

Add a structured parser with no Android dependencies. Each server item is classified by explicit fields:

- `command` means stdio, and the command must be a non-empty string.
- `type=streamable_http` requires a non-empty `url`, and is converted to `connectionType=httpStream`.
- `type=sse` requires a non-empty `url`, and is converted to `connectionType=sse`.
- Other transport types, mixed fields, and incorrect fields directly report an input error.

The parser also retains type validation for args, env, disabled, autoApprove, and headers. The market installation decision only consumes the parse result, and no longer duplicates the decision logic.

[DONE]
