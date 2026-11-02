---
title: Static Bidirectional Cross-Check
status: complete
---

# Static Bidirectional Cross-Check

## Cross-Check Scope

- Check that `NativeInterface` in `core.d.ts` contains no legacy members without a Kotlin implementation
- Compare the browser screenshot method injected by `JsTools.kt` with the `Net` members in `network.d.ts`
- Compare the new nodes in `compose-dsl.d.ts` with Kotlin Compose DSL node dispatch
- Review differences between documentation and type files

## Completion Criteria

The parameter fields of `browserTakeScreenshot` match the Kotlin parameter normalization logic, `AiChat` and `AdaptiveSidePanel` both have TS types and Kotlin rendering paths, and obsolete names no longer appear in public type declarations or developer documentation.

## Completion Notes

- Every `NativeInterface` member in `core.d.ts` has an implementation in a Kotlin `@JavascriptInterface`
- `setResult` and `setError` do not appear in public types or developer documentation
- The four parameters of `browserTakeScreenshot` match the Kotlin normalization logic
- The Compose DSL type factory and Kotlin rendering nodes number 88 each, with no difference between the two sets
- `git diff --check` found no whitespace errors
