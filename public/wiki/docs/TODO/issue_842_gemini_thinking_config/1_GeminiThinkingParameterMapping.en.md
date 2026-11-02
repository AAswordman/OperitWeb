---
title: Gemini Global Thinking Configuration Mapping
status: complete
---

# Gemini Global Thinking Configuration Mapping

## Old Implementation

`GeminiProvider` created `generationConfig.thinkingConfig.includeThoughts` when the global thinking switch was on, but did not pass the global thinking level through to Gemini.

## Change Intent

`GeminiProvider` converts the global thinking level directly into Gemini's `thinkingConfig`. That object is written to the request after the regular model parameters, so it is determined solely by the global thinking mode.

## Parameter Contract

- Global switch -> `thinkingConfig.includeThoughts = true`
- Global level `1` -> `thinkingConfig.thinkingLevel = MINIMAL`
- Global level `2` -> `thinkingConfig.thinkingLevel = LOW`
- Global level `3` -> `thinkingConfig.thinkingLevel = MEDIUM`
- Global level `4` -> `thinkingConfig.thinkingLevel = HIGH`
- Global level `5` -> `thinkingConfig.thinkingLevel = HIGH`

Gemini only accepts `thinkingLevel`, `thinkingBudget`, and `includeThoughts` as members of `thinkingConfig`. Responses are still handled by the existing `part.thought` and `thoughtSignature` processing, so they can enter the already-implemented collapsible thinking display.

[DONE]
