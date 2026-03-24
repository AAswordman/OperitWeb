# tool-types 与 results

这一章专门解释一件很容易被忽略、但实际上非常关键的事：  
为什么你写 `toolCall("list_files", ...)` 时，编辑器能知道返回结果里有 `entries`、`path`、`env` 这些字段？

## 学完这一章，你应该能做到

- 理解 `toolCall(...)` 的返回类型为什么可以根据工具名推断。
- 知道 `core.d.ts`、`tool-types.d.ts`、`results.d.ts` 是如何串起来工作的。
- 分清“工具名映射”和“结果结构定义”是两层不同职责。

## 建议先具备

- 已经看过《index.d.ts 与 core.d.ts》。
- 知道 TypeScript 里泛型和类型别名的基本意义。

## 本章对应的真实文件

- `examples/types/core.d.ts`
- `examples/types/tool-types.d.ts`
- `examples/types/results.d.ts`

## 先看一个最小例子

```ts
/// <reference path="./types/index.d.ts" />

async function inspectDir() {
  const result = await toolCall("list_files", {
    path: "/sdcard/Download",
  });

  return {
    env: result.env,
    count: result.entries.length,
    firstName: result.entries[0]?.name,
  };
}
```

## 把例子拆开理解

### 第一步：`toolCall(...)` 定义在 `core.d.ts`

你在 `examples/types/core.d.ts` 里能看到：

```ts
export declare function toolCall<T extends string>(
  toolName: T,
  toolParams?: ToolParams
): Promise<ToolReturnType<T>>;
```

也就是说，`toolCall(...)` 的返回值不是直接写死成 `any`，而是交给了 `ToolReturnType<T>` 去推断。

### 第二步：`ToolReturnType<T>` 去查工具名映射表

同一个文件里还能看到：

```ts
export type ToolReturnType<T extends string> =
  T extends keyof import('./tool-types').ToolResultMap
    ? import('./tool-types').ToolResultMap[T]
    : any;
```

这句话的核心含义是：

- 如果工具名能在 `ToolResultMap` 里找到
- 就返回这个工具名对应的精确结果类型
- 找不到时才退回到 `any`

### 第三步：`tool-types.d.ts` 负责“工具名 -> 结果类型”

`examples/types/tool-types.d.ts` 里保存着映射表，例如：

- `'list_files': DirectoryListingData`
- `'read_file': FileContentData`
- `'http_request': HttpResponseData`
- `'get_page_info': UIPageResultData`
- `'create_workflow': WorkflowDetailResultData`

也就是说，这一层只回答一个问题：

> 某个工具名应该对应哪一种结果类型？

它不负责定义这些结果内部长什么样。

### 第四步：`results.d.ts` 负责“结果类型内部长什么样”

真正的结构细节在 `examples/types/results.d.ts`，比如：

- `DirectoryListingData`
- `FileContentData`
- `HttpResponseData`
- `UIActionResultData`
- `WorkflowDetailResultData`

拿 `DirectoryListingData` 举例，它会告诉你：

- 有 `env`
- 有 `path`
- 有 `entries`
- `entries` 里的每一项又是什么结构

所以完整链路其实是：

`toolCall(...)`  
-> `ToolReturnType<T>`  
-> `ToolResultMap[T]`  
-> `results.d.ts` 里的具体结构

## `toolCall(...)` 和 `Tools.Files.list(...)` 是什么关系

这两条路线不要混了：

- `toolCall("list_files", ...)`
  走的是“工具名映射”这条泛型链路。
- `Tools.Files.list(...)`
  走的是对应宿主模块 `.d.ts` 的直接方法声明。

但它们最后经常会收敛到同一批结果结构，比如文件列表、文件内容、HTTP 响应、UI 页面信息等。  
也就是说：

- `tool-types.d.ts` 负责“按工具名推断”
- 各个模块 `.d.ts` 负责“按命名空间方法推断”
- `results.d.ts` 负责统一描述结果数据本身

## 回到源码仓库，它为什么这样写

这种拆法的好处非常实际：

- 新增一个工具名时，只要补映射表，就能把 `toolCall(...)` 的类型串起来
- 结果结构集中在 `results.d.ts`，不会散落在每个调用点里
- 无论你从 `toolCall(...)` 进来，还是从 `Tools.xxx` 进来，最终都能落回一致的结果结构认知

这也是为什么你以后看到一个陌生工具时，可以按这个顺序查：

1. 先去 `tool-types.d.ts` 看工具名映射
2. 再去 `results.d.ts` 看具体返回结构

## 本章最容易踩的坑

### 坑 1：以为 `tool-types.d.ts` 定义了所有字段细节

实际上它只是映射表，不是字段说明书。

### 坑 2：以为返回值结构只能从运行结果里猜

在这套宿主类型里，很多时候你完全可以先读 `results.d.ts` 再写代码。

### 坑 3：工具名没命中映射时，误以为宿主没有类型支持

有时只是那个调用路径没有走到映射表，或者你查错了文件层级。

## 本章自查

- 我是否知道 `toolCall(...)` 的类型推断链路从哪里开始？
- 我是否知道 `tool-types.d.ts` 和 `results.d.ts` 的职责不同？
- 我是否已经知道如何根据工具名去查返回结构？

## 下一章

建议继续看《[宿主模块类型](/#/guide/plugin/runtime-module-types)》。
