# MCP: Model Context Protocol

## What MCP Means in Operit: User Perspective

Think of MCP as a plugin system that connects external capabilities into Operit. Each MCP service (a server) shows up as a plugin item. On that item you can see:

 - whether it is enabled
 - whether it is running (usually shown as `active`)
 - the tools it provides (they show up after it starts)

## Quick Start: Just These 3 Steps

Open Operit’s MCP management page. This is the page with the plugin list, the enable toggle, deploy, edit, and import/connect.

### Step 1: Add an MCP

Tap “Import/Connect”, then choose one method: Config Import, Repository Import, ZIP Import, or Connect Remote.

![Import MCP Plugin](/manuals/assets/package_or_MCP/7.png)

### Step 2: Enable it

Turn on the toggle on the right side of the plugin.

### Step 3: Make it actually run

 - Local plugin: you usually need to tap “Deploy / Re-deploy” once so Operit can install dependencies and prepare it.
 - Remote plugin: no deployment needed. Save it and make sure the connection succeeds.

Normally, you’ll see the status turn into running and show `active`. Then the tool list will start to appear.

## How to Add MCP: Choose One of These 4 Ways

### Option 1: Config Import

Best for MCP servers that can start with a single command, such as `npx` / `uvx` / `uv`. You don’t need to download a repo or move files around.

How: open “Import/Connect”, switch to “Config Import”, paste the JSON, then tap “Merge Config”. If it succeeds, the plugin will show up in the list.

A minimal working example (only `mcpServers` is required):

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"],
      "env": {},
      "autoApprove": []
    }
  }
}
```

Here `playwright` is the plugin ID in Operit. It also affects the tool prefix in chat. It’s recommended to use only letters/numbers/underscore, and keep it lowercase.

### Option 2: Import from Repository

Best when you have a GitHub project (Python/Node/TypeScript, etc.) and want to import the project files into the device.

Note: importing is not the same as ready to use. Local plugins usually still require you to tap “Deploy / Re-deploy” once.

### Option 3: Import from ZIP

Best when you already have a ZIP file locally (for example, you copied a plugin ZIP from your computer to your phone).

Same note: after importing, you usually still need to “Deploy / Re-deploy”.

### Option 4: Connect to a Remote Service

Best when you already run the MCP server on your PC/server, and the phone only connects to it.

Fill in the service URL, for example `http://127.0.0.1:8752`. Then choose a transport: `httpStream` or `sse`.

If the remote requires authentication, you can set a Bearer Token. After saving, it will appear as a remote plugin.

## Using MCP in Chat: Auto Activate and Call

Just tell the AI what you want to do. If it matches an MCP plugin’s capability, Operit will automatically activate the right plugin and call its tools in the background.

In most cases, you don’t need to care about formats like `pluginId:toolName`. You also don’t need to activate anything manually.

If the chat still says an MCP service is not active or unavailable, the plugin is usually not in a runnable state. Go back to the MCP management page and check:

 - the plugin is enabled
 - the plugin status is running (active)
 - for local plugins, it has been deployed

## `mcp_config.json` Format: What You Actually Need to Remember

For most users, you only need to remember one thing: `mcpServers` is the server list, and each key is the plugin ID.

One more thing that matters a lot (and is easy to miss) is `env`.

Many MCP plugins require an API key or token to run. In most cases, you should follow the plugin README and put your key/token into `env`.

UI details like name/description are handled automatically by the app. You don’t need to configure them manually.

```json
{
  "mcpServers": {
    "your_plugin_id": {
      "command": "npx",
      "args": ["some-package@latest"],
      "disabled": false,
      "autoApprove": [],
      "env": {
        "YOUR_API_KEY": "YOUR_KEY_HERE",
        "YOUR_TOKEN": "YOUR_TOKEN_HERE"
      }
    }
  }
}
```

Field notes:

 - `command`: required.
 - `args` / `env` / `autoApprove`: optional.
 - `env`: pay attention to this. Missing keys/tokens are a very common cause of “plugin starts but tools fail”, or “plugin cannot start at all”.
 - `disabled: true`: disabled. In the UI, this is the same as toggling it off.

Try not to change the `mcpServers` keys (plugin IDs) too often. This is the most common reason for “the plugin is in the list, but tools don’t match / tool calls fail”.

## Troubleshooting and Advanced: Only Read When Something Breaks

### Where the config lives

By default, MCP configuration files are stored under `Download/Operit/mcp_plugins/` on your phone.

`server_status.json` is an internal file used by Operit to record runtime status and tool cache; it’s generally not recommended to edit it manually.

### What “Deploy” actually does

When you tap “Deploy / Re-deploy”, Operit copies the plugin directory from the phone into the terminal environment (Ubuntu/Linux):

`~/mcp_plugins/<pluginShortName>`

`<pluginShortName>` is typically the last segment of the plugin ID. For example, `owner/repo` becomes `repo`.

After copying, the deploy process `cd`s into this directory and runs automated install/build steps.

Deploy only handles “install/build”. It skips the actual start command.

### Auto-deploy commands

Python projects typically run:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install -e .
```

JavaScript/TypeScript projects typically run:

```bash
pnpm config set registry https://registry.npmmirror.com
pnpm install
pnpm install --ignore-scripts
pnpm exec tsc -p ./tsconfig.json
```

### What the start command is

After deployment, the actual MCP service is started using the `command + args` from `mcp_config.json`, with working directory:

`cwd = ~/mcp_plugins/<pluginShortName>`

Common cases:

 - Python (auto-deployed): usually uses the `venv` Python, e.g. `.../venv/bin/python -m <moduleName>`.
 - Node/TS: usually `node <some js entry>` (e.g. `dist/index.js` or `index.js`, depending on build output).

### Symptom checklist

 - Tool count stays 0: check plugin toggle, then check running status; for local plugins, also confirm it has been deployed.
 - Bridge/terminal environment errors: usually means the terminal environment for running MCP is not ready (for example terminal service not connected, or Node/pnpm missing). Prepare the terminal environment first, then come back and refresh. See [Terminal Configuration](/#/guide/basic-config/terminal-config).
 - Remote plugin cannot connect: verify the URL is reachable in your current network, and the transport (`httpStream` / `sse`) matches the remote server.

> Note: some MCP repos include Docker files, but Operit doesn’t support Docker, so you can ignore them.
>
> Note: Operit runs MCP in a Linux environment (Ubuntu 24 / proot). Plugins that require running Windows `.exe` are not supported.

