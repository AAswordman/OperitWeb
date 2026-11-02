---
title: Issue 842 Gemini Thinking Parameter Passing
fork: https://github.com/tuxKOH/Operit
status: complete
---

# Issue 842 Gemini Thinking Parameter Passing

## Current State

The Google provider only writes `includeThoughts` based on the global thinking toggle and does not read the global thinking level. The Gemini GenerateContent API requires thinking configuration to be placed in `generationConfig.thinkingConfig`, so the current global thinking level has no effect on the actual thinking level of Gemini 3.

Existing response parsing already converts Parts with `thought: true` into `<think>` content and preserves the `thoughtSignature` needed for subsequent requests. Gemini's `thinkingConfig` is written by the global thinking mode after the regular model parameters.

## Expected Results

- When the global thinking toggle is on, send `thinkingConfig.includeThoughts = true`
- Global thinking levels `1` through `5` map to `MINIMAL`, `LOW`, `MEDIUM`, `HIGH`, `HIGH`
- Responses with `thought: true` continue to reuse the existing collapsible thinking display

## Official Parameter Reference

The Gemini GenerateContent REST reference defines the `includeThoughts`, `thinkingBudget`, and `thinkingLevel` fields of `generationConfig.thinkingConfig`. The thinking level ranges for Gemini 3 and 2.5 vary by model; the full level set for Gemini 3 is `MINIMAL`, `LOW`, `MEDIUM`, `HIGH`.

- [Gemini thinking](https://ai.google.dev/gemini-api/docs/thinking)
- [Gemini 3 guide](https://ai.google.dev/gemini-api/docs/gemini-3)
- [GenerateContent REST reference](https://ai.google.dev/api/generate-content)

## Steps

1. [Thinking parameter mapping](./1_GeminiThinkingParameterMapping.en.md) [DONE]
2. [Parameter mapping tests and delivery](./2_VerificationAndDelivery.en.md) [DONE]

## Execution Constraints

This task does not run compile, build, or test commands locally. Verification is limited to source inspection, test source review, and Git diff review.

## Completion Record

Request mapping of Gemini thinking parameters and JVM test coverage are complete. The collapsible display of `part.thought` and the history passing of `thoughtSignature` reuse the existing implementation. The Android `JSONObject` JVM stub issue exposed by CI was resolved by testing pure Kotlin configuration values, and targeted JVM tests were run to verify.
