---
fork_repository: https://github.com/AAswordman/Operit.git
---

# Memory Extraction Additional Rules

Automatic and manual AI organization of long-term memory only used the built-in knowledge graph prompt, and users could not limit the ingestion scope, classification preferences, or text style.

This change adds independent memory extraction additional rules for each memory space, and provides an editing entry in the auto-save group of the memory library settings. The rules are shared by the auto-save scheduler and manual updates, while the built-in long-term value filtering and JSON output protocol remain in effect.

Scope:

- Memory space configuration in `MemorySearchSettingsPreferences`
- Memory library settings dialog and ViewModel save chain
- Knowledge graph extraction prompt of `MemoryLibrary`

Steps:

- [01 Settings and Prompt Integration](01_settings_and_prompt_integration.en.md)
