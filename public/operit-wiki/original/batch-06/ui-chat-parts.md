---
title: UI 聊天消息部件
module: UI 聊天
sources: CustomXmlRenderer.kt, ThinkToolsXmlNodeGrouper.kt, ToolDisplayComponents.kt, FileDiffDisplay.kt, FontTagRenderer.kt, ParamVisualizer.kt, StatusCardHtmlDocument.kt, DetailsTagRenderer.kt, DialogComponents.kt, ToolResultDisplay.kt, XmlCanvasBlockComponents.kt, XmlCanvasSummaryComponents.kt, AttachmentViewerDialog.kt, AudioAttachmentPlayer.kt, VideoAttachmentPlayer.kt, TokenInfoDialog.kt
date: 2026-10-01
---

## 概述

聊天消息体渲染层：负责把模型输出的自定义 XML 标签（思考过程、工具调用、搜索卡片、状态、HTML 卡片等）分发渲染成 Compose 界面，附带附件预览弹窗与 Token 说明弹窗。

## AI 速览

- 核心符号：`CustomXmlRenderer`（总分发器，实现 `XmlContentRenderer`）、`ThinkToolsXmlNodeGrouper`（流式 think+tool 分组折叠）、`CompactToolDisplay` / `DetailedToolDisplay`（工具调用紧凑/详细两种形态）、`FileDiffDisplay`（文件差异）、`ParamVisualizer`（参数可视化）、`ContentDetailDialog`（通用详情弹窗）、`StatusCardHtmlDocument`（HTML 卡片字体打包方案）、`AttachmentViewerDialog`（附件预览）、`TokenInfoDialog`（Token 说明）。
- 主入口：`CustomXmlRenderer.RenderXmlContent(content, xmlStream)`，内部 `RenderXmlContentInternal` 按标签名分发到各 `render*` 私有函数；`ThinkToolsXmlNodeGrouper.group()` 在 markdown 层把连续 think/tool 块合并成可折叠分组。
- 数据流向一句话：XML 文本 →（extractTagName / 闭合性判断 / 插件注册表优先）→ 按标签分发到各自渲染函数 → Compose 卡片/弹窗/分组。

## 核心机制

### 1. 中央标签分发器（CustomXmlRenderer，1780 行）

`CustomXmlRenderer` 构造时注册 12 个内置标签（think、thinking、search、tool、status、tool_result、html、mood、font、details、detail、meta），并接受一个 `fallback = DefaultXmlRenderer()` 兜底。`RenderXmlContent` 的流程：trim → `extractTagName` 提取根标签 → `shouldHideHiddenMeta` 过滤掉模型内部推理签名类 meta（如 `provider=gemini:thought_signature`）→ `RenderXmlContentInternal`。

分发时有三条规则：

- **插件优先**：先问 `XmlRenderPluginRegistry.RenderIfMatched`（例如 deepsearch 的 `<plan>` 标签），插件命中就直接渲染。
- **未闭合保护**：除 tool/think/thinking/search 外的内置标签，未闭合时直接返回不显示（等流式补全）；未知标签未闭合则交 fallback。
- **闭合后分发**：按标签名进入 `renderThinkContent`、`renderToolRequest`、`renderToolResult`、`renderStatus`、`renderHtmlContent` 等十几个私有渲染函数。

无障碍方面，每个标签带朗读描述（如 tool → `R.string.tool_call_block`），唯独 think/thinking 系列用无描述 Box，避免打断读屏。

### 2. 思考过程渲染：流式感知与自动折叠

`renderThinkContent` 是整页最细的函数（约 300 行）：

- **进行态判定**：`xmlStream != null && !isXmlFullyClosed`。进行中标题做 1400ms 线性无限流光动画（位移 -140f → 220f）。
- **展开策略**：初始 `initialThinkingExpanded` 且已完成 → 展开；进行中 → 跟随用户偏好（`rememberLocal("expand_thinking_process_default")`）；结束后总是自动折叠（`skipCollapseAnimationOnce` 跳过一次收起动画，避免视觉跳动）。
- **贴底滚动**：自动贴底阈值 80px，用户手动滚离底部后停止跟踪。
- **流式 markdown**：`createThinkMarkdownCharStream` 用尾部缓冲逐字过滤掉 `</think>` 等尾标签，再交给 `StreamMarkdownRenderer`（文字透明度 0.6）。
- 正文默认最大高度 300.dp，点击可切换全高。

### 3. 工具调用：紧凑与详细的双形态

`renderToolRequest` 用正则 `name="([^"]+)"` 提取工具名，形态由两条规则决定：

- 文件操作工具（apply_file/create_file/edit_file）：已闭合 → `CompactToolDisplay`（单行摘要，首个参数前 120 字）；未闭合 → `DetailedToolDisplay`（逐行代码+行号，便于看流式参数）。
- 其他工具：流式且参数 token 估计超过 50 → 详细，否则紧凑。token 估计用 `XmlInnerTokenCounter` + `IncrementalTokenEstimator`（中文 1.5、其他字符 0.25）。

`renderToolResult` 用 name/status/content 三正则提取，status 缺省 "success"；工具名空则显示 `R.string.unknown_tool`。文件工具成功且结果含 `<file-diff` 时解析出 path/details/CDATA 交 `FileDiffDisplay`；否则走 `ToolResultDisplay`（失败时从 `<error>` 提取错误信息）。

### 4. Think+Tool 分组折叠（ThinkToolsXmlNodeGrouper）

流式消息会产生大量 think/tool/search 块，`ThinkToolsXmlNodeGrouper` 实现 `MarkdownNodeGrouper` 把它们合并：

- 连续 think+tool/tool_result/search → `think-tools-$i` 分组；纯工具序列 → `tools-only-$i`；纯 search → `search-only-$i`。之间允许纯空白文本节点，`meta` 可忽略。
- 是否参与分组按 `ToolCollapseMode`：`ALL`/`FULL` 全收；其他模式仅名字含 search 或属于 10 个只读白名单（read_file、list_files、grep_code 等）。
- 折叠阈值：`FULL` 恒折叠；`ALL`/`READ_ONLY` 要求 toolCount≥2 且 xml 相关节点≥2。
- 自动展开仅在流式仍在输出（`hasLiveXmlStream`）且尾部无不合规节点时；流结束或用户取消后默认收起；用户手动切换后 `userOverride` 接管。

### 5. HTML 卡片与离线字体方案

`renderHtmlContent` 把 `<html>` 内容拼成完整文档后用 WebView 渲染：`StatusCardHtmlDocument` 解决了一个具体事故（issue #930）——以前从 fonts.googleapis.com 拉 5.36MB 可变字体，弱网 10-40 秒、离线时图标名按原文画出；现在把 456KB 的静态 woff2 随 APK 打包，以 data: URI 内联，base64 缓存每进程只读一次。文档内建 status-card 等 5 种类名样式与 `<metric>`、`<badge>`、`<progress>` 三个内联组件（progress 0-100 钳制，80+ 绿/50+ 蓝/30+ 橙/余红）。

### 6. 纯 Canvas 的摘要行与装饰件

`XmlCanvasBlockComponents`（316 行）与 `XmlCanvasSummaryComponents`（470 行）全部手绘：折叠头（箭头旋转 90°、可选流光）、缩进引导线（默认 10.dp 渐隐竖线）、字体块（6.dp 圆角底、alpha 0.18）、胶囊标签；工具摘要行（图标 16dp、标题宽 80-120.dp 钳制、单行 160 字符截断）、结果行（24.dp 缩进、转角箭头、Check/Close 状态、复制按钮）、状态卡片（8.dp 圆角、1.dp 边框）、警告行（2.dp 红竖条）。`font` 标签渲染器（size 1-7 → 10-24.sp，face 支持 monospace/serif/sans-serif/cursive）与 `details` 折叠标签（`<summary>` 作标题、`open` 属性默认展开）都复用这些件。

### 7. 附件预览与 Token 说明

`AttachmentViewerDialog` 按 mimeType 路由：图片限读 20MB 并降采样解码；`media_pool:` 前缀经 `MediaPoolManager` 取数据（20MB 上限，写 `cacheDir/media_pool_preview`）；文本优先用附带 content、文件超 512KB 不读；音视频用 ExoPlayer 包 `StyledPlayerView` 的播放器（`autoPlay=false`）；有本地文件时经 `FileProvider` 调外部应用打开，失败弹 toast。`TokenInfoDialog` 是简单的确认弹窗，文案取 `token_info_*` 字符串，返回键与点击外部均可关闭。

## 关键符号（英文原名）

- `CustomXmlRenderer`：消息体 XML 总分发器（part/CustomXmlRenderer.kt）
- `ThinkToolsXmlNodeGrouper`：流式 think/tool 分组折叠器（part/ThinkToolsXmlNodeGrouper.kt）
- `CompactToolDisplay` / `DetailedToolDisplay`：工具调用紧凑/详细卡片（part/ToolDisplayComponents.kt）
- `FileDiffDisplay` / `FileDiff`：文件差异展示（part/FileDiffDisplay.kt）
- `ToolResultDisplay` / `ToolResultDetailDialog`：工具结果展示（part/ToolResultDisplay.kt）
- `ParamVisualizer` / `ParamItem`：工具参数可视化（part/ParamVisualizer.kt）
- `ContentDetailDialog` / `DiffContentLazyColumn`：通用详情弹窗与 diff 行渲染（part/DialogComponents.kt）
- `FontTagRenderer`：`<font>` 标签渲染（part/FontTagRenderer.kt）
- `DetailsTagRenderer`：`<details>` 折叠渲染（part/DetailsTagRenderer.kt）
- `StatusCardHtmlDocument`：HTML 卡片文档拼装与离线字体（part/StatusCardHtmlDocument.kt）
- `CanvasToolSummaryRow` / `CanvasToolResultRow` / `CanvasStatusCard` / `CanvasWarningStatusRow`：Canvas 摘要行件（part/XmlCanvasSummaryComponents.kt）
- `CanvasExpandableHeaderRow` / `CanvasIndentedGuide` / `CanvasFontTextBlock` / `CanvasPillLabel`：Canvas 装饰件（part/XmlCanvasBlockComponents.kt）
- `AttachmentViewerDialog` / `ChatAttachment`：附件预览弹窗（attachments/AttachmentViewerDialog.kt）
- `AudioAttachmentPlayer` / `VideoAttachmentPlayer`：音视频附件播放器（attachments/）
- `TokenInfoDialog`：Token 说明弹窗（config/TokenInfoDialog.kt）

## 输入 → 处理 → 输出调用链

1. **输入**：聊天消息文本（流式时为不完整的 XML 片段）进入 `CustomXmlRenderer.RenderXmlContent(content, xmlStream)`，或 markdown 层调用 `ThinkToolsXmlNodeGrouper.group(nodes)`。
2. **处理**：
   - 分组器先把连续的 think/tool/search 节点合并成 `think-tools-$i` 分组，决定折叠态（流中展开、流后收起、用户手动覆盖）。
   - 分发器逐块 `extractTagName` → 插件注册表 → 未闭合保护 → 按标签分发；think 块做流式 markdown 尾标签过滤，tool 块按闭合态与 token 估计选紧凑/详细，search 块判结构化后走卡片或折叠 markdown，html 块拼文档进 WebView，status 块按类型配色配文案。
3. **输出**：Compose 卡片（折叠头/摘要行/结果行/状态卡片/HTML WebView）、详情弹窗（参数可视化 / diff 行 / 代码行号）、附件预览（图片/音视频/文本）、Token 说明弹窗。

## 来源

- 源码：`app/src/main/java/com/ai/assistance/operit/ui/features/chat/components/part/`（12 个文件，约 4911 行）、`attachments/`（3 个文件）、`config/TokenInfoDialog.kt`
- 16 个种子文件 100% 全文阅读（共 5282 行），commit `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`
- 事实清单见 `ui-chat-parts.facts.json`，代码走查见 `ui-chat-parts.quality.json`
