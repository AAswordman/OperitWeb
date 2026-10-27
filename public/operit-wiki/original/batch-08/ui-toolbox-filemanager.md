---
title: 文件管理器界面
module: 工具箱 / 文件管理器
sources: 13
date: 2026-10-01
---

# ui-toolbox-filemanager（文件管理器界面）

> 种子：`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/`（13 个 Kotlin 文件，约 3,494 行）@ `dbf71916`

## 概述

这是 Operit 工具箱里的**图形化文件管理器**：浏览目录、进出文件夹、新建文件夹、复制/剪切/粘贴、重命名（含批量重命名）、删除、压缩/解压、搜索、多标签页、三种列表密度。

核心设计：**UI 层自己不直接读写文件，所有文件操作都翻译成 AI 工具调用**，经 `AIToolHandler`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:81`）执行。同一套工具既服务 AI Agent 也服务人类界面；代价是界面响应要等工具往返。

状态全部收拢在 `FileManagerViewModel`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:28`）。

界面只负责渲染：`FileManagerScreen`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/FileManagerScreen.kt:45`）做总装配，底部菜单、列表、工具栏、标签栏、状态栏拆成独立可组合组件。

## AI 速览

- **核心符号**：`FileManagerScreen`（Compose 入口）、`FileManagerViewModel`（全部状态与工具调用）、`FileContextMenu`（底部动作菜单）、`FileListContent`（列表容器）、`FileListItem`（行渲染）、`FileManagerToolbar`（顶部工具栏）、`PathNavigationBar`（路径栏）、`FileManagerTabRow`（多标签）、`StatusBar`（状态栏）、`DisplayMode`（单列/双列/三列）、`FileItem`/`TabItem`（数据模型）、`getFileIcon`/`formatFileSize`（`FileUtils.kt` 工具函数）。
- **主入口**：Compose 侧 `FileManagerScreen`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/FileManagerScreen.kt:45`）是界面入口。
- **状态入口**：ViewModel 的 `init` 块直接调 `loadCurrentDirectory()`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:479`）。
- **数据流向一句话**：用户手势 → ViewModel 改状态并经 `AIToolHandler` 调工具 → 结果写回状态 → Compose 重组刷新列表。

## 核心机制

### 1. 工具驱动的文件操作

界面不直接做文件 IO，各操作对应工具如下（均为构造 `AITool` 后经 `toolHandler.executeTool` 执行）：

- 浏览目录调 `list_files`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:102`）。
- 新建文件夹调 `make_directory`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:259`）。
- 搜索调 `find_files`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:300`）。
- 复制调 `copy_file`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:429`）。
- 删除调 `delete_file`，`recursive` 参数按是否为目录取值（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/components/FileContextMenu.kt:173`）。
- 重命名用 `move_file` 实现（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/components/FileContextMenu.kt:214`）。
- 压缩调 `zip_files`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/components/FileContextMenu.kt:253`）。
- 解压调 `unzip_files`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/components/FileContextMenu.kt:294`）。
- 打开调 `open_file`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/FileManagerScreen.kt:505`）。
- 分享调 `share_file`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/FileManagerScreen.kt:516`）。

工具调用包在 `viewModelScope` 协程 + `Dispatchers.IO` 中（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:97`），结果切回主线程写状态。

### 2. 多环境与快速访问

`currentEnvironment`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:31`）区分文件系统环境：空值为普通 Android 路径，`"linux"` 为 Linux 环境，`"repo:书签名"` 为 SAF 仓库。

`withEnvParams`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:83`）在环境非空时给工具参数追加 `environment`。

快速访问栏四个入口：

- Linux 芯片跳 `navigateToPath("/", "linux")`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/FileManagerScreen.kt:324`）。
- SDCard 芯片跳外部存储根目录（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/FileManagerScreen.kt:336`）。
- Workspace 芯片跳应用 `filesDir` 下的 workspace 目录（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/FileManagerScreen.kt:349`）。
- "+" 唤起系统目录选择器添加仓库书签（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/FileManagerScreen.kt:400`）。

### 3. SAF 仓库书签

- "+" 按钮用 `OpenDocumentTree`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/FileManagerScreen.kt:107`）唤起系统目录选择器。
- 选中后 `takePersistableUriPermission` 获取读写持久化 URI 权限（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/FileManagerScreen.kt:111`）。
- 书签名默认取内容提供者应用标签并规范化（`queryRepoBookmarkName`，`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/FileManagerScreen.kt:87`）。
- 重名（忽略大小写）被拦下（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/FileManagerScreen.kt:158`）。
- 确认后 `addSafBookmark` 持久化（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/FileManagerScreen.kt:167`）。
- 删除书签先 `releasePersistableUriPermission`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/FileManagerScreen.kt:380`）。
- 删除正在浏览的书签时回退到 workspace（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/FileManagerScreen.kt:385`）。

### 4. 标签页

`tabs`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:59`）初始只有一个 `/sdcard` 标签。

- `addTab`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:219`）新增标签并跳到新路径。
- `closeTab`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:228`）至少保留一个标签。
- `switchTab`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:241`）切换并加载对应路径。

### 5. 列表与滚动记忆

每次加载成功列表首位固定插入上级目录入口（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:121`）。

点击该入口走 `navigateUp`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:143`）。

`scrollPositions` 按路径记忆首可见索引（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/FileManagerScreen.kt:227`）。

导航时目标路径的记忆写入 `pendingScrollPosition`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:150`），但该字段没有任何消费代码（见代码走查）。

### 6. 多选与剪贴板

单击目录进入目录、单击文件选中；多选模式下单击切换选中态（`onItemClick`，`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/FileManagerScreen.kt:195`）。

长按弹出底部菜单（`onItemLongClick`，`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/FileManagerScreen.kt:213`）。

复制/剪切经 `setClipboard`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:405`）记录三要素。

`pasteFiles`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:413`）逐个复制剪贴板文件。

剪切模式下复制成功后调 `delete_file` 删源文件（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:448`）。

### 7. 搜索

`searchFiles`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:281`）是搜索入口。

默认把查询包成通配符（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:294`）。

调 `find_files`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:300`）。

逐结果调 `file_info`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:327`）。

以 `fileType == "directory"` 判定为目录（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:341`）。

结果的 `fullPath` 保留完整路径（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:355`）。

### 8. 重命名、压缩、解压

单文件重命名弹窗校验“非空且与原名不同”后调 `renameFile`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/components/FileContextMenu.kt:540`）。

批量重命名按“前缀+中段+后缀+扩展名”组新名（`batchRenameFiles`，`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/components/FileContextMenu.kt:320`）。

压缩默认名含秒级时间戳（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/components/FileContextMenu.kt:550`），缺 `.zip` 后缀自动补（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/components/FileContextMenu.kt:681`）。

解压按钮只对非目录的 `.zip` 文件出现（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/components/FileContextMenu.kt:487`）。

解压目标为当前目录（`unzipFile`，`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/components/FileContextMenu.kt:282`）。

## 关键符号

| 符号 | 位置 | 说明 |
|---|---|---|
| `FileManagerScreen` | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/FileManagerScreen.kt:45` | Compose 界面总装配 |
| `FileManagerViewModel` | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:28` | 全部状态与工具调用 |
| `loadCurrentDirectory` | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:93` | 列表加载入口 |
| `navigateToPath` | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:192` | 路径跳转与环境切换 |
| `searchFiles` | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:281` | 搜索入口 |
| `pasteFiles` | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:413` | 粘贴 |
| `FileContextMenu` | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/components/FileContextMenu.kt:30` | 底部动作菜单 |
| `deleteFile` | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/components/FileContextMenu.kt:162` | 删除 |
| `renameFile` | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/components/FileContextMenu.kt:202` | 重命名 |
| `compressFiles` | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/components/FileContextMenu.kt:240` | 压缩 |
| `DisplayMode` | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/components/FileListItem.kt:27` | 三种列表密度 |
| `FileItem` | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/models/FileModels.kt:11` | 文件行数据模型 |
| `TabItem` | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/models/FileModels.kt:4` | 标签页数据模型 |
| `getFileIcon` | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/utils/FileUtils.kt:14` | 按扩展名取图标 |
| `formatFileSize` | `app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/utils/FileUtils.kt:87` | 大小格式化 |

## 调用链

链路 1：打开目录浏览

1. 输入：点击目录行（`onItemClick`，`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/FileManagerScreen.kt:195`）。
2. 处理：`buildPath` 拼接新路径（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:484`）。
3. 输出：在 IO 线程调 `list_files`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:102`）。

结果映射为 `FileItem`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:121`），主线程刷新后列表重组。

链路 2：新建文件夹

1. 输入：工具栏新建按钮 → `NewFolderDialog`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/FileManagerScreen.kt:479`）。
2. 处理：`createNewFolder`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:251`）。

调 `make_directory`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:259`）。
3. 输出：成功后 `loadCurrentDirectory` 刷新当前目录（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:269`）。

链路 3：复制/剪切粘贴

1. 输入：底部菜单复制/剪切 → `setClipboard`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:405`）。
2. 处理：`pasteFiles` 遍历剪贴板（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:413`）。

逐文件调 `copy_file`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:429`）。
3. 输出：剪切成功后调 `delete_file` 删源文件（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:448`），最后刷新列表。

链路 4：搜索文件

1. 输入：`SearchDialog`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/components/SearchDialogs.kt:26`）输入查询。
2. 处理：`searchFiles`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:281`）。

调 `find_files`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:300`）。
3. 输出：`searchResults` 刷新（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/viewmodel/FileManagerViewModel.kt:284`）。

弹出 `SearchResultsDialog`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/components/SearchDialogs.kt:96`）。

链路 5：删除

1. 输入：底部菜单删除 → 删除确认对话框（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/components/FileContextMenu.kt:699`）。
2. 处理：`deleteFile`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/components/FileContextMenu.kt:162`）。

调 `delete_file`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/components/FileContextMenu.kt:173`）。
3. 输出：成功后经 `onFilesUpdated` 刷新（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/components/FileContextMenu.kt:188`）。

链路 6：添加 SAF 仓库书签

1. 输入："+" 按钮 → `OpenDocumentTree`（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/FileManagerScreen.kt:107`）唤起系统目录选择器。
2. 处理：`takePersistableUriPermission` 获取读写持久化 URI 权限（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/FileManagerScreen.kt:111`）。

重名被拦下（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/FileManagerScreen.kt:158`）。
3. 输出：`addSafBookmark` 持久化（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/FileManagerScreen.kt:167`）。

书签行可点击进入（`app/src/main/java/com/ai/assistance/operit/ui/features/toolbox/screens/filemanager/FileManagerScreen.kt:365`）。

## 来源

- 事实库：`review/batch-08/ui-toolbox-filemanager.facts.json`（144 条原子事实，引用全部验真）
- 代码走查：`review/batch-08/ui-toolbox-filemanager.quality.json`（12 条：0 高危 / 4 警告 / 8 建议）
- 源码：Operit `dbf71916`（v1.12.2），种子目录 13 个 kt 文件约 3,494 行
