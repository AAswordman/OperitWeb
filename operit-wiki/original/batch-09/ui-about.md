---
title: 关于/更新/帮助界面
module: UI / 关于与更新
sources: 7
date: 2026-10-01
issue: 119
---

# ui-about（关于/更新/帮助界面）

> 种子：`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/`（AboutScreen.kt、OpenSourceLicenses.kt）+ `ui/features/update/screens/`（UpdateScreen.kt、UpdateViewModel.kt、UpdateInfo.kt）+ `ui/features/help/screens/HelpScreen.kt` + `ui/features/agreement/screens/AgreementScreen.kt`（186 行，首次启动用户协议页），共 7 文件、约 2,722 行 @ `dbf71916`

> 范围说明：本 commit 的 `ui/features/settings/screens/` 下不存在 LoginScreen.kt、FeedbackScreen.kt、ChangelogScreen.kt、PrivacyScreen.kt（git ls-tree 查无此文件），登录入口由 GitHubAccountScreen 等其他页面承担，不在本页范围内。

> 覆盖关于页（版本信息、检查更新、测试计划、项目链接、开源许可、联系方式）、更新历史页（GitHub releases 列表）、更新下载全流程（镜像测速→下载→安装）、帮助页（官网 WebView 承载）。

## 概述

关于页是 Operit 的"门面信息页"：顶部展示应用图标与版本号，下面是检查更新、测试计划开关、项目地址、更新日志、开源许可、联系方式等入口。它不只是一个静态展示页，还完整承载了**应用内更新**的全部交互：检查更新 → 发现新版本 → 选下载源（镜像测速）→ 下载进度 → 调起系统安装。更新分两条技术路线：**补丁更新**（PatchUpdateInstaller，只下载差量包再本地合成 APK）和**完整更新**（FullUpdateInstaller，直接下载完整 APK），UI 层为两者各维护一套对话框状态机。

更新历史页（UpdateScreen）则是只读的版本编年史：从 GitHub API 拉取 AAswordman/Operit 的 releases 列表，过滤草稿和预发布后按时间倒序展示，最新版本打特殊标记。

帮助页最简单：一个全屏 WebView 打开 `https://operit.app` 官网，附加载遮罩。

## AI 速览

- **核心符号清单**：AboutScreen、UpdateDialog、PatchUpdateProgressDialog、FullUpdateProgressDialog、FullUpdateMethodDialog、DownloadSourceDialog、PatchDownloadSourceDialog、PatchUpdatePhase、PatchUpdateDialogState、FullUpdatePhase、FullUpdateDialogState、HtmlText、SettingsGroup、SettingsRow、InfoItem、UpdateScreen、UpdateViewModel、UpdateUiState、UpdateInfo、UpdateCard、UpdateList、ErrorState、HelpScreen、LicenseDialog、OpenSourceLibrary、reducePatchUpdateState、reduceFullUpdateState、pickBestMirrorKey、mapPatchStage、formatBytes、formatSpeed、viewModelFactory、AgreementScreen。
- **主入口**：AboutScreen(navigateToUpdateHistory)；更新历史独立入口 UpdateScreen(onNavigateToThemeSettings)；帮助独立入口 HelpScreen(onBackPressed)。
- **数据流向一句话**：用户点"检查更新" → UpdateManager.checkForUpdates(appVersion) → LiveData<UpdateStatus> 变化 → AboutScreen 的 observer 更新 updateStatus → 自动弹窗 → 用户选下载方式 → PatchUpdateInstaller/FullUpdateInstaller 下载并回调 ProgressEvent → reducer 折叠为对话框状态 → 下载完成调 installApk 调起系统安装。

## 核心机制

### 1. 关于页的布局与信息行

AboutScreen 顶部是 80.dp 圆形应用图标（`R.drawable.ic_launcher_simple_foreground`）+ 应用名 + 版本号（`R.string.about_version(appVersion)`，`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:884`）。

appVersion 从 PackageManager.getPackageInfo 读取 versionName，取不到时回退 `R.string.about_version_unknown`（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:502`）。

页面主体由三个 SettingsGroup 组成，行组件是私有的 SettingsRow：左侧 38.dp 圆角图标块（底色为图标色 0.16 透明度），中间标题+副标题，尾部可定制或在有 onClick 时自动显示箭头（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:400`）。

检查更新行的副标题随 updateStatus 变化：Available/PatchAvailable 显示"当前版本 → 新版本"，UpToDate 显示已是最新，Error 显示错误信息，Checking 显示"检查中"（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:891`）；Checking 时行尾是 18.dp 圆形进度条（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:908`）。

点击行为按状态分流：已有结论（Available/PatchAvailable/UpToDate/Error）直接重开对话框，Checking 中忽略点击，其他情况触发 checkForUpdates（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:926`）。

测试计划（beta_plan）行尾是一个 Switch，状态来自 `UserPreferencesManager.betaPlanEnabled` 的 Flow，切换时调 `saveBetaPlanEnabled` 持久化（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:943`）。

- 项目地址行点击浏览器打开 `GITHUB_PROJECT_URL`（`https://github.com/AAswordman/Operit`，`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:957`）。
- GitHub Star 行点击同样打开该地址（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:969`）。
- 更新日志行点击调用 navigateToUpdateHistory()（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:986`）。
- 开源许可行点击把 showLicenseDialog 置 true（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:995`）。
- 联系方式行副标题取 `R.string.about_contact`（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:1006`）。
- 开发者行用 HtmlText 渲染 `R.string.about_developer` 的 HTML（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:1017`）。
- 页脚居中显示版权（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:1029`）。

### 2. 更新状态的监听与自动弹窗

- AboutScreen 持有 `UpdateManager.getInstance(context)`（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:472`）。
- 用 `observeForever` 监听其 `updateStatus` LiveData，DisposableEffect 的 onDispose 中移除观察者（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:480`）。

`LaunchedEffect(updateStatus)` 在状态变为 Available、PatchAvailable、UpToDate、Error 时自动把 showUpdateDialog 置 true（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:512`）。

UpdateDialog 按状态换图标与标题：发现新版本（Available/PatchAvailable）、检查中、检查完成、检查失败（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:1044`）；全量更新正文显示"$appVersion -> ${status.newVersion}"（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:1077`）。

注意一个写死规则：newVersion 包含 "+" 时不展示 releaseNotes（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:1083`）。

### 3. 更新下载的三条路径

点击更新对话框的确认按钮进 handleDownload，按状态分流（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:716`）：

1. **Available 且 downloadUrl 以 .apk 结尾**：先弹 FullUpdateMethodDialog 让用户选"应用内更新"或"浏览器下载"（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:1339`）。浏览器路径进 DownloadSourceDialog 选源后用 ACTION_VIEW 打开；应用内路径同样进 DownloadSourceDialog 选源，但回调进 startFullUpdateInApp（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:769`）。
2. **Available 但没有 .apk 链接**：直接浏览器打开 status.updateUrl。
3. **PatchAvailable**：进 PatchDownloadSourceDialog 选补丁镜像，回调进 startPatchUpdateWithMirror。

补丁路径 startPatchUpdateWithMirror：先判任务是否进行中防止重复启动（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:543`），初始阶段 DOWNLOADING_META（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:548`），全程 `ActivityLifecycleManager.forceKeepScreenOn(true)` 保持亮屏（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:555`），调用 `PatchUpdateInstaller.downloadAndPreparePatchUpdateWithProgressUsingMirror` 下载差量包并本地合成 APK（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:558`），完成后切主线程调 `PatchUpdateInstaller.installApk` 调起系统安装器（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:584`），finally 恢复亮屏策略。

- 自动测速路径 startPatchUpdate 的初始阶段为 SELECTING_MIRROR（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:611`）。
- 该路径调用 `downloadAndPreparePatchUpdateWithProgress` 让安装器自己探测镜像（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:620`）。

完整包路径 startFullUpdateInApp 调用 `FullUpdateInstaller.downloadAndPrepareUpdate` 下载完整 APK，同样经 installApk 安装（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:679`）。

### 4. 进度事件的 reducer 状态机

安装器的 ProgressEvent 是事件流，UI 层用两个纯 reducer 把它折叠成对话框状态，避免在回调里直接改 UI 状态：

- reducePatchUpdateState：StageChanged 切阶段并清零进度；MirrorProbeStarted/Result 累积镜像探测结果；MirrorSelected 记录所选镜像；ChainScanProgress 更新链式校验进度；DownloadProgress 计算百分比（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:146`）。
- reduceFullUpdateState：只有 StageChanged 与 DownloadProgress 两种事件（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/UpdateScreen.kt` 外，实际位于 `app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:228`）。

阶段枚举与安装器阶段一一对应由 mapPatchStage / mapFullUpdateStage 转换（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:135`）。

两个进度对话框都禁止返回键与点击外部关闭（`DialogProperties(dismissOnBackPress = false, dismissOnClickOutside = false)`），只能点取消按钮；取消时 cancel 对应的 Job 并清空状态（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:1147`）。

### 5. 镜像测速与选择

下载源选择对话框（DownloadSourceDialog）用 `GithubReleaseUtil.getMirroredUrls(downloadUrl)` 生成各镜像 URL，并把 GitHub 原站加入候选（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:1507`）；在 IO 线程并发探测每个源的速度与延迟（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:1532`）；"自动选择"按钮按速度最快、延迟最低挑可用源（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:1537`）；只有探测通过的源可点击（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:1647`）。

补丁源选择（PatchDownloadSourceDialog）同时探测 patch 与 meta 两个 URL：速度取两者最小值，延迟取两者最大值（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:1719`）；选源后回调 mirrorKey 进入 startPatchUpdateWithMirror（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:815`）。

镜像排序规则（sortPatchMirrorNamesForDisplay / sortFullMirrorNamesForDisplay）：可用在前、失败在后；可用中按速度降序、延迟升序、名称字母序。

### 6. 更新历史页

UpdateScreen 独立成页，参数 onNavigateToThemeSettings（`app/src/main/java/com/ai/assistance/operit/ui/features/update/screens/UpdateScreen.kt:77`）；用内联的 viewModelFactory 以 applicationContext 创建 UpdateViewModel（`app/src/main/java/com/ai/assistance/operit/ui/features/update/screens/UpdateScreen.kt:70`）。

UpdateViewModel 请求 `AAswordman/Operit` 仓库第 1 页、每页 20 条 releases（`app/src/main/java/com/ai/assistance/operit/ui/features/update/screens/UpdateViewModel.kt:43`），过滤草稿与预发布（`app/src/main/java/com/ai/assistance/operit/ui/features/update/screens/UpdateViewModel.kt:46`），过滤后第一条标 isLatest（`app/src/main/java/com/ai/assistance/operit/ui/features/update/screens/UpdateViewModel.kt:48`）。

parseReleaseToUpdateInfo 把发布时间解析为 yyyy-MM-dd，失败回退取前 10 字符；标题取 release.name；downloadUrl 与 releaseUrl 都取 release.html_url（`app/src/main/java/com/ai/assistance/operit/ui/features/update/screens/UpdateViewModel.kt:61`）。

UpdateCard 按"超过 5 行或 200 字符"判断是否可折叠（`app/src/main/java/com/ai/assistance/operit/ui/features/update/screens/UpdateScreen.kt:171`）；最新版本用 primaryContainer 背景、4.dp 阴影与绿色"最新"角标（`app/src/main/java/com/ai/assistance/operit/ui/features/update/screens/UpdateScreen.kt:191`）；releaseUrl 非空时底部有"查看 Release"与"下载"两个按钮（`app/src/main/java/com/ai/assistance/operit/ui/features/update/screens/UpdateScreen.kt:320`）。

### 7. 开源许可与帮助页

LicenseDialog 展示 getOpenSourceLibraries() 硬编码的约 70 个三方库清单（按名称排序），每库显示名称、描述、许可证，website 非空时提供浏览器跳转按钮（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/OpenSourceLicenses.kt:139`）。

HelpScreen 全屏 WebView 打开 `https://operit.app`（`app/src/main/java/com/ai/assistance/operit/ui/features/help/screens/HelpScreen.kt:27`），WebView 实例由 WebViewConfig.createWebView 创建（`app/src/main/java/com/ai/assistance/operit/ui/features/help/screens/HelpScreen.kt:32`）；onPageStarted/onPageFinished/onReceivedError 切换加载遮罩；shouldOverrideUrlLoading 返回 false 让站内链接都在 WebView 内打开（`app/src/main/java/com/ai/assistance/operit/ui/features/help/screens/HelpScreen.kt:66`）；首次组合即 loadUrl（`app/src/main/java/com/ai/assistance/operit/ui/features/help/screens/HelpScreen.kt:72`）。

HtmlText 是关于页复用的小组件：AndroidView 嵌入原生 TextView 渲染 HTML 并支持链接点击（`app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:107`）。

### 8. 首次启动的用户协议页

打开 App 第一次会先看到用户协议页（`AgreementScreen`），不是一上来就能点"同意"（`app/src/main/java/com/ai/assistance/operit/ui/features/agreement/screens/AgreementScreen.kt:24`）。
按钮要等 5 秒强制阅读倒计时走完才亮，倒计时里按钮上直接显示剩余秒数：`repeat(5)` 每次 `delay(1000)` 递减（`app/src/main/java/com/ai/assistance/operit/ui/features/agreement/screens/AgreementScreen.kt:31`），这 5 秒是写死的、不可配置。

协议内容分三块：先是一段"人话版"（大白话讲要点），然后是"严肃版"（正式条款，HTML 格式、用原生 TextView 渲染以支持富文本）（`app/src/main/java/com/ai/assistance/operit/ui/features/agreement/screens/AgreementScreen.kt:131`），最后是免责声明。
页面顶部还标了协议版本号（`AgreementPreferences.CURRENT_AGREEMENT_VERSION`）（`app/src/main/java/com/ai/assistance/operit/ui/features/agreement/screens/AgreementScreen.kt:67`）。
点同意后只调 `onAgreementAccepted` 回调——记版本号、下次不再弹这些事由调用方处理，本页不管（`app/src/main/java/com/ai/assistance/operit/ui/features/agreement/screens/AgreementScreen.kt:24`）。

## 关键符号

| 符号 | 职责 | 引用 |
|---|---|---|
| AboutScreen | 关于页主组合函数，承载版本信息与更新全流程 | `app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:462` |
| UpdateDialog | 更新状态对话框（新版本/检查中/已是最新/失败） | `app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:1044` |
| PatchUpdateProgressDialog | 补丁更新进度弹窗（测速/下载/打补丁/校验） | `app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:1138` |
| FullUpdateProgressDialog | 完整包更新进度弹窗 | `app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:1399` |
| FullUpdateMethodDialog | 应用内更新 vs 浏览器下载二选一 | `app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:1339` |
| DownloadSourceDialog | 完整包下载源选择（镜像测速+自动选择） | `app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:1500` |
| PatchDownloadSourceDialog | 补丁镜像选择（同时探测 patch+meta） | `app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:1680` |
| PatchUpdatePhase | 补丁更新 7 阶段枚举 | `app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:63` |
| PatchUpdateDialogState | 补丁进度对话框的全部状态 | `app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:73` |
| FullUpdatePhase / FullUpdateDialogState | 完整包更新的阶段与状态 | `app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:89` |
| reducePatchUpdateState | 把安装器 ProgressEvent 折叠为对话框状态 | `app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:146` |
| pickBestMirrorKey | 按速度/延迟挑选最优镜像 | `app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:268` |
| HtmlText | AndroidView 嵌入 TextView 渲染 HTML | `app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:107` |
| SettingsRow / SettingsGroup | 关于页的行与分组容器组件 | `app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt:400` |
| UpdateScreen | 更新历史列表页 | `app/src/main/java/com/ai/assistance/operit/ui/features/update/screens/UpdateScreen.kt:77` |
| UpdateViewModel | 从 GitHub API 拉取 releases | `app/src/main/java/com/ai/assistance/operit/ui/features/update/screens/UpdateViewModel.kt:20` |
| UpdateUiState | Loading/Success/Error 三态密封类 | `app/src/main/java/com/ai/assistance/operit/ui/features/update/screens/UpdateViewModel.kt:99` |
| UpdateInfo | 版本条目的数据模型 | `app/src/main/java/com/ai/assistance/operit/ui/features/update/screens/UpdateInfo.kt:3` |
| UpdateCard | 单个版本卡片 | `app/src/main/java/com/ai/assistance/operit/ui/features/update/screens/UpdateScreen.kt:168` |
| HelpScreen | 全屏 WebView 打开官网帮助页 | `app/src/main/java/com/ai/assistance/operit/ui/features/help/screens/HelpScreen.kt:24` |
| LicenseDialog | 开源许可清单对话框 | `app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/OpenSourceLicenses.kt:139` |
| OpenSourceLibrary | 开源库条目数据类 | `app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/OpenSourceLicenses.kt:27` |
| AgreementScreen | 首次启动用户协议页：5 秒强制阅读倒计时、人话版/严肃版（HTML）/免责声明三段正文 | `app/src/main/java/com/ai/assistance/operit/ui/features/agreement/screens/AgreementScreen.kt:24` |

## 调用链

**检查并安装更新（补丁路径）**：
1. 输入：用户点击"检查更新"行 → checkForUpdates() → `UpdateManager.checkForUpdates(appVersion)`。
2. 处理：UpdateManager 更新 LiveData<UpdateStatus> → AboutScreen 的 observeForever 回调更新 updateStatus → LaunchedEffect 自动弹出 UpdateDialog → 用户点确认 → handleDownload 分流到 PatchAvailable → PatchDownloadSourceDialog 测速选镜像 → startPatchUpdateWithMirror → PatchUpdateInstaller 下载差量包、本地合成 APK（ProgressEvent 经 reducePatchUpdateState 折叠为进度 UI）。
3. 输出：合成完成后主线程调 `PatchUpdateInstaller.installApk` 调起系统安装器；用户在系统界面完成安装。

**查看更新历史**：
1. 输入：关于页点击"更新日志"行 → navigateToUpdateHistory() → UpdateScreen。
2. 处理：UpdateViewModel.init 调 loadUpdates → GitHubApiService.getRepositoryReleases("AAswordman", "Operit", page=1, perPage=20) → 过滤 draft/prerelease → parseReleaseToUpdateInfo 转 UpdateInfo（第一条标 isLatest）。
3. 输出：UpdateList 渲染版本卡片；点击"下载"按钮浏览器打开 release.html_url。

**打开帮助**：
1. 输入：进入帮助页 → HelpScreen 首次组合。
2. 处理：WebViewConfig.createWebView 创建 WebView → LaunchedEffect 加载 `https://operit.app` → onPageStarted/Finished 切换加载遮罩。
3. 输出：官网内容在应用内 WebView 展示，站内链接不跳外部浏览器。

## 来源

- `app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/AboutScreen.kt`（1,876 行）：关于页主体、更新状态机、全部更新对话框
- `app/src/main/java/com/ai/assistance/operit/ui/features/about/screens/OpenSourceLicenses.kt`（194 行）：开源库清单与许可对话框
- `app/src/main/java/com/ai/assistance/operit/ui/features/update/screens/UpdateScreen.kt`（349 行）：更新历史页 UI
- `app/src/main/java/com/ai/assistance/operit/ui/features/update/screens/UpdateViewModel.kt`（104 行）：GitHub releases 拉取与转换
- `app/src/main/java/com/ai/assistance/operit/ui/features/update/screens/UpdateInfo.kt`（13 行）：版本条目数据模型
- `app/src/main/java/com/ai/assistance/operit/ui/features/help/screens/HelpScreen.kt`（113 行）：官网 WebView 帮助页
- `app/src/main/java/com/ai/assistance/operit/ui/features/agreement/screens/AgreementScreen.kt`（186 行）：首次启动用户协议页、5 秒强制阅读倒计时、三段式协议正文

关联数据层（非种子，供追溯）：`data/updates/UpdateManager`、`data/updates/PatchUpdateInstaller`、`data/updates/FullUpdateInstaller`、`util/GithubReleaseUtil`、`data/api/GitHubApiService`。
