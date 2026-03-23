# 插件教程

> 这是一个独立于《用户手册》的开发者专区，专门讲 `Operit / Assistance` 的脚本包与 ToolPkg 插件包开发。  
> 本专区的核心学习对象不是某一个示例文件，而是当前源码仓库里的三层材料：  
> `docs` 负责规则说明，`examples` 负责展示写法，`examples/types` 负责定义宿主 API 契约。

## 这套教程适合谁

- 你已经有一点编程基础，但第一次接触 `Operit / Assistance` 插件开发。
- 你想先写一个能跑的脚本工具，再逐步升级到 `TypeScript` 和 `ToolPkg`。
- 你已经看过 `examples/quick_start.ts`，但还没完全理解 `Tools`、`complete(...)`、`exports`、`types` 目录之间的关系。

## 为什么这里要把 `examples/types` 放到中心位置

如果你只看示例代码，很容易形成“能抄能跑，但不知道宿主到底提供了什么”的状态。  
真正决定以下事情的关键，不是示例本身，而是 `examples/types`：

- `Tools` 里到底有哪些命名空间
- `Tools.Files.read(...)`、`Tools.System.sleep(...)` 这类 API 接受什么参数
- `toolCall("list_files")` 为什么能知道返回值结构
- `ToolPkg.registerAppLifecycleHook(...)` 这类注册函数到底该传什么
- `Compose DSL` 里的 `screen`、`ComposeNode`、`ComposeColor` 这些类型从哪来

如果你想理解“内置能力从哪来、`Tools` 为什么会有提示、ToolPkg 的 hook 为什么能补全”，第一个总入口就是：

- `examples/types/index.d.ts`

## 先分清 3 类插件形态

| 形态 | 最适合的场景 | 典型文件 | 是否要编译 | 优先看的参考 |
|---|---|---|---|---|
| JavaScript 脚本包 | 先写一个最小可运行工具 | `my_tool.js` | 不一定 | `examples/quick_start.ts`、`docs/SCRIPT_DEV_GUIDE.md` |
| TypeScript 脚本包 | 需要类型提示、多人维护、文件开始变多 | `my_tool.ts` + `tsconfig.json` | 是 | `examples/tsconfig.json`、`examples/github/src/index.ts` |
| ToolPkg 插件包 | 要打包子包、资源、UI 模块、hook | `manifest.json` + `main.ts/js` + `packages/...` | 通常要 | `docs/TOOLPKG_FORMAT_GUIDE.md`、`examples/windows_control` |

## 先看哪些文件最划算

- `docs/SCRIPT_DEV_GUIDE.md`
  先帮你建立脚本包开发的大框架。
- `examples/quick_start.ts`
  最适合入门的教程型示例，能看到最小包结构、wrapper、`complete(...)` 和 `exports`。
- `examples/types/index.d.ts`
  类型总入口，决定了你在脚本里能直接看到哪些全局对象。
- `examples/types/core.d.ts`
  `toolCall`、`complete`、`exports`、`NativeInterface` 的底层声明都在这里。
- `examples/types/tool-types.d.ts`
  工具名和返回类型的映射表在这里。
- `examples/types/results.d.ts`
  文件、网络、UI、工作流、聊天等结果结构都在这里。
- `docs/TOOLPKG_FORMAT_GUIDE.md`
  真正进入 ToolPkg 之前必须回来看的一份总说明。

## 章节导览

### 起步与仓库

- 《[开发环境与仓库地图](/#/guide/plugin/setup-and-repo-map)》
  先把 `docs`、`examples`、`tools`、`examples/types` 四块材料的职责分清。

### JavaScript 脚本包

- 《[变量、对象与数组](/#/guide/plugin/javascript-basics)》
  只讲写插件时最高频的数据组织方式。
- 《[函数、模板字符串与流程控制](/#/guide/plugin/javascript-functions-flow)》
  帮你理解“一个工具函数到底是怎么把输入变成输出的”。
- 《[异步、错误处理与宿主运行时](/#/guide/plugin/javascript-async-runtime)》
  讲 `async/await`、`try/catch`，以及这个环境为什么不是网页脚本环境。
- 《[第一个 JavaScript 脚本包](/#/guide/plugin/javascript-package)》
  从零把一个最小脚本包拼出来。
- 《[METADATA、exports 与 complete](/#/guide/plugin/metadata-exports-complete)》
  深入理解宿主如何发现你的工具、调用你的工具、接收你的结果。

### TypeScript 入门

- 《[TypeScript 类型入门](/#/guide/plugin/typescript-basics)》
  把参数、返回值、可选字段、`Promise<T>` 这些最常用写法建立起来。

### TypeScript 工程化

- 《[从 JavaScript 迁移到 TypeScript](/#/guide/plugin/migrate-js-to-ts)》
  用一个现成脚本包演示最稳的迁移路径。
- 《[tsconfig 基础模板](/#/guide/plugin/tsconfig)》
  先把单文件脚本最常用的配置模板建立起来。
- 《[场景化 tsconfig 与排错](/#/guide/plugin/tsconfig-scenarios)》
  专门处理多文件项目、ToolPkg、`Tools` 没提示、编译产物路径不对这些问题。
- 《[项目结构与目录演进](/#/guide/plugin/project-structure)》
  讲脚本包为什么会从单文件一路演进到多文件工程和 ToolPkg。

### ToolPkg 插件包

- 《[ToolPkg 基础与 manifest](/#/guide/plugin/toolpkg-basics)》
  先判断你到底需不需要 ToolPkg，再讲 `manifest.json` 的角色。
- 《[main、hooks 与注册流程](/#/guide/plugin/toolpkg-main-and-hooks)》
  把 ToolPkg 主入口脚本、hook、UI 模块注册讲清楚。

### 调试与排错

- 《[编译、运行与调试](/#/guide/plugin/build-and-debug)》
  区分普通脚本和 ToolPkg 的两套调试路径。
- 《[常见坑与定位方法](/#/guide/plugin/pitfalls)》
  你最后很可能会反复回到这一页做排错。

## 推荐学习路线

- 标准路线  
  先读《开发环境与仓库地图》 -> JavaScript 五章 -> TypeScript 入门 -> 工程化 -> ToolPkg -> 调试与排错。
- 只想先跑一个工具  
  先读《开发环境与仓库地图》 -> 《变量、对象与数组》 -> 《异步、错误处理与宿主运行时》 -> 《第一个 JavaScript 脚本包》 -> 《METADATA、exports 与 complete》。
- 目标是做完整 ToolPkg  
  JavaScript 基础走完以后，不要直接跳 `manifest`，先把 `tsconfig`、项目结构和 ToolPkg 基础两章看完，再进入更完整的 ToolPkg 开发流程。

## 读完本页后，先去哪一页

建议先从《[开发环境与仓库地图](/#/guide/plugin/setup-and-repo-map)》开始。  
如果你想对照用户手册里的相关概念，可以继续看：

- 《[沙盒包（Package）](/#/guide/tools-and-features/ai-tools/sandbox-package)》
- 《[Skill](/#/guide/tools-and-features/ai-tools/skill)》
- 《[MCP](/#/guide/tools-and-features/ai-tools/mcp)》
