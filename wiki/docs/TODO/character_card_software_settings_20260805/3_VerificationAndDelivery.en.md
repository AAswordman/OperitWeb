---
title: Source Review and Delivery
status: complete
---

# Source Review and Delivery

## Checklist

- Native tool registration names, the software settings executor, and the JavaScript bridge correspond one-to-one
- TypeScript parameter and result types match the native fields
- The tool definitions, parameter validation, and calls in `operit_editor.ts` cover all character card interfaces
- The JavaScript output is in sync with the app's built-in copy
- The existing `Tools.Chat.listCharacterCards()` is retained

## Execution Restrictions

The user did not request compile, build, or test commands. This step does not run them.

It has been confirmed that the counts and names of interfaces in the native registration names, JavaScript bridge, TypeScript declarations, and editor are consistent. The hashes of `examples/operit_editor.js` and `app/src/main/assets/packages/operit_editor.js` match, and `git diff --check` reported no whitespace errors.

[DONE]
