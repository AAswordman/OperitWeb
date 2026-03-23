# index.d.ts 与 core.d.ts

这一章开始进入整套教程最关键的一条主线：宿主类型系统。  
如果你已经会写一点 TypeScript，但还不清楚 `Tools`、`complete(...)`、`exports`、`sendIntermediateResult(...)` 为什么能在脚本里直接出现，这一章就是答案。

## 学完这一章，你应该能做到

- 理解为什么三斜线引用通常先指向 `examples/types/index.d.ts`。
- 知道 `index.d.ts` 和 `core.d.ts` 在整套宿主类型系统中的分工。
- 理解 `declare global` 在这里的实际作用，而不是把它当成抽象语法名词。

## 建议先具备

- 已经看过《TypeScript 类型入门》。
- 知道 `.d.ts` 是“声明”而不是“实现”。

## 本章对应的真实文件

- `examples/types/index.d.ts`
- `examples/types/core.d.ts`
- `examples/types/toolpkg.d.ts`
- `examples/types/compose-dsl.d.ts`

## 先看一个最小例子

```ts
/// <reference path="./types/index.d.ts" />

async function main() {
  await Tools.System.sleep(200);

  sendIntermediateResult({
    stage: "sleep-finished",
  });

  complete({
    success: true,
    lang: getLang(),
  });
}

exports.main = main;
```

## 把例子拆开理解

### 为什么先引用 `index.d.ts`

因为 `examples/types/index.d.ts` 不是普通单文件声明，而是整个宿主类型入口。  
它做了三类事情：

1. 重新导出核心模块  
   比如 `core`、`results`、`tool-types`、`toolpkg`、`compose-dsl`。
2. 把多个运行时命名空间接到全局对象上  
   比如 `Tools.Files`、`Tools.System`、`Tools.UI`、`Tools.Workflow`。
3. 通过 `declare global` 暴露宿主全局能力  
   比如 `complete(...)`、`sendIntermediateResult(...)`、`getEnv(...)`、`exports`、`Android`、`ToolPkg` 相关类型等。

这也是为什么在绝大多数脚本里，你不会一上来写很多 `import`，而是先接一条三斜线引用。

### `declare global` 在这里到底意味着什么

在这套宿主类型里，`declare global` 的实际含义不是抽象的“声明一个全局扩展”，而是：

- 告诉 TypeScript：这些名字在脚本运行时本来就存在
- 你不需要自己 `import`
- 编辑器应该为这些全局对象提供补全和检查

所以你才能直接写：

- `Tools.System.sleep(...)`
- `complete(...)`
- `sendIntermediateResult(...)`
- `getEnv(...)`
- `getLang()`
- `exports.main = main`

而不是先从某个 npm 包里导入它们。

### `core.d.ts` 负责哪一层

`examples/types/core.d.ts` 是底层核心声明文件。  
它主要定义了这些内容：

- `ToolParams`
- `ToolConfig`
- `BaseResult`
- `ToolReturnType<T>`
- `toolCall(...)`
- `complete(...)`
- `NativeInterface`
- `exports`
- `_`
- `dataUtils`

也就是说，如果把整个宿主类型系统比作建筑：

- `index.d.ts` 更像总入口和总装配层
- `core.d.ts` 更像最底层的公共基础接口

### 除了 `Tools` 和 `complete`，这里还暴露了什么

很多人第一次只注意到 `Tools`，其实 `index.d.ts` 暴露出来的全局对象比这多得多，比如：

- `sendIntermediateResult(...)`
- `getState()`
- `getLang()`
- `getCallerName()`
- `getChatId()`
- `OPERIT_DOWNLOAD_DIR`
- `Android`
- `Intent`
- `UINode`

这意味着你后面做更复杂的脚本时，判断“这个能力到底是不是宿主内置提供的”，最稳的方式不是猜，而是回到 `index.d.ts` 和 `core.d.ts`。

## 为什么这里还要提到 ToolPkg 和 Compose DSL

因为 `index.d.ts` 不只是给普通脚本包准备的。  
它同时还把这些类型入口统一接进来了：

- `toolpkg.d.ts`
- `compose-dsl.d.ts`
- `compose-dsl.material3.generated.d.ts`

所以当你后面写 ToolPkg、写 hook、写 Compose DSL UI 时，还是沿着同一条入口线进入类型系统，而不是另起一套规则。

## 回到源码仓库，它为什么这样写

这样的组织方式有很明显的工程好处：

- 写脚本的人不需要先知道所有内部实现文件
- 只要先引用 `index.d.ts`，就能拿到完整宿主上下文
- 真要深挖时，再一路下钻到 `core.d.ts`、`tool-types.d.ts`、`results.d.ts`、`files.d.ts` 这些更具体的模块

这其实和大型前端或 SDK 项目常见的“公共入口 + 模块细分”思路是一样的，只不过这里的对象不是浏览器 API，而是 `Operit / Assistance` 的宿主脚本 API。

## 本章最容易踩的坑

### 坑 1：三斜线引用只当成“某种固定开场白”

如果不理解它接进来的到底是什么，后面看到补全、泛型、返回结构时就会一直发虚。

### 坑 2：只会用 `Tools`，但不知道 `complete(...)`、`exports` 的类型来源

结果通常是能抄代码，但解释不清为什么这样写。

### 坑 3：以为 `declare global` 是“把所有东西都变成魔法”

它不是魔法，只是把宿主运行时里本来存在的名字，用 TypeScript 能理解的方式声明出来。

## 本章自查

- 我是否知道为什么宿主脚本通常先引用 `index.d.ts`？
- 我是否知道 `core.d.ts` 负责的是底层公共声明，而不是某个具体业务模块？
- 我是否知道 `complete(...)`、`sendIntermediateResult(...)`、`exports` 都可以回到类型入口里核对？

## 下一章

建议继续看《[tool-types 与 results](/#/guide/plugin/tool-result-types)》。
