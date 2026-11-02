---
title: Engine Lease and Destruction Synchronization
status: completed
document_type: implementation-plan-step
last_reviewed: 2026-08-01
---

# Engine Lease and Destruction Synchronization [DONE]

## Current State

`ToolPkgManager` saves only one `JsEngine` per context key. Compose XML rendering and Compose DSL screen release immediately remove that instance from the table and destroy it. While an asynchronous rendering task is finishing initialization or task submission, `destroy()` can concurrently null out QuickJS, throwing `JsEngine already destroyed` onto the application error screen.

## Changes

- Introduce `acquireToolPkgExecutionEngine()`, registering a lease for UI and widget calls that will release at the end of their lifecycle.
- Releasing an earlier lease for the same context only decrements the count; the engine is destroyed only when the last lease is released.
- `JsEngine` serializes script execution preparation and destruction with a short critical section. Execution requests on an already-destroyed instance return a script error result instead of throwing a lifecycle exception toward Compose.
- Add `ToolPkgManagerTest`, covering the scenario of two holders releasing the same context in sequence.

## Checks

- All `releaseToolPkgExecutionEngine` call sites have been checked to obtain their instances through an explicit lease acquisition.
- The resident main runtime has been checked to keep using the original `getToolPkgExecutionEngine`, without accumulating UI leases.
- Per the repository execution guidelines, no compilation, build, or test was run.
