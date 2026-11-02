# Java Bridge Interface

这份文档是 **QuickJS + Java Bridge 的接口契约**。

目标只有一个：

- 给脚本开发者一份**简洁、可直接依赖**的 API 文档
- 给测试提供**明确的验收基准**
- 给 Bridge 实现提供**需要对齐的目标行为**

如果实现与本文档不一致，应优先把问题视为 **Bridge / Runtime 待修项**，而不是先降低文档承诺。

## 1. 入口

运行时注入：

- `Java`
- `Kotlin`

它们是同一个桥的两个别名。

## 2. 类与包访问

支持以下入口：

```js
Java.type('java.lang.StringBuilder')
Java.use('java.lang.StringBuilder')
Java.importClass('java.lang.StringBuilder')
Java.package('java.lang')
Java.java.lang.StringBuilder
Java.android.os.Build.VERSION
```

## 3. 构造与调用语法糖

对于类代理 `Cls`，保证支持：

```js
new Cls(...args)
Cls(...args)
Cls.newInstance(...args)
```

对于实例代理 `obj`，保证支持：

```js
obj.method(...args)
obj.field
obj.field = value
```

并且：

```js
obj.method(...args) === obj.call('method', ...args)
obj.field === obj.get('field')
```

对于类代理 `Cls`，保证支持：

```js
Cls.STATIC_FIELD
Cls.STATIC_FIELD = value
Cls.staticMethod(...args)
Cls.InnerClass
```

并且：

```js
Cls.staticMethod(...args) === Cls.callStatic('staticMethod', ...args)
```

## 4. 顶层桥接 API

保证支持：

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

## 5. 接口实现

保证支持：

```js
Java.implement(interfaceNameOrClassProxy, impl)
Java.proxy(interfaceNameOrClassProxy, impl)
```

单接口 / SAM 场景下，保证支持：

```js
Java.implement(() => { ... })
Java.proxy(() => { ... })
```

回调参数位置如果目标类型本身就是接口，保证支持直接传 JS 对象 / JS 函数：

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

接口映射规则：

- 对象同名方法映射到接口方法
- `getX()` / `isX()` / `setX(v)` 可映射到对象属性 `x`
- 非 `void` / 非 `Unit` 回调可直接 `return`

## 6. 挂起调用

`callSuspend(...)` 永远返回 `Promise`。

保证支持：

```js
await Java.callSuspend('com.example.Demo', 'load', 'arg')
await SomeClass.callSuspend('load', 'arg')
await someInstance.callSuspend('load', 'arg')
```

## 7. Java -> JS 转换

Java / Kotlin 返回到 JS 时，保证按下表转换：

| Java / Kotlin | JS |
|------|------|
| `null` / `Unit` | `null` |
| `String` / `char` | `string` |
| Java 方法返回的 `CharSequence` 值 | 可按 `string` 使用 |
| `boolean` / `Boolean` | `boolean` |
| `Number` | `number` |
| `Enum` | `string` |
| `Class<?>` | `string` |
| `Map` / `JSONObject` | plain object |
| `Iterable` / `List` / `Set` | JS array |
| Java 数组 | JS array |
| `JSONArray` | JS array |
| 其他普通对象 | Java 实例代理 |

补充说明：

- 这里说的“返回到 JS 时按字符串/数组/对象使用”，指的是**Java/Kotlin 方法返回值**的归一化语义。
- 如果你显式构造的是普通 Java 对象，例如 `new Java.java.lang.StringBuilder()`、`new Java.java.util.ArrayList()`，得到的仍然是 Java 实例代理，而不是直接拍平成 JS primitive / array / object。

## 8. JS -> Java 转换

JS 传给 Java / Kotlin 时，保证按目标参数类型进行转换：

| JS | Java / Kotlin |
|------|------|
| `null` | 非 primitive 参数 |
| `string` | `String` / `char` / `enum` / `Class<?>` / `JSONObject` / `JSONArray` |
| `number` | 各种数字类型 |
| `boolean` | `boolean` / `Boolean` |
| JS array | Java 数组 / `Collection` / `JSONArray` / varargs |
| plain object | `Map` / `JSONObject` / 接口实现代理 |
| Java 实例代理 | 原始 Java 对象 |
| `Java.implement(...)` / `Java.proxy(...)` 返回值 | Java 接口代理 |

## 9. 返回结果

导出函数允许两种完成方式：

```js
return result;
complete(result);
```

`complete(result)` 与直接 `return result` 都是正式接口。

结果对象保证支持：

- 普通 JSON 对象 / 数组 / 字符串 / 数字 / 布尔 / `null`
- Java Bridge 实例
- Java Bridge 回调代理

## 10. 推荐写法

默认推荐开发者直接使用语法糖：

```js
const File = Java.java.io.File;
const file = new File('/sdcard/demo.txt');
const name = file.getName();
const path = file.absolutePath;

const Integer = Java.java.lang.Integer;
const value = Integer.parseInt('123');
const max = Integer.MAX_VALUE;
```

`.call(...)` / `.get(...)` / `.set(...)` / `callStatic(...)` 属于显式底层写法，主要用于：

- 调试
- 字段 / 方法同名冲突
- 排查桥接问题
