---
For_Agent: ToolPkg API 1.0.1 long-press menu on messages and Compose DSL dialog extension record
---

# ToolPkg Message Long-Press Menu and Dialog DSL

## Current State

- The message long-press menu is hard-coded by the host; ToolPkg cannot register actions on a single message's menu.
- The message translation effort in the PR1066 branch tends to add a host-side dedicated dialog, which is not a generic enough extension mechanism.
- Compose DSL is well suited to carrying lightweight native UI, but lacks a dialog entry point that can be opened from the message menu.

## Intent

- Expose `ToolPkg.registerChatMessageMenuItem(...)` in ToolPkg API `1.0.1`.
- When a menu item is clicked, pass the current `chatId`, message index, and message snapshot to the plugin function.
- Plugins can declare `dialog.screen`, which the host loads as a Compose DSL dialog Host with the package's in-package UI resources.
- The built-in "message translation" is implemented as an example package, with no translation business logic hard-coded in the chat host.

## Scope

- ToolPkg registration capture, manifest parsing, and runtime bridge.
- ChatArea long-press menu registry integration.
- Compose DSL `AlertDialog` / `Dialog` nodes and the message menu dialog Host.
- The `examples/message_translation` example and built-in assets `.toolpkg`.
- `examples/types` and the ToolPkg development documentation.
