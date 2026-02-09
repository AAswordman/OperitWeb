# Sandbox Package (Package)

> “Sandbox Package” in this doc corresponds to the `Packages` tab in Operit.

## What It Is

A Sandbox Package is a script-defined dynamic tool package. Think of it as:

- a set of tool functions callable by AI
- package-level metadata (name, description, parameters, env vars, state switching)

This type is activated via `use_package(package_name)` and then called with `packageName:toolName`.

## User View: What You See in UI

In `Package Management > Packages`, you can:

- view available and imported packages
- import external packages (current UI importer mainly supports `.js`)
- enable/disable a package
- inspect package details, tool list, and env requirements

External package directory (shown by app):

`Android/data/com.ai.assistance.operit/files/packages`

## Where Is the Environment Config Button?

Use this path:

1. Open `Package Management`
2. Switch to the `Packages` tab (not `Skills` / `MCP`)
3. Check the bottom-right floating action area:
   - Large `+` button: import external package
   - Small gear button (`Manage Environment Variables`): environment config entry

After tapping the gear icon, you will see the `Configure Environment Variables` dialog, where you can fill variables declared in package `env` (such as API keys).

Note: if there are package load errors, an extra red error button appears in the same bottom-right area. In that case, the environment button is typically between the red error button and the `+` button.

## Built-in Sandbox Packages and Default Import Logic

On startup, the app scans both built-in and external packages. Packages marked as built-in and enabled-by-default are auto-added to imported packages (unless manually disabled by user).

Common built-in sandbox packages (subject to app version; UI is source of truth), for example:

- `daily_life`
- `super_admin`
- `system_tools`
- `extended_file_tools`
- `extended_http_tools`
- `extended_memory_tools`
- `ffmpeg`
- `file_converter`
- `web`

## Calling Pattern (Unified and Clear)

1. Activate package: `use_package(package_name)`
2. Call tool: `packageName:toolName`

Example (illustrative):

- `use_package("daily_life")`
- `daily_life:get_current_date`

> The system can also attempt auto-activation when `packageName:toolName` is called first, but the recommended mental model is still “activate first, then call”.

## Advanced Capabilities (Power Users)

Sandbox packages support:

- `env`: required/optional env vars with optional defaults
- `states`: conditional tool-set switching (permission level, Shizuku availability, virtual display capability, etc.)

So, available tools in the same package can differ by device or authorization context.

## Write Your Own Sandbox Package

Official script development guide:

- GitHub page:
  `https://github.com/AAswordman/Operit/blob/main/docs/SCRIPT_DEV_GUIDE.md`
- Raw link (direct reading):
  `https://raw.githubusercontent.com/AAswordman/Operit/main/docs/SCRIPT_DEV_GUIDE.md`

Minimal structure (example):

```js
/*
METADATA
{
  "name": "my_package",
  "description": { "zh": "我的包", "en": "My package" },
  "tools": [
    {
      "name": "hello",
      "description": { "zh": "打招呼", "en": "Say hello" },
      "parameters": []
    }
  ]
}
*/

async function hello(params) {
  complete({ success: true, message: "hello" });
}

exports.hello = hello;
```

## Common Issues

- **Import failed: only JavaScript files supported**
  - In current Packages UI import flow, prefer `.js` files
- **Activated but tool unavailable**
  - Check missing `env` values
  - Check whether current package `state` excludes that tool
- **“Package not activated” errors**
  - Explicitly run `use_package(package_name)` once first
