# Java Bridge Interface

This document is the **interface contract for QuickJS + Java Bridge**.

It has only one goal:

- Give script developers a **concise, directly dependable** API document
- Give testing a **clear acceptance baseline**
- Give the Bridge implementation the **target behavior to align with**

If the implementation disagrees with this document, the problem should first be treated as a **Bridge / Runtime item to fix**, rather than lowering the document's promises first.

## 1. Entry Point

Injected at runtime:

- `Java`
- `Kotlin`

They are two aliases for the same bridge.

## 2. Class and Package Access

The following entry points are supported:

```js
Java.type('java.lang.StringBuilder')
Java.use('java.lang.StringBuilder')
Java.importClass('java.lang.StringBuilder')
Java.package('java.lang')
Java.java.lang.StringBuilder
Java.android.os.Build.VERSION
```

## 3. Construction and Call Syntactic Sugar

For a class proxy `Cls`, support is guaranteed for:

```js
new Cls(...args)
Cls(...args)
Cls.newInstance(...args)
```

For an instance proxy `obj`, support is guaranteed for:

```js
obj.method(...args)
obj.field
obj.field = value
```

And:

```js
obj.method(...args) === obj.call('method', ...args)
obj.field === obj.get('field')
```

For a class proxy `Cls`, support is guaranteed for:

```js
Cls.STATIC_FIELD
Cls.STATIC_FIELD = value
Cls.staticMethod(...args)
Cls.InnerClass
```

And:

```js
Cls.staticMethod(...args) === Cls.callStatic('staticMethod', ...args)
```

## 4. Top-Level Bridge API

Support is guaranteed for:

```js
Java.classExists(className)
Java.newInstance(className, ...args)
Java.callStatic(className, methodName, ...args)
Java.callSuspend(className, methodName, ...args)
Java.getApplicationContext()
Java.getCurrentActivity()
Java.loadDex(path, options?)
Java.loadJar(path, options?)
Java.listLoadedCodePaths()
```

## 5. Interface Implementation

Support is guaranteed for:

```js
Java.implement(interfaceNameOrClassProxy, impl)
Java.proxy(interfaceNameOrClassProxy, impl)
```

In single-interface / SAM scenarios, support is guaranteed for:

```js
Java.implement(() => { ... })
Java.proxy(() => { ... })
```

When the callback parameter position's target type is itself an interface, support is guaranteed for passing a JS object / JS function directly:

```js
button.setOnClickListener({
  onClick(view) {
    console.log('clicked');
  }
});

someApi.acceptRunnable(() => {
  console.log('run');
});
```

Interface mapping rules:

- Object methods with the same name map to interface methods
- `getX()` / `isX()` / `setX(v)` can map to the object property `x`
- Non-`void` / non-`Unit` callbacks can `return` directly

## 6. Suspended Calls

`callSuspend(...)` always returns a `Promise`.

Support is guaranteed for:

```js
await Java.callSuspend('com.example.Demo', 'load', 'arg')
await SomeClass.callSuspend('load', 'arg')
await someInstance.callSuspend('load', 'arg')
```

## 7. Java -> JS Conversion

When Java / Kotlin returns to JS, conversion is guaranteed as per the following table:

| Java / Kotlin | JS |
|------|------|
| `null` / `Unit` | `null` |
| `String` / `char` | `string` |
| `CharSequence` value returned by a Java method | usable as `string` |
| `boolean` / `Boolean` | `boolean` |
| `Number` | `number` |
| `Enum` | `string` |
| `Class<?>` | `string` |
| `Map` / `JSONObject` | plain object |
| `Iterable` / `List` / `Set` | JS array |
| Java array | JS array |
| `JSONArray` | JS array |
| Other plain objects | Java instance proxy |

Additional notes:

- What is meant by "usable as string/array/object when returned to JS" refers to the normalization semantics of **Java/Kotlin method return values**.
- If what you explicitly construct is a plain Java object, for example `new Java.java.lang.StringBuilder()` or `new Java.java.util.ArrayList()`, what you get is still a Java instance proxy, not something flattened directly into a JS primitive / array / object.

## 8. JS -> Java Conversion

When JS is passed to Java / Kotlin, conversion is guaranteed according to the target parameter type:

| JS | Java / Kotlin |
|------|------|
| `null` | non-primitive parameter |
| `string` | `String` / `char` / `enum` / `Class<?>` / `JSONObject` / `JSONArray` |
| `number` | various numeric types |
| `boolean` | `boolean` / `Boolean` |
| JS array | Java array / `Collection` / `JSONArray` / varargs |
| plain object | `Map` / `JSONObject` / interface implementation proxy |
| Java instance proxy | original Java object |
| `Java.implement(...)` / `Java.proxy(...)` return value | Java interface proxy |

## 9. Return Results

Exported functions allow two completion methods:

```js
return result;
complete(result);
```

`complete(result)` and directly `return result` are both official interfaces.

Result objects are guaranteed to support:

- Plain JSON objects / arrays / strings / numbers / booleans / `null`
- Java Bridge instances
- Java Bridge callback proxies

## 10. Recommended Style

By default, developers are recommended to use the syntactic sugar directly:

```js
const File = Java.java.io.File;
const file = new File('/sdcard/demo.txt');
const name = file.getName();
const path = file.absolutePath;

const Integer = Java.java.lang.Integer;
const value = Integer.parseInt('123');
const max = Integer.MAX_VALUE;
```

`.call(...)` / `.get(...)` / `.set(...)` / `callStatic(...)` are explicit low-level styles, mainly used for:

- Debugging
- Field / method name conflicts
- Troubleshooting bridging issues
