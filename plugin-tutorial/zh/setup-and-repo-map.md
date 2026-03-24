# 开发环境与仓库地图

这一章解决的问题很简单：你现在面对的不只是一个示例文件，而是一整个插件开发仓库。  
如果不先把仓库结构和材料职责看清楚，后面读代码时很容易一直在“会抄不会判断”的状态里打转。

## 学完这一章，你应该能做到

- 知道当前源码仓库里哪些目录是教程主线的一部分。
- 分清 `docs`、`examples`、`tools`、`examples/types` 分别负责什么。
- 知道为什么 `examples/types` 不是附属资料，而是宿主 API 契约目录。

## 建议先具备

- 会看基本的目录树和 TypeScript 文件。
- 知道 `JavaScript` / `TypeScript` 文件和 `.d.ts` 声明文件不是一回事。

## 本章对应的真实文件

- `docs/SCRIPT_DEV_GUIDE.md`
- `docs/TOOLPKG_FORMAT_GUIDE.md`
- `examples/quick_start.ts`
- `examples/github/src/index.ts`
- `examples/windows_control/manifest.json`
- `examples/types/index.d.ts`
- `tools/execute_js.bat`
- `tools/debug_toolpkg.bat`

## 先看一个最小目录图

```text
<repo-root>
├── docs/
│   ├── SCRIPT_DEV_GUIDE.md
│   └── TOOLPKG_FORMAT_GUIDE.md
├── examples/
│   ├── quick_start.ts
│   ├── tsconfig.json
│   ├── github/
│   ├── windows_control/
│   └── types/
│       ├── index.d.ts
│       ├── core.d.ts
│       ├── tool-types.d.ts
│       ├── results.d.ts
│       ├── files.d.ts
│       ├── system.d.ts
│       └── ...
└── tools/
    ├── execute_js.bat
    └── debug_toolpkg.bat
```

## 把这个目录图拆开理解

### `docs/` 是规则说明

这里不是“可有可无的文字版附件”，而是你判断开发边界时最稳的依据。

- `SCRIPT_DEV_GUIDE.md`
  负责解释脚本包的开发方式、编译方式、运行方式、基本结构。
- `TOOLPKG_FORMAT_GUIDE.md`
  负责解释 ToolPkg 的包结构、`manifest`、主入口、注册流程。

如果你只看示例代码，很多约定只能靠猜；而文档会告诉你这些约定原本的设计意图。

### `examples/` 是用法示例

这是你最容易“看得懂”的部分，因为它直接展示了文件应该怎么写。

- `quick_start.ts`
  适合第一眼入门，能看到一个教学型的完整脚本包长什么样。
- `github/src/index.ts`
  适合往工程化方向走时看，能看到多文件入口聚合和更真实的包规模。
- `windows_control`
  适合进入 ToolPkg 时看，能看到 `manifest.json`、`src/main.ts`、`dist/`、`resources/` 之间的关系。

### `tools/` 是运行与调试入口

写完代码以后，最终还是要跑起来。

- `tools/execute_js.bat`
  面向普通脚本包，用来直接执行某个 `.js` 文件里的某个导出函数。
- `tools/debug_toolpkg.bat`
  面向 ToolPkg，用来走“安装 / 重装 / 调试包”的路径。

### `examples/types/` 是宿主 API 契约目录

这一块最容易被低估，但其实是整个教程的主轴之一。

你在脚本里能直接写这些东西：

```ts
/// <reference path="./types/index.d.ts" />

await Tools.System.sleep(300);
complete({ success: true });
exports.main = main;
```

为什么 `Tools`、`complete`、`exports` 能被编辑器识别？  
为什么你能在 `ToolPkg.registerAppLifecycleHook(...)` 里看到事件名补全？  
为什么 `toolCall("list_files")` 可以推断返回结构？

答案都不在 `quick_start.ts` 本身，而在 `examples/types/` 里。

## 回到源码仓库，它为什么这样写

这个仓库故意把“写法”和“契约”分开了：

- `examples/*.ts`
  负责告诉你“怎么写一个东西”
- `examples/types/*.d.ts`
  负责告诉编辑器和你本人“宿主到底允许你怎么写”

这有两个实际好处：

1. 你可以在自己的独立项目里直接复制 `types/` 目录，保留宿主能力的类型提示。
2. 你不需要从实现代码里反推 API 形状，读 `.d.ts` 就能先知道参数和返回值。

在 `SCRIPT_DEV_GUIDE.md` 里也明确强调了这一点：独立项目常常要把 `examples/types/` 复制成自己项目里的 `types/` 目录，并通过 `tsconfig.json` 的 `typeRoots` 接入。

## 本章最容易踩的坑

### 坑 1：把 `examples/types` 当成可选材料

结果通常是：

- 代码能写，但没有类型提示
- 看到 `Tools` 只能靠猜
- 遇到返回值结构时不知道该去哪里核对

### 坑 2：只看 `docs`，不看 `examples`

这样会知道概念，却不知道真实项目里通常怎么落地。

### 坑 3：只看 `examples`，不看 `docs`

这样会知道“某个例子怎么写”，但不知道哪些部分是通用规则，哪些只是示例作者的写法选择。

## 本章自查

- 我是否知道 `docs` 和 `examples` 的职责不同？
- 我是否知道 `tools/execute_js.bat` 和 `tools/debug_toolpkg.bat` 面向不同对象？
- 我是否已经意识到 `examples/types` 是宿主契约目录，而不是附带示例？

## 下一章

建议继续看《[变量、对象与数组](/#/guide/plugin/javascript-basics)》。
