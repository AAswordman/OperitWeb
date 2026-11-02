# API Documentation: `core.d.ts`

`core.d.ts` is the foundational definition file for the entire script runtime environment. It provides tool invocation, result structures, low-level bridge interfaces, and several global tool objects.

## Purpose

The current definitions cover:

- Generic parameter and result types.
- `toolCall()` and `complete()`.
- The `NativeInterface` native bridge.
- Lightweight tool objects `_` and `dataUtils`.
- CommonJS-style `exports`.

## Basic Types

### `ToolParams`

```ts
interface ToolParams {
  [key: string]: string | number | boolean | object;
}
```

Used to describe tool call parameters.

### `ToolConfig`

```ts
interface ToolConfig {
  type?: string;
  name: string;
  params?: ToolParams;
}
```

Used for the object form of `toolCall()`.

### `BaseResult`

```ts
interface BaseResult {
  success: boolean;
  error?: string;
}
```

### `StringResult` / `BooleanResult` / `NumberResult`

These three results all inherit from `BaseResult`, and carry:

- `data`
- `toString()`

### `ToolResult`

```ts
type ToolResult = StringResult | BooleanResult | NumberResult | (BaseResult & { data: any })
```

### `ToolReturnType<T>`

It derives the return type of `toolCall()` from the `ToolResultMap` in `tool-types.d.ts`.

## Global Functions

### `toolCall()`

`core.d.ts` defines a total of 4 overloads:

```ts
toolCall(toolType: string, toolName: T, toolParams?: ToolParams)
toolCall(toolName: T, toolParams?: ToolParams)
toolCall(config: ToolConfig & { name: T })
toolCall(toolName: string)
```

The most commonly used are the latter two:

```ts
const result = await toolCall('read_file', { path: '/sdcard/a.txt' });
```

Or:

```ts
const result = await toolCall({
  name: 'http_request',
  params: { url: 'https://example.com' }
});
```

Additional notes:

- `toolCall()` runs over an asynchronous bridge at runtime, but JS callback dispatch still returns to the same QuickJS runtime thread.
- `Promise.all([...toolCall(...)])` only means "wait for multiple Promises at the same time"; it does not guarantee that the underlying tools actually execute in parallel. Whether they truly run in parallel depends on the corresponding tool executor itself.
- If intermediate results are needed, use the overload with `onIntermediateResult`.

### `complete(result)`

```ts
complete<T>(result: T): void
```

Ends script execution and returns the result.

Additional notes:

- An exported function can either directly `return result`, or explicitly call `complete(result)`.
- The Java Bridge contract is governed by [docs/doc-src/dev-core/JAVA_BRIDGE_INTERFACE.md](../dev-core/JAVA_BRIDGE_INTERFACE.en.md).
- `complete(result)` suits scenarios where you need to end manually or use it together with an emitter.

## `NativeInterface`

`NativeInterface` is a lower-level native bridge interface. Most business code should prefer `Tools.*`, `toolCall()`, or global objects; use it directly only when bridge-level capabilities are needed.

### Tool Invocation and Logging

- `callTool(toolType, toolName, paramsJson)`
- `callToolAsync(callbackId, toolType, toolName, paramsJson)`
- `logInfo(message)`
- `logError(message)`
- `logDebug(message, data)`

Scripts return execution results via `complete(result)`. Callback methods internal to the runtime are not part of the `NativeInterface` public interface.

### ToolPkg Registration

- `registerToolPkgToolboxUiModule(specJson)`
- `registerToolPkgAppLifecycleHook(specJson)`
- `registerToolPkgMessageProcessingPlugin(specJson)`
- `registerToolPkgXmlRenderPlugin(specJson)`
- `registerToolPkgInputMenuTogglePlugin(specJson)`

### Image Registration

- `registerImageFromBase64(base64, mimeType)`
- `registerImageFromPath(path)`

Both methods return a `<link type="image" id="...">` string that can be embedded in messages.

### Error Reporting

- `reportError(errorType, errorMessage, errorLine, errorStack)`

### Java / Kotlin Bridge

- `javaClassExists(className)`
- `javaGetApplicationContext()`
- `javaGetCurrentActivity()`
- `javaNewInstance(className, argsJson)`
- `javaCallStatic(className, methodName, argsJson)`
- `javaCallInstance(instanceHandle, methodName, argsJson)`
- `javaHasInstanceMethod(instanceHandle, methodName)`
- `javaGetStaticField(className, fieldName)`
- `javaSetStaticField(className, fieldName, valueJson)`
- `javaGetInstanceField(instanceHandle, fieldName)`
- `javaSetInstanceField(instanceHandle, fieldName, valueJson)`

These methods generally return bridge JSON strings, which the caller must parse itself.

Additional notes:

- The high-level Java Bridge interface promised to script developers is uniformly governed by [docs/doc-src/dev-core/JAVA_BRIDGE_INTERFACE.md](../dev-core/JAVA_BRIDGE_INTERFACE.en.md).
- Unbinding Java instance handles is part of the runtime's internal lifecycle management; no public `release` / `releaseAll` script interfaces are provided anymore.
- JS callback objects produced by `Java.implement(...)` / `Java.proxy(...)` are now automatically unbound by the runtime; the old script-side manual release interfaces have been removed.
- `obj.methodName()` is the preferred usage; the runtime will preferentially interpret instance members as methods, to keep the syntactic sugar usable as much as possible.
- `obj.call('methodName', ...)` is still retained, mainly for the rare cases of field/method name conflicts or low-level debugging scenarios.
- JS callbacks created by `Java.implement(...)` still actually execute on the QuickJS runtime thread; JS code is not truly moved onto a Java child thread to run.

## Global Tool Objects

### `_`

Currently only a lightweight Lodash-style subset is declared:

- `isEmpty`
- `isString`
- `isNumber`
- `isBoolean`
- `isObject`
- `isArray`
- `forEach`
- `map`

### `dataUtils`

- `parseJson(jsonString)`
- `stringifyJson(obj)`
- `formatDate(date?)`

### `exports`

```ts
var exports: { [key: string]: any }
```

Used for CommonJS-style exports.

## Examples

### Using `toolCall()`

```ts
const file = await toolCall('read_file', {
  path: '/sdcard/demo.txt'
});
complete(file);
```

### Logging Directly

```ts
NativeInterface.logInfo('start');
NativeInterface.logDebug('payload', JSON.stringify({ ok: true }));
```

### Registering an Image

```ts
const imageLink = NativeInterface.registerImageFromPath('/sdcard/demo.png');
complete({ imageLink });
```

## Relationship to `index.d.ts`

`core.d.ts` defines the "basic capabilities"; `index.d.ts` builds on this to attach more objects and helper functions to the global scope, for example:

- `sendIntermediateResult`
- `getEnv`
- `Tools`
- `Java`
- `Kotlin`

For these additions, please read them together with `docs/doc-src/package-dev/index.md`.

## Related Files

- `examples/types/core.d.ts`
- `examples/types/tool-types.d.ts`
- `docs/doc-src/package-dev/index.md`
