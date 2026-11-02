---
title: DeepSeek Harness pnpm dependency builds
status: in_progress
---

# DeepSeek Harness pnpm Dependency Builds

## Current State

pnpm in the Debug Linux container refuses to run the lifecycle scripts of DSH dependencies, and reports
`ERR_PNPM_IGNORED_BUILDS`. The script exits after `pnpm add` returns failure, so the subsequent `node-pty`
native rebuild never gets a chance to run. The install failure marker only contains generic text, and the UI does not show the raw pnpm error.

## Changes

- Write an `allowBuilds` configuration in `pnpm-workspace.yaml` in the DSH runtime directory.
- Only allow the DSH dependencies listed in the logs to run build scripts.
- After installing DSH, run `pnpm install --prod` so that previously half-installed states also pick up this configuration.
- Use the failure marker together with the final pnpm output as UI diagnostics.

## Acceptance Criteria

- `ERR_PNPM_IGNORED_BUILDS` no longer appears.
- The `node-pty` native rebuild and load check actually run.
- DSH Web is still only started after an install success marker is received.
