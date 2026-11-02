---
title: DeepSeek Harness Runtime Failure Feedback
status: completed
---

# DeepSeek Harness Runtime Failure Feedback

## Original State

The DeepSeek Harness install command relied solely on the `exitCode` returned by the terminal API. In an interactive PTY, even when the inner `bash -lc` ended with an error status, the terminal API could still report that the outer session completed normally. The plugin therefore treated a failed install as a success, went on to start Web, and waited on `127.0.0.1:3081`, leaving the user with only a connection refused error.

The install failure result also did not pass `installOutput` to the UI, and the error text showed at most three lines, so the real cause was invisible.

## Changes

- The install script prints a success marker generated at runtime; only after receiving that marker is starting DSH Web allowed.
- Paths such as missing Node, missing pnpm, failed DSH installation, and failed node-pty loading all print explicit error markers.
- The specific install error is passed to the dashboard as result diagnostics.
- On failure, the cached Web URL is cleared, and the display range of error information is expanded.

## Acceptance Criteria

- When a Debug Linux container lacks Node, the page directly displays `Node.js is required in the Linux runtime.`.
- When no install success marker has been received, `dsh web` is not executed, and port 3081 is not waited on.
- After a failed Retry, no previous WebView content is retained.

## Completion Record

- [DONE] Changed the install completion criterion from the terminal API's `exitCode` to an explicit success marker, avoiding the interactive PTY masking the inner shell's failure status.
- [DONE] Parsed the install failure marker into UI diagnostics, and synchronized it to the `dist` artifact actually loaded by ToolPkg.
- [DONE] Added a description of runtime failure behavior; this time only static checks were performed, with no build or test executed.
