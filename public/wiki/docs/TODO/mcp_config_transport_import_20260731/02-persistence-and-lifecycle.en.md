# 02 Persistence And Lifecycle

## Old Implementation

The local runtime reads commands from `mcpServers`, while the remote runtime reads the endpoint, connection type, and authentication information from `pluginMetadata`. Import did not maintain the mutual-exclusion relationship between the two tables, and caches could also persist across transport types.

## Fix

- When importing stdio, write to `mcpServers` and remove remote metadata with the same ID.
- When importing HTTP/SSE, remove local configuration with the same ID and write remote metadata.
- When transport configuration is replaced, remove that ID's tool cache and runtime state, and wait for the next startup to rediscover tools.
- Only keep the display fields of existing remote records; connection fields follow the imported content; new remote records use standard default metadata.
- Manual write paths for local and remote follow the same mutual-exclusion rule.
- Remote details do not enter the local JSON configuration editing path.

[DONE]
