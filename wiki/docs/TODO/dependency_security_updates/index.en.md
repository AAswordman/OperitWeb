---
For_Agent: https://github.com/AAswordman/Operit
---

# Dependency Security Updates

## Current Status

GitHub Dependabot reports five open alerts on the default branch: the web-chat Vite dev dependency chain contains three Vite alerts and one esbuild alert, and the MCP bridge's uuid runtime dependency contains one alert.

## Intent

- Upgrade web-chat to a version containing the Vite and esbuild fixes
- Upgrade the MCP bridge's uuid to a version with the bounds-checking fix
- Keep existing build tools and runtime interfaces, introducing no functional changes

## Scope

- web-chat/package.json
- web-chat/package-lock.json
- tools/mcp_bridge/package.json

`tools/mcp_bridge/pnpm-lock.yaml` is intentionally ignored by the repository, so it is regenerated locally from package.json and is not part of this change.

## Completion Criteria

- The Vite locked version no longer hits the four dev server alerts
- The esbuild locked version no longer hits the CORS alert
- The uuid locked version no longer hits the buffer bounds alert

[DONE]
