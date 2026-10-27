---
title: 标准工具·文件系统
module: core
sources: 7
date: 2026-10-01
---

# 标准工具·文件系统

## 概述

- 文件系统工具是 AI 在 Operit 里"动手"的主通道：读、写、删、改、找、压、解压、打开、分享、下载，共 24 个工具，全部经 `StandardFileSystemTools` 这一套入口实现。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:82`
- 24 个工具在文件系统注册段集中注册，以 `list_files` 开头。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:1775`
- 注册段以 `download_file` 收尾。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:2258`
- 最关键的设计是"三套环境"：同一个读文件工具，根据 `environment` 参数可以读手机本机文件、读 Linux 终端（Ubuntu）里的文件、读用户授权的文档树（SAF）。环境路由是 `isSafEnvironment`（以 `repo` 开头）与 `isLinuxEnvironment`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:146`
- 路径校验很薄：`validateAndroidPath` 只检查非空与 `/` 开头，不做权限确认。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/PathValidator.kt:8`

## AI 速览

- 核心符号：`StandardFileSystemTools`（统一入口）、`SafFileSystemTools`（SAF 文档树）、`LinuxFileSystemTools`（Ubuntu 终端）、`PathValidator`（格式校验）、`mapLinuxPath`（Linux 路径映射）、`MAX_FILE_READ_BYTES`（读取上限）。
- 主入口：`ToolRegistration.kt` 的文件系统注册段（`list_files` 起）；执行统一委托 `fileSystemTools` 的各操作函数。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:1771`
- 数据流向一句话：工具调用 → `PathValidator` 格式校验 → 按 `environment` 分发到本机 / `getLinuxFileSystem()` / `safTools` → 结果经 `ToolExecutionLimits` 截断后返回。
- 环境速查：默认走本机文件操作；linux 走 `getLinuxFileSystem`（优先 SSH、无则本地终端）；repo: 开头走 SAF 用户授权树。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:114`
- 高风险操作：删除（无确认无回收站）、写文件（默认全量覆写）、下载（只验 scheme）、打开/分享（文件递交外部应用）。

## 核心机制

### 三套环境与路由

- `environment` 参数是总开关：空或 android 走本机；"linux" 走 Linux；"repo:书签名" 走 SAF（Storage Access Framework，安卓的文档授权框架：用户在系统文件选择器里授权一棵文档树，App 拿到的是 `content://` 形式的 Uri 而非真实路径）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:146`
- 每个工具函数开头都是同一套分发：`isLinuxEnvironment` 命中走 Linux 实现，`isSafEnvironment` 命中走 SAF 实现，否则本机。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:2065`
- Linux 文件系统由 `getLinuxFileSystem()` 提供：先问 `sshFileManager` 要 SSH 文件系统（远程连上了就用远程的），没有 SSH 连接就回退本地终端的文件系统。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:114`
- Linux 路径是"假路径"：`mapLinuxPath` 把 `/home/user/x` 拼接到 Ubuntu 根目录（`{filesDir}` 下的 `usr/var/lib/proot-distro/installed-rootfs/ubuntu`）才是真实位置。`app/src/main/java/com/ai/assistance/operit/util/PathMapper.kt:17`
- SAF 书签从 `safBookmarksFlow` 按名匹配，取出用户授权的文档树 Uri 后再解析路径。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/SafFileSystemTools.kt:67`
- `repo:` 环境和 `linux` 环境混用直接拒绝。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:2785`
- `LinuxFileSystemTools` 继承 `StandardFileSystemTools`，只覆写 Linux 下不支持的能力，其余复用。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/LinuxFileSystemTools.kt:33`

### 读侧：保护与特殊文件

- 读文件超过 `MAX_FILE_READ_BYTES`（32000）自动截断，防止大文件撑爆上下文。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:1591`
- `readFilePart` 按 1-based 行号分段读，`startLineParam` 缺省为 1。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:1682`
- 分段读默认 200 行（`DEFAULT_FILE_READ_PART_LINES`）。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolExecutionLimits.kt:5`
- `text_only` 模式先取前 512 字节用 `FileUtils.isTextLike` 预检，非文本直接拒绝，避免把二进制当文本灌给模型。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:1453`
- 特殊文件扩展名表 `SPECIAL_FILE_EXTENSIONS` 含 doc/docx、pdf、图片、音频、视频。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:85`
- 特殊文件读取走 `handleSpecialFileRead`：图片可 OCR 或直传给识图模型，PDF/Word 提文本，音视频只给元信息。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:953`
- Linux 环境不支持图片/PDF/Word 读取。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/LinuxFileSystemTools.kt:156`
- Linux 环境下打开文件与分享文件均不支持。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/LinuxFileSystemTools.kt:1143`

### 写侧：默认覆写、无确认

- 写文件的 `append` 参数缺省按 `false` 处理：不传就是全量覆写。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:1809`
- 写入前自动 `mkdirs` 建父目录。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:1843`
- 写二进制文件取 `base64Content` 参数，用 `Base64.decode` 解码后写入。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:1989`
- `deleteFile` 的 `recursive` 参数默认 false；无二次确认、无回收站，直接删。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:2059`
- 移动先 `renameTo`，失败（比如跨文件系统）回退 copy+delete，整个移动非原子。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:2314`
- `applyFile` 是 `Flow` 流式工具，`typeParam` 决定操作类型。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:3870`
- `type` 取值限定为 replace/delete/create，其他值直接报错。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:4155`
- 结构化编辑经 `EnhancedAIService.applyFileBindingOperations` 做 AI 合并。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:4166`

### 压缩、打开、分享、下载

- 解压有 ZipSlip 防护：`newFileCanonical` 必须以目标目录 `canonicalPath` 开头，否则抛 `SecurityException`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:3743`
- 解压用 `FileOutputStream` 直接写目标文件，同名文件被覆盖。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:3761`
- 打开文件经 `FileProvider.getUriForFile` 拿 Uri，发 `ACTION_VIEW` 调外部应用打开。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:4547`
- 分享文件同理走 `ACTION_SEND` 调系统分享。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:4811`
- 下载只校验 URL 以 `http`/`https` 开头。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:4395`
- 下载用 `HttpMultiPartDownloader`，`threadCount = 4` 分段下载。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:4430`

### 搜索与跨环境复制

- 搜索是 agentic 三轮：`round in 1..3` 跑"搜索→精炼"，每轮推进度。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:626`
- 跨环境复制用 `BUFFER_SIZE = 10 * 1024 * 1024`（10MB）缓冲分块传输。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:2518`

### SAF 的特殊限制

- SAF 写文件有扩展名→MIME 白名单，不在名单抛 `IllegalArgumentException`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/SafFileSystemTools.kt:179`
- `guessPermissions` 恒返回写死的权限串：SAF 下文件信息的权限字段不可信。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/SafFileSystemTools.kt:1045`
- SAF 的 `grepCode` 直接报错，由 `find_files` + `read_file_full` 组合接管。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/SafFileSystemTools.kt:1488`
- SAF 的移动是"先 `copyFile`、成功再删源"的两步实现。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/SafFileSystemTools.kt:561`

## 关键符号

- `StandardFileSystemTools`：24 个文件工具的统一实现入口，日志 `TAG` 为 `"FileSystemTools"`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:84`
- `getLinuxFileSystem()`：Linux 环境的文件系统提供者，SSH 优先、无则本地终端。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:114`
- `resolveTreeUriFromEnvironment`：按书签名解析 SAF 文档树 Uri。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/SafFileSystemTools.kt:67`
- `LinuxFileSystemTools`：继承 `StandardFileSystemTools` 的 Linux 特化。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/LinuxFileSystemTools.kt:33`
- `validateLinuxPath`：Linux 路径要求 `/` 或 `~` 开头。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/PathValidator.kt:33`
- `mapLinuxPath`：Linux 假路径→真路径映射。`app/src/main/java/com/ai/assistance/operit/util/PathMapper.kt:17`
- `SPECIAL_FILE_EXTENSIONS`：需特殊处理的扩展名表。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:85`
- `MAX_FILE_READ_BYTES`（32000）：读侧字节上限。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolExecutionLimits.kt:4`

## 调用链

以读文件（`environment="linux"`）为例：

1. 输入 → `AIToolHandler.executeTool` 取到读文件工具的 executor（注册段 `list_files` 起），参数为路径 + `environment="linux"`。`app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt:1775`
2. 处理 → `readFile`：先做 Linux 路径校验（要求 `/` 或 `~` 开头）；`isLinuxEnvironment` 命中 → 委托 Linux 实现；`getLinuxFileSystem()` 选 SSH 或本地终端文件系统读字节；超 32000 字节截断；Linux 下图片/PDF/Word 直接返回不支持。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:1566`
3. 输出 → `ToolResult`（文本内容或截断后的内容），结果带 `env` 字段标记来源环境。

以写文件（默认环境）为例：

1. 输入 → executor 拿到 `path`、`content`，`append` 缺省按 `false` 处理。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt:1805`
2. 处理 → `validateAndroidPath`（`/` 开头）；本机分支；父目录不存在则 `mkdirs`；`append=false` 直接全量覆写（`append=true` 且文件存在才追加）。
3. 输出 → `FileOperationData` 的 `ToolResult`，`successful` 标记成败。

## 关联条目

- [[core-tools|工具系统（总览）]]：本页所属章节的总览。
- [[core-tools-registry|工具注册与执行框架]]：24 个工具的注册机制与执行调用链。
- [[core-tools-standard-webchat|标准工具·WebChat]]：同属标准工具组的兄弟页。
- [[core-tools-standard-system|标准工具·系统]]：同属标准工具组的兄弟页。
- [[core-tools-execmodes|标准工具·执行模式]]：同属标准工具组的兄弟页。

## 来源

- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/StandardFileSystemTools.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/SafFileSystemTools.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/standard/LinuxFileSystemTools.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/PathValidator.kt`
- `app/src/main/java/com/ai/assistance/operit/util/PathMapper.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/ToolRegistration.kt`
- `app/src/main/java/com/ai/assistance/operit/api/chat/EnhancedAIService.kt`
