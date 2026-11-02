# Localization and Verification

## Current Status

Chat settings text is distributed across Android resource files, and new settings need localizable copy.

## Changes

- Add Chinese and English resources for settings items and conversion result prompts
- Statically check affected call sites and resource references
- Add unit tests for pasted text recognition

## Expected Results

Setting names, descriptions, and conversion prompts all display correctly.

[DONE]
