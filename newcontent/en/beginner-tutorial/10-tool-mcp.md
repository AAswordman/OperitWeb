# 10. Tools: MCP

Last chapter we covered sandbox packages. Now let's talk about another tool type — MCP.

MCP stands for *Model Context Protocol*. It's a tool server that runs as a *separate process*, and it's quite resource-heavy. In Operit, we integrate it into the existing tool system as a package type, **fully compatible** with sandbox packages. Same deal — activate it dynamically, then call the tools inside.

Because MCP is heavy, Operit **dynamically loads** and **dynamically unloads** MCP servers, restarting them only when needed.

From the AI's perspective, MCP, sandbox packages, and Skills are **all the same thing**. The AI activates them all with `use_package` and calls the tools inside with `package_proxy`. You don't need to tell the AI where a feature comes from — it uses the same **unified interface** for everything.

## Installing MCP

Open the Package Manager in the app, switch to the MCP tab, and tap the "+" or "Import/Connect" button. A dialog will pop up with several import methods.

### Config Import

Best for services that can run with a single command, like `npx` or `uvx`. Switch to the "Config Import" tab, paste the MCP JSON, and tap "**Merge Config**". That's all.

![Config Import](</manuals/assets/tools/mcp_config_import.jpg>)

For example, to add a Fetch MCP, paste this JSON:

```json
{
  "mcpServers": {
    "fetch": {
      "command": "uvx",
      "args": ["mcp-server-fetch"],
      "env": {},
      "autoApprove": []
    }
  }
}
```

The `fetch` key is the *plugin ID* — use only letters, numbers, and underscores, preferably lowercase. Once merged, the plugin will appear in the list.

**Important: this method only works for local stdio MCPs. For remote MCPs, use the dedicated remote import below — never use config merge for remote services!!**

Then tap the run button on the right to complete the import.

### Import from Repo

Best for MCPs that are GitHub projects written in Python, Node.js, or TypeScript. Switch to the "Repo" tab, enter the repository URL, give it a plugin name, tap "Get MCP", then "Import".

![Repo Import](</manuals/assets/tools/mcp_repo_import.jpg>)

One thing to note: the software currently *only recognizes Node.js and Python* automatically. If the repo isn't structured for these two, or if it's something else entirely, don't use repo import.

### Import from ZIP

Best if you already have a local plugin archive. The principle is the same as repo import above.

### Connect to Remote Service

Best if the MCP is already running on your computer or server, and your phone just needs to connect. Switch to the "Remote" tab, enter the server address (e.g., `http://192.168.1.100:8752`), and select the connection type (`httpStream` or `sse`). **Don't pick the wrong type!!!**

![Remote Connection](</manuals/assets/tools/mcp_remote_connect.jpg>)

If the remote service needs authentication, fill in a *Bearer Token*. Need extra headers? You can add custom ones below. Once saved, it'll appear as a remote plugin — **no deployment needed**, just connect and use.

Don't forget to tap the start button after configuring it.

A note: remote MCP config is stored in `pluginMetadata`, which differs from the standard mcp_config format. So **don't try to import remote MCPs via config merge**.

### Manual Config Editing

This is the *most universal method*. It's a bit more involved, but you can also leave it to Operit's AI to handle — it can edit the config and start the plugin automatically.

The process is similar to configuring MCP on Linux or Windows. The config directory is at `/sdcard/Download/Operit/mcp_plugins/`, and the main config file is `mcp_config.json`. You might also see `server_status.json` — that's just a **status cache**, ignore it.

I won't go into the structure of `mcp_config.json` here — *you can search for that yourself*.

One important thing: the MCP startup working directory is a fixed Linux path `~/mcp_plugins/<last-segment-of-pluginId>/`. So paths in `args` must be *relative to this directory*. Think of it as: first cd into this path, then run the startup command.

The `~` here refers to the path inside *Operit's built-in Linux environment*, not the Android side.

So why are we placing files under `/sdcard` and writing config there, but the startup path is inside Linux? Simple: when you deploy, the software **copies the MCP files from `/sdcard` into the Linux environment**, then starts it there. That's what **"deployment"** actually is.

For `npx`-type MCPs: write `"command": "npx"` as usual in the config. The software *automatically converts it to `pnpm dlx`* at runtime. So your Linux environment needs `pnpm`. Don't manually change it to `npm` or `pnpm` — that can cause compatibility issues.

## Deployment

Building on the config section above — not every MCP comes ready to run. Many are source code repos full of `.py` and `.ts` files that *need dependencies downloaded first*.

Operit has an **auto-detection** mechanism that handles the copy process and automatically downloads dependencies and sets up the environment. Note that currently *only Node.js and Python* are supported. Other languages can work too, but you'd need to write custom deployment commands. The easiest approach? Just leave it to Operit's AI — the agent can handle it.

An undeployed plugin has *no files in the Linux directory*. Based on this, the start button now checks whether a plugin is deployed before launching — if not, it **auto-deploys** first. So you don't really need to worry about manually clicking deploy anymore.

## How Startup Works

Now that you know the import methods, you might wonder — what actually happens when you tap the start button? And what do you do when things go wrong? Let's look at the process.

Operit starts *three terminal sessions*. The first one is the default session. The second — `mcp_shared` — checks if the pnpm environment is ready and if the bridge can be copied. If everything checks out, a third window is created to *run the MCP bridge separately*. **If something goes wrong, go to the third terminal window to debug.**

Once the bridge is running, the software tries to register each plugin. If registration succeeds, it runs a tool probe. If the probe succeeds, MCP is good to go. A few key points: the MCP needs to actually start — if the environment is missing dependencies, it'll crash. Also, if your phone is *low on memory*, the terminal process might get killed. Close some apps to prevent "double free" errors. And check the actual error messages — some say a dependency is missing, and you'll need to install it.

The next time `use_package` is called, the software *reactivates* the MCP, and may shut it down a few minutes later. This keeps the number of simultaneously running MCPs manageable.

As mentioned in the manual config section, the startup process follows the config. *Add things gradually* — MCP is heavy, especially local ones. Remote MCPs are lighter in comparison.

If a feature overlaps with what built-in packages or Skills can do, prefer those — they're **much lighter**.

## MCP Description

At this point you might notice something: according to our sandbox package theory, the AI needs a package name and description to know which package to activate. But MCPs don't have a description yet. Right — so after startup, there's one final step: **generating the description**.

As you can probably guess, this step uses the *function model* to generate the description based on the tools and tool descriptions pulled after startup. If your *function model isn't configured properly*, this step will likely fail too — keep that in mind when troubleshooting.

## Common Issues

When MCP isn't working, the problem usually falls into one of these categories:

**Wrong paths**: This is the most common mistake. Writing Android paths (like `/sdcard/...`) in `args` when the working directory is on the Linux side (`~/mcp_plugins/`). Won't work.

**Missing dependencies**: Node-based MCPs need `pnpm`, Python-based ones need `uv` or `pip` with required packages. Check your Linux terminal.

**Missing environment variables**: Some MCPs need API keys or other env vars in the `env` field. Miss or mistype them, and the MCP may start but its features won't work.

**Directory doesn't exist**: The plugin directory on the Linux side is created automatically, but if auto-analysis of build commands fails, the directory might be empty. This usually happens after resetting the terminal — just redeploy the plugin.

## Navigation

- [Back to Welcome](/#/guide/new)
- [Previous: 09. Tools: Sandbox Packages](/#/guide/new/beginner-tutorial/09-tool-sandbox-package)
- [Next: 11. Tools: SKILL](/#/guide/new/beginner-tutorial/11-tool-skill)