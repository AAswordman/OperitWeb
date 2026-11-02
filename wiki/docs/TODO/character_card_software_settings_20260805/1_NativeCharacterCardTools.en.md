---
title: Native Character Card Management Tools
status: complete
---

# Native Character Card Management Tools

## Old Implementation

`StandardSoftwareSettingsModifyTools` already carried software settings operations but did not use `CharacterCardManager`. Character cards were only used by the settings UI and `StandardChatManagerTool.listCharacterCards`.

## Intent of the Change

Call `CharacterCardManager` directly in `StandardSoftwareSettingsModifyTools`, and have `ToolRegistration` register the corresponding native tools. Add structured result types that fully pass through the character card's configuration fields and the currently active character card ID.

## API Contract

- `list_character_cards_settings` returns the full character card list and the active character card ID
- `get_character_card` returns the specified character card
- `create_character_card` only accepts editable fields and returns the new character card
- `update_character_card` merges the specified editable fields and returns the updated character card
- `delete_character_card` deletes a non-default character card and returns the deleted ID
- `set_active_character_card` and `clear_active_character_card` return the current active character card ID
- `import_character_card_from_tavern_json` and `export_character_card_to_tavern_json` use the existing Tavern format conversion

Character card tools use the existing manager, ensuring side effects for themes, Waifu settings, custom expressions, chat bindings, and prompt tags are still handled by a single implementation.

[DONE]
