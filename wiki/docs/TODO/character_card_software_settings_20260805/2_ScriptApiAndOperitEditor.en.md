---
title: Script API and Operit Editor
status: complete
---

# Script API and Operit Editor

## Previous Implementation

The `Tools.SoftwareSettings` JavaScript bridge and `examples/types/software_settings.d.ts` had no character card interfaces. `examples/operit_editor.ts` and its JavaScript sync output also had no character card tools.

## Intent of the Change

Map the native character card tools to `Tools.SoftwareSettings` methods, provide strict TypeScript types for inputs and outputs, and provide character card management tools in `operit_editor` that packages can call.

## Sync Scope

- `examples/operit_editor.ts` is the editor source file
- `examples/operit_editor.js` is its JavaScript output
- `app/src/main/assets/packages/operit_editor.js` is the built-in package copy

The character card tool contracts of these three files must be consistent.

Character card methods and result types have been added to `Tools.SoftwareSettings`, and nine character card management tools have been registered in the editor. Array parameters support string arrays and their JSON string representations, and editor metadata uniformly uses JSON string arrays.

[DONE]
