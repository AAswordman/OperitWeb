---
title: 工作区与 WebView 基础设施
module: UI 聊天
sources: LocalWebServer.kt, WebViewHandler.kt, WorkspaceFileSelector.kt, WorkspaceUtils.kt, FileManager.kt, WorkspaceBackupManager.kt, WorkspaceCommandExecutionState.kt, WorkspaceConfig.kt, WorkspaceFilePreviewSupport.kt, WorkspaceImagePreview.kt, WorkspaceManager.kt, WorkspacePreviewRefreshBus.kt, WorkspaceReadOnlyDocumentPreview.kt, WorkspaceScreen.kt, WorkspaceSetup.kt, DepthLimitedFileObserver.kt, GitIgnoreFilter.kt, WorkspaceAttachmentProcessor.kt, WorkspaceChangeTracker.kt, WorkspaceRuleFileReader.kt, ComputerScreen.kt
date: 2026-10-01
---

## 概述

本页覆盖聊天页"工作区"标签的全部基础设施：一个跑在手机上的本地 HTTP 服务器（`LocalWebServer`，端口 8093）把工作区目录变成网站；一个重度定制的 `WebView` 配置器（`WebViewHandler`）负责渲染预览、下载 Blob、CORS 跨域代理；以及 VSCode 风格的工作区 UI（`WorkspaceManager`/`FileManager`/`WorkspaceSetup`）——文件浏览、标签页编辑、命令执行、版本备份与回滚。工作区是 AI 写代码的"落地盘"：AI 用工具读写文件，用户在工作区标签里实时看到网页预览、改代码、回滚到任意历史消息时的文件状态。

两个关键概念先说清楚：**工作区（workspace）** = 绑定到某次聊天的一个文件夹，AI 生成的网页/代码都写在这里；**workspaceEnv（环境标识）** = 字符串标记，空表示手机本地文件系统，`"repo:xxx"` 表示经 SAF（系统文件选择器）授权的外部目录（如用户手机上的某个仓库），`"linux"` 等表示其他工具执行环境。环境不同，文件读写走的通道完全不同。

## AI 速览

- 核心符号：`LocalWebServer`（NanoHTTPD 本地服务器，`WORKSPACE_PORT=8093`）、`WebViewHandler.configureWebView`（WebView 总配置）、`WorkspaceManager`（工作区主界面，1757 行）、`WorkspaceConfig`/`WorkspaceConfigReader`（`.operit/config.json` 配置）、`WorkspaceBackupManager`（按消息时间戳备份/回滚）、`WorkspaceChangeTracker`（文件变更追踪）、`DepthLimitedFileObserver`（限深文件监听）、`GitIgnoreFilter`（gitignore 过滤）、`FileBrowser`（文件浏览器）、`WorkspaceSetup`（首次绑定界面）、`MentionSuggestionPanel`（@-mention 建议面板）、`WorkspacePreviewRefreshBus`（预览刷新事件总线）、`ComputerScreen`（终端页）。
- 主入口：`WorkspaceScreen` 按聊天状态三选一 → `WorkspaceManager`（已绑定）/`WorkspaceSetup`（未绑定）/提示选会话；`LocalWebServer.getInstance(context, ServerType.WORKSPACE)` 取服务器单例。
- 数据流向一句话：AI 工具写文件 → `WorkspaceToolHookSession` 做增量快照 + `WorkspaceChangeTracker` 记录变更 → `WorkspacePreviewRefreshBus` 触发预览 WebView 重载 → 用户在 `WorkspaceManager` 里看/改；历史消息回看 → `syncState` 按时间戳回滚工作区。

## 核心机制

### 1. 本地 Web 服务器（LocalWebServer，865 行）

手机上跑的真 HTTP 服务器，基于 NanoHTTPD，固定端口 `WORKSPACE_PORT = 8093`：

- **双通道服务文件**：`serve()` 里，`/api/` 走 `handleApiRequest`；静态文件走两条路——当前工作区绑定了非空 `workspaceEnv` 时用 `serveWorkspaceFileViaTool`（经 `read_file_binary` AI 工具读文件，支持 SAF 等虚拟环境），否则 `serveFileFromDisk`（直接读磁盘）。服务器根目录是可变的，`updateChatWorkspace(path, env)` 会把它切到当前聊天的工作区。
- **路径安全**：`isSafeRelativeWebPath` 拒绝含反斜杠或 `..` 路径段的请求；磁盘模式用 `isInRoot`（canonicalPath 前缀校验）防目录穿越。
- **两个 API**：`/api/proxy?url=` 是开放代理——把任意 http/https URL 取回来，转发请求头（剥离 host/connection/content-length/accept-encoding）、自动附上 WebView 的 `CookieManager` 里该站点的 Cookie，再把响应头（剥离 content-length/content-encoding/transfer-encoding/connection）透传回去；`/api/files?path=` 经 `list_files` 工具列目录，返回 `FileApiEntry(name, isDirectory)` 的 JSON。
- **HTML 注入**：每个 served 的 HTML 都会被 `injectErudaIntoHtml` 注入两段脚本——console 早期缓冲回放（页面报错时能看到 console 输出）+ Eruda 移动端调试器（从 `cdn.jsdelivr.net/npm/eruda` 加载）。
- **CORS**：所有响应默认 `Access-Control-Allow-Origin: *`（代理请求则反射请求方的 origin）且 `Allow-Credentials: true`。
- **防 fd 泄漏**：自研 `CloseOnExecServerSocket`，用 `Os.socket(..., SOCK_STREAM or SOCK_CLOEXEC, 0)` 创建监听 socket，防止子进程继承文件描述符。

### 2. WebView 总配置器（WebViewHandler，756 行）

所有工作区预览 WebView 都经 `configureWebView(webView, mode, tabId, options)` 配置：

- **高权限设置**：`javaScriptEnabled=true`、`MIXED_CONTENT_ALWAYS_ALLOW`、`allowFileAccess/allowContentAccess/allowFileAccessFromFileURLs/allowUniversalAccessFromFileURLs` 全开——预览 AI 生成的页面时不设限。
- **UA 策略**：`preferDesktopSite` 默认 true，桌面 UA（Chrome/120 + `OperitWebView/1.0`）；关掉则用系统默认 UA。
- **NativeBridge**：`@JavascriptInterface` 注入的 `BlobDownloadInterface`，JS 侧 `downloadBlob(base64, fileName, mimeType)` 把页面里的 Blob 下载写进公共 Downloads 目录（文件名经 `sanitizeFileName` 把 `\ / : * ? " < > |` 换成下划线），发媒体扫描广播，并经 FileProvider 调起外部应用打开。
- **SSL 与权限**：`onReceivedSslError` 弹警告对话框，用户可点"继续"放行证书错误；`onPermissionRequest` 直接 `grant` 全部请求的权限（摄像头/麦克风等不二次确认）。
- **CORS 代理注入**：向页面注入 JS，把非 localhost 的 fetch/XHR 重写到 `http://localhost:8093/api/proxy?url=`，绕过浏览器同源策略；`blob:` 下载则注入 JS 把 Blob 转 Base64 走 NativeBridge。

### 3. 工作区主界面（WorkspaceManager，1757 行）

VSCode 风格：顶部标签页 + 文件编辑/预览区 + 底部可展开 FAB 菜单：

- **服务器联动**：`config.server.enabled` 为 true 时启动 `LocalWebServer` 并 `updateChatWorkspace`；为 false 时停掉。注意服务器是进程单例，所有聊天共用。
- **标签页**：`openFiles` 列表 + `currentFileIndex`；`openFile` 去重（已打开则切换），HTML 文件默认进预览态；`closeFile` 有未保存更改时弹"保存/不保存/取消"确认框；`saveFile` 经 `write_file` 工具全量写回（只读预览类文件直接跳过），HTML 保存后若在预览则刷新 WebView。
- **未保存追踪**：`unsavedFiles: Set<String>` 记录被改过的路径，标签上显示圆点；编辑器 `onCodeChange` 实时打标。
- **文件类型路由**：图片 → `WorkspaceImagePreview`（Coil，双击/双指缩放），音频/视频 → 播放器，PDF/Word/表格 → `WorkspaceReadOnlyDocumentPreview`，Markdown → 流式渲染预览，HTML → 内嵌 WebView（baseUrl 取文件父目录的 `file://`），其余 → `CodeEditor`。
- **命令执行**：`CommandButtonsView` 把 `config.json` 里定义的命令渲染成按钮，执行时弹 `WorkspaceCommandExecutionDialog`（输出自动滚到底、可隐藏、可取消、可复制；禁止返回键/点外部关闭）。
- **外部变更**：`WorkspacePreviewRefreshBus` 事件到来时重载预览 WebView。
- **FAB 菜单**：位置可拖拽并持久化（`rememberLocal("fab_menu_offset")`），含撤销/重做/格式化（仅 js/css/html）/文件管理/导出/重命名/解绑；键盘弹起时自动隐藏。
- **重命名工作区**：仅当工作区父目录是 `filesDir/workspace` 时允许，有未保存文件时拒绝。

### 4. 工作区配置（WorkspaceConfig，131 行）

`.operit/config.json` 的数据结构，`WorkspaceConfigReader.readConfig` 读取（缺失或解析失败 → 回退默认 web 配置）：

- `projectType`（默认 "web"）、`title`/`description`、`server{enabled,port,autoStart}`、`preview{type: browser|terminal|none, url, showPreviewButton}`、`commands: List<CommandConfig>`、`export{enabled}`、`watch{enabled,maxDepth=3,maxChangedFiles=80,exclude}`。
- `CommandConfig`：`id/label/command?/tool?/toolParameters/workingDir/shell/usesDedicatedSession/sessionTitle?`——命令按钮既可以直接跑 shell，也可以调用某个 AI 工具。
- 默认 web 配置：server 开、端口 8093、自启；preview 走 `http://localhost:8093`。

### 5. 版本备份与时间回滚（WorkspaceBackupManager，1178 行）

工作区的"时间机器"：按**消息时间戳**给工作区拍快照，回看历史消息时把文件恢复到当时的样子：

- **钩子会话**：`createWorkspaceToolHookSession` 返回实现 `AIToolHook` 的 `WorkspaceToolHookSession`。AI 每次执行工具前后触发：`onToolExecutionStarted` 只对 9 种变更文件工具（apply_file/create_file/edit_file/write_file/write_file_binary/move_file/delete_file/copy_file/make_directory）做增量处理；`onToolExecutionResult` 成功后把受影响路径重新快照，并经 `WorkspacePreviewRefreshBus` 广播刷新。注意回调里用了 `runBlocking(Dispatchers.IO)`。
- **内容寻址存储**：文件内容按 SHA-256 存进 `.backup/objects/`（按哈希前两位分片，如 `objects/ab/abcdef...`，兼容旧的扁平路径），`BackupManifest` 只记 `相对路径 → 哈希` 的映射 + 文件大小/修改时间。备份目录按聊天隔离：`.backup/chats/{chatId}/`，chatId 里的非法字符转下划线。
- **只备文本文件**：`refreshPathInStateProvider` 里非文本文件名（`FileUtils.isTextBasedFileName`）直接跳过——二进制文件不在备份覆盖范围。
- **syncState 回滚**：`syncState(workspacePath, messageTimestamp)`——如果存在比目标时间戳更新的备份，回滚到最近的那个更新备份（删除目标之后的文件、按哈希从对象库恢复），并删掉目标时间戳之后的所有备份；否则为当前时间戳记一次快照。`previewChanges`/`previewChangesForRewind` 用 `DiffUtils` 估算变更行数，供回滚前预览。
- **AI 变更去重**：hook 里调用 `WorkspaceChangeTracker.ignoreAiChanges`，把 AI 自己改的文件从"用户可见变更"里剔除，避免附件里重复报告。

### 6. 文件变更追踪（WorkspaceChangeTracker + DepthLimitedFileObserver + WorkspaceAttachmentProcessor）

AI 回复时自动附带的"工作区附件"（告诉模型文件发生了什么变化）的数据来源：

- `WorkspaceChangeTracker`（单例）：`updateOwner(ownerId, chatId, workspacePath, workspaceEnv)` 注册要监控的工作区——**SAF 环境（workspaceEnv 非空）直接移除绑定，不追踪**；`consumeChanges` 取出并清空累积的变更；`ignoreAiChanges` 把 AI 工具改过的路径记入 `aiChangedPaths` 并从待报告变更里删除。
- `DepthLimitedFileObserver`：基于 `FileObserver`，监听 CREATE/DELETE/MODIFY/CLOSE_WRITE/MOVED_FROM/MOVED_TO/DELETE_SELF/MOVE_SELF；启动时递归 watch 现有子目录（`maxDepth` 层），新建子目录自动加 watch，删除则移除；事件映射为 CREATED/MODIFIED/DELETED/MOVED 四种，`shouldIgnore` 回调（接 `GitIgnoreFilter`）过滤。
- `WorkspaceChangeSnapshot(changes, omittedCount, initialRootStructure)`：`recordChange` 里超过 `maxChangedFiles`（默认 80）后只记 `omittedCount`；首次建监控时 `buildRootLevelStructure` 生成根目录树形清单（目录在前，空目录显示"工作区为空"）。
- `WorkspaceAttachmentProcessor.generateWorkspaceAttachment`：把环境标识、初始目录结构、变更列表拼成纯文本附件，`escapeText` 转义 `&<>"'` 五个字符。

### 7. 文件浏览器（FileManager.kt，972 行）

`FileBrowser` 是 VSCode 风格的文件管理器，也被 `WorkspaceSetup` 复用做"选择已有文件夹"：

- 所有文件操作都走 AI 工具：`list_files` 列目录（失败时静默停留，不报错）、`make_directory`/`write_file` 新建、`delete_file(recursive=true)` 删除、`read_file_full` 打开文本。
- **三种环境**：本地路径、SAF 书签（`repo:书签名`，走 `OpenDocumentTree` 授权 + 持久化 URI 权限）、`linux` 快速路径；顶部快捷芯片（Linux/SDCard/Workspace/SAF 书签/+添加）。
- 媒体/PDF/Office 文档走 `workspaceShouldOpenAsDirectPreview` 直接回调空 content 的 `OpenFileInfo`，由预览器处理；其余文本文件读全文后打开。
- 管理模式（`isManageMode`）下长按文件弹出删除菜单（点文件不显示）；排序支持名称/大小/修改时间（目录置顶）；可开关隐藏文件显示；点"绑定当前文件夹"把路径交给 `onBindWorkspace`。

### 8. 预览支撑小件

- `WorkspaceFilePreviewSupport`（198 行）：扩展名→MIME 映射表（`workspaceMimeTypeForPath`）；`OpenFileInfo` 的 `isHtml/isMarkdown/isImage/isAudio/isVideo/isPdf/isWordDocument/isSpreadsheetDocument` 判定；`buildWorkspacePreviewUri` 把文件路径拼成 `http://127.0.0.1:8093/相对路径?v=缓存破坏token`（workspaceEnv 为空时退回 `Uri.fromFile`）。
- `WorkspaceImagePreview`（269 行）：Coil 加载（**禁用内存/磁盘缓存**、关闭 crossfade），双击 2.5x / 双指最大 5x 缩放并钳制偏移，左下角文件名徽标，加载中骨架 badge。
- `WorkspaceReadOnlyDocumentPreview`（508 行）：PDF 用 `PdfRenderer` 逐页 2x 渲染成 Bitmap 纵向列表；Word/Excel 经 `DocumentConversionUtil` 转 HTML 后用 WebView 展示（baseURL `https://workspace-preview.local/`，开 JS、允许文件访问）；SAF 环境先经 `read_file_binary` 把文件拷到 `cacheDir/workspace_document_preview`（文件名 `path.hashCode()_lastModified.扩展名`）。
- `WorkspacePreviewRefreshBus`（24 行）：`MutableSharedFlow`（缓冲 32）+ `tryEmit`，`WorkspacePreviewRefreshEvent(workspacePath, workspaceEnv, affectedPaths, source)`。
- `WorkspaceCommandExecutionState`（20 行）：命令执行对话框的状态数据类 + `toWorkspaceCommandOutputEntries`（`\r\n`/`\r` 统一成 `\n` 再切行）。
- `WorkspaceRuleFileReader`（57 行）：按 `AGENT.md` → `AGENTS.md` 顺序用 `read_file_full(text_only=true)` 读工作区根目录规则文件，首个非空命中返回。

### 9. 工作区绑定流程（WorkspaceSetup，636 行）与入口（WorkspaceScreen，60 行）

- `WorkspaceScreen` 三选一：`currentChat.workspace` 非空 → `WorkspaceManager`；chat 存在但未绑定 → `WorkspaceSetup`；无聊天 → 提示先选会话。
- `WorkspaceSetup` 提供两种入口：**新建**（弹项目类型对话框：blank/office/web/android/flutter/node/typescript/python/java/go 十种 + 工具包模板区，`bindBuiltInWorkspace` 调 `createAndGetDefaultWorkspace` 生成目录并写 `.operit/config.json`）与**选已有文件夹**（`FileBrowser`，可切 SAF 书签）。
- SAF 书签：`OpenDocumentTree` 选目录 → `takePersistableUriPermission` → 起名对话框（重名忽略大小写检查）→ `addSafBookmark` → `onBindWorkspace("/", "repo:书签名")`。
- 工具包模板导入：先 `createAndResetWorkspaceDirectory` 清空重建，失败时删目录回滚。
- `WorkspaceUtils.createAndGetDefaultWorkspace`：默认目录 `filesDir/workspace/{chatId}`；按项目类型从 `assets/templates/<name>` 复制模板（`gitignore` 重命名为 `.gitignore`，因为构建工具会吞掉 assets 里的点文件）；没有模板则只写 `.operit/config.json`。

### 10. @-mention 建议面板（WorkspaceFileSelector.kt，751 行）

聊天输入框 `@`/`/` 触发的建议面板 `MentionSuggestionPanel`：

- **文件建议**：`GitIgnoreFilter.loadRules` 加载忽略规则后遍历工作区，只收文本文件（`FileUtils.isTextBasedFile`），按 `scoreWorkspaceFileSuggestion` 打分取 Top 10（`MAX_FILE_SUGGESTIONS`）：文件名精确=0、路径精确=1、文件名开头=2、路径开头=3、父路径包含=4、文件名包含=5、路径包含=6；目录得分×2、文件得分×2+1（分数越小越靠前）；空查询时目录按深度、文件按 20+深度排序。
- **包建议**：三类来源——工具包（跳过容器包）、Skill、MCP 服务；`scoreMentionPackageSuggestion`：包名开头=0、标题开头=1、包名包含=2、标题包含=3、描述包含=4；空查询=4。
- 触发字符是 `/` 时只显示包建议，不显示文件建议。

### 11. 终端页（ComputerScreen，51 行）

`webview/computer/` 下唯一的页面：`@RequiresApi(O)`，`TerminalManager.getInstance` + `rememberTerminalEnv` 创建终端环境，渲染 `TerminalScreen`（不用本地输入法处理、进入不检查更新）；根 `Box` 用 `detectTapGestures` 把点击/双击/长按/按压全部消费掉，防止触摸穿透到下层聊天界面。

## 关键符号（英文原名）

- `LocalWebServer`：NanoHTTPD 本地服务器，端口 8093（webview/LocalWebServer.kt）
- `WebViewHandler` / `configureWebView` / `WebViewMode` / `WebViewOptions`：WebView 总配置器（webview/WebViewHandler.kt）
- `NativeBridge`（`BlobDownloadInterface`）：JS 下载桥，`downloadBlob(base64, fileName, mimeType)`（webview/WebViewHandler.kt）
- `WorkspaceManager`：工作区主界面（workspace/WorkspaceManager.kt）
- `WorkspaceScreen`：工作区入口三选一（workspace/WorkspaceScreen.kt）
- `WorkspaceSetup` / `WorkspaceOption` / `ProjectTypeCard`：首次绑定界面（workspace/WorkspaceSetup.kt）
- `FileBrowser` / `DirectoryEntry` / `OpenFileInfo`：文件浏览器（workspace/FileManager.kt）
- `WorkspaceConfig` / `ServerConfig` / `PreviewConfig` / `CommandConfig` / `ExportConfig` / `WatchConfig` / `WorkspaceConfigReader`：工作区配置（workspace/WorkspaceConfig.kt）
- `WorkspaceBackupManager` / `WorkspaceToolHookSession` / `BackupManifest` / `FileStat`：版本备份与回滚（workspace/WorkspaceBackupManager.kt）
- `WorkspaceChangeTracker` / `WorkspaceChangeSnapshot`：变更追踪单例（workspace/process/WorkspaceChangeTracker.kt）
- `DepthLimitedFileObserver` / `WorkspaceFileChange` / `WorkspaceFileChangeKind`：限深文件监听（workspace/process/DepthLimitedFileObserver.kt）
- `GitIgnoreFilter`：gitignore 规则过滤（workspace/process/GitIgnoreFilter.kt）
- `WorkspaceAttachmentProcessor`：AI 附件文本拼装（workspace/process/WorkspaceAttachmentProcessor.kt）
- `WorkspaceRuleFileReader`：AGENT.md/AGENTS.md 读取（workspace/process/WorkspaceRuleFileReader.kt）
- `WorkspacePreviewRefreshBus` / `WorkspacePreviewRefreshEvent`：预览刷新事件总线（workspace/WorkspacePreviewRefreshBus.kt）
- `WorkspaceCommandExecutionState`：命令执行对话框状态（workspace/WorkspaceCommandExecutionState.kt）
- `WorkspaceImagePreview`：图片预览（workspace/WorkspaceImagePreview.kt）
- `WorkspaceReadOnlyDocumentPreview`：PDF/Office 只读预览（workspace/WorkspaceReadOnlyDocumentPreview.kt）
- `workspaceMimeTypeForPath` / `buildWorkspacePreviewUri`：MIME 映射与预览 URL 拼装（workspace/WorkspaceFilePreviewSupport.kt）
- `MentionSuggestionPanel`：@-mention 建议面板（webview/WorkspaceFileSelector.kt）
- `createAndGetDefaultWorkspace`：默认工作区创建（webview/WorkspaceUtils.kt）
- `ExpandableFabMenu` / `VSCodeTab` / `CommandButtonsView`：FAB 菜单/标签/命令按钮（workspace/WorkspaceManager.kt）
- `ComputerScreen`：终端页（webview/computer/ComputerScreen.kt）

## 输入→处理→输出调用链

1. **绑定工作区**：`WorkspaceScreen`（chat 未绑定）→ `WorkspaceSetup` → 用户选"新建"→ `bindBuiltInWorkspace(projectType)` → `createAndGetDefaultWorkspace(context, chatId, projectType)`（复制 `assets/templates/<type>` + 写 `.operit/config.json`）→ `onBindWorkspace(path, null)` → `ChatViewModel.bindChatToWorkspace`；或选 SAF 目录 → `OpenDocumentTree` → `takePersistableUriPermission` → 起名 → `onBindWorkspace("/", "repo:名")`。
2. **打开工作区页**：`WorkspaceScreen`（已绑定）→ `WorkspaceManager` → 读 `.operit/config.json` → `server.enabled` 为真则 `LocalWebServer.getInstance(...).start()` + `updateChatWorkspace(path, env)` → 预览 WebView 经 `WebViewHandler.configureWebView` 加载 `preview.url`（如 `http://localhost:8093`）。
3. **AI 改文件**：工具执行 → `WorkspaceToolHookSession.onToolExecutionStarted/Result`（9 种文件变更工具）→ `refreshPathInStateProvider` 更新 `BackupManifest`（SHA-256 内容寻址存 `.backup/objects/`）→ `WorkspaceChangeTracker.ignoreAiChanges` 去重 → `WorkspacePreviewRefreshBus.tryEmit` → `WorkspaceManager` 重载预览 WebView；同时 `DepthLimitedFileObserver` 记录用户侧变更 → `consumeChanges` → `WorkspaceAttachmentProcessor.generateWorkspaceAttachment` 拼进 AI 上下文。
4. **用户编辑**：`CodeEditor.onCodeChange` → `unsavedFiles += path` → 点保存 → `saveFile` 经 `write_file` 工具写回 → hook 再次快照 → 预览刷新。
5. **回看历史**：切到旧消息 → `syncState(path, messageTimestamp)` → 有更新备份则 `restoreFromManifestsProvider` 回滚并删除其后备份 → `WorkspacePreviewRefreshBus` 刷新预览。
6. **@ 引用文件**：输入框 `@` → `MentionSuggestionPanel` → `GitIgnoreFilter` 过滤 + `scoreWorkspaceFileSuggestion` 打分取 Top 10 → `onFileSelected(path)` 插入引用。

## 来源

- 种子文件（Operit @ `dbf71916`，21 个，9758 行）：`webview/LocalWebServer.kt`、`webview/WebViewHandler.kt`、`webview/WorkspaceFileSelector.kt`、`webview/WorkspaceUtils.kt`、`webview/workspace/FileManager.kt`、`webview/workspace/WorkspaceBackupManager.kt`、`webview/workspace/WorkspaceCommandExecutionState.kt`、`webview/workspace/WorkspaceConfig.kt`、`webview/workspace/WorkspaceFilePreviewSupport.kt`、`webview/workspace/WorkspaceImagePreview.kt`、`webview/workspace/WorkspaceManager.kt`、`webview/workspace/WorkspacePreviewRefreshBus.kt`、`webview/workspace/WorkspaceReadOnlyDocumentPreview.kt`、`webview/workspace/WorkspaceScreen.kt`、`webview/workspace/WorkspaceSetup.kt`、`webview/workspace/process/`（5 个）、`webview/computer/ComputerScreen.kt`。`workspace/editor/` 归属 ui-chat-editor 页，本页未覆盖。
- 原子事实见 `ui-chat-workspace.facts.json`（211 条），代码走查见 `ui-chat-workspace.quality.json`（21 条：高危 2 / 警告 12 / 建议 7）。
