```md
# DataStore Domain Repair Core

## Core Functions

`repairPreferenceState` — atomically commits repair results, records corrupted keys, and quarantines the original.

## Validators

- `mergeNormalizedJsonFields` — preserves unknown future fields; uses the normalized array when array shapes are inconsistent
- `normalizeSafBookmarks` — keeps valid SAF bookmarks, discards ones with corrupted JSON
- `getValidModelIndex` — handles out-of-range indexes for comma-separated model names
- `CharacterCardToolAccessConfig.normalized` — deduplicates and trims
- `CharacterCardMemoryProfileBindingMode.normalize` — downgrades illegal modes

## Validation Order

1. `model_configs` — model ID existence, modelIndex out-of-range, customParameters JSON parsing
2. `user_preferences` — memory space list, active ID validity, memory_space_xxx fields
3. `functional_configs` — function mappings fall back to default
4. `character_cards` — character card list validity, modelIndex validity, toolAccessConfig JSON
5. `character_groups` — group list, member validity, orderIndex sorting
6. `api_settings` — SAF bookmark JSON validity, featureToggle JSON validity, tool prompt order

## Preservation and Exit

On validation failure, nothing is written; the original ZIP is preserved, and the repair plan records the failed keys.

[DONE]
```