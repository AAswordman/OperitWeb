---
title: Kotlin and TypeScript Bridge Interface Alignment
fork: https://github.com/tuxKOH/Operit
status: complete
---

# Kotlin and TypeScript Bridge Interface Alignment

## Current Status

`examples/types/network.d.ts` is missing `Tools.Net.browserTakeScreenshot`, which Kotlin has already injected.

`examples/types/core.d.ts` retains `setResult` and `setError` declarations that have no Kotlin implementation. Other undeclared `@JavascriptInterface` methods of `JsEngine` are ToolPkg or runtime-internal bridges and should not be added to the public `NativeInterface` type.

Compose DSL is also missing the `AiChat` and `AdaptiveSidePanel` nodes that have been confirmed as needing to be public.

## Expected Result

- `Tools.Net.browserTakeScreenshot` has the same parameters and return value at runtime and in TypeScript
- `NativeInterface` only retains methods that are currently public and implemented in Kotlin
- Remove the `setResult` and `setError` type declarations that have no Kotlin implementation
- `AiChat` and `AdaptiveSidePanel` are available in both the Compose DSL TypeScript declarations and the Kotlin renderer
- Documentation for script developers is updated to match the actually public interfaces

## Steps

1. [DONE: Public Interface Inventory](./1_NativeBridgeInventory.en.md)
2. [DONE: TypeScript, Compose DSL, and Developer Documentation](./2_TypeDeclarationsAndDocs.en.md)
3. [DONE: Static Bidirectional Check](./3_StaticVerification.en.md)

## Execution Constraints

This task does not run compile, build, or test commands. Verification uses public interface mapping, Compose DSL node set comparison, and Git diff review.

## Completion Record

- Removed `NativeInterface.setResult` and `NativeInterface.setError`, which have no Kotlin implementation
- Added `Tools.Net.browserTakeScreenshot`, `AiChat`, and `AdaptiveSidePanel`
- Check passed: all public `NativeInterface` declarations have Kotlin implementations, and the Compose DSL type and render node sets are consistent
