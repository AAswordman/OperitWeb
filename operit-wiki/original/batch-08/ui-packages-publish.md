---
title: 扩展发布界面（Artifact / Market 发布）
module: 插件 / 市场发布
sources: 10
date: 2026-10-01
issue: 103
---

## 概述

扩展发布界面是把本地插件/脚本制品（Artifact）推上 Operit 市场的整套 UI 与流程。它分两条发布轨道：

1. **Artifact 轨道**（`ArtifactPublishScreen`）：发布本地已安装的 script / package 构件。文件先传到用户 GitHub 账号下自动创建的公开仓库 **OperitForge** 的 Release 资产，再向市场后端注册条目。
2. **Repo 轨道**（`RepoMarketPublishScreen`）：发布一个 GitHub 仓库地址（skill / mcp 类型），市场后端按仓库引用收录，不上传文件。

两条轨道共用一套"草稿—确认—进度—结果"交互骨架：表单填完先弹确认框核对，发布中弹不可取消的进度框，全程经 `PublishProgressStage` 8 个阶段上报。所有发布动作都要求先登录 GitHub（`GitHubAuthPreferences.isLoggedIn()`），未登录只展示错误提示卡。

人话总结：你在手机上做了一个插件，点"发布到市场"，App 会自动在你的 GitHub 建一个叫 OperitForge 的公开仓库、打 Release、传文件，最后在市场登记——之后别人就能搜到并安装。

## AI 速览

- **核心符号**：`ArtifactPublishScreen`（主界面）、`ArtifactMarketViewModel`（发布编排）、`GitHubForgePublishService.publishArtifact`（上传+注册）、`RepoMarketPublishScreen` / `RepoMarketPublishViewModel`（仓库引用发布）、`PublishArtifactType`（SCRIPT/PACKAGE）、`PublishArtifactSource`（DirectUpload/GitHubReleaseAsset）、`PublishProgressStage`（8 阶段）、`ArtifactPublishClusterContext`（续发上下文）、`installArtifactProjectVersion`（本地安装）。
- **主入口**：`ArtifactPublishScreen(onNavigateBack, editingEntry, publishContext)`（screens/ArtifactPublishScreen.kt:139）；仓库轨道入口 `RepoMarketPublishScreen(type, onNavigateBack, editingEntry, publishVersionOnly, canEditEntry)`（screens/RepoMarketPublishScreen.kt:59）。
- **数据流向一句话**：本地构件 → 构建发布描述符（`buildPublishArtifactDescriptor`）→ 确保 OperitForge 仓库与 Release → 上传资产并算 sha256 → 向市场后端注册条目（`MarketV2PublishRequest`）→ 返回 `MarketV2Entry`（stateCode=pending）。

## 核心机制

### 两条发布轨道

`ArtifactPublishScreen` 处理三种模式：全新发布、续发（`publishContext != null`）、编辑已发布条目元数据（`editingEntry != null`，此时 `activePublishContext` 强制为 null）（screens/ArtifactPublishScreen.kt:164）。`RepoMarketPublishScreen` 只接受 `MarketStatsType.SKILL` 或 `MCP`，入口处 `require` 拦截其他类型（screens/RepoMarketPublishScreen.kt:66）。

### 发布描述符与命名规范

`buildPublishArtifactDescriptor`（market/ArtifactMarketModels.kt:342）是发布的"装配车间"：版本号去 `v` 前缀、空则默认 `1.0.0`；包 ID 经 `normalizeMarketArtifactId` 归一化（小写、非字母数字转 `-`）；资源文件名固定为 `{归一化包ID}-v{版本}.{扩展名}`；`contentType` 按扩展名推断（toolpkg→zip、js→javascript、ts→text/plain 等）；只有 PACKAGE 类型携带 ToolPkg API 版本（空回退 `1.0.0`）。独立发布（无上下文）会先校验包 ID 能生成稳定市场 ID，续发则要求归一化包 ID 与上下文一致。`canEditEntry=false` 的贡献者续发会锁定显示名、项目显示名与分类，只能改描述类字段。

### OperitForge 仓库与 Release

`GitHubForgePublishService.ensureForgeRepository`（market/GitHubForgePublishService.kt:285）查找 `{用户登录名}/OperitForge`：存在但为空（size==0）则写入 README 初始化；报 404 且允许建仓时创建**公开**仓库（`isPrivate=false, autoInit=true`）；首次走 `allowCreateForgeRepo=false`，拿不到仓库就返回 `NeedsForgeInitialization`，界面连弹两个确认框，用户二次确认后才真正建仓并继续（screens/ArtifactPublishScreen.kt:1406）。`ensureRelease` 按 tag `{script|package}-{归一化ID}-v{版本}` 查找 Release，不存在则创建（非草稿、非预发布），存在则更新名称与正文（market/GitHubForgePublishService.kt:373）。上传前先删除同名旧资产（忽略大小写），再上传新字节。

### 两种资产来源

`PublishArtifactSource`（market/ArtifactMarketModels.kt:143）二选一：`DirectUpload(minifyArtifact)` 本地直传——文件经 `ToolPkgArtifactMinifier.processArtifactFile` 处理（含混淆/压缩选项）后上传，注册的 sha256 是**处理后字节**的哈希；`GitHubReleaseAsset(owner/repository/releaseTag/assetName)` 引用用户已有 Release 的资产——下载后算哈希，`require` 与本地源文件哈希一致才放行（market/GitHubForgePublishService.kt:208）。界面用分段按钮切换，GitHub 模式需先加载 Release 目录再选 tag 与资产（screens/ArtifactPublishScreen.kt:452）。

### 市场注册

`registerMarketEntry`（market/GitHubForgePublishService.kt:431）组装 `MarketV2PublishRequest`：`asset.kind="github_release_asset"`，携带 ghOwner/ghRepo/ghReleaseTag/assetName/sha256；`minAppVer` 必填（空抛异常），`maxAppVer` 空默认 `1.99.99`。无已有条目调 `publish`，有则调 `publishNewVersion` 并映射成 `stateCode="pending"` 的条目。注意：注册失败不抛异常，而是返回 `PublishAttemptResult.RegistrationFailed` 由上层展示错误（market/GitHubForgePublishService.kt:251）。

### 身份冲突与版本递增

全新发布前 `ensureFreshPublishIdentityAvailable`（screens/artifact/viewmodel/ArtifactMarketViewModel.kt:561）做三重检查：显示名、运行时包 ID、归一化 ID，冲突时一次性抛出中文原因。续发走 `validateContinuationVersion`：拉取项目详情，要求新版本严格大于已有最高版本（screens/artifact/viewmodel/ArtifactMarketViewModel.kt:457）。版本号比较 `comparePublishVersions` 先比数字段再比后缀，空后缀（正式版）大于预发布后缀。

### 草稿持久化

两条轨道都把表单存草稿：Artifact 轨道 key 为 `artifact_publish_draft_{scope}`（无上下文 `fresh`，有上下文 `entry_{脱敏ID}`），带 `savedAtEpochMs` 时间戳，无标记不读半截草稿（screens/artifact/viewmodel/ArtifactMarketViewModel.kt:728）；Repo 轨道 key 为 `{type.wireValue}_publish_draft`（screens/market/viewmodel/RepoMarketPublishViewModel.kt:53）。Artifact 界面 14 个字段用 `rememberSaveable`，进程重建不丢；发布成功后清草稿。

### 本地安装与完整性

`installArtifactProjectVersion`（market/ArtifactLocalInstallSupport.kt:134）先算本地快照做五态判定：`EXACT_INSTALLED` 直接返回；`BUILT_IN_CONFLICT` 拒绝覆盖内置包；`NAME_CONFLICT` / `SAME_PROJECT_VARIANT_INSTALLED` 先删旧包再导入（导入返回须以 `Successfully imported` 开头）。下载到 `cacheDir/market_downloads`，跟随重定向，下载后**必验 sha256**，不一致删文件抛异常；临时文件 `finally` 删除。

### Logo 与市场预览

PACKAGE 类型在 IO 线程读包内嵌 logo（`produceState`，screens/ArtifactPublishScreen.kt:406），logo 卡片可打开 `MarketPublishPreviewDialog`：全屏弹窗，列表/详情双页签，空字段有占位文案（标题空→untitled、版本空→1.0.0），指标全显示 `--`，底部下载按钮 disabled 仅做样式预览（screens/MarketPublishPreview.kt:54）。

### 快捷插件创建器

`runQuickPluginCreatorSetup`（screens/QuickPluginCreatorSetupSupport.kt:25）做三件事：从 jsdelivr 下载 `install_or_update.js` 到 `Download/Operit/skills/SandboxPackage_DEV/scripts/`；启用 `operit_editor` 包；以 `debug_run_sandbox_script` 工具执行下载的脚本（参数 `source_path`）。`PluginCreationIntent`（market/PluginCreationIntent.kt:6）是 Fresh/Continue/Merge 三种意图的 sealed 接口，各自把需求文本拼进给 AI 的创建提示词。

### 仓库 URL 解析（Repo 轨道）

`parseRepoPublishTarget`（screens/market/viewmodel/RepoMarketPublishViewModel.kt:314）接受 `github.com`（含子域名）与 `raw.githubusercontent.com`；路径含 `tree`/`blob` 时取分支名，否则调 GitHub API 取默认分支。请求中 `source.kind="github_repo"`，`refType` 固定 `branch`。

## 关键符号

| 符号 | 位置 | 说明 |
|---|---|---|
| `ArtifactPublishScreen` | screens/ArtifactPublishScreen.kt:139 | Artifact 发布主界面，全新/续发/编辑三模式 |
| `ArtifactMarketViewModel` | screens/artifact/viewmodel/ArtifactMarketViewModel.kt:66 | 发布编排：草稿、冲突检查、进度、Forge 初始化二次确认 |
| `GitHubForgePublishService.publishArtifact` | market/GitHubForgePublishService.kt:93 | 核心发布：校验→建仓→Release→上传→注册，全程 `Dispatchers.IO` |
| `PublishAttemptResult` | market/GitHubForgePublishService.kt:37 | `NeedsForgeInitialization` / `Success` / `RegistrationFailed` |
| `PublishArtifactType` | market/ArtifactMarketModels.kt:44 | SCRIPT（OperitScriptMarket）/ PACKAGE（OperitPackageMarket） |
| `PublishArtifactSource` | market/ArtifactMarketModels.kt:143 | `DirectUpload` 直传 / `GitHubReleaseAsset` 引用已有资产 |
| `PublishProgressStage` | market/ArtifactMarketModels.kt:112 | 8 个发布阶段，界面进度文案来源 |
| `ArtifactPublishClusterContext` | market/ArtifactMarketModels.kt:162 | 续发上下文：entryId、锁定显示名、canEditEntry |
| `buildPublishArtifactDescriptor` | market/ArtifactMarketModels.kt:342 | 组装发布描述符：命名、版本、contentType、API 版本 |
| `buildPublishReleaseDescriptor` | market/ArtifactMarketModels.kt:443 | 生成 Release tag/名/正文 |
| `installArtifactProjectVersion` | market/ArtifactLocalInstallSupport.kt:134 | 市场版本下载、验 sha256、安装到本地 |
| `resolveLocalArtifactInstallState` | market/ArtifactLocalInstallSupport.kt:89 | 五态安装判定 |
| `RepoMarketPublishScreen` | screens/RepoMarketPublishScreen.kt:59 | 仓库引用发布界面（skill/mcp） |
| `RepoMarketPublishViewModel` | screens/market/viewmodel/RepoMarketPublishViewModel.kt:38 | 仓库发布：草稿、URL 解析、版本递增校验 |
| `MarketPublishPreviewDialog` | screens/MarketPublishPreview.kt:54 | 发布前市场效果全屏预览 |
| `runQuickPluginCreatorSetup` | screens/QuickPluginCreatorSetupSupport.kt:25 | 下载并执行沙盒包开发环境安装脚本 |
| `PluginCreationIntent` | market/PluginCreationIntent.kt:6 | Fresh/Continue/Merge 三种插件创建意图 |
| `normalizeMarketArtifactId` | market/ArtifactMarketModels.kt:302 | 包 ID 归一化，市场项目 ID 来源 |
| `OPERIT_FORGE_REPO_NAME` | market/ArtifactMarketModels.kt:11 | `"OperitForge"`，用户账号下的发布仓库名 |

## 调用链

### 链路 1：全新 Artifact 发布（本地直传）

1. **输入**：用户在 `ArtifactPublishScreen` 选本地构件，填显示名/描述/分类/版本，选"本地上传"，点发布（按钮启用要求已登录 GitHub 且字段齐全，screens/ArtifactPublishScreen.kt:1170）。
2. **处理**：确认框核对 → `ArtifactMarketViewModel.requestPublish`（screens/artifact/viewmodel/ArtifactMarketViewModel.kt:209）→ `executePublish` 做登录检查与三重身份冲突检查 → `GitHubForgePublishService.publishArtifact`（market/GitHubForgePublishService.kt:93）：校验文件→`ensureForgeRepository`（无仓则经两步确认建公开仓）→`ensureRelease` 保 tag→`ToolPkgArtifactMinifier` 处理文件→`uploadAssetReplacingExisting` 上传→算处理后字节 sha256。进度经 `PublishProgressStage` 回调到界面进度框。
3. **输出**：`registerMarketEntry` 向市场后端注册（`asset.kind="github_release_asset"`），成功得 `MarketV2Entry(stateCode=pending)`，界面弹成功框、清草稿、返回上一页；注册失败返回 `RegistrationFailed` 展示错误。

### 链路 2：Artifact 续发新版本

1. **输入**：从已发布条目进续发，`ArtifactPublishClusterContext` 锁定显示名与包 ID（贡献者不可改名）。
2. **处理**：`validateContinuationVersion` 拉项目详情要求版本号严格递增（screens/artifact/viewmodel/ArtifactMarketViewModel.kt:457）；其余流程同链路 1，但 `registerMarketEntry` 走 `publishNewVersion(entryId, ...)` 并附差异补丁（`buildNewVersionEntryPatch`）。
3. **输出**：新版本条目（pending），显示名冲突检查跳过（续发不查）。

### 链路 3：引用已有 GitHub Release 资产发布

1. **输入**：资产来源切到"GitHub Release"，填仓库地址，加载 Release 目录，选 tag 与资产。
2. **处理**：`publishArtifact` 走 `PublishArtifactSource.GitHubReleaseAsset` 分支：`getReleaseByTag` 取 Release，按名找资产，下载全部字节算 sha256，`require` 与本地源文件哈希一致（market/GitHubForgePublishService.kt:208）。
3. **输出**：后续注册流程与链路 1 相同，`releaseWasCreated=null`（复用他人 Release）。

### 链路 4：Repo 轨道发布（skill/mcp 仓库引用）

1. **输入**：`RepoMarketPublishScreen` 填标题/描述/仓库 URL/版本/分类（MCP 可填 installConfig）。
2. **处理**：确认框 → `RepoMarketPublishViewModel.publish` → `submit(entryId=null)` → `resolveRepoPublishTarget` 解析仓库与分支（无分支则取默认分支）→ 组装 `MarketV2PublishRequest(source.kind="github_repo")` → `marketStatsApiService.publish`。新版本走 `publishNewVersion`，先 `validateNewVersion` 校验递增。
3. **输出**：`Result<Unit>`，成功清草稿弹不可点外部关闭的成功框。

### 链路 5：从市场安装 Artifact 到本地

1. **输入**：`installArtifactProjectVersion(context, packageManager, projectVersions, version)`。
2. **处理**：`resolveLocalArtifactInstallState` 五态判定（market/ArtifactLocalInstallSupport.kt:89）；需安装则下载到 `cacheDir/market_downloads`（跟随重定向、超时 30s/60s），下载后强制验 sha256；冲突时先 `deletePackage` 再 `addPackageFileFromExternalStorage`，导入返回须以 `Successfully imported` 开头。
3. **输出**：与目标 sha256 一致的本地包；临时文件 `finally` 删除。

## 来源

- `ui-packages-publish.facts.json`（221 条，引用逐条验真）
- `ui-packages-publish.quality.json`（14 条代码走查：1 高危 / 8 警告 / 5 建议）
- 种子：`screens/ArtifactPublishScreen.kt`、`screens/RepoMarketPublishScreen.kt`、`screens/MarketPublishPreview.kt`、`screens/QuickPluginCreatorSetupSupport.kt`、`screens/artifact/viewmodel/ArtifactMarketViewModel.kt`、`screens/market/viewmodel/RepoMarketPublishViewModel.kt`、`market/ArtifactMarketModels.kt`、`market/GitHubForgePublishService.kt`、`market/ArtifactLocalInstallSupport.kt`、`market/PluginCreationIntent.kt`（10 文件约 5450 行，源码钉住 `dbf71916`）
