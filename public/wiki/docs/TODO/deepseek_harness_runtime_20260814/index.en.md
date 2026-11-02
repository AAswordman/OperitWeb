---
title: DeepSeek Harness Runtime ToolPkg
status: in_progress
---

# DeepSeek Harness Runtime ToolPkg

## Current State

- `sidebar_opencode` has already installed the Node CLI in the Linux terminal, starts a Web service listening only on the loopback address, and hosts its native UI in the ToolPkg WebView.
- Operit's ToolPkg cannot directly parse NPM/Cordis bundles, but the terminal runtime can execute raw Node and pnpm dependency graphs.
- DeepSeek Harness is distributed as NPM packages and Cordis profile bundles; the current integration target is `@deepseek-ai/dsh@latest`.

## Intent

- Add an independent `sidebar_deepseek_harness` ToolPkg to host the original DeepSeek Harness Web Runtime.
- Bind Harness to the Linux loopback address and display the official Web UI in the main sidebar WebView.
- Establish an independent runtime directory and stable entry point for subsequent DSH bundle installation, offline tarball import, and Runtime state management.
- Merge the service control capabilities of the official collaboration implementation, providing status query, start, restart, and stop entry points, while retaining the `node-pty` check.

## Compatibility Constraints

- Do not modify the existing ToolPkg import protocol, OpenCode container, or terminal API.
- DSH runs in the Linux terminal environment and cannot obtain the ToolPkg Java/Android Bridge.
- Entering the sidebar first checks the local and upstream `latest` versions; initialization and updates are triggered only by explicit user actions.

## Scope

- Runtime directory, pnpm environment, installation checks, background processes, health checks, and log diagnostics.
- `main_sidebar_plugins` routing and the WebView hosting page.
- The example ToolPkg's manifest, TypeScript source, and compiled `dist` artifacts.
- The ToolPkg control subpackage is detached from the service session; the original DSH credentials in the Linux Runtime are not exposed.
- The ADB debugging tool's unified parsing of the Debug/Release applicationIds and dynamic path generation.

## Non-Goals

- Do not integrate the DSH bundle into Operit's native package manager.
- Do not translate Cordis/React plugins into Compose DSL.
- Do not implement the DSH bundle management page or offline tarball import at this stage.

## Verification

- Statically confirmed that the Runtime uses `@deepseek-ai/dsh@latest`, listens on `127.0.0.1`, and that the WebView does not expose the native bridge.
- Statically confirmed that the example is recognized by the ToolPkg packager as an independent TypeScript ToolPkg.
- Confirmed on the target phone's Linux ARM64 container that Node `v24.19.0`, the `node-gyp` build chain, and the `node-pty` native module loading path work.
- Confirmed that the phone's file system leaves a dangling `pty.node` symlink after `node-pty`'s `postinstall`; the runtime has been changed to skip that cleanup hook and dereference the artifact.
- Started the DSH Web with the fixed ToolPkg; actual PTY execution returned `pty-ok`, the loopback service returned HTTP 200, and the WebView entered the official API Key configuration page.
- Supplemented the Debug/Release dual-package selection for the ADB JS executor, ToolPkg debug installation, and example package hot updates; see `04_dual_app_debugging.md`.
- Supplemented installation failure feedback: the Web is started only upon receiving an explicit success marker, and installation failures directly display the actual reason; see `05_runtime_failure_feedback.md`.
- Fixing pnpm's build approval for DSH lifecycle scripts; see `06_pnpm_dependency_builds.md`.
- Fixing the node-pty local module loading path; see `07_node_pty_module_resolution.md`.
- Changing the runtime installation to an explicit lifecycle and enriching sidebar installation feedback; see
  `10_explicit_runtime_lifecycle.md`.
