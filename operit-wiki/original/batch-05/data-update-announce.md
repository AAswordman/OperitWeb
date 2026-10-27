---
title: 应用更新与公告
module: 数据层
sources: UpdateManager.kt, FullUpdateInstaller.kt, PatchUpdateInstaller.kt, RemoteAnnouncementRepository.kt
date: 2026-10-01
---

# 应用更新与公告

> 源码版本：Operit v1.12.2（`dbf71916fae9750cfdc9f9a774f5a0fee56633fb`）

## 概述

这一页讲的是 Operit 的两套"从云端拿东西"机制：**应用更新**和**远程公告**。

- **应用更新**：检查 GitHub Release 有没有新版本。正式版走完整 APK 下载（6 线程分段）；beta 用户走增量补丁——只下载差量 zip，在本地把当前 APK 重建成新 APK，同样支持 6 线程与 34 个国内镜像测速。补丁按 `baseSha256 → targetSha256` 拼成链，可跨多个小版本连续打补丁。
- **远程公告**：启动时从 `https://operit.app/announcements/latest.json` 拉一份 JSON，按"开关、版本范围、渠道、语言、排期"六重条件决定是否弹窗；每个版本只弹一次。

两套机制都只做"提示"，不自动下载、不自动安装：最终安装动作一律调起系统安装器，由 Android 做签名校验。

## AI 速览

- 核心符号：`UpdateManager`（更新检查单例）、`UpdateStatus`（六态密封类）、`FullUpdateInstaller`（完整包 6 线程下载）、`PatchUpdateInstaller`（增量补丁：选镜像→解链→下载→打补丁→校验）、`RemoteAnnouncementRepository`（公告拉取与过滤）
- 主入口：`UpdateManager.checkForUpdates(context, currentVersion)`（静态）/ `getInstance(context).checkForUpdatesSilently(version)`（启动自动检查）；补丁 `PatchUpdateInstaller.downloadAndPreparePatchUpdateWithProgress(...)`；公告 `RemoteAnnouncementRepository.fetchDisplayableAnnouncement()`
- 数据流向一句话：GitHub Release（正式版）/ `AAswordman/OperitNightlyRelease`（补丁）/ `operit.app/announcements`（公告）→ 本地过滤与校验 → `LiveData`/`State` 推给 UI → 用户确认后调系统安装器或弹公告对话框。

## 核心机制

### 1. 更新检查：UpdateManager 先分正式版和补丁版两路

`UpdateManager` 是私有构造的单例，双重检查锁保证全局唯一，持有的是 `applicationContext`。
`app/src/main/java/com/ai/assistance/operit/data/updates/UpdateManager.kt:37`
`app/src/main/java/com/ai/assistance/operit/data/updates/UpdateManager.kt:51`

检查结果用 `UpdateStatus` 密封类表达：`Initial` / `Checking` / `Available`（完整包）/ `PatchAvailable`（增量补丁）/ `UpToDate` / `Error`。注意这里已经**移除了下载相关状态**，下载进度由两个 Installer 各自的事件流承担。
`app/src/main/java/com/ai/assistance/operit/data/updates/UpdateManager.kt:16`

`Available` 携带 `newVersion` / `updateUrl`（release 页面）/ `releaseNotes` / `downloadUrl`（APK 直链）。
`app/src/main/java/com/ai/assistance/operit/data/updates/UpdateManager.kt:19`

`PatchAvailable` 携带 `patchUrl`（差量 zip）与 `metaUrl`（补丁元数据 JSON）。
`app/src/main/java/com/ai/assistance/operit/data/updates/UpdateManager.kt:25`

状态经由 `updateStatus: LiveData<UpdateStatus>` 暴露，UI 层观察它。
`app/src/main/java/com/ai/assistance/operit/data/updates/UpdateManager.kt:41`

版本号比较 `compareVersions` 支持 `1.7.0+1` 这种"基础版本 + 补丁序号"格式：先去掉 `v` 前缀，再按 major / minor / patch / patchIndex 依次比较。
`app/src/main/java/com/ai/assistance/operit/data/updates/UpdateManager.kt:87`

两路检查逻辑都在 `checkForUpdatesInternal`：

1. **补丁路**：只有 beta 用户（`UserPreferencesManager.isBetaPlanEnabled()` 为 true）才走；偏好读取抛异常时静默按非 beta 处理。补丁源是写死的 `AAswordman/OperitNightlyRelease` 仓库前 20 个 release。
   `app/src/main/java/com/ai/assistance/operit/data/updates/UpdateManager.kt:141`
   `app/src/main/java/com/ai/assistance/operit/data/updates/UpdateManager.kt:223`
2. **正式版路**：仓库 owner/name 从字符串资源 `about_website` 里用正则 `https://github.com/([^/"<>]+)/([^/"<>]+)` 解析 HTML 链接提取；解析失败默认 `AAswordman/Operit`。然后用 `GithubReleaseUtil.fetchLatestReleaseInfo` 取最新 release。
   `app/src/main/java/com/ai/assistance/operit/data/updates/UpdateManager.kt:165`
   `app/src/main/java/com/ai/assistance/operit/data/updates/UpdateManager.kt:174`
   `app/src/main/java/com/ai/assistance/operit/data/updates/UpdateManager.kt:179`

正式版只有远端版本大于当前版本才判 `Available`，否则 `UpToDate`；补丁与正式版同时可用时，取两者中版本号更新的那个（相等时取正式版）。
`app/src/main/java/com/ai/assistance/operit/data/updates/UpdateManager.kt:185`
`app/src/main/java/com/ai/assistance/operit/data/updates/UpdateManager.kt:196`

补丁候选有三道过滤：跳过 draft；只接受与当前版本**同 base version（x.y.z）**的 release（防止 `1.7.0+1` 直接打 `1.7.1+3` 的补丁）；release 附件必须同时有 meta（`patch_*.json` 优先，否则任意 `.json`）和补丁包（`apkrawpatch_*.zip` 优先，否则任意 `.zip`）。同 base 内取版本号最高的。
`app/src/main/java/com/ai/assistance/operit/data/updates/UpdateManager.kt:248`
`app/src/main/java/com/ai/assistance/operit/data/updates/UpdateManager.kt:270`
`app/src/main/java/com/ai/assistance/operit/data/updates/UpdateManager.kt:267`
`app/src/main/java/com/ai/assistance/operit/data/updates/UpdateManager.kt:288`

`checkForUpdates`（手动触发）先推 `Checking` 再推结果；`checkForUpdatesSilently`（启动自动检查）只在有可用更新时才推状态，异常直接吞掉只记日志。
`app/src/main/java/com/ai/assistance/operit/data/updates/UpdateManager.kt:118`
`app/src/main/java/com/ai/assistance/operit/data/updates/UpdateManager.kt:104`

### 2. 完整包下载：FullUpdateInstaller 只管把 APK 下全

`FullUpdateInstaller` 是 object 单例。它的 `Stage` 只有两步：`DOWNLOADING_APK` → `READY_TO_INSTALL`，进度事件只有 `StageChanged` 与 `DownloadProgress` 两种。
`app/src/main/java/com/ai/assistance/operit/data/updates/FullUpdateInstaller.kt:22`
`app/src/main/java/com/ai/assistance/operit/data/updates/FullUpdateInstaller.kt:23`
`app/src/main/java/com/ai/assistance/operit/data/updates/FullUpdateInstaller.kt:28`

下载前做两道硬校验：服务端必须返回有效 `Content-Length`，否则抛异常；服务端必须支持 HTTP Range（`Range: bytes=0-0` 返回 206），否则抛异常。两道都过才开 6 线程分段下载。
`app/src/main/java/com/ai/assistance/operit/data/updates/FullUpdateInstaller.kt:108`
`app/src/main/java/com/ai/assistance/operit/data/updates/FullUpdateInstaller.kt:171`
`app/src/main/java/com/ai/assistance/operit/data/updates/FullUpdateInstaller.kt:46`

工作目录是 `cacheDir/full_update`，每次开始前删干净重建；产物固定叫 `update.apk`。下载前用 `RandomAccessFile.setLength` 预分配满文件长度，6 个线程各自 `seek` 到自己的分片区间写入，128KB 缓冲。
`app/src/main/java/com/ai/assistance/operit/data/updates/FullUpdateInstaller.kt:43`
`app/src/main/java/com/ai/assistance/operit/data/updates/FullUpdateInstaller.kt:67`
`app/src/main/java/com/ai/assistance/operit/data/updates/FullUpdateInstaller.kt:89`
`app/src/main/java/com/ai/assistance/operit/data/updates/FullUpdateInstaller.kt:219`

分片按"总量 ÷ 线程数"均分，余数字节补给前几个分片；任一分片请求返回非 206 就整体抛异常。另起一个协程每 300ms 上报已下载字节数与实时速度。
`app/src/main/java/com/ai/assistance/operit/data/updates/FullUpdateInstaller.kt:129`
`app/src/main/java/com/ai/assistance/operit/data/updates/FullUpdateInstaller.kt:212`
`app/src/main/java/com/ai/assistance/operit/data/updates/FullUpdateInstaller.kt:108`

OkHttp 超时配置：连接 30 秒、读取 120 秒、写入 30 秒。
`app/src/main/java/com/ai/assistance/operit/data/updates/FullUpdateInstaller.kt:38`

注意：完整包下载**不做 SHA-256/签名校验**，只保证"字节下全了"；安装前的信任完全交给系统安装器（见调用链）。

### 3. 增量补丁：PatchUpdateInstaller 六阶段流水线

`PatchUpdateInstaller` 也是 object 单例。补丁流程分六个阶段：`SELECTING_MIRROR`（选镜像）→ `DOWNLOADING_META`（下元数据）→ `DOWNLOADING_PATCH`（下补丁包）→ `APPLYING_PATCH`（打补丁）→ `VERIFYING_APK`（校验）→ `READY_TO_INSTALL`。
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:38`
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:43`

链路长度上限 `MAX_CHAIN_STEPS = 64`，补丁包下载线程数 6。
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:40`
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:41`

两个公开入口：`downloadAndPreparePatchUpdateWithProgress` 先测速选镜像再走内部流程；`downloadAndPreparePatchUpdateWithProgressUsingMirror` 跳过测速，直接用调用方给定的镜像。
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:125`
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:153`

内部流程先在 `cacheDir/patch_update` 建干净工作目录（存在旧目录则递归删除后重建），把**当前已安装 APK**（`applicationInfo.sourceDir`）拷贝成 `current.apk` 作为打补丁的基底。
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:548`
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:182`

先下载目标 meta JSON，其 `format` 字段必须为 `apkraw-1`，否则直接抛异常；然后计算基底 APK 的 SHA-256，作为补丁链的起点。
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:201`
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:205`

**补丁链解析**（`resolvePatchChain`）是核心算法：从 GitHub 拉该仓库最多 100 个 release（跳过 draft），把每个 release 的 meta（来自 release **正文**的 JSON）与附件解析成 `PatchStep(baseSha256 → targetSha256)`，按"基底哈希 → 目标哈希"边去重——同一条边保留 `toPatchIndex` 更大者。然后从当前 APK 的哈希出发贪心走链：每一步在候选边里选 `toPatchIndex` 最大、再按版本号最大的边；用 `seenEdges` 做环检测，超 64 步抛异常。
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:348`
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:415`
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:428`
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:452`
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:465`
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:470`

链上每一步做三次 SHA-256 校验：本步 meta 的 `baseSha256` 必须等于当前 APK 实测值；`patchSha256` 必须等于下载的补丁 zip 实测值；打完补丁后 `targetSha256` 必须等于新 APK 实测值。任一不一致抛异常，中断整条链。
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:256`
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:282`
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:312`

meta 文件用单线程下载，补丁 zip 用 6 线程分段下载（与完整包同一套分片逻辑）。
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:243`
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:278`

**打补丁**（`applyApkrawPatch`）是纯本地 ZIP 手术：按 meta 里 `apkRawEntries` 逐条目处理——`mode=copy` 的从基底 APK 的 central directory 定位 local record 原样搬运，`mode=add` 的从补丁 zip 里取 record 写入；最后把补丁 zip 里的尾文件（默认 `tail.bin`）拼到末尾。整个过程用 `DigestOutputStream` 边写边算 SHA-256。
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:903`

为定位 local record，`readCentralDirectory` 从基底 APK 末尾 65557 字节反向扫描 EOCD 签名（`0x50 0x4B 0x05 0x06`），逐条解析 central directory；文件名按 flag `0x800` 决定用 UTF-8 还是 ISO-8859-1 解码，目录条目跳过。`copyLocalRecord` 搬运 local header + 文件名 + 压缩数据，遇到 flag `0x08`（data descriptor）时按有无可选签名分别搬 16 或 12 字节。
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:954`
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:962`
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:1013`

全部步骤完成后只保留 `rebuilt.apk`，工作目录其余文件全部删除。
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:528`

**镜像测速**：`selectFastestMirrorKeyWithProgress` 对补丁 URL 与 meta URL 的全部镜像（含 GitHub 直连）并发探测，每个镜像取 patch/meta 两次探测速度的较小值作为该镜像速度，速度优先、延迟次之选出最快镜像；全部失败回退 `"GitHub"` 直连。单次探测超时 2500ms。
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:562`
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:585`
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:627`
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:640`
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:81`

镜像 URL 映射规则在 `GithubReleaseUtil`：内置 34 个镜像前缀，只对同时包含 `github.com` 与 `/releases/download/` 的 URL 生成镜像地址；`mirrorKey == "GitHub"` 时直接用原 URL。
`app/src/main/java/com/ai/assistance/operit/util/GithubReleaseUtil.kt:39`
`app/src/main/java/com/ai/assistance/operit/util/GithubReleaseUtil.kt:80`
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:556`

**安装**：`installApk` 把 APK 经 `FileProvider` 授权为 content URI（Android N+，并加 `FLAG_GRANT_READ_URI_PERMISSION`），用 `ACTION_VIEW` 调起系统安装器——签名校验由系统完成。
`app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:103`

### 4. 远程公告：两级 JSON + 六重过滤

`RemoteAnnouncementRepository` 默认从 `https://operit.app/announcements/latest.json` 拉公告。协议是两级：先拉"指针" `AnnouncementPointer`（`schemaVersion` / `latestVersion` / `latestFile` / `updatedAt` / `notes`），再按指针的 `latestFile` 拉真正的公告体 `RemoteAnnouncementPayload`。
`app/src/main/java/com/ai/assistance/operit/data/announcement/RemoteAnnouncementRepository.kt:259`
`app/src/main/java/com/ai/assistance/operit/data/announcement/RemoteAnnouncementRepository.kt:20`
`app/src/main/java/com/ai/assistance/operit/data/announcement/RemoteAnnouncementRepository.kt:106`

公告体字段：`enabled`（默认 false）、`type`（默认 `"modal"`）、`priority`（默认 `"normal"`）、`countdownSec`（默认 0），外加 `target`（投放条件）、`schedule`（排期）、`content`（多语言文案）、`meta`。
`app/src/main/java/com/ai/assistance/operit/data/announcement/RemoteAnnouncementRepository.kt:29`

投放条件 `AnnouncementTarget`：`minAppVersionCode` / `maxAppVersionCode`（版本区间）、`channels`（渠道名单，空=全渠道）、`locale`（默认 `"all"`）。
`app/src/main/java/com/ai/assistance/operit/data/announcement/RemoteAnnouncementRepository.kt:44`

展示前过六重门（`toDisplay`）：`enabled` 为 true、`version > 0`、当前 `VERSION_CODE` 落在版本区间内、渠道命中、语言命中、当前时间落在 `startAt`/`endAt` 排期内；文案的标题与正文都不能为空。
`app/src/main/java/com/ai/assistance/operit/data/announcement/RemoteAnnouncementRepository.kt:136`

渠道别名规则：`release` 构建对应 `stable`，`nightly` 对应 `beta`，`debug` 同时对应 `stable`/`beta`/`dev`（另加 `"all"` 与构建类型本身）。
`app/src/main/java/com/ai/assistance/operit/data/announcement/RemoteAnnouncementRepository.kt:170`

语言匹配把目标与设备语言都归一化（小写、`_` 转 `-`）后比 `language` 或完整 tag（如 `zh-cn`）。
`app/src/main/java/com/ai/assistance/operit/data/announcement/RemoteAnnouncementRepository.kt:185`

排期解析先试 ISO `Instant.parse`，失败再试 `OffsetDateTime`；起止任一为空视为无限制。
`app/src/main/java/com/ai/assistance/operit/data/announcement/RemoteAnnouncementRepository.kt:194`
`app/src/main/java/com/ai/assistance/operit/data/announcement/RemoteAnnouncementRepository.kt:218`

多语言文案选择顺序：完整 tag → language → `defaultLocale`（默认 `zh-CN`）→ 第一个可用语言。
`app/src/main/java/com/ai/assistance/operit/data/announcement/RemoteAnnouncementRepository.kt:204`
`app/src/main/java/com/ai/assistance/operit/data/announcement/RemoteAnnouncementRepository.kt:58`

`countdownSec` 被钳制在 0~30 秒；`id` 为空时回退为 `"announcement-{version}"`。
`app/src/main/java/com/ai/assistance/operit/data/announcement/RemoteAnnouncementRepository.kt:153`
`app/src/main/java/com/ai/assistance/operit/data/announcement/RemoteAnnouncementRepository.kt:148`

网络层：OkHttp 连接/读/写超时各 8 秒；两次请求都带 `Cache-Control: no-cache` 并拼接 `ts=毫秒时间戳` 破缓存。`latestFile` 是绝对 URL 直接用，相对路径按指针 URL 做 `URI.resolve`。
`app/src/main/java/com/ai/assistance/operit/data/announcement/RemoteAnnouncementRepository.kt:91`
`app/src/main/java/com/ai/assistance/operit/data/announcement/RemoteAnnouncementRepository.kt:125`
`app/src/main/java/com/ai/assistance/operit/data/announcement/RemoteAnnouncementRepository.kt:248`
`app/src/main/java/com/ai/assistance/operit/data/announcement/RemoteAnnouncementRepository.kt:226`

入口 `fetchDisplayableAnnouncement` 全程 `runCatching`，失败只记日志返回 null，不抛异常。
`app/src/main/java/com/ai/assistance/operit/data/announcement/RemoteAnnouncementRepository.kt:96`

### 5. UI 侧的接线

`MainActivity` 启动 3 秒后调 `checkForUpdatesSilently` 自动检查更新（注释写明"仅提示，不自动下载"）；`updateStatus` 的观察者只在 `Available` / `PatchAvailable` 时弹更新通知。
`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:764`
`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:784`
`app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:750`

"关于"页（`AboutScreen`）手动检查后弹更新对话框：完整包若 `downloadUrl` 为空或不是 `.apk` 结尾，直接用浏览器打开 `updateUrl`；否则让用户选"浏览器下载"或"应用内下载"（应用内下载走 `FullUpdateInstaller`）。补丁更新走 `PatchUpdateInstaller`，下载完成后都调 `installApk` 调起系统安装器。
`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:718`
`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:679`
`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:620`

公告侧：`OperitApp` 在有网络时拉取公告，只有 `version` 大于已确认版本才弹 `RemoteAnnouncementDialog`；用户确认后把该版本记为已确认，同版本不再弹出。公告的标题与正文用纯 `Text` 渲染，不解析 HTML。
`app/src/main/java/com/ai/assistance/operit/ui/main/OperitApp.kt:409`
`app/src/main/java/com/ai/assistance/operit/ui/main/OperitApp.kt:361`
`app/src/main/java/com/ai/assistance/operit/ui/features/announcement/RemoteAnnouncementDialog.kt:49`
`app/src/main/java/com/ai/assistance/operit/ui/features/announcement/RemoteAnnouncementDialog.kt:57`

## 关键符号

| 符号 | 角色 |
|---|---|
| `UpdateManager` | 更新检查单例；两路检查（正式版/补丁）的调度者 |
| `UpdateStatus` | 六态密封类：`Initial`/`Checking`/`Available`/`PatchAvailable`/`UpToDate`/`Error` |
| `compareVersions` | 版本号比较，支持 `1.7.0+1` 的补丁序号 |
| `FullUpdateInstaller` | 完整 APK 的 6 线程分段下载器 |
| `PatchUpdateInstaller` | 增量补丁流水线：选镜像→解链→下载→打补丁→校验 |
| `PatchStep` | 补丁链上的一条边：`baseSha256 → targetSha256` |
| `installApk` | 经 FileProvider 调起系统安装器 |
| `resolvePatchChain` | 贪心拼补丁链：去重边、环检测、64 步上限 |
| `applyApkrawPatch` | 本地 ZIP 手术：copy/add 条目 + 拼 tail |
| `GithubReleaseUtil` | 34 个 GitHub 镜像前缀、镜像测速、release 信息拉取 |
| `RemoteAnnouncementRepository` | 公告两级拉取与六重过滤 |
| `AnnouncementPointer` / `RemoteAnnouncementPayload` | 公告协议：指针 JSON 与公告体 JSON |
| `RemoteAnnouncementDisplay` | 剥离后的展示模型 |
| `RemoteAnnouncementPreferences` | 记录已确认的公告版本，同版本只弹一次 |

## 输入→处理→输出调用链

**链路 A：启动自动检查更新（静默）**

1. 输入：`MainActivity` 启动 3 秒后，当前 `versionName` 作为 `currentVersion`。
   `app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:764`
2. 处理：`UpdateManager.checkForUpdatesSilently` → `checkForUpdatesInternal`（IO 线程）：beta 用户先查 `OperitNightlyRelease` 补丁，同时查正式版 release；两者取新。异常吞掉只记日志；只有 `Available`/`PatchAvailable` 才推给 `updateStatus`。
   `app/src/main/java/com/ai/assistance/operit/data/updates/UpdateManager.kt:104`
3. 输出：`updateStatus` 观察者收到可用更新 → `MainActivity` 弹更新通知（仅提示，不下载）。
   `app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt:750`

**链路 B：补丁更新（beta 用户在"关于"页触发）**

1. 输入：`UpdateStatus.PatchAvailable` 的 `patchUrl` / `metaUrl`。
   `app/src/main/java/com/ai/assistance/operit/data/updates/UpdateManager.kt:25`
2. 处理：`PatchUpdateInstaller.downloadAndPreparePatchUpdateWithProgress`：并发测速 34 个镜像 → 下载目标 meta（校验 `apkraw-1`）→ 以当前 APK 的 SHA-256 为起点 `resolvePatchChain` 拼链 → 逐步下载 meta（单线程）/补丁 zip（6 线程）→ 三重 SHA-256 校验 → `applyApkrawPatch` 本地重建 → 只保留 `rebuilt.apk`。任一步失败抛异常，`AboutScreen` 捕获后显示错误。
   `app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:125`
3. 输出：`installApk` 经 FileProvider 调起系统安装器，由 Android 做签名校验后安装。
   `app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt:103`

**链路 C：远程公告**

1. 输入：`OperitApp` 在网络可用时调用 `fetchDisplayableAnnouncement()`（默认设备语言）。
   `app/src/main/java/com/ai/assistance/operit/ui/main/OperitApp.kt:409`
2. 处理：拉指针 JSON → 按 `latestFile` 拉公告体 → 六重过滤（开关/版本>0/版本区间/渠道/语言/排期）→ 选本地化文案 → 钳制倒计时 0~30 秒。失败返回 null。
   `app/src/main/java/com/ai/assistance/operit/data/announcement/RemoteAnnouncementRepository.kt:96`
3. 输出：`version` 大于已确认版本才弹 `RemoteAnnouncementDialog`（纯文本渲染）；用户确认后 `setAcknowledgedVersion`，同版本不再打扰。
   `app/src/main/java/com/ai/assistance/operit/ui/main/OperitApp.kt:411`
   `app/src/main/java/com/ai/assistance/operit/ui/main/OperitApp.kt:361`

## 来源

- 种子文件（100% 全文阅读）：
  - `app/src/main/java/com/ai/assistance/operit/data/updates/UpdateManager.kt`
  - `app/src/main/java/com/ai/assistance/operit/data/updates/FullUpdateInstaller.kt`
  - `app/src/main/java/com/ai/assistance/operit/data/updates/PatchUpdateInstaller.kt`
  - `app/src/main/java/com/ai/assistance/operit/data/announcement/RemoteAnnouncementRepository.kt`
- 相关调用方/被调用方（已读）：
  - `app/src/main/java/com/ai/assistance/operit/util/GithubReleaseUtil.kt`（镜像表、测速、release 拉取）
  - `app/src/main/java/com/ai/assistance/operit/data/api/GitHubApiService.kt`（`getRepositoryReleases`）
  - `app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt`（更新对话框、下载编排）
  - `app/src/main/java/com/ai/assistance/operit/ui/main/MainActivity.kt`（启动自动检查）
  - `app/src/main/java/com/ai/assistance/operit/ui/main/OperitApp.kt`（公告拉取与弹窗）
  - `app/src/main/java/com/ai/assistance/operit/ui/features/announcement/RemoteAnnouncementDialog.kt`（公告纯文本渲染）
  - `app/src/main/java/com/ai/assistance/operit/data/preferences/RemoteAnnouncementPreferences.kt`（已确认版本）
