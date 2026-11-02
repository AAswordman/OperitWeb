---
title: API Key First-Run Onboarding Fix
fork: https://github.com/luojiaping/Operit
branch: fix/api-key-onboarding
status: complete
---

# API Key First-Run Onboarding Fix

## Current State

On first entering the chat page, as long as the current config is still an empty-key DeepSeek config, the UI covers the chat content. The quick entry only checks whether the input is non-empty, and returning from the custom model config page does not bind the currently selected config to the chat feature.

## Intent of the Change

Let quick configuration use explicit local key format validation, and let the custom config page opened by first-run onboarding complete saving, validation, and chat config binding before returning. The regular model settings entry keeps the released version's behavior.

## Expected Results

- Chinese characters, whitespace, and invisible characters cannot be saved as a DeepSeek API Key
- "Configure other models" is a clear secondary button, no longer a three-character text link
- After entering custom configuration from first-run onboarding, the return action uses the currently selected valid config
- Top back, system back, and back gestures follow the same save and bind flow
- On save or config check failure, stay on the settings page and show an error
- The regular model settings entry does not automatically change the chat feature binding

## Steps

1. [Quick Configuration Validation and UI](./1_QuickConfiguration.en.md) [DONE]
2. [Custom Configuration Return Transaction](./2_CustomConfigurationReturn.en.md) [DONE]
3. [Static Review and Delivery](./3_StaticReviewAndDelivery.en.md) [DONE]

## Execution Constraints

This task does not run compile, build, or test commands locally. Verification is limited to source inspection, call-site inspection, and Git diff review.
