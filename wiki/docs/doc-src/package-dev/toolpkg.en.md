# API Documentation: `toolpkg.d.ts`

`toolpkg.d.ts` describes the tool package plugin registration system. Its core goal is not "calling tools", but **registering modules, hooks, and plugins with the host**, so that a tool package can insert its own behavior into the app lifecycle, message processing, XML rendering, input menus, and prompt pipelines.

## ToolPkg API Versions

A ToolPkg manifest can use `api_version` to declare the host API version the package depends on. This field strictly uses the `major.minor.patch` format; historical packages that omit this field are interpreted as `1.0.0`.

Operit before `1.12.1+4` only supported `1.0.0`; `1.12.1+4` and later support `1.0.0` and `1.0.1`. Packages using newer APIs should declare the corresponding version in the manifest, so the host can clearly report a version mismatch at package load time.

`1.0.1` contains the ToolPkg public capabilities added after `1.12.1+4`, currently including chat runtime hooks, message long-press menu registration, Compose DSL dialog components, and `Tools.Chat.call` function-model calls.

`examples/types/toolpkg.d.ts` keeps a copy of the latest declarations, annotated with `@since ToolPkg API x.y.z` for the version each public capability was introduced in. When using these capabilities, the manifest's `api_version` must be no lower than the corresponding version.

When published to the marketplace, the marketplace version information records the manifest's `api_version`. The marketplace list, details, and version history also display this value; it is a different field from the package's own `version` and from the archive format's `formatVer`. For a missing or blank `apiVersion`, it is interpreted as `1.0.0` per the old specification.

The manifest can also declare:

- `requires`: the manifest's package dependency declaration, which is not part of the ToolPkg JavaScript API. A list of dependency objects that must be loaded when this package is enabled. Each item contains the dependency package ID, a description of its purpose, and an optional target package version range; dependency packages are loaded before this package.

When a package is enabled, the dependencies in `requires` are added to the enabled set together with it; a package that is already depended on by another enabled ToolPkg cannot be closed directly. If a dependency relationship is wrong, the host gives the specific package name in the package loading error.

```json
"requires": [
  {
    "id": "com.example.shared",
    "description": "提供共享运行能力",
    "min_version": "1.2.0",
    "max_version": "2.0.0"
  }
]
```

`min_version` and `max_version` may be omitted; they constrain the target package's own `version`, not the ToolPkg API version.

The plugin list supports drag-to-reorder. This order serves as the base order when there are no manifest ordering constraints, and dependency relationships in the manifest take priority in forming the final loading order.

## Purpose

The current type definitions cover:

- Toolbox UI module registration.
- App lifecycle hooks.
- Message processing plugins.
- XML rendering plugins.
- Input menu toggle plugins.
- AI chat input box listening and submit hooks.
- Chat message persistence notification hooks.
- Chat message long-press menu registration.
- Chat runtime change notification hooks.
- Tool execution lifecycle hooks.
- Prompt input, history, system prompt, tool prompt, and pre-final-send hooks of various kinds.
- Various hooks in the summary generation phase.

## Type Namespace and Runtime Object

`toolpkg.d.ts` contains two levels of `ToolPkg` at the same time:

- `namespace ToolPkg`: carries the type definitions.
- `const ToolPkg: ToolPkg.Registry`: the global runtime registration object.

So the actual usage commonly seen in scripts is:

```ts
ToolPkg.registerAppLifecycleHook(...)
ToolPkg.registerMessageProcessingPlugin(...)
```

## Pre-Hook Timeout Gate

The host provides a "pre-plugin hook timeout" setting under "Display & Behavior", with a value range of 1 to 60 seconds and a default of 10 seconds.

This limit covers synchronously executed chat input, prompt, and summary generation hooks. Multiple hooks within one bridge dispatch share the total wait time; the full timeout is not recalculated for each hook.

When the deadline is reached, the host interrupts the current QuickJS execution and ignores that hook's return value, then continues message processing using the context accumulated so far. Developers should ensure hooks complete as soon as possible, and should not rely on side effects after a timeout.

The `message_processing` reply takeover chain remains independent and does not use this setting.

When a user submits a message through the chat input box, a chat input hook timeout displays an in-chat prompt explaining that the hook has been skipped and the message will continue to be sent. A prompt input hook timeout used by message injection reuses the AI request retry's non-fatal error event and is shown via a chat / floating-window Toast; other prompt and summary hook timeouts are only written to the log.

In addition, a set of helper functions is declared globally:

- `registerToolPkgToolboxUiModule(...)`
- `registerToolPkgAppLifecycleHook(...)`
- `registerToolPkgMessageProcessingPlugin(...)`
- `registerToolPkgXmlRenderPlugin(...)`
- `registerToolPkgInputMenuTogglePlugin(...)`
- `registerToolPkgChatInputHook(...)`
- `registerToolPkgChatMessageHook(...)`
- `registerToolPkgChatMessageMenuItem(...)`
- `registerToolPkgChatRuntimeHook(...)`
- `registerToolPkgToolLifecycleHook(...)`
- `registerToolPkgPromptInputHook(...)`
- `registerToolPkgPromptHistoryHook(...)`
- `registerToolPkgPromptEstimateHistoryHook(...)`
- `registerToolPkgSystemPromptComposeHook(...)`
- `registerToolPkgToolPromptComposeHook(...)`
- `registerToolPkgPromptFinalizeHook(...)`
- `registerToolPkgPromptEstimateFinalizeHook(...)`
- `registerToolPkgSummaryGenerateHook(...)`

## Basic Types

### `ToolPkg.LocalizedText`

```ts
type LocalizedText = string | { [lang: string]: string }
```

Suitable for multilingual text such as titles and descriptions.

### `ToolPkg.JsonPrimitive` / `ToolPkg.JsonValue` / `ToolPkg.JsonObject`

This group of types constrains the JSON structure of all plugin return values and event payloads.

## Event Categories

### App Lifecycle Events: `AppLifecycleEvent`

Supported:

- `application_on_create`
- `application_on_foreground`
- `application_on_background`
- `application_on_low_memory`
- `application_on_trim_memory`
- `application_on_terminate`
- `activity_on_create`
- `activity_on_start`
- `activity_on_resume`
- `activity_on_pause`
- `activity_on_stop`
- `activity_on_destroy`

### Generic Event Names: `HookEventName`

This is the union type of all hook events, which in addition to lifecycle events includes:

- `message_processing`
- `xml_render`
- `input_menu_toggle`
- Chat input box events
- Chat message persistence events
- Chat message long-press menu click events
- Tool lifecycle events
- Prompt input / history / system prompt / tool prompt / final-send events
- Summary generation events

### Prompt Turn Types: `PromptTurnKind` / `PromptTurn`

Prompt-related hooks and the history messages in `message_processing` plugins uniformly use the structured `PromptTurn`:

```ts
type PromptTurnKind =
  | 'SYSTEM'
  | 'USER'
  | 'ASSISTANT'
  | 'TOOL_CALL'
  | 'TOOL_RESULT'
  | 'SUMMARY'

interface PromptTurn {
  kind: PromptTurnKind
  content: string
  toolName?: string | null
  metadata?: JsonObject
}
```

Notes:

- The old `{ role, content }` structure is no longer used here.
- The `chatHistory` received by `message_processing` plugins is also `PromptTurn[]`.
- `Tools.Chat.call` uses the same `PromptTurn[]` as the function-model call context.
- If you want to reuse the old role semantics, you need to map `kind` to the corresponding role yourself.

### Tool Lifecycle Events: `ToolLifecycleEventName`

- `tool_call_requested`
- `tool_permission_checked`
- `tool_execution_started`
- `tool_execution_result`
- `tool_execution_error`
- `tool_execution_finished`

### Prompt Pipeline Events

#### `PromptInputEventName`

- `before_process`
- `after_process`

#### `PromptHistoryEventName`

- `before_prepare_history`
- `after_prepare_history`

#### `SystemPromptComposeEventName`

- `before_compose_system_prompt`
- `compose_system_prompt_sections`
- `after_compose_system_prompt`

#### `ToolPromptComposeEventName`

- `before_compose_tool_prompt`
- `filter_tool_prompt_items`
- `after_compose_tool_prompt`

#### `PromptFinalizeEventName`

- `before_finalize_prompt`
- `before_send_to_model`

#### `SummaryGenerateEventName`

- `before_prepare_summary_prompt`
- `before_send_to_model`
- `after_generate_summary`

## Event Objects

All hook events inherit from:

### `HookEventBase<TEventName, TPayload>`

Common fields include:

- `event`
- `eventName`
- `eventPayload`
- `toolPkgId?`
- `containerPackageName?`
- `functionName?`
- `pluginId?`
- `hookId?`
- `timestampMs?`

## Payload Types

### `MessageProcessingEventPayload`

Fields include:

- `messageContent?`
- `chatHistory?: PromptTurn[]`
- `workspacePath?`
- `maxTokens?`
- `tokenUsageThreshold?`
- `probeOnly?`
- `executionId?`

### `XmlRenderEventPayload`

Fields include:

- `xmlContent?`
- `tagName?`

### `InputMenuToggleEventPayload`

Fields include:

- `action?: 'create' | 'toggle' | string`
- `toggleId?`

### `ChatInputEventPayload`

Fields include:

- `chatId?`
- `text?`
- `selectionStart?`
- `selectionEnd?`
- `hasAttachments?`
- `attachmentCount?`
- `isProcessing?`
- `inputStyle?`
- `source?`
- `submitSource?`

Chat input box event names include:

- `input_changed`
- `submit_requested`
- `submitted`

### `ChatMessageEventPayload`

Fields include:

- `chatId`
- `timestamp`
- `sender`
- `roleName`
- `content`
- `completedAt`
- `provider`
- `modelName`
- `inputTokens`
- `outputTokens`
- `cachedInputTokens`
- `sentAt`
- `outputDurationMs`
- `waitDurationMs`
- `displayMode`
- `selectedVariantIndex`
- `isFavorite`

Chat message event names include:

- `message_persisted`

Notes:

- `timestamp` corresponds to `ChatMessage.timestamp` / `MessageEntity.timestamp`, and is also the stable field the current project uses to locate messages.
- `timestampMs` is the dispatch time of the outer hook event, and does not have the same meaning as `eventPayload.timestamp`.
- `sender` corresponds to `ChatMessage.sender` / `MessageEntity.sender`, indicating the source of the persisted message, e.g. `user`, `ai`, `summary`.
- `roleName` corresponds to `ChatMessage.roleName` / `MessageEntity.roleName`, indicating the message display or character card name, not the message source.
- `message_persisted` is a notification event; its return value does not change the already-persisted message.

### `ToolLifecycleEventPayload`

Fields include:

- `toolName`
- `parameters?`
- `description?`
- `granted?`
- `reason?`
- `success?`
- `errorMessage?`
- `resultText?`
- `resultJson?`

### `PromptHookEventPayload`

Fields include:

- `stage?`
- `functionType?`
- `promptFunctionType?`
- `useEnglish?`
- `rawInput?`
- `processedInput?`
- `chatHistory?: PromptTurn[]`
- `preparedHistory?: PromptTurn[]`
- `systemPrompt?`
- `toolPrompt?`
- `modelParameters?`
- `availableTools?`
- `metadata?`

### `SummaryGenerateEventPayload`

Fields include:

- `stage?`
- `functionType?`
- `useEnglish?`
- `previousSummary?`
- `chatHistory?: PromptTurn[]`
- `preparedHistory?: PromptTurn[]`
- `systemPrompt?`
- `summaryPrompt?`
- `summaryResult?`
- `modelParameters?`
- `metadata?`

## Return Value Types

### Message Processing Plugin Return: `MessageProcessingHookReturn`

May return:

- `boolean`
- `string`
- `MessageProcessingHookObjectResult`
- `null`
- `void`
- Or the corresponding `Promise`

`MessageProcessingHookObjectResult` may contain:

- `matched?`
- `text?`
- `content?`
- `chunks?`

### XML Rendering Plugin Return: `XmlRenderHookReturn`

May return:

- `string`
- `XmlRenderHookObjectResult`
- `null`
- `void`
- Or the corresponding `Promise`

`XmlRenderHookObjectResult` may contain:

- `handled?`
- `text?`
- `content?`
- `composeDsl?`

`composeDsl` may return within its structure:

- `screen: ComposeDslScreenRef`
- `state?`
- `memo?`
- `moduleSpec?`

### Input Menu Toggle Return: `InputMenuToggleHookReturn`

May return:

- `InputMenuToggleDefinitionResult[]`
- `InputMenuToggleObjectResult`
- `null`
- `void`
- Or the corresponding `Promise`

Each individual toggle definition contains:

- `id`
- `title`
- `description?`
- `isChecked?`

### Chat Input Box Return: `ChatInputHookReturn`

The return values of `input_changed` and `submitted` are ignored.

`submit_requested` supports returning:

- `null`
- `void`
- `string`: indicates replacing the text of this submission
- `{ action: 'allow' }`
- `{ action: 'block', message?: string }`
- `{ action: 'replace', text: string }`
- `{ action: 'consume', message?: string, clearInput?: boolean }`
- Or the corresponding `Promise`

### Chat Message Persistence Return

The return value of `message_persisted` is ignored.

### Chat Message Long-Press Menu Return

`chat_message_menu_item_click` may return `{ dialog: { state?, moduleSpec?, title? } }`. If the registered item declares `dialog.screen`, the host opens the corresponding Compose DSL dialog, and writes the current `chatId`, `messageIndex`, `menuItemId`, and message snapshot into the dialog's initial `state`.

### Prompt-Related Returns

- `PromptInputHookReturn`
- `PromptHistoryHookReturn`
- `SystemPromptComposeHookReturn`
- `ToolPromptComposeHookReturn`
- `PromptFinalizeHookReturn`
- `SummaryGenerateHookReturn`

These return types allow switching between strings, message arrays, structured objects, and empty returns; the exact details are governed by the type definitions.
Among them:

- Array elements in `PromptHistoryHookReturn` are of type `PromptTurn`
- Array elements in `PromptFinalizeHookReturn` are also of type `PromptTurn`
- The estimation-phase `PromptEstimateHistoryHook` / `PromptEstimateFinalizeHook` reuse the same payload and return structures
- `SummaryGenerateHookReturn` may return a string or a structured object; a string is treated as `summaryPrompt` in the pre-summary-generation phase, and as `summaryResult` in the `after_generate_summary` phase

## Registration Definition Objects

### `ToolboxUiModuleRegistration`

Fields:

- `id`
- `runtime?`
- `screen: ComposeDslScreenRef`
- `params?`
- `title?`

### `AppLifecycleHookRegistration`

Fields:

- `id`
- `event`
- `function`

### `MessageProcessingPluginRegistration`

Fields:

- `id`
- `function`

### `XmlRenderPluginRegistration`

Fields:

- `id`
- `tag`
- `function`

### `InputMenuTogglePluginRegistration`

Fields:

- `id`
- `function`

### `ChatInputHookRegistration`

Fields:

- `id`
- `function`

### `ChatMessageHookRegistration`

Fields:

- `id`
- `function`

### `ChatMessageMenuItemRegistration`

Fields:

- `id`
- `title`
- `icon?`
- `order?`
- `senders?`
- `dialog?`
- `function`

`dialog.screen` may be a Compose DSL screen reference, or a resource path string inside the package. When using this registration item, the manifest needs to declare `"api_version": "1.0.1"`.

### `ChatRuntimeHookRegistration`

Fields:

- `id`
- `function`

### Other Registration Objects

The following registration objects are all very simple in structure, with fields of just `id` + `function`:

- `ToolLifecycleHookRegistration`
- `PromptInputHookRegistration`
- `PromptHistoryHookRegistration`
- `PromptEstimateHistoryHookRegistration`
- `SystemPromptComposeHookRegistration`
- `ToolPromptComposeHookRegistration`
- `PromptFinalizeHookRegistration`
- `PromptEstimateFinalizeHookRegistration`
- `SummaryGenerateHookRegistration`

## `ToolPkg.Registry`

The runtime `ToolPkg` object implements this interface, providing the following methods:

- `registerToolboxUiModule(definition)`
- `registerUiRoute(definition)`
- `registerNavigationEntry(definition)`
- `registerDesktopWidget(definition)`
- `registerAppLifecycleHook(definition)`
- `registerMessageProcessingPlugin(definition)`
- `registerXmlRenderPlugin(definition)`
- `registerInputMenuTogglePlugin(definition)`
- `registerChatInputHook(definition)`
- `registerChatMessageHook(definition)`
- `registerChatMessageMenuItem(definition)`
- `registerChatRuntimeHook(definition)`
- `registerToolLifecycleHook(definition)`
- `registerPromptInputHook(definition)`
- `registerPromptHistoryHook(definition)`
- `registerPromptEstimateHistoryHook(definition)`
- `registerSystemPromptComposeHook(definition)`
- `registerToolPromptComposeHook(definition)`
- `registerPromptFinalizeHook(definition)`
- `registerPromptEstimateFinalizeHook(definition)`
- `registerSummaryGenerateHook(definition)`
- `readResource(key, outputFileName?)`

### `ToolPkg.readResource(...)`

Releases a resource declared in the current toolpkg's `manifest.resources` by `key` to the host temporary directory, and returns the absolute path after it is written to disk.

```ts
const jarPath = await ToolPkg.readResource('apktool_lib_jar', 'apktool-lib.jar');
```

Notes:

- This method does not depend on the `compose_dsl` `ctx`; ordinary subpackage tool functions, main entry hooks, and UI modules can all call it directly.
- `key` corresponds to `resources[].key` in `manifest.json`.
- `outputFileName` is optional; when omitted, the manifest resource's original filename is used.
- If the resource `mime` is a directory type (e.g. `inode/directory`, `vnd.android.document/directory`), the runtime first compresses that directory into a zip, then returns the absolute path of that zip file; the default filename automatically gains a `.zip` suffix.
- It cannot be called during `registerToolPkg()` execution; calling it throws an exception immediately.

## ToolPkg Logo

A ToolPkg can distribute its package logo as an ordinary resource along with the archive. `logo` takes a resource key, and the resource
must be a file, supporting SVG, PNG, JPEG, and WebP:

```json
{
  "logo": "package_logo",
  "resources": [
    {
      "key": "package_logo",
      "path": "resources/logo.svg",
      "mime": "image/svg+xml"
    }
  ]
}
```

Old packages without a `logo` field continue to use the default icon. Marketplace entries can display the logo corresponding to that resource.

## AssemblyScript WASM Modules

Enterprise plugins can declare AssemblyScript-compiled `.wasm` core modules in `manifest.json`:

```json
{
  "wasm_modules": [
    {
      "id": "core",
      "path": "modules/core.wasm",
      "exports": ["isPrime", "nthPrime"],
      "source_language": "assemblyscript",
      "abi": "assemblyscript"
    }
  ]
}
```

Suggested structure:

```text
my_toolpkg/
├── manifest.json
├── package.json
├── src/
│   ├── main.ts
│   └── wasm/
│       ├── core.ts
│       └── core.as.ts
├── build/
│   └── main.js
└── modules/
    └── core.wasm
```

AssemblyScript core module example `src/wasm/core.as.ts`:

```ts
export function isPrime(n: i32): i32 {
  if (n < 2) return 0;
  for (let divisor: i32 = 2; divisor <= n / divisor; divisor += 1) {
    if (n % divisor === 0) return 0;
  }
  return 1;
}
```

Compilation example:

```bash
npx asc src/wasm/core.as.ts --outFile modules/core.wasm --optimize
```

The current host parses and validates `wasm_modules`. A plugin's outward-facing entry points remain JS `exports` and the `ToolPkg.register...` series of APIs; the author entry point is recommended to be written as `src/main.ts`, which generates the `main.js` the host executes at build time. `ToolPkg.wasm.call(...)` cannot be called during `registerToolPkg()` execution; calling it throws an exception immediately.

TS facade example `src/wasm/core.ts`:

```ts
export async function isPrime(n: number): Promise<boolean> {
  const result = await ToolPkg.wasm.call("core", "isPrime", [{ type: "i32", value: n }]);
  if (typeof result !== "number") {
    throw new Error("core.isPrime returned a non-number result");
  }
  return result === 1;
}
```

Main entry example `src/main.ts`:

```ts
import { isPrime } from "./wasm/core";

export async function run(params: { n: number }) {
  return { is_prime: await isPrime(params.n) };
}
```

The current ABI supports `i32`, `i64`, `f32`, and `f64`. `i64` results are returned as strings; when passing `i64`, using strings is recommended to avoid JS number precision loss.

## Examples

### Registering a Toolbox UI Module

```ts
import toolboxUI from './index.ui.js';

ToolPkg.registerToolboxUiModule({
  id: 'demo_toolbox',
  runtime: 'compose_dsl',
  screen: toolboxUI,
  params: {},
  title: {
    zh: '示例模块',
    en: 'Demo Module'
  }
});
```

### Registering a Desktop Widget

```ts
ToolPkg.registerDesktopWidget({
  id: 'demo_widget',
  route: 'toolpkg:com.example.demo:ui:dashboard',
  render: 'toolpkg:com.example.demo:ui:dashboard_widget',
  title: {
    zh: '示例小组件',
    en: 'Demo Widget'
  },
  subtitle: {
    zh: '点击直接打开面板',
    en: 'Tap to open dashboard'
  },
  description: {
    zh: '用于桌面添加时的说明',
    en: 'Shown in widget picker'
  }
});
```

Notes:

- `route` / `routeId` must point to an already-registered UI route.
- `render` / `renderRouteId` is used to specify the UI route used to render the widget body; when omitted, it defaults to `route`.
- The current host uses a generic desktop widget to carry multiple ToolPkg widgets; when users add one to the desktop, they first enter a configuration page to select the specific item.
- The current click behavior is to open the corresponding route.

### Registering an App Lifecycle Hook

```ts
ToolPkg.registerAppLifecycleHook({
  id: 'demo_app_create',
  event: 'application_on_create',
  function(event) {
    console.log(JSON.stringify(event.eventPayload ?? {}));
    return { ok: true };
  }
});
```

### Registering a Message Processing Plugin

```ts
ToolPkg.registerMessageProcessingPlugin({
  id: 'demo_message_plugin',
  async function(event) {
    const message = String(event.eventPayload?.messageContent ?? '').trim();
    if (!message.startsWith('/demo')) {
      return { matched: false };
    }
    return {
      matched: true,
      text: '已命中 demo 插件'
    };
  }
});
```

### Registering an XML Rendering Plugin

```ts
ToolPkg.registerXmlRenderPlugin({
  id: 'demo_xml',
  tag: 'demo',
  function(event) {
    const xml = String(event.eventPayload?.xmlContent ?? '');
    if (!xml) {
      return { handled: false };
    }
    return {
      handled: true,
      text: 'XML 已处理'
    };
  }
});
```

### Registering an Input Menu Toggle Plugin

```ts
ToolPkg.registerInputMenuTogglePlugin({
  id: 'demo_toggle',
  function(event) {
    if (event.eventPayload?.action === 'create') {
      return [
        {
          id: 'demo_feature',
          title: 'Demo Feature',
          description: '示例开关',
          isChecked: true
        }
      ];
    }
    return [];
  }
});
```

### Registering a Chat Input Box Hook

```ts
ToolPkg.registerChatInputHook({
  id: 'demo_chat_input',
  function(event) {
    if (event.eventName === 'input_changed') {
      console.log('draft:', event.eventPayload.text);
      return;
    }

    if (event.eventName === 'submit_requested') {
      const text = event.eventPayload.text || '';
      if (text.includes('/blocked')) {
        return {
          action: 'block',
          message: '这条消息被插件阻止发送'
        };
      }
      if (text.startsWith('/upper ')) {
        return {
          action: 'replace',
          text: text.slice('/upper '.length).toUpperCase()
        };
      }
    }
  }
});
```

### Registering a Chat Message Persistence Hook

```ts
ToolPkg.registerChatMessageHook({
  id: 'demo_chat_message_sync',
  function(event) {
    if (event.eventName !== 'message_persisted') {
      return;
    }

    const message = event.eventPayload;
    const key = `${message.chatId}:${message.timestamp}`;
    console.log('persisted message:', {
      key,
      sender: message.sender,
      roleName: message.roleName,
      completedAt: message.completedAt,
      length: message.content.length
    });
  }
});
```

### Registering a Chat Message Long-Press Menu

The message long-press menu has been available since ToolPkg API `1.0.1`. The manifest needs to declare `"api_version": "1.0.1"`.

```ts
ToolPkg.registerChatMessageMenuItem({
  id: 'demo_translate_message',
  title: {
    zh: '翻译',
    en: 'Translate'
  },
  icon: 'translate',
  order: 20,
  senders: ['user', 'ai'],
  dialog: {
    screen: 'dist/ui/translate_dialog.ui.js',
    title: {
      zh: '翻译消息',
      en: 'Translate Message'
    }
  },
  function(event) {
    return {
      dialog: {
        state: {
          message: event.eventPayload.message
        }
      }
    };
  }
});
```

A dialog UI file can directly return `ctx.UI.AlertDialog(...)` or `ctx.UI.Dialog(...)`. The host writes `chatId`, `messageIndex`, `menuItemId`, and `message` into the DSL's initial state. For the interface language, read it via `getLang()`.

### Registering a Chat Runtime Hook

The chat runtime hook has been available since ToolPkg API `1.0.1`. The manifest needs to declare `"api_version": "1.0.1"`. It fires when the host chat runtime state changes, and the current event name is `state_changed`.

```ts
ToolPkg.registerChatRuntimeHook({
  id: 'demo_chat_runtime',
  function(event) {
    if (event.eventName !== 'state_changed') {
      return;
    }

    const state = event.eventPayload;
    console.log('chat runtime:', {
      chatId: state.chatId,
      slot: state.slot,
      state: state.state,
      toolName: state.toolName,
      progress: state.progress,
      isActive: state.isActive
    });
  }
});
```

### Registering a Summary Generation Hook

```ts
ToolPkg.registerSummaryGenerateHook({
  id: 'demo_summary_hook',
  function(event) {
    if (event.eventName === 'before_prepare_summary_prompt') {
      return {
        summaryPrompt: '请重点总结最近的工程决策、已完成事项和下一步待办。'
      };
    }

    if (event.eventName === 'after_generate_summary') {
      return {
        summaryResult: String(event.eventPayload?.summaryResult ?? '').trim()
      };
    }

    return null;
  }
});
```

## About the `registerToolPkg()` Entry Point

Tool packages should export a `registerToolPkg()` function in the manifest's `main` entry file, and call the above registration methods centrally inside it.

`registerToolPkg()` should only be used to declare registration items; it should not start resident timers, infinite loops, or wait for long-running tasks. This entry point has a 12-second execution limit. `ToolPkg.readResource(...)` and `ToolPkg.wasm.call(...)` cannot be used during the registration phase. JavaScript global state from the registration phase is not carried over as persistent state for subsequent tool calls or UI hooks.

## Development Debug Installation

What `toolpkg.d.ts` describes here is the registration API, which itself is not responsible for "how to debug-install onto a phone".

If you are developing a ToolPkg, note that:

- Ordinary `.js` packages can be debugged in a single run with `tools/adb/execute_js.bat` / `tools/adb/execute_js.sh`
- A `toolpkg` is not suitable for debugging that way, because it needs to read the manifest, execute the `main` registration entry, and reinstall the registration information
- When debugging a ToolPkg, use `tools/toolpkg/debug_toolpkg.bat` / `tools/toolpkg/debug_toolpkg.sh` / `tools/toolpkg/debug_toolpkg.py`

For the complete packaging, flashing, enabling, and refresh flow, see "10.3 Using the Debug Install Script to Quickly Flash to a Phone" in [TOOLPKG_FORMAT_GUIDE.md](../../TOOLPKG_FORMAT_GUIDE.en.md).

## Related Files

- `examples/types/toolpkg.d.ts`
- `examples/types/compose-dsl.d.ts`
- `docs/doc-src/package-dev/core.md`
- `docs/TOOLPKG_FORMAT_GUIDE.md`
