# 10. Tools: MCP

Last chapter we covered sandbox packages. This one is about another way to extend tools — MCP.

MCP stands for Model Context Protocol. It's an open standard that lets AI interact with external tools and services in a standardized way. Think of it as the USB port for the AI world — as long as everything follows the same protocol, the AI can plug and play regardless of what service is running on the other end.

## Where MCP Fits

From the previous chapters, you should have a sense that Operit has three layers of tooling.

First, there are the built-in tools from Chapter08 — `read_file`, `apply_file`, and so on. These are the most basic capabilities that come with the system. Second, there are sandbox packages from Chapter09 — JS scripts running in the QuickJS engine, tightly integrated with the app and very powerful, but only usable within Operit. Third, there's MCP, which is heavier than sandbox packages, but standardized — MCP is cross-platform, so you can use the same MCP setup across different AI tools.

In simple terms: if the functionality you need already has a ready-made MCP service, go with MCP. If you're building deep custom features for Operit, use sandbox packages. If you just need a simple set of instructions, write a Skill.

## Where to Find MCPs

Operit has its own MCP marketplace — it's a GitHub Issues repository where people share various MCP plugins. You can check it out at https://github.com/AAswordman/OperitMCPMarket/issues.

That said, MCP is an open standard, so any MCP project you find on other communities or GitHub will work as long as it follows the protocol. Common ones like the `npx`-based MCPs (such as `@modelcontextprotocol/server-filesystem`) or `uvx`-based Python MCPs can all be configured directly.

## How to Install MCP

Open the app's "Package Manager", switch to the MCP tab, and tap the "+" or "Import/Connect" button. A dialog will pop up with several import methods.

### Config Import

Best for services that can be run with a single command, like `npx` or `uvx`. Switch to the "Config Import" tab, paste the MCP JSON, and tap "Merge Config". No need to download repos or manually place files.

![Config Import](</manuals/assets/tools/mcp_config_import.jpg>)

For example, to add a Playwright MCP, paste this JSON:

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

The `playwright` key is the plugin ID — use only letters, numbers, and underscores, preferably lowercase. Once merged, the plugin will appear in the list.

### Import from Repo

Best for MCPs that are GitHub projects, especially Python, Node.js, or TypeScript ones. Switch to the "Repo" tab, enter the repository URL, give it a plugin name, tap "Get MCP", then "Import".

![Repo Import](</manuals/assets/tools/mcp_repo_import.jpg>)

One thing to note: importing doesn't mean it's ready to use. Local plugins usually need you to tap "Deploy/Redploy" to install dependencies and compile.

### Import from ZIP

Best for local plugin packages you've downloaded or transferred to your phone. Just select the ZIP file and import. After that, you'll also need to deploy it.

### Connect to Remote Service

Best if you already have an MCP server running on your computer or another server, and your phone just needs to connect to it. Switch to the "Remote" tab, enter the server address (e.g., `http://192.168.1.100:8752`), and select the connection type (`httpStream` or `sse`).

![Remote Connection](</manuals/assets/tools/mcp_remote_connect.jpg>)

If the remote service requires authentication, you can fill in a Bearer Token. Need extra headers? You can add custom headers below. Once saved, it will appear in the list as a remote plugin — no deployment needed, just connect and use.

### Manual Config Editing

Besides the UI import methods above, you can also edit the config file directly. The MCP configuration directory is at `/sdcard/Download/Operit/mcp_plugins/`. The main config file is `mcp_config.json`. You might also see a `server_status.json` — that's just a status cache, ignore it.

The top-level structure of `mcp_config.json` has an `mcpServers` object, where each key is a plugin ID. Each plugin takes the following fields:

- `command`: The startup command, required. For example, `node`, `python`, `npx`, or `uvx`.
- `args`: Command arguments, as an array. For example, `["dist/index.js"]`.
- `env`: Environment variables, as key-value pairs. Put sensitive info like API keys here.
- `autoApprove`: An optional list of operations that can auto-execute without confirmation.
- `disabled`: Set to `true` to disable the plugin without deleting its config.

One important thing to keep in mind: the working directory for MCP startup is fixed to `~/mcp_plugins/<last-segment-of-pluginId>/`. So when writing `args`, use paths relative to this directory — don't put Android paths (like `/sdcard/...`) in there.

For example, if you have a plugin called `my-org/my-plugin`, its startup directory is `~/mcp_plugins/my-plugin/`. If the entry file is at `~/mcp_plugins/my-plugin/dist/index.js`, then `args` should be `["dist/index.js"]`, not the Android-side path.

There's also a special case for `npx` MCPs: you still write `"command": "npx"` in the config as usual, but the app internally converts it to `pnpm dlx` at runtime. So your Linux environment needs `pnpm` installed. Don't manually change it to `npm` or `pnpm` — that can cause compatibility issues.

## Local vs Remote MCP

MCP comes in two flavors: local and remote.

Local MCP runs a process on your device to provide services. The app reads `mcp_config.json` at startup and launches each plugin accordingly. Whether it starts successfully depends on dependencies being installed, paths being correct, and environment variables being complete.

Remote MCP connects to an external MCP server — no local process needed. It's configured differently, mainly through `pluginMetadata` with an `endpoint` and connection method (like bearerToken or custom headers). This is suited for scenarios where you already have a running service.

## The Unified Package Model

This is a neat detail: from the AI's perspective, MCP, sandbox packages, and Skills are all the same thing. The AI activates them all with `use_package` and calls the tools inside with `package_proxy`. You don't need to tell the AI what kind of package a feature comes from — it works through a unified interface.

So the three tabs you see in the package manager — MCP, Sandbox, Skill — are just there to help you organize. To the AI, they're all the same. This is also why Chapter09 mentioned that `use_package` is a triple-compatible entry point.

## Common Issues

When MCP isn't working, the problem usually falls into one of these categories:

**Switch not turned on**: First, check if the plugin is disabled. If `mcp_config.json` has `"disabled": true`, the plugin won't start.

**Wrong paths**: This is the most common mistake. Writing Android paths (like `/sdcard/...`) in `args` when the working directory is on the Linux side (`~/mcp_plugins/`). They won't match up, so the plugin can't run.

**Missing dependencies**: Node-based MCPs need `pnpm`, Python-based ones need `uv` or `pip` with required packages installed. Check your Linux terminal to make sure dependencies are complete.

**Missing environment variables**: Some MCPs need API keys or other environment variables set in the `env` field. If they're missing or wrong, the MCP may start but its features won't work.

**Directory doesn't exist**: The plugin directory on the Linux side is created automatically, but if the auto-analysis of build commands fails, the directory might be empty. Check `~/mcp_plugins/<plugin-name>/` to see if there are files.

When troubleshooting, follow this order: check the switch first, then check if the directory has files, then verify the command/args/env fields in the config, make sure args don't use Android paths, and finally check dependencies in the Linux terminal. Following this sequence, most problems can be pinned down quickly.

## Navigation

- [Back to Welcome](/#/guide/new)
- [Previous: 09. Tools: Sandbox Packages](/#/guide/new/beginner-tutorial/09-tool-sandbox-package)
- [Next: 11. Tools: SKILL](/#/guide/new/beginner-tutorial/11-tool-skill)