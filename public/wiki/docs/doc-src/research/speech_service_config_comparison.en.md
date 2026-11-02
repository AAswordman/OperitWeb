# TTS/STT Configuration Approach Comparison

## The Current App's Released Version

`SpeechServicesPreferences` uses one TTS service type, one shared set of TTS HTTP/VITS parameters, and one STT service type plus one shared set of STT HTTP parameters. Switching services overwrites the same set of fields, so multiple sets of endpoints, models, keys, and voices cannot be saved at the same time.

## `prog/assistance2`

`TtsConfigManager` and `SttConfigManager` each save a configuration ID list, the current configuration ID, and the complete JSON of each configuration. Configurations have names, timestamps, standalone model and voice fields, and are managed through create, update, delete, and select interfaces. It also provides a Provider catalog, parameter validation, local model installation validation, and character-binding deletion protection.

## Conclusion

For standalone model management, extensibility, and data validation, `assistance2` is better; it decouples configuration entities from Provider implementations, so adding a Provider does not require reusing one shared set of fields. The current app's Provider implementations and released data format are better suited to gradual migration, so this branch adopts the same ID list and current-selection model, but keeps the existing parameter types and Provider constructors, and projects the current profile back to the old DataStore.

The resulting trade-off is: users can independently create, edit, switch, and delete TTS/STT profiles, while the released version's old read interfaces and existing Providers do not need to be rewritten all at once. When adding a Provider catalog or character binding later, extend at the profile management layer rather than restoring the shared single configuration.
