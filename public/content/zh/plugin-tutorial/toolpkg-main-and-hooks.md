# main、hooks 与注册流程

上一章讲的是 `manifest`，这一章讲 ToolPkg 真正开始“接入宿主”的地方：`main`。  
如果你现在最大的困惑是“到底有哪些 hook、各自什么时候触发、注册对象该怎么写”，这一章就是专门解决这个问题的。

## 学完这一章，你应该能做到

- 知道 `main` 在 ToolPkg 里到底负责什么。
- 知道当前类型系统里可以注册哪些 hook / plugin。
- 能根据 `toolpkg.d.ts` 写出最小可运行的注册代码。
- 能分清哪些 hook 目前在示例仓库里已经有真实案例，哪些主要先靠类型定义。

## 建议先具备

- 已经看过《ToolPkg 基础与 manifest》。
- 已经知道 `manifest`、`main`、`subpackages` 是三层不同职责。

## 本章对应的真实文件

- `examples/types/toolpkg.d.ts`
- `docs/TOOLPKG_FORMAT_GUIDE.md`
- `examples/windows_control/src/main.ts`
- `examples/linux_ssh/src/main.ts`
- `examples/deepsearching/src/plugin/deep-search-plugin.ts`

## 先看一个最小例子

```ts
import toolboxUI from "./ui/demo/index.ui.js";

export function registerToolPkg() {
  ToolPkg.registerToolboxUiModule({
    id: "demo_panel",
    runtime: "compose_dsl",
    screen: toolboxUI,
    title: {
      zh: "演示面板",
      en: "Demo Panel",
    },
  });

  ToolPkg.registerAppLifecycleHook({
    id: "demo_app_create",
    event: "application_on_create",
    function: onApplicationCreate,
  });

  ToolPkg.registerMessageProcessingPlugin({
    id: "demo_message_plugin",
    function: onMessageProcessing,
  });

  ToolPkg.registerXmlRenderPlugin({
    id: "demo_xml_plan",
    tag: "plan",
    function: onXmlRender,
  });

  ToolPkg.registerInputMenuTogglePlugin({
    id: "demo_input_toggle",
    function: onInputMenuToggle,
  });

  return true;
}

export function onApplicationCreate(event: ToolPkg.AppLifecycleHookEvent) {
  console.log(event.eventName);
  return { ok: true };
}

export function onMessageProcessing(event: ToolPkg.MessageProcessingHookEvent) {
  const message = event.eventPayload.messageContent ?? "";
  if (!message.includes("/demo")) {
    return { matched: false };
  }
  return { matched: true, text: "命中了 demo 插件" };
}

export function onXmlRender(event: ToolPkg.XmlRenderHookEvent) {
  if (event.eventPayload.tagName !== "plan") {
    return { handled: false };
  }
  return { handled: true, text: "plan 已接管" };
}

export function onInputMenuToggle(event: ToolPkg.InputMenuToggleHookEvent) {
  if (event.eventPayload.action === "create") {
    return [
      {
        id: "demo_mode",
        title: "Demo Mode",
        description: "打开 demo 模式",
        isChecked: false,
      },
    ];
  }
  return [];
}
```

## 把例子拆开理解

### `registerToolPkg()` 只做一件事：注册

ToolPkg 的主入口不要当普通业务入口写。  
它最核心的职责就是在宿主启动这个包时，调用一系列 `ToolPkg.register...(...)` 把扩展点挂进去。

你可以把 `main` 里的工作先记成两类：

- 注册 UI 模块
- 注册 hook / plugin

### 先把当前可注册的东西认全

下面这张表直接对照 `examples/types/toolpkg.d.ts`。

| 类别 | 注册函数 | 注册对象关键字段 | 什么时候触发 | 当前仓库是否有真实示例 |
|---|---|---|---|---|
| 工具箱 UI 模块 | `registerToolboxUiModule` | `id`、`screen`、`runtime`、`title` | 打开对应 UI 模块时 | 有：`windows_control`、`linux_ssh` |
| 应用生命周期 hook | `registerAppLifecycleHook` | `id`、`event`、`function` | 应用 / Activity 生命周期节点 | 有：`windows_control`、`linux_ssh`、`deepsearching` |
| 消息处理插件 | `registerMessageProcessingPlugin` | `id`、`function` | 聊天消息进入处理链时 | 有：`deepsearching` |
| XML 渲染插件 | `registerXmlRenderPlugin` | `id`、`tag`、`function` | 目标 XML 标签被渲染时 | 有：`deepsearching` |
| 输入菜单开关插件 | `registerInputMenuTogglePlugin` | `id`、`function` | 创建 / 切换输入菜单开关时 | 有：`deepsearching` |
| 工具生命周期 hook | `registerToolLifecycleHook` | `id`、`function` | 工具请求、权限、执行、结束各阶段 | 类型已定义，示例较少 |
| Prompt 输入 hook | `registerPromptInputHook` | `id`、`function` | 输入进入处理前后 | 类型已定义，示例较少 |
| Prompt 历史 hook | `registerPromptHistoryHook` | `id`、`function` | 准备历史消息前后 | 类型已定义，示例较少 |
| System Prompt 组装 hook | `registerSystemPromptComposeHook` | `id`、`function` | 组装 system prompt 各阶段 | 类型已定义，示例较少 |
| Tool Prompt 组装 hook | `registerToolPromptComposeHook` | `id`、`function` | 组装 tool prompt 各阶段 | 类型已定义，示例较少 |
| Prompt 收尾 hook | `registerPromptFinalizeHook` | `id`、`function` | 最终发给模型前 | 类型已定义，示例较少 |

这一段最重要的结论是：

- 真正“已经在 examples 里能直接抄着学”的，当前主要是前五类。
- 后面几类虽然类型已经完整定义，但仓库里的公开示例还不算多，读的时候要以 `toolpkg.d.ts` 为准。

### 1. AppLifecycleHook 怎么用

这个是最常见、也最容易先上手的一类。

注册对象长这样：

```ts
ToolPkg.registerAppLifecycleHook({
  id: "demo_app_create",
  event: "application_on_create",
  function: onApplicationCreate,
});
```

`event` 允许的值在 `toolpkg.d.ts` 里已经列得很清楚：

- `application_on_create`
- `application_on_foreground`
- `application_on_background`
- `application_on_low_memory`
- `application_on_trim_memory`
- `application_on_terminate`
- `activity_on_create`
- `activity_on_start`
- `activity_on_resume`
- `activity_on_pause`
- `activity_on_stop`
- `activity_on_destroy`

回调拿到的是 `ToolPkg.AppLifecycleHookEvent`，最常用字段包括：

- `event`
- `eventName`
- `eventPayload.extras`
- `toolPkgId`
- `hookId`

`windows_control/src/main.ts` 和 `linux_ssh/src/main.ts` 都是在演示这一类最小注册写法。

### 2. MessageProcessingPlugin 怎么用

这一类不是“生命周期”，而是“聊天消息进入处理链时要不要由你的插件先接一下”。

注册方式：

```ts
ToolPkg.registerMessageProcessingPlugin({
  id: "deepsearching_message_plugin",
  function: onMessageProcessing,
});
```

`deepsearching` 就是当前仓库里最值得看的真实例子。  
它的回调签名是：

```ts
export async function onMessageProcessing(
  event: ToolPkg.MessageProcessingHookEvent
): Promise<ToolPkg.MessageProcessingHookReturnValue> {
  const message = event.eventPayload.messageContent ?? "";
  if (!message) {
    return { matched: false };
  }
  return { matched: true, text: "命中后的输出" };
}
```

这一类回调里最常看的 payload 字段有：

- `messageContent`
- `chatHistory`
- `workspacePath`
- `maxTokens`
- `tokenUsageThreshold`
- `probeOnly`
- `executionId`

返回值常见写法：

- `false` / `{ matched: false }`
  表示不接管。
- `string`
  直接给出处理后的文本。
- `{ matched: true, text: "..." }`
  明确告诉宿主“我接管了，并给出结果文本”。

### 3. XmlRenderPlugin 怎么用

这一类用在“模型输出了某种 XML 标签，你想自己接管渲染”的场景。

注册方式：

```ts
ToolPkg.registerXmlRenderPlugin({
  id: "deepsearching_xml_plan",
  tag: "plan",
  function: onXmlRender,
});
```

回调里最关键的是这两个字段：

- `event.eventPayload.xmlContent`
- `event.eventPayload.tagName`

最小写法：

```ts
export function onXmlRender(
  event: ToolPkg.XmlRenderHookEvent
): ToolPkg.XmlRenderHookReturn {
  if (event.eventPayload.tagName !== "plan") {
    return { handled: false };
  }
  return {
    handled: true,
    text: "这里是自定义渲染结果",
  };
}
```

如果你要返回 Compose DSL，也可以返回：

```ts
{
  handled: true,
  composeDsl: {
    screen,
    state: {},
  }
}
```

### 4. InputMenuTogglePlugin 怎么用

这一类解决的是“输入框旁边的开关菜单由谁定义、切换后怎么处理”。

注册方式：

```ts
ToolPkg.registerInputMenuTogglePlugin({
  id: "deepsearching_input_menu_toggle",
  function: onInputMenuToggle,
});
```

`event.eventPayload.action` 一般最关键：

- `create`
  宿主要你返回一组 toggle 定义。
- `toggle`
  用户真的切换了某个开关。

最小写法：

```ts
export function onInputMenuToggle(
  event: ToolPkg.InputMenuToggleHookEvent
): ToolPkg.InputMenuToggleDefinitionResult[] {
  if (event.eventPayload.action === "create") {
    return [
      {
        id: "demo_mode",
        title: "Demo Mode",
        description: "打开 demo 模式",
        isChecked: false,
      },
    ];
  }
  return [];
}
```

如果是处理切换行为，通常还会看：

- `event.eventPayload.toggleId`

### 5. Tool lifecycle / Prompt hooks 到底是干什么

这几类在 `toolpkg.d.ts` 里已经定义得比较完整，只是仓库里的公开示例还不多。  
所以你要先知道它们分别要拦哪一段：

#### Tool lifecycle

注册函数：

```ts
ToolPkg.registerToolLifecycleHook({
  id: "demo_tool_lifecycle",
  function: onToolLifecycle,
});
```

这类事件名包括：

- `tool_call_requested`
- `tool_permission_checked`
- `tool_execution_started`
- `tool_execution_result`
- `tool_execution_error`
- `tool_execution_finished`

回调里最常看的 payload 字段：

- `toolName`
- `parameters`
- `granted`
- `reason`
- `success`
- `errorMessage`
- `resultText`
- `resultJson`

这一类更适合做：

- 观测工具调用链
- 记录日志
- 在工具成功 / 失败后做附加行为

#### Prompt 输入与历史

注册函数：

- `registerPromptInputHook`
- `registerPromptHistoryHook`

对应事件名：

- Prompt 输入：
  `before_process`、`after_process`
- Prompt 历史：
  `before_prepare_history`、`after_prepare_history`

适合做：

- 改写用户原始输入
- 对历史消息做裁剪、重排、补充

#### System Prompt / Tool Prompt / Finalize

注册函数：

- `registerSystemPromptComposeHook`
- `registerToolPromptComposeHook`
- `registerPromptFinalizeHook`

对应事件名：

- System Prompt：
  `before_compose_system_prompt`、`compose_system_prompt_sections`、`after_compose_system_prompt`
- Tool Prompt：
  `before_compose_tool_prompt`、`filter_tool_prompt_items`、`after_compose_tool_prompt`
- Finalize：
  `before_finalize_prompt`、`before_send_to_model`

适合做：

- 注入 system prompt 片段
- 过滤或增强 tool prompt 内容
- 在真正发给模型前再做最后一轮调整

这一整组 hook 的事件对象基本都会带 `PromptHookEventPayload`，里面最常见的字段是：

- `rawInput`
- `processedInput`
- `chatHistory`
- `preparedHistory`
- `systemPrompt`
- `toolPrompt`
- `availableTools`
- `metadata`

## 回到源码仓库，它为什么这样写

### `windows_control` / `linux_ssh`

这两个示例最适合用来建立第一层理解：

- `main.ts` 真的只是注册 UI 模块和一个生命周期 hook。
- 它们没有把业务逻辑堆进 `main`，而是把主入口维持得很薄。

### `deepsearching`

这个例子最适合用来理解“一个 ToolPkg 主入口到底可以注册到什么程度”：

- `registerAppLifecycleHook`
- `registerMessageProcessingPlugin`
- `registerXmlRenderPlugin`
- `registerInputMenuTogglePlugin`

而且这不是空注册，它真的在用：

- `messageContent`
- `probeOnly`
- `executionId`
- `xmlContent`
- `tagName`
- `action`
- `toggleId`

所以如果你只看 `windows_control`，你会觉得 ToolPkg 的 hook 很简单；但把 `deepsearching` 一起看，就会知道真正复杂的入口长什么样。

## 本章自查

- 我是否知道当前 `toolpkg.d.ts` 里一共能注册哪些大类 hook / plugin？
- 我是否知道哪几类在仓库里已经有真实示例，哪几类目前主要靠类型文件阅读？
- 我是否知道 `MessageProcessing`、`XmlRender`、`InputMenuToggle` 各自最关键的 payload 字段是什么？

## 下一章

建议继续看《[编译、运行与调试](/#/plugin-tutorial/build-and-debug)》。
