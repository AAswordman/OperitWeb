# TypeScript 类型入门

这一章的目标不是把 TypeScript 讲成一门完整语言，而是让你先会看、会写插件里最常见的类型。  
你要建立的核心认知是：TypeScript 的价值，不是“让代码更复杂”，而是把原本靠记忆维持的约定写成显式规则。

## 学完这一章，你应该能做到

- 看懂插件里最常见的类型写法。
- 会给参数对象和返回值对象补上基础类型。
- 理解可选字段、`Promise<T>`、函数返回类型在插件开发里为什么重要。

## 建议先具备

- 已经看过 JavaScript 脚本包相关章节。
- 知道参数对象和结果对象在插件里很常见。

## 本章对应的真实文件

- `examples/quick_start.ts`
- `examples/github/src/index.ts`
- `examples/types/index.d.ts`

## 先看一个最小例子

```ts
type ReadPreviewParams = {
  path: string;
  maxLength?: number;
};

type ReadPreviewResult = {
  path: string;
  preview: string;
  length: number;
};

async function readPreview(params: ReadPreviewParams): Promise<ReadPreviewResult> {
  const maxLength = params.maxLength ?? 80;

  return {
    path: params.path,
    preview: "demo content".slice(0, maxLength),
    length: maxLength,
  };
}
```

## 把例子拆开理解

### 参数对象类型

```ts
type ReadPreviewParams = {
  path: string;
  maxLength?: number;
};
```

这里最重要的两点是：

- `path: string`
  表示 `path` 必须是字符串。
- `maxLength?: number`
  表示这个字段可传可不传，但如果传了，必须是数字。

这类对象类型在插件里特别常见，因为工具参数天生就适合写成一个对象。

### 返回值类型

```ts
type ReadPreviewResult = {
  path: string;
  preview: string;
  length: number;
};
```

给返回值起一个单独的类型名，有两个直接好处：

- 业务逻辑变大以后更容易维护
- 函数签名会非常清晰

### `Promise<T>` 是异步函数的返回值

```ts
async function readPreview(...): Promise<ReadPreviewResult> { ... }
```

只要函数是 `async`，返回值本质上就是一个 `Promise`。  
这里的 `Promise<ReadPreviewResult>` 表示：

- 这不是立刻返回最终结果
- 而是将来会异步得到一个 `ReadPreviewResult`

### `??` 和可选字段很常一起出现

```ts
const maxLength = params.maxLength ?? 80;
```

这表示：

- 如果传了 `maxLength`，就用它
- 如果没传，就用默认值 `80`

插件里这种写法会非常常见，因为很多参数都不是强制项。

## TypeScript 在插件开发里到底帮你解决什么

最直接的价值通常出现在这三类场景：

- 参数越来越多  
  光靠记忆已经不稳了。
- 返回结构越来越复杂  
  你很难记住每个字段到底叫什么。
- 多人维护  
  代码改着改着，很容易把某个字段名或类型改错。

把这些约定写成类型后，编辑器会比“纯靠脑子记”可靠得多。

## 回到源码仓库，它为什么这样写

你去看 `examples/quick_start.ts` 和 `examples/github/src/index.ts`，会发现它们都不是简单地“把 JS 改成 TS 后缀”：

- 参数会有清楚的对象形状
- 返回值会有稳定结构
- 异步函数的返回值也会被明确标出来

而且你很快就会意识到，自己手写的业务类型只是第一层。  
真正和宿主打交道时，很多关键类型其实来自：

- `examples/types/index.d.ts`
- `examples/types/results.d.ts`
- 以及各个宿主模块的 `.d.ts` 文件

下一组章节就会专门讲这件事。

## 本章最容易踩的坑

### 坑 1：把 TypeScript 理解成“每个变量都必须写类型”

其实很多时候只要把参数、返回值、关键对象形状写清楚，收益就已经很大了。

### 坑 2：用了类型，但没有先想清楚字段结构

这样类型只是把混乱的结构又写了一遍，维护体验不会变好。

### 坑 3：以为所有类型都要自己手写

真正和宿主 API 对接时，很多关键类型本来就已经在 `examples/types` 里定义好了。

## 本章自查

- 我是否能读懂 `path: string`、`maxLength?: number` 这类写法？
- 我是否知道 `Promise<ReadPreviewResult>` 在表达什么？
- 我是否已经意识到宿主相关类型应该回到 `examples/types` 去看？

## 下一章

建议继续看《[index.d.ts 与 core.d.ts](/#/plugin-tutorial/host-types-overview)》。
