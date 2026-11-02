# 03 Bridge Local Only

The Node bridge previously still held HTTP Stream and SSE transports, and started helpers according to the remote service configuration. The Android side also had a corresponding bridge remote registration overload.

This step deletes the bridge's remote service model, remote transports, and remote registration entry. The bridge only accepts local stdio services with a command, and helpers use the official TypeScript SDK's stdio transport. Android assets have been regenerated from the bridge TypeScript build.

Expected result: the only runtime implementation of remote MCP is the Kotlin SDK; Node bridge service registration only describes local stdio processes.

[DONE]
