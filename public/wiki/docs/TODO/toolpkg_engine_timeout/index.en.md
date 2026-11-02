---
title: ToolPkg Engine Timeout and Lifecycle Fix
status: completed
document_type: implementation-plan-index
repository: https://github.com/AAswordman/Operit.git
last_reviewed: 2026-07-16
---

# ToolPkg Engine Timeout and Lifecycle Fix

Ordinary JavaScript plugin packages share the registration engine when scanning `.toolpkg`. After a synchronous script saturates the QuickJS thread, the existing timeout cancellation can only queue on the same thread and wait, unable to terminate the running script. The ToolPkg UI context also has unclear ownership and unreleased XML rendering, causing engines and their threads to keep accumulating.

This plan covers only ordinary plugin packages and `.toolpkg`, not MCP.

## Goals

- Each `.toolpkg` is parsed in an independent temporary registration engine, so a failure does not pollute subsequent packages
- Timeout and destruction directly notify native QuickJS to interrupt synchronous execution
- ToolPkg contexts record their owning container, and all related engines are cleaned up when a container is deactivated or deleted
- XML Compose DSL rendering releases its corresponding engine when leaving the composition

## Steps

1. [Registration Isolation and Forced Interrupt [DONE]](./1_RegistrationIsolationAndInterrupt.en.md): fix same-thread cancellation and the shared registration engine
2. [Context Lifecycle [DONE]](./2_ContextLifecycle.en.md): fill in container ownership and XML rendering release
3. [Verification and Records [DONE]](./3_Verification.en.md): add targeted regression tests and complete static checks

## Scope

Code changes are limited to the QuickJS execution wrapper, ordinary plugin package loader, ToolPkg engine management, and XML plugin rendering. Existing plugin script formats, registration functions, and tool call interfaces remain unchanged.

## Completion Record

Ordinary plugin package registration has been changed to a per-package temporary engine; timeout and close directly trigger a native interrupt; run contexts have container and instance ownership; XML rendering release has been filled in. Call-surface retrieval and `git diff --check` have passed; per repository execution rules, no compile, build, or test commands were run.
