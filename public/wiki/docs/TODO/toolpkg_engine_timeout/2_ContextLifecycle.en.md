---
title: ToolPkg Context Lifecycle
status: completed
document_type: implementation-plan-step
last_reviewed: 2026-07-16
---

# ToolPkg Context Lifecycle [DONE]

## Old Implementation

The ToolPkg engine only stored entries in an unbounded map keyed by string. Container cleanup only recognized the main and provider keys, and XML Compose DSL rendering created an engine without releasing it when the composition was destroyed.

## Changes

- Engine entries explicitly save the container package name, instead of inferring the owner from the key format
- All creation points pass in the container name, and when a container is deactivated, replaced, or deleted, all of its contexts are cleaned up
- XML Compose DSL rendering uses `DisposableEffect` to release the context

## Expected Result

main, provider, Compose DSL, XML render, and widget contexts can all be traced back to a container. Short-lived UI contexts are destroyed along with their host, and container-level operations leave no related QuickJS threads behind.

Status: complete. The release operation also validates the engine instance, so a delayed dispose from an old host does not mistakenly delete a new context under the same key.
