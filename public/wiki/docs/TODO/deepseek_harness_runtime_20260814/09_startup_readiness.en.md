---
title: DeepSeek Harness Startup Readiness Coordination
status: in_progress
---

# DeepSeek Harness Startup Readiness Coordination

## Original State

After DSH Web starts, the sidebar only waits 30 seconds. When HTTP readiness is not reached, the UI shows an error.
A plain `Retry` passes `forceRestart`, and re-entering the sidebar also re-enters the install and startup flow, potentially terminating
a DSH process that is already starting.

## Changes

- The Web readiness check waits up to two minutes.
- When the PID points to a live process but HTTP is not yet ready, keep waiting on that process.
- A plain `Retry` keeps checking the current service; an explicit restart from the service control subpackage keeps the terminate-and-restart semantics.
- The status interface returns `starting`, distinguishing a service that is starting from one that has stopped.
- A local health check connection failure is only handled as a not-ready state: it is not repeatedly recorded as a plugin error, and no HTTP
  request exception stack trace is printed.
- The number in the PID file must correspond to a process carrying the DSH runtime marker; a reused PID, or one left after the service exits, must not be mistaken
  for a starting service, nor killed by mistake by a stop operation.
- A terminal command completion event cannot provide Bash's real exit code, so process checks only recognize the dedicated success marker actually output by the target process.

## Acceptance Criteria

- The first DSH Web startup after native module compilation is not falsely reported as failed due to the 30-second check window.
- Reopening the sidebar or clicking a plain `Retry` does not terminate a DSH process that is already starting.
- An explicit restart tool still stops the old process and starts a new one.
- While DSH is not yet listening on the loopback port, the log keeps a short tool failure text, with no `ConnectException` stack trace or
  duplicate `DeepSeek Harness health check failed` record.
- When the PID file is stale or points to another process, a plain startup restarts DSH; explicit stop and restart do not send
  `kill` to that other process.
- Even if a target process check command is marked by the terminal as `exitCode: 0`, it must be treated as not running if it did not output the dedicated success marker.
