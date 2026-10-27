---
title: 聊天消息样式：气泡风格与 Cursor 风格
module: UI 聊天 / app
sources: 9
date: 2026-10-01
---

# 聊天消息样式：气泡风格与 Cursor 风格

## 概述

Operit 的聊天界面有两种外观风格：**气泡风格（bubble）**——微信式的左右气泡，和 **Cursor 风格（cursor）**——仿 Cursor IDE 的编辑器式排版。两种风格都由一个分发函数按消息发送者（用户 / AI / 总结）把消息路由到各自的渲染组件；总结消息两种风格共用同一个实现。

本页覆盖 `ui/features/chat/components/style/` 下 bubble、cursor、common 三个目录共 9 个 Kotlin 文件。

## AI 速览

- **分发入口**：`BubbleStyleChatMessage`（bubble）、`CursorStyleChatMessage`（cursor），均按 `message.sender` 三路分发：`user` / `ai` / `summary`。
- **AI 渲染**：`BubbleAiMessageComposable` / `AiMessageComposable`（cursor）；共用 `StreamMarkdownRenderer` + `StreamMarkdownRendererState`（按 `message.timestamp` 缓存）。
- **用户渲染**：`BubbleUserMessageComposable` / `UserMessageComposable`（cursor）；共用 `parseMessageContent` 解析富文本标签与附件。
- **总结消息**：`SummaryMessageComposable`（两风格共用）——细分隔条 + 点击弹详情对话框。
- **隐藏占位**：`HiddenUserMessagePlaceholderContent`（220.dp 宽的虚线分隔占位行）。
- **气泡图片背景**：`BubbleImageBackgroundSurface` + `BubbleImageStyleConfig` + `BubbleImageRenderMode`（九宫格图片背景）。
- **数据流向一句话**：`ChatMessage.sender` → 分发器 → 具体 composable（AI 走流式 Markdown 渲染、用户走标签解析）→ Surface 气泡（圆角 / 玻璃 / 图片背景三选一互斥）。

## 核心机制

1. **三路分发**：两个分发器都按 `message.sender` 路由。`enableDialogs`（默认 true）是弹窗类功能的总开关，控制链接预览、附件预览、总结详情等对话框。
2. **气泡风格的视觉系统**：AI 消息是左气泡（圆角 `4,20,20,20` dp，左上小圆角），用户消息是右气泡（圆角 `20,4,20,20` dp）；窄布局下气泡最大宽度为容器的 85%；`bubbleWideLayoutEnabled` 切换宽窄布局（宽布局显示头像 + 角色名 + 模型信息头）；玻璃拟态有水玻璃（waterGlass）与液态玻璃（liquidGlass）两种，二者互斥，且任一玻璃启用时图片背景被置空。
3. **AI 消息渲染**：`StreamMarkdownRenderer` 负责流式 Markdown；`CustomXmlRenderer` 处理思考过程与状态标签；`ThinkToolsXmlNodeGrouper` 把工具调用分组折叠（默认 `ToolCollapseMode.ALL` 全折叠）；当内容含代码块 / 表格 / 图片等宽节点时气泡全宽渲染；流式消息用 `markdownStream`，静态消息用 `content`，共享同一 `rendererState`；新消息出现时做 300ms 淡入上移动画；头像长按可触发"提及"（mention）。
4. **九宫格图片背景**：`BubbleImageStyleConfig` 配置图片 URI、裁剪比例（钳制 0–0.45）、重复区（默认 0.35–0.65）、缩放（钳制 0.2–3）与渲染模式。`TILED_NINE_SLICE` 模式四角固定、上下边横向平铺、左右边纵向平铺、中心双向平铺；`NINE_PATCH` 模式九个区域全部拉伸。
5. **用户消息解析**：`parseMessageContent` 把消息文本里的富文本标签解析成结构：记忆标签、代发人标签、图片链接（经 `ImagePoolManager` 取图、Base64 解码、`ImageBitmapLimiter` 降采样）、媒体链接、回复引用、工作区上下文、附件（支持配对标签与自闭合标签两种格式）；附件再分为尾部附件（消息末尾连续附件块，右对齐展示）与行内附件（正文中保留为 `@filename`）。
6. **Cursor 风格差异**：AI 消息带 "Response" 标题栏，右侧按偏好拼接角色名 / 模型名 / 服务商；用户消息带 "Prompt"（代发人时为 "Prompt by X"）标题；支持 `overrideStream` 参数覆盖消息流；工具输出折叠跟随用户偏好：Cursor 版从 displayPreferencesManager.toolCollapseMode 读取偏好并透传给 ThinkToolsXmlNodeGrouper，并非强制折叠（该处 KDoc 注明的"恒用折叠执行模式"已过期）。注意行为差异：弹窗关闭时，气泡风格的链接点击直接无反应，Cursor 风格则回退到系统浏览器打开。
7. **总结消息**：渲染为一条细分隔条（中央是 Info 图标 + 标签的圆角徽标），点击弹出详情对话框（16.dp 圆角、8.dp 阴影、内容区最大 400.dp 可滚动），底部可编辑 / 删除，删除走二次确认。
8. **隐藏用户消息占位**：被隐藏的用户消息渲染为 220.dp 宽的占位行，两侧是主题色 28% 透明度的分隔线，中央是 badge 文案。

## 关键符号

| 符号 | 作用 |
|---|---|
| `BubbleStyleChatMessage` / `CursorStyleChatMessage` | 两种风格的消息分发入口 |
| `BubbleAiMessageComposable` / `AiMessageComposable` | AI 消息渲染组件 |
| `BubbleUserMessageComposable` / `UserMessageComposable` | 用户消息渲染组件 |
| `SummaryMessageComposable` | 总结消息（两风格共用） |
| `StreamMarkdownRenderer` / `StreamMarkdownRendererState` / `rememberRevisableTextStream` | 流式 Markdown 渲染 |
| `CustomXmlRenderer` / `ThinkToolsXmlNodeGrouper` / `ToolCollapseMode` | 思考过程与工具输出渲染 |
| `BubbleImageStyleConfig` / `BubbleImageRenderMode` / `BubbleImageBackgroundSurface` | 九宫格图片背景 |
| `parseMessageContent` / `MessageParseResult` / `AttachmentData` / `AttachmentTag` | 用户消息标签解析与附件展示 |
| `HiddenUserMessagePlaceholderContent` | 隐藏用户消息的占位行 |
| `enableDialogs` | 弹窗功能总开关 |
| `heightMemory` | 消息高度记忆，供滚动定位使用 |

## 输入 → 处理 → 输出

1. **输入**：`ChatMessage`（`sender` / `content` / `contentStream` / `roleName` / `modelName` / `provider` 等字段）+ 主题偏好（圆角开关、字体、玻璃效果、宽窄布局等）。
2. **处理**：分发器按 `sender` 路由到三种渲染组件 → AI 消息走 `StreamMarkdownRenderer` 流式渲染（含 XML 思考块、工具折叠、链接预览），用户消息走 `parseMessageContent` 解析标签与附件 → 套上 Surface 气泡（圆角 / 玻璃拟态 / 图片背景三选一，互斥逻辑）；高度经 `onSizeChanged` 写入 `heightMemory`。
3. **输出**：屏幕上的左右消息气泡（bubble 风格）/ Cursor 风格条目 / 总结分隔条；点击行为（链接预览、附件预览、总结详情）受 `enableDialogs` 门控。

## 来源

- 源码：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`，`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/style/`。
- 种子文件（9 个，100% 全文阅读）：`bubble/BubbleStyleChatMessage.kt`（101 行）、`bubble/BubbleAiMessageComposable.kt`（692 行）、`bubble/BubbleImageBackgroundSurface.kt`（822 行）、`bubble/BubbleUserMessageComposable.kt`（1103 行）、`common/HiddenUserMessagePlaceholderContent.kt`（50 行）、`cursor/CursorStyleChatMessage.kt`（80 行）、`cursor/AiMessageComposable.kt`（225 行）、`cursor/SummaryMessageComposable.kt`（203 行）、`cursor/UserMessageComposable.kt`（747 行）。
