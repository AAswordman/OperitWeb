# 异步、错误处理与宿主运行时

这一章是整个 JavaScript 入门阶段最重要的一页之一。  
你要开始真正理解：在 `Operit / Assistance` 里写脚本，不是在写网页，也不是在写普通 Node.js 程序，而是在写宿主脚本。

## 学完这一章，你应该能做到

- 理解为什么插件里 `async / await` 会这么高频。
- 理解为什么 `try / catch` 几乎是每个工具函数的标配。
- 分清 `Tools`、`complete(...)`、`exports` 和浏览器里的 `window`、`document` 不是一套东西。

## 建议先具备

- 已经看过《函数、模板字符串与流程控制》。
- 不排斥“异步函数”和“等待结果”的概念。

## 本章对应的真实文件

- `examples/quick_start.ts`
- `examples/types/index.d.ts`
- `examples/types/core.d.ts`
- `examples/types/files.d.ts`
- `examples/types/system.d.ts`

## 先看一个最小例子

```js
async function read_preview(params) {
  try {
    const path = params.path;
    const file = await Tools.Files.read(path);

    complete({
      success: true,
      path: file.path,
      preview: file.content.slice(0, 80),
    });
  } catch (error) {
    complete({
      success: false,
      message: `读取失败：${String(error.message || error)}`,
    });
  }
}
```

## 把例子拆开理解

### 为什么这里要 `async`

因为 `Tools.Files.read(...)` 返回的是一个 `Promise`。  
你可以在 `examples/types/files.d.ts` 里直接看到这件事：

```ts
function read(path: string): Promise<FileContentData>;
```

只要一个函数内部要写 `await`，外层基本就要是 `async function`。

### 为什么这里要 `await`

`await` 的意思不是“把程序卡死”，而是：

- 发起一个异步动作
- 等这个动作完成
- 拿到结果后再继续往下执行

插件里很多宿主能力都长这样，比如：

- `Tools.Files.read(...)`
- `Tools.Files.find(...)`
- `Tools.System.sleep(...)`
- 各类网络请求、UI 操作

`examples/types/system.d.ts` 里同样能看到：

```ts
function sleep(milliseconds: string | number): Promise<SleepResultData>;
```

### 为什么这里要 `try / catch`

一旦文件不存在、参数错误、宿主调用失败，异步函数就可能抛错。  
如果你不接住这个错误，调用方只会看到“失败了”，但不一定知道为什么。

```js
try {
  const file = await Tools.Files.read(path);
  ...
} catch (error) {
  complete({
    success: false,
    message: `读取失败：${String(error.message || error)}`,
  });
}
```

### `complete(...)` 是结果出口

在 `examples/types/core.d.ts` 里，你能看到：

```ts
export declare function complete<T>(result: T): void;
```

也就是说，`complete(...)` 就是宿主脚本回传结果的正式出口。  
无论成功还是失败，你都应该给出一个清晰、结构化的结果对象。

## 这个运行时为什么不是网页脚本环境

`examples/types/index.d.ts` 的 `declare global` 已经告诉你，这个环境最重要的全局对象是：

- `Tools`
- `complete`
- `sendIntermediateResult`
- `getEnv`
- `getLang`
- `exports`

而不是：

- `window`
- `document`
- DOM 事件系统

所以你要建立一个非常稳定的判断标准：

- 这是宿主脚本环境
- 不是浏览器页面脚本环境
- 也不是以 DOM 为核心的前端编程环境

## 回到源码仓库，它为什么这样写

在 `examples/quick_start.ts` 里，教程示例一上来就会强调：

- 统一的 wrapper
- 异步函数
- `complete(...)`
- `exports`

这不是作者个人习惯，而是因为宿主的调用方式决定了最稳的结构就是这样。

同样，`index.d.ts` 里把 `Tools.Files`、`Tools.System`、`complete`、`exports` 都声明成全局可用，也是在告诉你：  
这套运行时已经帮你把宿主 API 接到脚本层了，你要做的是正确地调用和组织返回结果。

## 本章最容易踩的坑

### 坑 1：用了 `await`，但忘了把外层函数写成 `async`

这是最经典的语法错误之一。

### 坑 2：以为脚本里能直接操作 `window` / `document`

这通常说明你把宿主脚本当成网页脚本了。

### 坑 3：出了错只 `console.log`，但没有通过 `complete(...)` 回传失败结果

这样调用侧很难稳定判断这次执行到底是成功、失败，还是根本没结束。

## 本章自查

- 我是否已经知道 `Tools.Files.read(...)` 和 `Tools.System.sleep(...)` 都是异步的？
- 我是否知道 `complete(...)` 在类型上定义在 `core.d.ts`？
- 我是否已经明确这个环境不是浏览器脚本环境？

## 下一章

建议继续看《[第一个 JavaScript 脚本包](/#/guide/plugin/javascript-package)》。
