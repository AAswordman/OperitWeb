# METADATA、exports 与 complete

如果说上一章是在“把包拼起来”，这一章就是在讲这个包和宿主之间的通信协议。  
你真正要搞清楚的不是某一行语法，而是这三样东西如何互相配合：

- `METADATA`
- `exports`
- `complete(...)`

## 学完这一章，你应该能做到

- 知道宿主是如何根据 `METADATA` 认识你的工具的。
- 知道为什么函数名、工具名、导出名必须对齐。
- 知道 `complete(...)` 的成功 / 失败结果应该怎么组织。

## 建议先具备

- 已经看过《第一个 JavaScript 脚本包》。
- 已经知道工具函数不是自动暴露给宿主的。

## 本章对应的真实文件

- `examples/quick_start.ts`
- `docs/SCRIPT_DEV_GUIDE.md`
- `examples/types/core.d.ts`
- `examples/types/index.d.ts`

## 先看一个最小例子

```js
/*
METADATA
{
  "name": "demo_reader",
  "category": "Utility",
  "tools": [
    {
      "name": "read_preview",
      "description": {
        "zh": "读取文件预览",
        "en": "Read file preview"
      },
      "parameters": [
        {
          "name": "path",
          "description": {
            "zh": "文件路径",
            "en": "File path"
          },
          "type": "string",
          "required": true
        }
      ]
    }
  ]
}
*/

async function read_preview(params) {
  try {
    complete({
      success: true,
      path: params.path,
    });
  } catch (error) {
    complete({
      success: false,
      message: String(error.message || error),
    });
  }
}

exports.read_preview = read_preview;
```

## 把例子拆开理解

### `METADATA` 在描述什么

`METADATA` 主要回答这几个问题：

- 这个包叫什么
- 它属于什么分类
- 它暴露了哪些工具
- 每个工具有哪些参数

其中最关键的一层是 `tools` 数组，因为宿主真正要调用的就是这里声明出来的工具。

### 为什么名字必须对齐

你至少要保证这三处一致：

1. `METADATA.tools[].name`
2. 真实函数名
3. `exports.xxx = xxx`

也就是说：

```js
// 1. METADATA 里写 read_preview
// 2. 函数名叫 read_preview
async function read_preview(params) { ... }

// 3. 导出名也叫 read_preview
exports.read_preview = read_preview;
```

只要有一处不一致，就很容易出现这种情况：

- 包看起来加载成功
- 工具列表里也像是有这个名字
- 但真正调用时找不到实现

### `complete(...)` 在契约里扮演什么角色

`examples/types/core.d.ts` 里直接定义了：

```ts
export declare function complete<T>(result: T): void;
```

这表示宿主脚本最终结果不是靠 `return` 直接交给宿主，而是通过 `complete(...)` 正式回传。

最稳的返回结构通常至少包含：

- `success`
- 成功时的 `data`、`message`、或关键结果字段
- 失败时的 `message`

例如：

```js
complete({
  success: true,
  data: { preview: "..." },
});
```

或：

```js
complete({
  success: false,
  message: "文件不存在",
});
```

## `exports` 和 `complete` 为什么能直接用

因为 `examples/types/index.d.ts` 通过 `declare global` 把宿主环境里可直接使用的对象都暴露出来了。  
这也是为什么在 TypeScript 脚本里，常见的第一行是：

```ts
/// <reference path="./types/index.d.ts" />
```

这条引用一接进来，编辑器才知道：

- `complete(...)` 存在
- `exports` 存在
- `Tools` 存在

## 回到源码仓库，它为什么这样写

你去看 `SCRIPT_DEV_GUIDE.md` 和 `quick_start.ts`，会发现它们一直在强调“标准结构”。  
这不是为了形式统一，而是因为宿主需要靠统一结构来做三件事：

1. 读取工具声明
2. 找到可执行入口
3. 接收执行结果

所以这三者不是可以随意替换的细节，而是整套脚本协议的核心。

## 本章最容易踩的坑

### 坑 1：把 `complete(...)` 当成可选

很多时候看起来函数已经 `return` 了，但宿主并不会因此自动拿到结果。

### 坑 2：`METADATA` 描述和真实实现不同步

文档层面看起来没问题，运行层面却会出现各种“对不上”的故障。

### 坑 3：工具函数名和导出名用了不同的别名

可以做，但在入门阶段非常不建议，这会徒增排错成本。

## 本章自查

- 我是否知道 `METADATA`、函数名、导出名必须对齐？
- 我是否知道 `complete(...)` 的声明来自 `core.d.ts`？
- 我是否知道为什么三斜线引用通常先接 `index.d.ts`？

## 下一章

建议继续看《[TypeScript 类型入门](/#/plugin-tutorial/typescript-basics)》。
