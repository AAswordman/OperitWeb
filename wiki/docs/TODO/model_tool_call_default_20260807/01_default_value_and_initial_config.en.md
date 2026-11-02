# Unified Default Value and Initial Configuration

Old implementation:

- The default value of `ModelConfigData.enableToolCall` was `false`
- The default DeepSeek configuration created on first initialization did not explicitly set Tool Call, so it used the disabled state
- A regular newly created configuration wrote `true` separately, so the default sources were inconsistent

Intended fix:

- Define the Tool Call default state centrally in `ModelConfigDefaults` and set it to enabled
- Have the initialization and creation paths of `ModelConfigData` and `ModelConfigManager` use that default state
- Keep the explicit Tool Call switch value of already saved configurations

Expected results:

- The DeepSeek configuration generated on first launch enables Tool Call by default
- Newly created model configurations enable Tool Call by default
- New configurations created via the configuration data class use the same default value
- A user's already saved disabled state is not overwritten by this default value adjustment

Verification:

- Statically check the references to the default constant, the initialization path, and the creation path
- Per repository execution rules, do not run build or test commands

## Result [DONE]

`ModelConfigDefaults.DEFAULT_ENABLE_TOOL_CALL` and `ModelConfigData` have been changed to enabled; both the first-time DeepSeek configuration and regular newly created configurations reference that default value; the protocol documentation has been updated with a description of the default behavior.
