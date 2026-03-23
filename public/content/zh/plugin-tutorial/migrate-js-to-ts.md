# 从 JavaScript 迁移到 TypeScript

这一章不讲抽象原则，而是讲最常见的真实需求：  
你已经有一个能跑的 JavaScript 脚本包了，现在想把它稳稳地迁移到 TypeScript，应该按什么顺序做。

## 学完这一章，你应该能做到

- 知道把一个现有 JS 脚本迁移到 TS 时，第一步、第二步、第三步分别是什么。
- 知道为什么迁移时要先接 `index.d.ts`，再补参数 / 返回值类型。
- 知道怎样把宿主 API 调用逐步改造成有类型的写法。

## 建议先具备

- 已经看过《ToolPkg 与 Compose DSL 类型》之前的章节。
- 已经有一个最小 JavaScript 脚本包心智模型。

## 本章对应的真实文件

- `examples/quick_start.ts`
- `examples/types/index.d.ts`
- `examples/types/results.d.ts`
- `examples/github/src/index.ts`

## 先看一个最小例子

### JavaScript 版本

```js
async function read_preview(params) {
  const file = await Tools.Files.read(params.path);

  complete({
    success: true,
    preview: file.content.slice(0, params.maxLength || 80),
  });
}

exports.read_preview = read_preview;
```

### TypeScript 版本

```ts
/// <reference path="./types/index.d.ts" />

type ReadPreviewParams = {
  path: string;
  maxLength?: number;
};

type ReadPreviewResult = {
  preview: string;
};

async function read_preview(params: ReadPreviewParams): Promise<void> {
  try {
    const file = await Tools.Files.read(params.path);
    const result: ReadPreviewResult = {
      preview: file.content.slice(0, params.maxLength ?? 80),
    };

    complete({
      success: true,
      data: result,
    });
  } catch (error) {
    complete({
      success: false,
      message: String(error?.message || error),
    });
  }
}

exports.read_preview = read_preview;
```

## 把例子拆开理解

### 第一步：先把宿主类型入口接进来

最稳的第一步通常不是先大改函数，而是先加：

```ts
/// <reference path="./types/index.d.ts" />
```

这样你立刻就能拿到：

- `Tools`
- `complete(...)`
- `exports`
- 宿主结果结构和各种命名空间类型提示

如果你省掉这一步，后面补类型很容易只补到自己定义的业务对象，而宿主 API 还是一片模糊。

### 第二步：先给参数对象和返回结果起名字

迁移时最先受益的通常不是每个局部变量，而是：

- 参数对象
- 返回结构

```ts
type ReadPreviewParams = {
  path: string;
  maxLength?: number;
};

type ReadPreviewResult = {
  preview: string;
};
```

这一步做完以后，函数边界会立刻清晰很多。

### 第三步：把宿主 API 调用改成有类型的写法

比如：

```ts
const file = await Tools.Files.read(params.path);
```

只要 `index.d.ts` 已经接入，TypeScript 就能从 `files.d.ts` 推断出：

- `file` 是 `FileContentData`
- `file.content`、`file.path`、`file.size` 这些字段可以直接补全

这比“先运行一下再猜结构”稳得多。

### 第四步：最后再处理 wrapper、拆文件、工程化

很多人一迁移就想同时做这些事：

- 改 TS
- 上 wrapper
- 拆目录
- 改 tsconfig
- 改 ToolPkg

这样很容易把问题缠在一起。  
更稳的顺序通常是：

1. 先把单文件 JS 迁成单文件 TS
2. 再补 `tsconfig`
3. 再考虑拆目录和工程化

## 回到源码仓库，它为什么这样写

你看 `examples/quick_start.ts` 时，会发现它不是“把 JS 代码原样搬过去”这么简单，而是顺便做了这些提升：

- 参数和结果结构更清楚
- 错误处理更统一
- wrapper 更稳定
- 宿主能力能获得更好的编辑器提示

而 `examples/github/src/index.ts` 进一步证明了一件事：  
一旦项目规模变大，TypeScript 的价值不是“语法更炫”，而是“边界更稳、多人更好维护”。

## 本章最容易踩的坑

### 坑 1：只改后缀，不补宿主类型入口

这样文件虽然变成 `.ts` 了，但最重要的宿主补全和校验并没有真正接入。

### 坑 2：一上来就追求“全部变量都强类型”

入门阶段更划算的做法，是先把函数边界和关键结果结构稳住。

### 坑 3：迁移时同时做太多结构改造

这样一旦出错，很难知道是 TS 本身、宿主类型、目录结构，还是编译配置导致的问题。

## 本章自查

- 我是否知道迁移到 TS 的第一步通常是接入 `index.d.ts`？
- 我是否知道先给参数和返回值补类型比先给局部变量补类型更划算？
- 我是否知道 `Tools.Files.read(...)` 的结果类型应该回到 `files.d.ts` / `results.d.ts` 去确认？

## 下一章

建议继续看《[tsconfig 基础模板](/#/guide/plugin/tsconfig)》。
