# Upgrading Dependencies with Alerts

## Old Implementation

web-chat uses Vite 5.4.21 and esbuild 0.21.5. The MCP bridge uses uuid 9.x.

## Fix

- Update Vite to the 6.4.3 line, using its fixed development server and esbuild dependency chain
- Update uuid to at least 11.1.1

## Expected Results

Keep the existing Vite React plugin and the MCP bridge's UUID calling convention, while removing Dependabot alerts.

## Implementation Results

- Vite updated to 6.4.3, pinning esbuild 0.25.12
- The MCP bridge has no UUID calls, so the uuid and @types/uuid dependencies were removed
- The official npm lockfile audit result for web-chat is zero vulnerabilities

[DONE]
