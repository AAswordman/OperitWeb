# 宿主模块类型

前两章讲的是入口和总链路，这一章开始按模块看宿主 API。  
你在脚本里最常写的 `Tools.Files`、`Tools.System`、`Tools.Net`、`Tools.UI`，本质上都来自 `examples/types` 里不同的声明文件。

## 学完这一章，你应该能做到

- 知道 `Tools.xxx` 每个命名空间大致对应哪份 `.d.ts`。
- 知道常用宿主模块各自最典型的方法和返回值类型。
- 遇到陌生 API 时，知道先回哪份类型文件查。

## 建议先具备

- 已经看过《tool-types 与 results》。
- 已经知道 `index.d.ts` 会把多个模块挂到全局 `Tools` 对象上。

## 本章对应的真实文件

- `examples/types/index.d.ts`
- `examples/types/files.d.ts`
- `examples/types/system.d.ts`
- `examples/types/network.d.ts`
- `examples/types/ui.d.ts`
- `examples/types/chat.d.ts`
- `examples/types/workflow.d.ts`
- `examples/types/tasker.d.ts`
- `examples/types/memory.d.ts`

## 先看一个最小例子

```ts
/// <reference path="./types/index.d.ts" />

async function inspectWorkspace(path: string) {
  const files = await Tools.Files.list(path, "linux");
  const device = await Tools.System.getDeviceInfo();

  return {
    count: files.entries.length,
    env: files.env,
    brand: device.brand,
  };
}
```

## 把例子拆开理解

### `Tools` 在入口文件里是怎么接起来的

你在 `examples/types/index.d.ts` 里能看到 `Tools` 对象大致是这样拼起来的：

- `Tools.Files`
- `Tools.Net`
- `Tools.System`
- `Tools.UI`
- `Tools.Tasker`
- `Tools.Workflow`
- `Tools.Chat`
- `Tools.Memory`

这意味着你后面只要看到 `Tools.SomeNamespace`，第一反应就应该是：

> 去找 `examples/types/<对应模块>.d.ts`

## 常用宿主模块速览

| 类型文件 | 命名空间 | 常用方法 | 常见返回类型 |
|---|---|---|---|
| `files.d.ts` | `Tools.Files` | `list`、`read`、`apply` | `DirectoryListingData`、`FileContentData`、`FileApplyResultData` |
| `system.d.ts` | `Tools.System` | `sleep`、`getDeviceInfo`、`terminal.exec` | `SleepResultData`、`DeviceInfoResultData`、`TerminalCommandResultData` |
| `network.d.ts` | `Tools.Net` | `httpGet`、`http`、`visit` | `HttpResponseData`、`VisitWebResultData` |
| `ui.d.ts` | `Tools.UI` | `getPageInfo`、`clickElement`、`runSubAgent` | `UIPageResultData`、`UIActionResultData`、`AutomationExecutionResultData` |
| `chat.d.ts` | `Tools.Chat` | `listAll`、`sendMessage`、`getMessages` | `ChatListResultData`、`MessageSendResultData`、`ChatMessagesResultData` |
| `workflow.d.ts` | `Tools.Workflow` | `getAll`、`create`、`patch`、`trigger` | `WorkflowListResultData`、`WorkflowDetailResultData`、`StringResultData` |
| `tasker.d.ts` | `Tools.Tasker` | `triggerEvent` | `Promise<string>` |
| `memory.d.ts` | `Tools.Memory` | `query`、`getByTitle`、`link`、`queryLinks` | `Promise<string>`、`MemoryLinkResultData`、`MemoryLinkQueryResultData` |

## 各模块再展开一点

### `files.d.ts` -> `Tools.Files`

这是脚本开发里最常用的模块之一。  
你可以直接在 `files.d.ts` 里看到：

- `list(path, environment?)`
- `read(path)`
- `readPart(path, startLine, endLine, environment?)`
- `find(path, pattern, options?, environment?)`
- `grep(...)`
- `apply(path, type, old, newContent, environment?)`

这也是为什么你写文件处理脚本时，经常能直接得到像 `FileContentData`、`DirectoryListingData` 这样的强类型结果。

### `system.d.ts` -> `Tools.System`

这是和设备、系统、终端交互的重要入口。  
常用方法包括：

- `sleep(...)`
- `getDeviceInfo()`
- `toast(...)`
- `startApp(...)`
- `terminal.exec(...)`
- `terminal.hiddenExec(...)`
- `terminal.screen(...)`

也就是说，系统等待、设备信息、应用管理、终端控制，其实都可以先回到 `system.d.ts` 查。

### `network.d.ts` -> `Tools.Net`

如果你的工具涉及 HTTP 或网页访问，这里是核心类型来源。  
常见方法包括：

- `httpGet(...)`
- `httpPost(...)`
- `http(...)`
- `visit(...)`
- `startWeb(...)`
- `webSnapshot(...)`

这说明 `Tools.Net` 不只是简单请求库，它还覆盖了网页访问和持久化 Web 会话相关能力。

### `ui.d.ts` -> `Tools.UI`

这里定义的是 UI 自动化和页面信息相关能力。  
常用方法包括：

- `getPageInfo()`
- `clickElement(...)`
- `setText(...)`
- `swipe(...)`
- `runSubAgent(...)`

另外，这个文件里还定义了全局可用的 `UINode` 包装类，用来更方便地遍历和处理 UI 节点树。

### `chat.d.ts` -> `Tools.Chat`

如果你的脚本要操作聊天上下文，这里是权威入口。  
常见方法包括：

- `listAll()`
- `createNew(...)`
- `switchTo(...)`
- `sendMessage(...)`
- `sendMessageAdvanced(...)`
- `getMessages(...)`

这类能力尤其适合做会话管理、辅助发送、上下文检查等工具。

### `workflow.d.ts` -> `Tools.Workflow`

这里不仅有结果类型，还有一整套 `Runtime` 方法：

- `getAll()`
- `create(...)`
- `get(...)`
- `update(...)`
- `patch(...)`
- `delete(...)`
- `trigger(...)`

如果你要用脚本去管理工作流，本章之后就应该养成“先查 `workflow.d.ts` 再写”的习惯。

### `tasker.d.ts` -> `Tools.Tasker`

这个文件聚焦 Tasker 集成。  
最关键的方法就是：

- `triggerEvent(params)`

它允许你带着 `task_type` 以及可选参数，触发外部 Tasker 事件。

### `memory.d.ts` -> `Tools.Memory`

这里定义的是记忆库相关能力，常用方法包括：

- `query(...)`
- `getByTitle(...)`
- `create(...)`
- `update(...)`
- `link(...)`
- `queryLinks(...)`

这类接口很适合做记忆查询、结构化关系建立、知识回写。

## 回到源码仓库，它为什么这样写

把模块拆成多份 `.d.ts` 有两个非常直接的好处：

1. 你不用在一个超大文件里搜索所有 API。
2. 模块边界会反过来帮助你建立宿主能力的心智模型。

例如：

- 文件操作就去 `files.d.ts`
- 系统和终端就去 `system.d.ts`
- ToolPkg 相关就去 `toolpkg.d.ts`

这会让你后面读更复杂的示例时，定位速度快很多。

## 本章最容易踩的坑

### 坑 1：只记住 `Tools`，但不知道每个命名空间具体回哪份类型文件

结果是每次都只能全局搜索，效率很低。

### 坑 2：看到返回结果字段时只去示例代码里找

更稳的做法通常是直接回到对应模块和 `results.d.ts`。

### 坑 3：把 `toolCall(...)` 和 `Tools.xxx` 当成完全一样的入口

它们会通向相似结果结构，但类型推断链路并不一样。

## 本章自查

- 我是否知道 `Tools.Files`、`Tools.System`、`Tools.UI` 各自对应哪份 `.d.ts`？
- 我是否能举出每个常用模块至少一个真实方法？
- 我是否知道遇到陌生 API 时，先回模块类型文件查，而不是只猜？

## 下一章

建议继续看《[ToolPkg 与 Compose DSL 类型](/#/guide/plugin/toolpkg-types-and-compose)》。
