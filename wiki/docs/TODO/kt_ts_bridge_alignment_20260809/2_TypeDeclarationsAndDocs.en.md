---
title: TypeScript Declarations and Development Documentation
status: complete
---

# TypeScript Declarations and Development Documentation

## Old Implementation

The network browser screenshot interface could not get TypeScript hints, and Compose DSL lacked embedded chat and adaptive sidebar nodes. `core.d.ts` still retained two old interfaces with no runtime implementation.

## Modification Intent

Update `examples/types/core.d.ts`, `examples/types/network.d.ts`, and `examples/types/compose-dsl.d.ts`, implement Compose DSL render nodes, and synchronize the development documentation.

## Expected Results

Script authors can get type hints for browser screenshots, embedded chat, and adaptive sidebars from `examples/types/index.d.ts`, and will not see old bridging methods with no Kotlin implementation.

## Completion Record

Public types and development documentation for `browserTakeScreenshot`, `AiChat`, and `AdaptiveSidePanel` have been added. The Kotlin implementation of `AdaptiveSidePanel` supports drag-to-resize on wide screens and mask-close on narrow screens.
