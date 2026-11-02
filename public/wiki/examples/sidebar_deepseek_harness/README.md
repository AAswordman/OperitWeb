# Sidebar DeepSeek Harness

`sidebar_deepseek_harness` is a ToolPkg wrapper around the upstream DeepSeek Harness Web Runtime. It does not translate Cordis plugins into ToolPkg APIs. The Linux terminal runs the original Node runtime, while the ToolPkg sidebar displays its local Web UI.

## Runtime Contract

- Requires `node` and `pnpm` in the Linux terminal environment
- Installs the latest upstream CLI `@deepseek-ai/dsh@latest` under `/root/sidebar_deepseek_harness/node_modules`
- Stores Harness profiles and sessions under `/root/sidebar_deepseek_harness/dsh-home`
- Listens only at `http://127.0.0.1:3081`
- Writes server output to `/root/sidebar_deepseek_harness/deepseek-harness-web.log`

The sidebar first compares the installed DSH version with the upstream `latest` version. A missing runtime requires an explicit initialization action, and an available update requires an explicit update action. When the installed version is current, the sidebar starts DSH immediately without running pnpm installation commands. When a DSH process is still starting, the sidebar waits up to two minutes for that process rather than installing or restarting it again. Before an explicit dependency installation, the mobile Linux runtime installs `build-essential` when the compiler is absent, so the DSH `node-pty` lifecycle script can compile. It then writes an `allowBuilds` policy for the five DSH dependencies that require lifecycle scripts and runs `pnpm install --prod` so a partially installed runtime also applies that policy. It locates pnpm's bundled `node-gyp.js` to build DSH's `node-pty` dependency for the installed Node ABI and stores a dereferenced `pty.node` because the mobile Linux container otherwise leaves a dangling symlink into the removed `obj.target` directory.

## Service Control

Version `0.2.1` includes the enabled `DeepSeek Harness Control` subpackage. It exposes status, start, restart, and stop tools for the local Web service. The server is started in a separate session so leaving the sidebar does not terminate DSH or its PTY work.

DSH credentials and profile configuration remain in the upstream Web UI. The ToolPkg does not expose raw credential or environment files to AI tools.

Runtime installation must emit an explicit completion marker before the ToolPkg starts DSH Web. A missing Node or pnpm executable, a pnpm build-policy failure, a DSH installation failure, or a `node-pty` build/load failure is shown directly in the sidebar with the reported cause and recent pnpm output; the ToolPkg does not wait for `127.0.0.1:3081` after an unsuccessful installation.

## Android Runtime Setup

Upstream `node-pty@1.1.0` has no Linux ARM64 prebuild for Operit's Node 24 runtime. The ToolPkg resolves this by installing the Ubuntu `build-essential` package, compiling `pty.node` inside the DSH runtime, and converting the Android-container symlink output into a regular native file before DSH loads it. The compiler packages use about 113 MB of Linux container storage. This preserves DSH's subprocess, shell, and PTY capabilities.

## Scope

This package provides the original DSH Web Runtime. DSH NPM bundles continue to be installed and managed by DSH itself. Native ToolPkg import, Android/Java bridge access, and offline tarball management are intentionally outside this first version.

## Attribution

- `AAswordsman`、`luojiaping`、`空悲切`、`zjxdzh`: unified package co-authors.
