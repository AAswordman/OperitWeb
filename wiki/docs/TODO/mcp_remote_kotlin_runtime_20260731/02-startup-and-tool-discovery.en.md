# 02 Startup And Tool Discovery

`MCPStarter` previously registered remote services with the Node bridge, and built remote connections, tool caching, and validation on the bridge service name. Batch startup also initialized terminal, pnpm, and bridge even when there were no local plugins.

This step changes startup orchestration to manage runtime sessions by `pluginId`. Remote plugins complete connection, validation, and tool discovery in a Kotlin SDK session; local plugins continue to be registered by the bridge and to start stdio services. The tool cache comes directly from the session and is no longer written back to the bridge.

Expected result: remote plugins do not access terminal, pnpm, bridge registry, spawn, or unspawn; the stdio lifecycle of local plugins stays inside the bridge.

The MCP configuration page reads remote tool names through `MCPRepository`. The repository registers the runtime from persisted remote metadata, and discovers and caches tools with a Kotlin SDK session; the page itself no longer queries the bridge for remote services. When there are no local plugins, the page does not initialize bridge queries either.

The return value of a remote tool call is parsed uniformly in `MCPToolExecutor`. Standard `content` is presented directly; only when there is just `structuredContent`, the executor parses the nested JSON result within it and then outputs the text content, preventing Kotlin SDK serialization escaping from entering the tool execution UI.

[DONE]
