---
title: Kotlin Bridge Interface Inventory
status: complete
---

# Kotlin Bridge Interface Inventory

## Old Implementation

`JsEngine` exposed internal bridge methods to the script runtime via `@JavascriptInterface`. They are wrapped by ToolPkg and the runtime, and are not part of the public script interface of `NativeInterface`.

`JsTools` injected `browserTakeScreenshot` into `Tools.Net`, but the type declaration had no corresponding method.

## Intent of the Change

The public `NativeInterface` type only describes bridge methods that script developers can use directly. Remove `setResult` and `setError`, which have no Kotlin implementation, and do not copy internal bridge methods into `core.d.ts`.

## Expected Result

A static comparison should confirm that every public `NativeInterface` method in `core.d.ts` has a corresponding Kotlin implementation, and that it contains none of the removed names.

## Completion Record

`NativeInterface` has removed `setResult` and `setError`. All other public declarations map to Kotlin `@JavascriptInterface` implementations; ToolPkg and runtime internal bridges did not enter the public declarations.
