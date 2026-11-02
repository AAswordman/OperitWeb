---
fork_repository: https://github.com/AAswordman/Operit.git
---

# Model Configuration Defaults to Enabling Tool Call

The `enableToolCall` default value of the current model configuration data class is off, so the first-created DeepSeek configuration is also off as a result. Although ordinary newly created configurations are already explicitly enabled, the default source is not unified.

This change unifies the model configuration's default Tool Call state to enabled, and makes the first-initialized DeepSeek configuration use the same default. Explicit values in already-saved configurations remain unchanged.

Scope:

- The defaults of `ModelConfigDefaults` and `ModelConfigData`
- `ModelConfigManager`'s first DeepSeek configuration and newly created configurations
- The default behavior description in the Tool Call protocol documentation

Implementation steps:

- [01 Unify default value and initial configuration](01_default_value_and_initial_config.en.md)
