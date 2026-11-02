# Script Development Guide

This document discusses only the four things that really matter for the current script runtime:

1. The module system and the `import/export` support boundary
2. How to use the Java / Kotlin Bridge
3. The execution model when a script module is called by the host
4. How to write `compose_dsl`

This document does **not** discuss metadata, manifest, or packaging description fields.

---

## 1. First, Build the Correct Mental Model

Operit's current script runtime is neither Node.js nor a browser-native ESM runtime.

It is closer to:

- A host-controlled **CommonJS-style module executor**
- A **local runtime** injected per call
- A **bridging environment** with direct access to Android / Java / Kotlin
- A **declarative rendering runtime** that additionally supports `compose_dsl` for UI scenarios

Therefore, when writing scripts, the most important principles are:

- **Write modules as CommonJS**: `require`, `exports`, `module.exports`
- **Treat one call as one independent session**: do not rely on cross-call module singletons
- **Treat streams as call-specific capabilities**: use the host-injected `sendIntermediateResult / emit / delta / log / update / done / complete` directly
- **Treat Java/Kotlin as a bridged object system**: not direct TypeScript type connections, but proxy objects + handle lifecycles

---

## 2. Module System: What Is Actually Supported

### 2.1 The Runtime Supports CommonJS, Not Native ESM

The JS module form that the runtime actually executes is:

```js
const helper = require('./helper');

function run(params) {
  return helper.work(params);
}

exports.run = run;
```

Or:

```js
module.exports = {
  run(params) {
    return { ok: true, params };
  }
};
```

The current runtime **directly supports**:

- `require(...)`
- `exports.xxx = ...`
- `module.exports = ...`

The current runtime does **not directly execute** native ESM:

```ts
import { foo } from './foo';
export function run() {}
```

If you want to write `import/export` syntax in TypeScript, you can, but only on the condition that:

- The final compiled output must land as CommonJS-style JS
- Do not hand untranspiled ESM directly to the runtime

The recommended TypeScript output target is CommonJS.

---

### 2.2 `require` Resolution Rules

For toolpkg / main script modules, `require` supports the following forms.

#### Relative Paths

```js
const plan = require('./plan/PlanModeManager');
const parser = require('../shared/parser');
```

#### Absolute In-Package Paths

```js
const utils = require('/lib/utils');
```

#### JSON Modules

```js
const config = require('./config.json');
```

`.json` is automatically parsed into an object.

#### Directory Entry Fallback

For paths without a suffix, the runtime tries the following candidates in order:

- `name`
- `name.js`
- `name.json`
- `name/index.js`
- `name/index.json`

In other words, both of the following work:

```js
const mod = require('./foo');
const mod2 = require('./foo/index');
```

---

### 2.3 Non-Relative Modules: Only Runtime Built-ins Are Supported

This is not the complete npm ecosystem.

The runtime only has a few built-in names:

- `lodash` → `_`
- `uuid` → provides `v4()`
- `axios` → a lightweight wrapper around the host's `http_request`, not full Node axios

For example:

```js
const _ = require('lodash');
const { v4 } = require('uuid');
const axios = require('axios');
```

If you write:

```js
require('fs');
require('path');
require('process');
```

These Node built-in modules are **not supported by default**.

---

### 2.4 Export Rules and Recommended Style

When the host executes a module, it looks for the export corresponding to the target function name.

Always export explicitly, as recommended:

```js
async function onMessage(params) {
  return { ok: true };
}

exports.onMessage = onMessage;
```

Or:

```js
module.exports = {
  onMessage,
  onXmlRender,
  onAppStart,
};
```

Although the runtime also tries some additional paths (for example, resolving to an injected function or a function on `window` in some scenarios), **at the documentation level, only treat `exports/module.exports` as the official interface**.

That is the most stable, and it most helps with splitting modules apart.

---

### 2.5 Cached Within a Single Call, Not Cached Across Calls

This is a key point of the current architecture.

**Within a single call**:

- Calling `require('./foo')` multiple times only executes it once
- Modules within the same call share the same `exports`

**Between different calls**:

- The main module is re-evaluated
- Submodules are also reloaded for the current call
- No cross-call persistent module cache is retained

Therefore you should understand module state like this:

- **Shareable within a call**
- **Do not rely on persisting module-level state across calls**

Incorrect example:

```js
let globalCounter = 0;

exports.run = function () {
  globalCounter += 1;
  return globalCounter;
};
```

Do not assume it can keep accumulating across multiple calls.

---

### 2.6 The Boundary Between Top-Level Code and Asynchronous Code

Module top-level code executes during the loading phase, still with synchronous loading semantics.

Put asynchronous work inside exported functions, as recommended:

```js
async function run(params) {
  const data = await toolCall('http_request', {
    url: params.url,
    method: 'GET'
  });
  return data;
}

exports.run = run;
```

Do not design module initialization to depend on "exporting only after top-level async work completes".

---

## 3. What Actually Happens When a Script Module Is Called

### 3.1 Host Call Model

When the host calls a script, it essentially:

- Establishes a new call session
- Allocates a new `callId`
- Injects a set of **local runtime functions bound for this call**
- Executes the target module
- Looks up the specified exported function
- Calls it with a single `params` object
- Receives the final result and intermediate streaming results

In other words, you should understand an exported function as:

```ts
type RuntimeEntry = (params: Record<string, unknown>) => unknown | Promise<unknown>
```

Not:

- Multi-positional-argument calls
- Relying on a global current context
- Relying on the host to guess which stream this belongs to

---

### 3.2 Parameter Passing Characteristics

When the host calls the target function, it passes a **single object parameter**.

For example:

```js
async function onMessage(params) {
  const event = params.event;
  const payload = params.eventPayload;
  const pluginId = params.pluginId;
  return { event, payload, pluginId };
}

exports.onMessage = onMessage;
```

Therefore it is recommended to:

- Always assume the entry has only one `params`
- Hang all extended fields on `params`
- Do field convergence and validation inside the module itself

---

### 3.3 Return Value Model

You can:

- Return a plain object directly
- Return a string / number / array
- Return a `Promise`
- Explicitly call `complete` / `done`

For example:

```js
exports.runSync = function (params) {
  return { ok: true, mode: 'sync', params };
};

exports.runAsync = async function (params) {
  const data = await toolCall('http_request', {
    url: params.url,
    method: 'GET'
  });
  return { ok: true, data };
};
```

If you just want to "complete normally", **returning directly is the most natural style**.

Only use the following when you really want to control termination manually:

- `done(...)`
- `complete(...)`

---

### 3.4 Stream: Current Recommended Usage

For script developers, the most important conclusion is just one sentence:

**Do not manage the call context yourself, do not guess ownership yourself, use the injected emitter directly.**

Each call injects a set of **local functions bound to this call**:

- `sendIntermediateResult(...)`
- `emit(...)`
- `delta(...)`
- `log(...)`
- `update(...)`
- `done(...)`
- `complete(...)`

They are all **closures dedicated to this call**, so they can safely cross `await`:

```js
exports.run = async function (params) {
  log({ stage: 'start' });

  const plan = await toolCall('http_request', {
    url: params.url,
    method: 'GET'
  });

  update({ stage: 'after-await', plan });

  return { ok: true, plan };
};
```

Under this model, the rules a script author needs to follow are:

- **Call the emitter directly**
- **Do not save / derive / pass callId**
- **Do not patch Promise context propagation yourself**
- **Do not write global logic for "who the current session is"**

This part already belongs to the engine's responsibilities, and should not go back to the plugin layer to handle.

---

### 3.5 `console` and Error Reporting

When a module executes, `console.log/info/warn/error` are also bound per call.

In other words:

```js
console.log('loading...');
console.error('failed:', err);
```

They land on the log channel corresponding to the current call, rather than relying on some global "currently active call".

In addition, the runtime also provides a per-call-bound:

```js
reportDetailedError(error, 'some context');
```

Usually you only need to use `try/catch` in business code for normal error tidying; underlying bridging errors, Promise rejections, and console paths are already handled by the runtime.

---

### 3.6 Context-Reading Functions Available to the Current Call

In ordinary modules, the current call injects these convenience functions:

- `getEnv(key)`
- `getState()`
- `getLang()`
- `getCallerName()`
- `getChatId()`
- `getCallerCardId()`

For example:

```js
exports.run = async function () {
  const lang = getLang();
  const apiKey = getEnv('OPENAI_API_KEY');
  return { lang, hasApiKey: !!apiKey };
};
```

These functions are likewise **bound to this call**, and need no global context.

---

## 4. `toolCall`, `Tools`, and Host Capabilities

### 4.1 `toolCall` Is Promise-Style

`toolCall(...)` in the current runtime is asynchronous, returning a `Promise`.

It supports several common styles:

```js
await toolCall('http_request', { url: 'https://example.com', method: 'GET' });
await toolCall('default', 'http_request', { url: 'https://example.com', method: 'GET' });
```

It is recommended to uniformly write it in `await` style, and not to treat it as a synchronous function.

---

### 4.2 `Tools` Is a Host-Predefined Bridge

The runtime also injects a `Tools` object. It suits high-level tool-style calls; `toolCall` suits a uniform style and dynamic calls.

If you are writing generic modules or reusable helpers, it is recommended to prioritize:

- `toolCall` for host tool capabilities
- `Java` for Java/Kotlin system capabilities

That makes the structure clearer.

---

## 5. Java / Kotlin Bridge

If you only want to see the **interface promised to script developers**, prioritize reading [docs/doc-src/dev-core/JAVA_BRIDGE_INTERFACE.md](../../../../../../../../docs/doc-src/dev-core/JAVA_BRIDGE_INTERFACE.md).

### 5.1 Entry Objects

The runtime injects:

- `Java`
- `Kotlin`

They are two aliases for the same bridge.

The most commonly used entries:

- `Java.type(className)`
- `Java.use(className)`
- `Java.importClass(className)`
- `Java.package(packageName)`
- `Java.newInstance(className, ...args)`
- `Java.callStatic(className, methodName, ...args)`
- `Java.callSuspend(className, methodName, ...args)`
- `Java.loadDex(path, options?)`
- `Java.loadJar(path, options?)`
- `Java.listLoadedCodePaths()`

---

### 5.2 Basic Examples

```js
const StringBuilder = Java.type('java.lang.StringBuilder');
const sb = new StringBuilder();
// 也可以：const sb = StringBuilder();
// 也可以：const sb = StringBuilder.newInstance();

sb.append('hello ');
sb.append('world');
const text = sb.toString();
```

Class access / nested class access syntactic sugar:

```js
const Integer = Java.java.lang.Integer;
const Build = Java.android.os.Build;
const Version = Java.android.os.Build.VERSION;
const AlertDialogBuilder = Java.android.app.AlertDialog.Builder;
```

Static field / static method syntactic sugar:

```js
const Integer = Java.java.lang.Integer;
const Build = Java.android.os.Build;

const maxValue = Integer.MAX_VALUE;
const parsed = Integer.parseInt('123');

const model = Build.MODEL;
const sdkInt = Build.VERSION.SDK_INT;

// 等价底层写法
const parsedByApi = Java.callStatic('java.lang.Integer', 'parseInt', '123');
```

Suspend calls can go through either the top-level API or the class proxy syntactic sugar:

```js
const SomeBridge = Java.com.ai.assistance.operit.SomeBridge;

const resultA = await SomeBridge.callSuspend('loadSomething', 'arg1');

const resultB = await Java.callSuspend(
  'com.ai.assistance.operit.SomeBridge',
  'loadSomething',
  'arg1'
);
```

If what you hold is an instance proxy, it is likewise supported:

```js
const stream = await enhancedAIService.callSuspend('sendMessage', options);
```

It is recommended to uniformly write `await ...callSuspend(...)`, and not to treat suspend methods as synchronous functions.

---

### 5.3 Java Classes, Instances, and Package Proxies

Objects in the bridge are not real class instances in the TypeScript sense, but proxies.

#### Class Proxies

```js
const File = Java.type('java.io.File');
const file = File.newInstance('/sdcard/test.txt');
```

#### Instance Proxies

```js
file.exists();
file.getName();
file.length();
```

#### Package Proxies

```js
const Runnable = Java.java.lang.Runnable;
```

These proxies support:

- `new Cls(...args)` / `Cls(...args)` / `Cls.newInstance(...args)`
- `obj.method(...args)`, equivalent to `obj.call('method', ...args)`
- `obj.field` / `obj.field = value`, equivalent to `obj.get('field')` / `obj.set('field', value)`
- `Cls.STATIC_FIELD` / `Cls.STATIC_FIELD = value`, equivalent to `Cls.getStatic('STATIC_FIELD')` / `Cls.setStatic('STATIC_FIELD', value)`
- `Cls.staticMethod(...args)`, equivalent to `Cls.callStatic('staticMethod', ...args)`
- `Cls.InnerClass`, which resolves to `Outer$Inner` as a nested class

For example:

```js
const System = Java.java.lang.System;
const now = System.currentTimeMillis();

const ActivityLifecycleManager = Java.com.ai.assistance.operit.core.application.ActivityLifecycleManager;
const activity = ActivityLifecycleManager.INSTANCE.getCurrentActivity();
```

For static method calls on Kotlin class proxies, the runtime also automatically tries a `Companion` fallback; therefore many `companion object` methods can also be written directly as `SomeKotlinClass.someMethod()`.

#### Dynamically Loading dex / jar

If a script needs to access classes outside the host APK, first attach the external code to the Java bridge's `ClassLoader` chain, then use `Java.type(...)` / `Java.xxx.yyy` normally.

Loading a `.dex`:

```js
Java.loadDex('/data/user/<current_user_id>/com.ai.assistance.operit/files/plugins/demo.dex');

const DemoEntry = Java.type('com.example.demo.Entry');
const message = DemoEntry.callStatic('hello');
```

Loading a `.jar`:

```js
Java.loadJar('/data/user/<current_user_id>/com.ai.assistance.operit/files/plugins/demo.jar');

const DemoEntry = Java.type('com.example.demo.Entry');
const instance = new DemoEntry();
```

If the external code also depends on a `.so`, you can additionally specify a native library directory:

```js
Java.loadDex('/data/user/<current_user_id>/com.ai.assistance.operit/files/plugins/demo.dex', {
  nativeLibraryDir: '/data/user/<current_user_id>/com.ai.assistance.operit/files/plugins/lib'
});
```

If the external jar and the host APK have same-package-name dependency conflicts, you can explicitly specify child-first package prefixes:

```js
Java.loadJar('/data/user/<current_user_id>/com.ai.assistance.operit/files/plugins/demo.jar', {
  childFirstPrefixes: [
    'com.example.plugin.',
    'org.apache.commons.'
  ]
});
```

To see which external code has already been mounted in the current session:

```js
const loaded = Java.listLoadedCodePaths();
console.log(JSON.stringify(loaded, null, 2));
```

Constraint notes:

- `loadDex(...)` only accepts `.dex` files.
- `loadJar(...)` only accepts `.jar` files, and the **jar must contain `classes.dex`**.
- Traditional JVM `.class` jars cannot be executed directly on Android through this bridge.
- The call order must be `loadDex/loadJar` first, then `Java.type(...)` or package proxy class access.
- `childFirstPrefixes` only enables child-first lookup for child-matching package name prefixes; other classes still keep the default parent-first behavior.
- Repeatedly loading the same path reuses the loading record already created in the current session, and does not mount it repeatedly.

---

### 5.4 Interface Implementation and Callbacks

You can implement a Java interface in JS:

```js
const Runnable = Java.type('java.lang.Runnable');

const runnable = Java.implement(Runnable, {
  run() {
    console.log('Runnable called from Java');
  }
});
```

Or in SAM style:

```js
const runnable = Java.implement('java.lang.Runnable', () => {
  console.log('run');
});
```

If the call site itself can infer the target interface, a shorter form is also supported:

```js
const runnable = Java.implement(() => {
  console.log('run');
});
```

`Java.proxy(...)` is just an alias for `Java.implement(...)`:

```js
const runnable = Java.proxy(Runnable, {
  run() {
    console.log('run via proxy alias');
  }
});
```

Multi-interface implementation is also supported:

```js
const impl = Java.implement([
  'java.lang.Runnable',
  'java.io.Closeable'
], {
  run() {},
  close() {}
});
```

Besides explicit `Java.implement(...)` / `Java.proxy(...)`, **callback positions** also support object literal syntactic sugar:

```js
const ViewOnClickListener = Java.android.view.View.OnClickListener;

button.setOnClickListener({
  onClick(view) {
    console.log('clicked', view);
  }
});

const listener = ViewOnClickListener({
  onClick(view) {
    console.log('clicked from class proxy', view);
  }
});
```

The core rules here are:

- When the target parameter type of a Java / Kotlin method or constructor is itself an interface, a plain object automatically adapts into an interface proxy
- Methods of the same name on the object map to interface methods
- Accessors like `getX()` / `isX()` / `setX(v)` can also map to the plain property `x` on the object

For example:

```js
someApi.setListener({
  enabled: true,
  onChanged(value) {
    console.log('changed', value);
  }
});
```

If the interface methods are `isEnabled()` / `getEnabled()` / `setEnabled(value)`, the `enabled` property above can also be used as the corresponding implementation.

Callback parameters and return values still follow ordinary bridging conversion:

- Parameters are passed back to JS according to bridging rules
- Non-`void` / non-`Unit` methods can `return` directly
- `void` / `Unit` callbacks may return no value

The bridge internally allocates object IDs for these JS objects, and calls back into JS through the host.

Recommendations:

- For a single SAM interface position, prefer the shorthand `Java.implement(() => {})`
- When just temporarily passing a listener at a method call site, prefer object literal callbacks, which are shorter and more intuitive
- When multiple interfaces, clearer method names, or stronger documentation readability are needed, prefer explicitly writing the interface name / class proxy
- Do not pass a bare JS function directly as an ordinary bridging parameter to Java; for function callbacks, use `Java.implement(...)` / `Java.proxy(...)`

---

### 5.5 Handle Lifecycle: Instances and JS Callbacks Automatically Unbind

Behind a bridging instance is a handle.

Handle unbinding for Java instance proxies is handled automatically by the runtime:

```js
const obj = Java.newInstance('java.lang.StringBuilder');
obj.append('abc');
return obj.toString();
```

Recommendations:

- JS interface callbacks marked as no longer needed do not require manual release; when the corresponding Java proxy is GC'd, the runtime automatically unregisters the current JS callback
- Java instance proxies should no longer be written as `obj.release()` / `Java.release(...)` / `Java.releaseAll()`
- The runtime will try to unbind the corresponding handle after a proxy object is GC'd, and will also uniformly clean up remaining handles when the engine is destroyed.

---

### 5.6 Bridging Parameter and Return Value Boundaries

The most important conclusion of this section is just one sentence:

- **The bridge actively normalizes types, and does not move Java containers to JS verbatim.**

The easiest pitfalls are:

- Java `List` / `Set` / other `Iterable`
- Java arrays
- `Map` / `JSONObject` / `JSONArray`

Once these values cross the bridge to JS, they are usually normalized into ordinary JS structures, rather than retaining Java container methods.

For example:

```js
const result = someJavaApi.listSomething();

Array.isArray(result); // 大概率是 true
result.length;         // 对
result[0];             // 对
result.size();         // 错，JS 里已经不是 java.util.List 了
```

#### Java / Kotlin -> JS

The current actual conversion rules when bridging back to JS are:

| Java / Kotlin Side Value | JS Side Behavior |
|------|------|
| `null` / Kotlin `Unit` | `null` |
| `String` / `char` | `string` |
| Java method-returned `CharSequence` values | Can be used as `string` |
| `boolean` / `Boolean` | `boolean` |
| `int` / `long` / `double` / other `Number` | `number` |
| `float` | `number` (passed with double semantics) |
| `Enum` | Enum name string |
| `Class<?>` | Class name string |
| `Map` / `JSONObject` | Plain JS object |
| `Iterable` (including `List` / `Set`, etc.) | Plain JS array |
| Java arrays | Plain JS array |
| `JSONArray` | Plain JS array |
| Other ordinary Java/Kotlin objects | Java instance proxy (handle proxy) |

This means:

- A `List<File>` returned from Java should be used in JS as an array: `length`, indexes, `map/filter`
- A `Map<String, Object>` returned from Java should be used in JS as a plain object
- Only if what is returned is an ordinary object proxy will it have bridging capabilities like `obj.method()`, `obj.field`
- But if you yourself explicitly construct objects like `new Java.java.lang.StringBuilder()`, `new Java.java.util.ArrayList()`, what you get is still a Java instance proxy, and it is not directly flattened into a string or array

#### JS -> Java / Kotlin

When JS passes arguments to Java / Kotlin, the bridge automatically tries to convert according to the target parameter type:

| JS Side Value | Java / Kotlin Targets It Can Automatically Adapt To |
|------|------|
| `null` | All non-primitive parameters |
| `string` | `String`, and can also try converting to `char` / `enum` / `Class<?>` / `JSONObject` / `JSONArray` |
| `number` | Various numeric types: `byte` / `short` / `int` / `long` / `float` / `double` |
| `boolean` | `boolean` / `Boolean`, and can also participate in some numeric conversions |
| JS arrays | Java arrays, `Collection`, `JSONArray` |
| plain object | `Map`, `JSONObject`, or, when the target is an interface, conversion to an interface implementation proxy |
| Java instance proxy | Restored to the original Java object |
| `Java.implement(...)` / `Java.proxy(...)` return values | Java interface proxy |

Several additional automatic conversions already supported:

- When the target parameter is an interface, a plain object can directly adapt into an interface proxy
- The object property `enabled` can map to `getEnabled()` / `isEnabled()` / `setEnabled(...)`
- When JS arrays are passed to Java varargs, they are converted item by item according to the target component type
- When a string is passed to a `Class<?>` parameter, it tries `Class.forName(...)` by class name
- `List` passed to `JSONArray`, and plain object passed to `JSONObject`, are also automatically wrapped

A few practical examples:

```js
// 1. JS 数组 -> Java 数组 / Collection
someApi.acceptStrings(['a', 'b', 'c']);

// 2. plain object -> Java Map / JSONObject
someApi.acceptConfig({
  enabled: true,
  retries: 3
});

// 3. plain object -> Java interface
button.setOnClickListener({
  onClick(view) {
    console.log('clicked');
  }
});

// 4. Java List -> JS array
const files = someApi.listFiles();
const names = files.map((file) => file.getName());
```

Practical development recommendations:

- Pass simple parameters as raw values directly
- After collection return values enter JS, handle them by default as plain object / array, and do not assume they still retain Java container methods
- When object behavior is needed, confirm that what you got is a Java instance proxy, rather than a structure already normalized
- When high-fidelity calls are needed, prefer putting complex logic on the Java/Kotlin side, then calling a clean bridging method from JS

---

## 6. `compose_dsl`

`compose_dsl` is a special class of runtime module: it does not "return an ordinary JSON result", but rather "returns a declarative UI tree".

---

### 6.1 What the Entry Function Looks Like

A `compose_dsl` module's entry should export:

- `default`
- or `Screen`

Their signatures are both:

```ts
type ComposeDslScreen = (ctx: ComposeDslContext) => ComposeNode | Promise<ComposeNode>
```

Recommended style:

```js
function Screen(ctx) {
  const { UI, Modifier } = ctx;
  return UI.Column(
    {
      modifier: Modifier.padding(16)
    },
    [
      UI.Text({ text: 'Hello compose_dsl' })
    ]
  );
}

exports.default = Screen;
```

Or:

```js
exports.Screen = function Screen(ctx) {
  return ctx.UI.Text({ text: 'Hello' });
};
```

For UI modules, **`default` / `Screen` are the official entries**.

---

### 6.2 What Is in `ctx`

The most important things in `ComposeDslContext` are:

#### State Capabilities

- `useState(key, initialValue)`
- `useMutable(key, initialValue)`
- `useRef(key, initialValue)`
- `useMemo(key, factory, deps?)`

#### UI Capabilities

- `UI.*`
- `Modifier`
- `MaterialTheme`
- `h(type, props, children)`

#### Host Capabilities

- `callTool(...)`
- `toolCall?(...)`
- `getEnv(key)`
- `setEnv(key, value)`
- `navigate(route, args?)`
- `showToast(message)`
- `reportError(error)`

#### Package / Module Identity

- `getModuleSpec()`
- `getCurrentPackageName()`
- `getCurrentToolPkgId()`
- `getCurrentUiModuleId()`

#### Package Management Capabilities (Optional)

- `isPackageImported(packageName)`
- `importPackage(packageName)`
- `removePackage(packageName)`
- `usePackage(packageName)`
- `listImportedPackages()`
- `resolveToolName(request)`

---

### 6.3 A Minimal `compose_dsl` Example

```js
function Screen(ctx) {
  const { UI, Modifier, useState } = ctx;
  const [count, setCount] = useState('count', 0);

  return UI.Column(
    {
      modifier: Modifier.padding(16),
      verticalArrangement: 'center'
    },
    [
      UI.Text({ text: `count = ${count}` }),
      UI.Button(
        {
          text: '加一',
          onClick: () => setCount(count + 1)
        }
      )
    ]
  );
}

exports.default = Screen;
```

There are two key points here:

- Event handler functions can be written directly as JS functions
- After state changes, the host drives re-rendering

---

### 6.4 `compose_dsl` Call Characteristics

Unlike ordinary modules, `compose_dsl` is more like a "host-controlled render loop".

What you need to know:

- On first entry, the host calls the screen and gets a UI tree
- After the user triggers buttons, input boxes, gestures, and other actions, the host dispatches actions
- If there is asynchronous logic inside an action, the host automatically pushes intermediate rendering after state changes
- You do not need to manually send `sendIntermediateResult` to the UI yourself to refresh the interface

In other words:

- **An ordinary script's stream** is called by you yourself with emitters during the business phase
- **A `compose_dsl` interface update** is mainly driven by state changes, with the runtime automatically handling intermediate rendering

These are "streams" at two different levels.

---

### 6.5 `getEnv` in `compose_dsl`

`getEnv` in ordinary modules is injected per call.

In `compose_dsl`, you should prioritize:

```js
ctx.getEnv('KEY')
```

Rather than relying on some global helper.

This is because the current DSL context already explicitly attaches the current call's runtime capabilities to `ctx`.

---

### 6.6 Tool Calls in `compose_dsl`

```js
async function Screen(ctx) {
  const { UI, useState } = ctx;
  const [text, setText] = useState('text', 'loading...');

  return UI.Column({}, [
    UI.Text({ text }),
    UI.Button({
      text: '加载',
      onClick: async () => {
        const data = await ctx.callTool('http_request', {
          url: 'https://example.com',
          method: 'GET'
        });
        setText(JSON.stringify(data));
      }
    })
  ]);
}

exports.default = Screen;
```

In the DSL, uniformly use `ctx.callTool(...)` or `ctx.toolCall(...)`, rather than hard-copying helpers from ordinary scripts over.

---

### 6.7 Resources and Package Operations

#### Reading Resources

```js
const path = await ToolPkg.readResource('icon');
```

What the host returns is usually a readable path or binary content.

#### Package Management

```js
const imported = await ctx.isPackageImported('com.operit.xxx');
if (!imported) {
  await ctx.importPackage('com.operit.xxx');
}
```

#### Resolving Tool Names

```js
const toolName = await ctx.resolveToolName({
  packageName: 'com.operit.xxx',
  toolName: 'do_work'
});
```

---

## 7. Recommended Module Styles

### 7.1 Ordinary Script / Hook Modules

```js
const planner = require('./planner');
const render = require('./render');

async function onMessage(params) {
  log({ stage: 'start' });

  const plan = await planner.build(params);
  update({ stage: 'planned', plan });

  const result = await render.run(plan, params);
  return result;
}

exports.onMessage = onMessage;
```

### 7.2 Helper Modules

```js
async function build(params) {
  return { tasks: [], raw: params };
}

exports.build = build;
```

### 7.3 `compose_dsl` Modules

```js
function Screen(ctx) {
  const { UI } = ctx;
  return UI.Text({ text: 'compose' });
}

exports.default = Screen;
```

---

## 8. Styles Strongly Recommended Against

### 8.1 Do Not Rely on a Global Current Call

Wrong approach:

```js
// 不要自己猜当前调用是谁
// 不要自己维护 callId
```

The current runtime already makes emitters, logging, error reporting, and context reading all per-call-bound local capabilities.

---

### 8.2 Do Not Hand Untranspiled ESM Directly to the Runtime

Wrong:

```ts
import { foo } from './foo';
export const run = () => {};
```

If it has not been compiled to CommonJS, do not run it directly.

---

### 8.3 Do Not Assume Modules Persist Across Calls

Wrong:

```js
let cache = null;
```

Do not rely on it saving state across calls.

---

### 8.4 Do Not Manually Handle Stream Ownership in Plugins

Wrong directions:

- Manually grabbing `callId`
- Manually writing a "currently active call" global variable
- Manually patching Promise / microtask ownership

These all belong to the engine layer, not the script layer.

---

## 9. One-Page Summary

If you only remember four things, remember these four:

1. **Write modules as CommonJS**: `require`, `exports`, `module.exports`
2. **One call is one new session**: do not rely on cross-call module state
3. **Use the injected emitter directly for streams**: `sendIntermediateResult / emit / delta / log / update / done / complete`
4. **When using `compose_dsl` for UI, export `default` or `Screen`**, and route all business capabilities through `ctx`

---

## 10. Related Type Definitions

It is also recommended to refer to:

- `examples/types/java-bridge.d.ts`
- `examples/types/compose-dsl.d.ts`

These two definitions are the most direct entry points for understanding the current script runtime boundaries.
