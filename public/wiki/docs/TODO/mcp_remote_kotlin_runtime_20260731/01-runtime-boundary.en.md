# 01 Runtime Boundary

The old implementation let `MCPBridgeClient` take on remote connections, local process lifecycle, and tool calls at the same time, making remote startup depend on terminal/pnpm. The new implementation exposes connection, tool discovery, and tool call capabilities through `McpRuntimeSession`; the bridge session only wraps local services, and the remote session only holds the Kotlin SDK client.

The primary key of a runtime session is `pluginId`. The local bridge's service name exists only inside the bridge adapter, and the remote display name does not participate in addressing.

[DONE]
