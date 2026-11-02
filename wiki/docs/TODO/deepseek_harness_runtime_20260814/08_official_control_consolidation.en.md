---
title: DeepSeek Harness official control consolidation
status: in_progress
---

# DeepSeek Harness Official Control Capability Consolidation

## Current State

- The workspace example uses `@deepseek-ai/dsh@latest`, verifying the pnpm lifecycle build and the `node-pty` native module, but has no AI-callable service control entry.
- The official collaboration implementation `com.operit.sidebar_dsh` provides a ToolPkg subpackage for service control — state query, start, restart, and stop — as well as an implementation that lets install background tasks detach from the terminal session.
- Community member `zjxdzh`'s contribution uses the same runtime package ID as this example. To respect the copyright of their independent contribution, this consolidation does not include their source code; the release notes will thank them for their timely follow-up on DeepSeek Harness community exploration.

## Changes

- Add a service control subpackage to `sidebar_deepseek_harness`: query status, start, restart, and stop.
- Reuse the existing explicit install result and `node-pty` load check; service startup is changed to a session-detached `setsid` background process.
- Prepare `build-essential` before updating DSH dependencies, to avoid the `node-pty` lifecycle script being interrupted by a missing `make`.
- When an existing DSH PID is still running, wait for its Web service to become ready; do not interrupt the process and reinstall on sidebar re-entry or ordinary retry.
- Keep DSH credentials and profile configuration managed only by the DSH native Web UI; do not return `.credentials.yaml`, `.env`, or other credential plaintext to ToolPkg tools.
- Upgrade the example version to `0.2.1` and generate a `.toolpkg` that the publisher can upload themselves.

## Acceptance Criteria

- The control subpackage can return the actual Web service health status, and can start, restart, and stop the runtime.
- On cold start or explicit restart, update DSH to `@latest`, and return a clear diagnosis when pnpm, dependency build, or `node-pty` loading fails.
- The built archive contains the manifest, the main entry, the control subpackage, the shared runtime, and the Compose DSL page.
- [DONE] The credential-free control subpackage has been added, and `pnpm exec tsc -p examples/sidebar_deepseek_harness/tsconfig.json` has been completed.
- [DONE] `build/deliverables/sidebar_deepseek_harness-0.2.1.toolpkg` has been generated, and the manifest, `dist/main.js`, and `dist/packages/deepseek_harness_control.js` have all been verified to be inside the archive. SHA-256 is `BF4373FAF28C314CA3E73F83D3911D45E559F2026C27D5C9884318383B47E2E4`.
