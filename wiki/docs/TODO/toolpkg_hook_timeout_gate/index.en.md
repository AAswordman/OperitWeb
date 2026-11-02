---
fork: https://github.com/tuxKOH/Operit.git
scope: ToolPkg chat input, Prompt, summary Hook synchronous timeout gate and display settings
---

# ToolPkg Hook Timeout Gate

Currently, synchronous ToolPkg Hooks wait one by one for execution to complete. When a single script gets stuck, the user's message stalls in the input handling or Prompt assembly stage.

This change adds display and behavior settings that by default limit one Hook dispatch chain to 10 seconds. Multiple Hooks within a chain share the same deadline; when it expires, the in-flight QuickJS call is interrupted and processing continues with the context already obtained.

Change scope:

- `DisplayPreferencesManager` and the display and behavior settings page
- Millisecond-level timeout passing in `JsEngine`, `PackageManager`, and the ToolPkg facade
- Chat input, Prompt, and summary Hook bridges
- ToolPkg development documentation

See [1_前置_Hook_超时门禁.md](1_%E5%89%8D%E7%BD%AE_Hook_%E8%B6%85%E6%97%B6%E9%97%A8%E7%A6%81.en.md) for the detailed implementation.
