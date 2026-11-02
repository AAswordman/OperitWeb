# Settings and UI

The model configuration DataStore stores `thinking_option_id`, and the Web API uses a string field of the same name. The slider directly sets stops and labels from the number of options parsed out of the current configuration rules, and after switching models, the available positions are computed from the current mapping.

The model configuration page adds a "Thinking Configuration" block, at the same level as the model parameters. The outer block is collapsed by default; after expanding, it shows only each configuration's model matching, request path, and control summary. Clicking a single preview enters a compact popup for the corresponding configuration, and the write action and slider position continue to fold inside the popup.

Rules are saved along with the model configuration. When creating a new configuration or switching providers, the corresponding built-in rules are written from `app/src/main/java/com/ai/assistance/operit/data/collects/ModelThinkingConfigDefaultsCollect.kt`. At request time, only the current model configuration is read; the collects directory is no longer read. The thinking position is also read only from the current model configuration, and is no longer stored in the global state of `ApiPreferences`.

The order of the rules array is the matching priority: the UI explicitly prompts that matching proceeds from top to bottom, and the first matching enabled rule takes effect immediately; each rule preview item provides move-up and move-down operations, and the adjusted order is automatically saved along with the rule configuration.

After completing the request parameter migration, the Android/WebChat type migration, and static checks, append `[DONE]` at the end of this document.

[DONE]
