# API Documentation: `index.d.ts`

`index.d.ts` is the overall entry point of the package development type system. It does three things:

- Re-exports the types from each `.d.ts` file.
- Injects commonly used objects and functions into the global scope.
- Assembles the `Tools` namespace commonly used at runtime.

If you reference only one type entry at the top of a script, it is usually this one.

## Recommended Reference Style

```ts
/// <reference path="./types/index.d.ts" />
```

This way the IDE can directly recognize the global APIs and result types.

## What `index.d.ts` Does

### 1. Re-export core types

It re-exports:

- `core.d.ts`
- `results.d.ts`
- `tool-types.d.ts`
- `java-bridge.d.ts`
- `toolpkg.d.ts`
- `compose-dsl.d.ts`
- `compose-dsl.material3.generated.d.ts`

### 2. Export the main namespaces

It also explicitly exports the following modules:

- `Net`
- `System`
- `SoftwareSettings`
- `UI`
- `UINode`
- `FFmpegVideoCodec` / `FFmpegAudioCodec` / `FFmpegResolution` / `FFmpegBitrate`
- `Tasker`
- `Workflow`
- `ToolPkg`
- `Chat`
- `Memory`
- Android-related classes and enums

### 3. Inject global objects and functions

This is also the most important responsibility of `index.d.ts`: in scripts you usually do not need to `import` to use these objects directly.

## Globally Available Functions

### Tool calls and result returns

- `toolCall(...)`
- `complete(result)`
- `sendIntermediateResult(result)`

### Context reading

- `getEnv(key)`
- `getState()`
- `getLang()`
- `getCallerName()`
- `getChatId()`
- `getCallerCardId()`

## Globally Available Objects and Classes

### Android / UI related

- `Intent`
- `IntentFlag`
- `IntentAction`
- `IntentCategory`
- `UINode`
- `Android`

### Runtime tool objects

- `Tools`
- `_`
- `dataUtils`
- `exports`
- `NativeInterface`
- `Java`
- `Kotlin`

### Constants

- `OPERIT_DOWNLOAD_DIR`
- `OPERIT_CLEAN_ON_EXIT_DIR`

## The `Tools` Namespace

`Tools` assembles the runtime entry points of each module under a single object:

```ts
const Tools: {
  Files
  Net
  System
  SoftwareSettings
  UI
  FFmpeg
  Tasker
  Workflow
  Chat
  Memory
  calc
}
```

Where:

- `Tools.Tasker` corresponds to `Tasker.Runtime`
- `Tools.Workflow` corresponds to `Workflow.Runtime`
- `Tools.calc(expression)` returns `Promise<CalculationResultData>`

## Global Types

`index.d.ts` also promotes a large number of result types to the global scope, for example:

- `CalculationResultData`
- `SleepResultData`
- `SystemSettingData`
- `AppOperationData`
- `AppListData`
- `DeviceInfoResultData`
- `UIPageResultData`
- `UIActionResultData`
- `FileContentData`
- `HttpResponseData`
- `VisitWebResultData`
- `WorkflowDetailResultData`
- `ModelConfigResultItem`
- `MemoryLinkResultData`

In addition, it exposes the following bridge types as global types:

- `ComposeDslContext`
- `ComposeDslScreen`
- `ComposeNode`
- `ComposeCanvasCommand`
- `JavaBridgeApi`
- `JavaBridgeClass`
- `JavaBridgeInstance`
- `JavaBridgeHandle`
- `JavaBridgePackage`
- `JavaBridgeJsInterfaceMarker`
- `JavaBridgeJsInterfaceImpl`
- `JavaBridgeJsMethod`
- `JavaBridgeInterfaceRef`
- `JavaBridgeCallbackResult`

## Examples

### Typical script style

```ts
/// <reference path="./types/index.d.ts" />

const page = await UINode.getCurrentPage();
const title = page.findByText('设置');

if (title) {
  await title.click();
}

const response = await Tools.Net.httpGet('https://example.com');
complete({
  ok: true,
  status: response.statusCode
});
```

### Using context functions

```ts
const apiKey = getEnv('OPENAI_API_KEY');
const state = getState();
const chatId = getChatId();

sendIntermediateResult({ state, chatId });
```

## Document Index for This Directory

The following files in `docs/doc-src/package-dev` are currently synced:

- `android.md`
- `chat.md`
- `core.md`
- `cryptojs.md`
- `ffmpeg.md`
- `files.md`
- `jimp.md`
- `memory.md`
- `network.md`
- `okhttp.md`
- `results.md`
- `software_settings.md`
- `system.md`
- `tasker.md`
- `tool-types.md`
- `toolpkg.md`
- `ui.md`
- `workflow.md`

## Type Files Not Yet Expanded Separately

Some advanced or extended definitions in `examples/types` do not yet have their own document in this directory, for example:

- `compose-dsl.d.ts`
- `compose-dsl.material3.generated.d.ts`
- `java-bridge.d.ts`
- `pako.d.ts`

These types are already re-exported by `index.d.ts`; when using them, the corresponding `.d.ts` remains authoritative.

## Related Files

- `examples/types/index.d.ts`
- `docs/doc-src/package-dev/core.md`
- `docs/doc-src/package-dev/results.md`
- `docs/doc-src/package-dev/toolpkg.md`
