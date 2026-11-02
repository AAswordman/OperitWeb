---
title: ToolPkg API Local Declarations and Version Variants
status: in-progress
---

# ToolPkg API Local Declarations and Version Variants

## Original State

ToolPkg API version checks were scattered across `Tools.Chat.call`, the ToolPkg registration bridge, and runtime parameter passing. The previous centralized catalog stuffed API names, tool names, and registration names into a single table, so maintenance cost remained high.

## Intent of the Change

Kotlin only validates whether the manifest's `api_version` is supported by the current host, and puts that value into the execution context. Each public API is declared next to its own JS facade property via `ToolPkgApi.namespace("Tools.Chat", { call: ToolPkgApi.method().since("1.0.1", implementation) })`. The runtime forms the public API name from the property name and selects the implementation at call time; adding a new interface only changes code near that interface, and a new version implementation of an API of the same name only needs another `.since(version, implementation)` appended.

## Scope

- Slim down `ToolPkgApiCompatibility` to version parsing and supported-version checks
- Parse `manifest.requires` as package dependency and load-order metadata
- `ToolPkg.registerChatMessageMenuItem` / `registerChatRuntimeHook` locally declare capability limits in the registration bridge
- `Tools.Chat.call` locally declares version variants in the JS facade in `JsTools.kt`
- Remove the centralized mapping table from tool/registration to public API

## Step Records

- [ ] 1_capability_registry.md
- [ ] 2_shared_js_runtime.md
- [ ] 3_native_dispatch.md
- [ ] 4_tests_and_docs.md
