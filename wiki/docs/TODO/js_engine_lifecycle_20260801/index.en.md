---
title: QuickJS execution context lifecycle
status: completed
document_type: implementation-plan-index
repository: https://github.com/AAswordman/Operit.git
last_reviewed: 2026-08-01
---

# QuickJS Execution Context Lifecycle

Compose XML rendering releases the ToolPkg QuickJS context when recomposing or leaving the composition. The existing implementation destroys the engine immediately by context key, so when multiple UIs hold the same context, one UI leaving can leave another UI continuing to use an already-destroyed instance.

## Goals

- UIs and widgets with a release obligation acquire an explicit engine lease
- QuickJS is only closed after the last lease for each context is released
- Destruction does not interleave with script execution initialization, call registration, and task dispatch
- The ToolPkg script interface remains unchanged

## Steps

1. [Engine lease and destruction synchronization [DONE]](./1_EngineLeaseAndDestruction.en.md)

## Scope

- `ToolPkgManager`
- `PackageManager`
- Compose DSL and XML rendering call sites
- `JsEngine`
- Targeted unit tests
