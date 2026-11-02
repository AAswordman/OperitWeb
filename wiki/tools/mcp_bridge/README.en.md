# MCP TCP Bridge

This tool is only responsible for bridging between STDIO-based local MCP servers and TCP clients, so that clients that cannot directly access named pipes (FIFOs), such as Android apps, can communicate with local processes.

Remote HTTP Stream and SSE MCP services are connected directly by the Android-side Kotlin MCP SDK and do not go through the bridge.

## Features

- Bridges STDIO-type MCP servers to a TCP port
- Supports concurrent connections
- Automatically restarts crashed MCP processes
- Gracefully handles connection errors and process termination
- Detailed logging

## Installation

```bash
# Install workspace dependencies from the project root
pnpm install

# Build the bridge and sync Android assets
pnpm --dir tools/mcp_bridge run build
```

The dependencies of `tools/mcp_bridge` are uniformly locked by the root `pnpm-lock.yaml`. The build updates
`app/src/main/assets/bridge/index.js` and `app/src/main/assets/bridge/spawn-helper.js`.

## Usage

### Basic Usage

```bash
# Start with the default configuration
pnpm --dir tools/mcp_bridge start
```

This starts the bridge on the default port 8752, connecting to `../your-mcp-server.js`.

### Advanced Usage

You can customize the bridge via command-line arguments:

```bash
# Format
pnpm --dir tools/mcp_bridge start -- [port] [command] [args...]

# Example: start on port 9000, connecting to a Python MCP server
pnpm --dir tools/mcp_bridge start -- 9000 python ../python_mcp_server.py

# Example: connect to a Java MCP server
pnpm --dir tools/mcp_bridge start -- 8752 java -jar ../java_mcp_server.jar
```

### Using in Code

You can also use this bridge in other Node.js applications:

```typescript
import McpBridge from './path/to/bridge';

const bridge = new McpBridge({
  port: 8752,
  host: '127.0.0.1',
  mcpCommand: 'node',
  mcpArgs: ['../your-mcp-server.js'],
  verbose: true
});

bridge.start();
```

## Using in Termux

In a Termux environment, follow these steps:

```bash
# Install Node.js
pkg install nodejs

# Clone or download this project
git clone <project URL>
cd <project directory>

# Install root workspace dependencies
pnpm install

# Build and sync Android assets
pnpm --dir tools/mcp_bridge run build

# Start the bridge
pnpm --dir tools/mcp_bridge start -- 8752 node ../your-mcp-server.js
```

## Android Client Example

Below is example code for an Android client connecting to the MCP bridge:

```kotlin
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.PrintWriter
import java.net.Socket
import org.json.JSONObject

class McpClient {
    private val host = "127.0.0.1"
    private val port = 8752
    
    suspend fun sendRequest(method: String, params: JSONObject): JSONObject = withContext(Dispatchers.IO) {
        Socket(host, port).use { socket ->
            val input = BufferedReader(InputStreamReader(socket.getInputStream()))
            val output = PrintWriter(socket.getOutputStream(), true)
            
            // 创建JSONRPC请求
            val requestId = System.currentTimeMillis().toString()
            val request = JSONObject().apply {
                put("jsonrpc", "2.0")
                put("id", requestId)
                put("method", method)
                put("params", params)
            }
            
            // 发送请求
            output.println(request.toString())
            
            // 读取响应
            val response = input.readLine()
            JSONObject(response)
        }
    }
}
```

## Notes

- Ensure the MCP server program is properly installed and executable
- The bridge should be used together with an internal network; do not expose it to the public internet
- For production environments, consider adding an authentication and encryption layer
- In an Android environment, ensure the app has the INTERNET permission
