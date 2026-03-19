# ToolPkg 与 Compose DSL 类型

这一章不再讲“注册流程”，而是专门回答另一个问题：  
当你已经知道 `main.ts` 里可以注册哪些东西以后，编辑器里的补全、事件对象、返回值约束，到底是靠哪些类型文件撑起来的？

## 学完这一章，你应该能做到

- 知道 `toolpkg.d.ts` 主要定义了哪些注册对象和 hook 事件。
- 知道 `compose-dsl.d.ts` 和 `compose-dsl.material3.generated.d.ts` 分别在补哪一层类型。
- 知道 UI 模块、hook 回调、Compose DSL 这些补全为什么会出现。

## 建议先具备

- 已经看过《main、hooks 与注册流程》。
- 已经知道 ToolPkg 主入口里最常见的是 UI 模块注册和各类 hook 注册。

## 本章对应的真实文件

- `examples/types/toolpkg.d.ts`
- `examples/types/compose-dsl.d.ts`
- `examples/types/compose-dsl.material3.generated.d.ts`
- `examples/windows_control/src/main.ts`
- `examples/deepsearching/src/plugin/deep-search-plugin.ts`

## 先看一个最小例子

```ts
/// <reference path="../types/index.d.ts" />

const screen: ComposeDslScreen = () => ({
  type: "Column",
  props: {
    padding: 16,
  },
  children: [
    {
      type: "Text",
      props: {
        text: "Hello ToolPkg",
      },
    },
  ],
});

export function registerToolPkg() {
  ToolPkg.registerToolboxUiModule({
    id: "demo_panel",
    runtime: "compose_dsl",
    screen,
    title: {
      zh: "演示面板",
      en: "Demo Panel",
    },
  });
}
```

## 把例子拆开理解

### `toolpkg.d.ts` 负责的是“注册契约”

这个文件最核心的作用不是列一堆函数名，而是把“你能注册什么、每种注册项长什么样”说清楚。

你在里面能直接找到这些关键接口：

| 接口 / 类型 | 负责什么 |
|---|---|
| `ToolboxUiModuleRegistration` | UI 模块注册对象 |
| `AppLifecycleHookRegistration` | 应用生命周期 hook 注册对象 |
| `MessageProcessingPluginRegistration` | 消息处理插件注册对象 |
| `XmlRenderPluginRegistration` | XML 渲染插件注册对象 |
| `InputMenuTogglePluginRegistration` | 输入菜单 toggle 插件注册对象 |
| `ToolLifecycleHookRegistration` | 工具生命周期 hook 注册对象 |
| `PromptInputHookRegistration` | 输入处理 hook 注册对象 |
| `PromptHistoryHookRegistration` | 历史处理 hook 注册对象 |
| `SystemPromptComposeHookRegistration` | system prompt 组装 hook 注册对象 |
| `ToolPromptComposeHookRegistration` | tool prompt 组装 hook 注册对象 |
| `PromptFinalizeHookRegistration` | prompt 最终收尾 hook 注册对象 |

也就是说，写 `main.ts` 时你如果不确定“这个注册对象该传哪些字段”，首先该回看的就是这里。

### `toolpkg.d.ts` 还定义了事件对象和返回值

除了注册对象，这个文件里还定义了各类事件参数和返回值：

| 事件类型 | 关键事件对象 / 返回类型 |
|---|---|
| 生命周期 | `AppLifecycleHookEvent`、`AppLifecycleHookReturn` |
| 消息处理 | `MessageProcessingHookEvent`、`MessageProcessingHookReturnValue` |
| XML 渲染 | `XmlRenderHookEvent`、`XmlRenderHookReturn` |
| 输入菜单 toggle | `InputMenuToggleHookEvent`、`InputMenuToggleHookReturn` |
| 工具生命周期 | `ToolLifecycleHookEvent`、`ToolLifecycleHookReturn` |
| Prompt 相关 | `PromptInputHookEvent`、`PromptHistoryHookEvent`、`PromptFinalizeHookEvent` 等 |

这就是为什么你在 IDE 里写：

```ts
event.eventPayload.messageContent
```

或者：

```ts
event.eventPayload.tagName
```

会有补全。  
它不是示例代码“带出来的”，而是 `toolpkg.d.ts` 先定义好了。

### `compose-dsl.d.ts` 负责的是基础 UI DSL

这个文件负责 Compose DSL 的基础类型系统，比如：

- `ComposeDslScreen`
- `ComposeNode`
- `ComposeColor`
- `ComposeCanvasCommand`

它告诉编辑器：

- `screen` 应该是一个什么签名
- 一个节点对象至少有哪些结构
- 基础布局 / 文本 / 绘制相关节点怎么约束

所以当你写：

```ts
const screen: ComposeDslScreen = () => ({ ... })
```

真正让这行代码有意义的，是 `compose-dsl.d.ts`。

### `compose-dsl.material3.generated.d.ts` 负责的是 Material3 组件补全

你可以把这两个文件理解成：

- `compose-dsl.d.ts`
  负责 DSL 的基础框架
- `compose-dsl.material3.generated.d.ts`
  负责 Material3 组件及其 props 的详细补全

这也意味着：  
如果你的 ToolPkg UI 越写越复杂，越不应该把 Compose DSL 当成“随便拼一个对象树”，而应该回到这两份类型文件看清楚组件属性到底怎么约束。

### 为什么 ToolPkg 一复杂，类型文件就必须跟着看

普通脚本包里你高频回看的，往往是：

- `Tools`
- `complete(...)`
- `exports`

到了 ToolPkg，你高频回看的会变成：

- `ToolPkg.register...(...)` 这组注册函数
- 各类 `HookEvent`
- 各类 `HookReturn`
- `ComposeDslScreen`
- 各种 Compose 节点和 Material3 props

所以 ToolPkg 文档如果只讲 `manifest` 和 `main`，但不讲 `toolpkg.d.ts`，最后一定会变成“知道要写什么函数名，但不知道参数和返回值该怎么写”。

## 回到源码仓库，它为什么这样写

### `windows_control`

这个例子适合看：

- `ToolPkg.registerToolboxUiModule(...)`
- `ToolPkg.registerAppLifecycleHook(...)`

也就是说，它是最小 ToolPkg 主入口的真实模板。

### `deepsearching`

这个例子适合看更复杂的类型是怎么被真正用起来的：

- `MessageProcessingHookEvent`
- `XmlRenderHookEvent`
- `InputMenuToggleHookEvent`

你会发现它不是在“手猜字段名”，而是在按类型文件里已经定义好的结构去取：

- `eventPayload.messageContent`
- `eventPayload.xmlContent`
- `eventPayload.tagName`
- `eventPayload.action`
- `eventPayload.toggleId`

这就是 ToolPkg 类型文件真正的价值：  
它不是附带说明，而是你读主入口代码时最稳定的对照表。

## 本章自查

- 我是否知道 `toolpkg.d.ts` 主要负责注册契约，而不是 UI DSL 本身？
- 我是否知道 `compose-dsl.d.ts` 和 `compose-dsl.material3.generated.d.ts` 是两层不同的类型来源？
- 我是否已经知道遇到 hook 参数或 Compose 组件补全不清楚时，应该回哪份 `.d.ts`？

## 下一章

建议继续看《[从 JavaScript 迁移到 TypeScript](/#/plugin-tutorial/migrate-js-to-ts)》。
