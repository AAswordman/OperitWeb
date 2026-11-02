---
title: ToolPkg Registration Isolation and Forced Interrupt
status: completed
document_type: implementation-plan-step
last_reviewed: 2026-07-16
---

# ToolPkg Registration Isolation and Forced Interrupt [DONE]

## Old Implementation

All `.toolpkg` packages' `registerToolPkg()` shared the `PackageManager` JavaScript engine. After a wait timeout, the cancellation code queued through the busy QuickJS executor; a synchronous infinite loop never yielded the thread, so subsequent package registrations and engine destruction kept blocking.

## Changes

- On a Java wait timeout or thread interrupt, directly call the QuickJS native interrupt
- Before destroying the engine, trigger interrupt first, and no longer append JavaScript cancellation tasks to an already-closed scheduler during destruction
- External and built-in `.toolpkg` packages each create a temporary registration engine on every load, and deterministically destroy it after parsing finishes

## Expected Outcome

A bad package exits registration when the time limit is reached, the error is attributed to the current package, and scanning can continue with subsequent packages. The registration engine keeps no cross-package state, and retains no threads after scanning ends.

Status: completed.
