---
title: SoftwareSettings Character Card Management Interface
fork: https://github.com/tuxKOH/Operit
status: complete
---

# SoftwareSettings Character Card Management Interface

## Current State

`CharacterCardManager` already supports character card reading, creation, updating, deletion, activation, and tavern JSON import and export. On the script side there is only `Tools.Chat.listCharacterCards()`, whose returned content is only for session card selection and lacks complete fields and management operations.

`Tools.SoftwareSettings` and `operit_editor` cannot manage character cards.

## Expected Result

- Add character card list, detail, create, update, delete, activate, and clear-active-state interfaces to `Tools.SoftwareSettings`
- Provide single-character-card tavern JSON import and export interfaces
- Expose all interfaces through the JavaScript bridge, TypeScript declarations, and `operit_editor`
- Keep `Tools.Chat.listCharacterCards()` so session tools retain their existing calling pattern

## Interface Boundaries

`SoftwareSettings` is responsible for the character card configuration itself. `Chat` only references character cards when creating a session or sending a message.

Write interfaces only accept editable fields. Character card ID, creation time, and default character card attributes are maintained by the character card manager; callers cannot change them through the update interface.

## Steps

1. [Native Character Card Tools](./1_NativeCharacterCardTools.en.md) [DONE]
2. [Script Interface and Editor](./2_ScriptApiAndOperitEditor.en.md) [DONE]
3. [Source Review and Delivery](./3_VerificationAndDelivery.en.md) [DONE]

## Execution Constraints

This task does not run compile, build, or test commands locally. Verification uses source inspection, interface mapping review, artifact sync checks, and Git diff review.

## Completion Record

The complete configuration management interface for character cards has been added, while keeping the existing `Tools.Chat.listCharacterCards()`. `examples/operit_editor.ts` and the two JavaScript package artifacts have been synced, and source review confirms that tool registration, the JavaScript bridge, type declarations, and editor entry points are consistent.
