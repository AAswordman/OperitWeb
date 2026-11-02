# 01 Runtime Host

## Current State

`sidebar_opencode` already implements the Linux run directory, the pnpm environment, the background web service PID, the loopback health check, and tail-of-log reading.

## Changes

- Set up a DSH-specific run directory, logs, PID, and terminal session.
- After ensuring Node and pnpm are available, install `@deepseek-ai/dsh@latest`.
- Start the DSH Web Runtime, and confirm the startup result with a loopback health check.

## Expected Result

DSH runs in the Linux terminal as the original Node/Cordis Runtime, and Operit only connects to the local loopback address.

## Device Investigation Notes (2026-08-14)

On the phone, `node-gyp` C++ compilation had already succeeded, but the `postinstall` of `node-pty@1.1.0` cleans `build/Release/obj.target`. The `COPY Release/pty.node` on that container is a symbolic link pointing into that directory, so after cleanup it is left dangling, which is why DSH reported that `pty.node` could not be found.

The runtime has pnpm manage DSH dependencies, and updates to upstream `latest` on cold start or explicit restart. Before running `pnpm add`, it first ensures `gcc`, `g++`, and `make` are available, installing `build-essential` when missing, to satisfy `node-pty` lifecycle compilation. It then locates pnpm's bundled `node-gyp.js` and runs `rebuild --nodedir=/usr` directly; pnpm's `install` command enters the dependency installation and build approval flow and cannot be used to invoke `node-pty` lifecycle scripts. After compilation, `pty.node` is dereferenced into a regular file; the device probe verified that `require('./')` returns `spawn`, `fork`, `createTerminal`, `open`, and `native`. Before each forced restart, the current log is cleared to avoid old native module errors polluting the current diagnosis.

[DONE] Root-cause identification, artifact repair script verification, and the phone-side restart are all complete; the sidebar has reached the DSH official API Key configuration page, and `127.0.0.1:3081` returns HTTP 200.
