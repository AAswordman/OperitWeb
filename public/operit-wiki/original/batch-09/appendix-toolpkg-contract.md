---
title: ToolPkg 容器契约
module: 附录
sources: 5
date: 2026-10-03
issue: 155
---

# appendix-toolpkg-contract（ToolPkg 容器契约）

> 种子：`core/tools/packTool/ToolPkgParser.kt`（容器解析）、`core/tools/packTool/ToolPkgApiVersion.kt`（版本模型）、`core/tools/javascript/JsToolPkgApiRuntime.kt`（版本门禁运行时）、`core/tools/javascript/JsToolPkgRegistration.kt`（注册入口）@ `dbf71916`

> 一句话：ToolPkg 是装插件的**容器格式**（`.toolpkg` = ZIP + `manifest.json/hjson` + `registerToolPkg()` 主入口），老式 JS 沙盒包在里面是当 subpackage 装进去的。这页只写容器的契约：解析器保证什么、违反会怎样。

## 概述

人话：如果说 JS 沙盒包是"一页纸的合同"，ToolPkg 就是"带附件的文件夹"：一个 ZIP 里装着清单（manifest）、主入口脚本、子包、资源文件、甚至 WASM 模块。宿主拿到 ZIP 后按固定顺序验货——清单找不到、ID 为空、入口缺失、API 版本不兼容，任何一步不过就整个包拒收。

跟其他页的关系：`appendix-plugin-contract`（插件开发契约手册）讲的是**老式单文件 JS 包**的契约；**本页讲新容器格式**的契约。两者都满足时，一个 ToolPkg 才能被加载。

## AI 速览

- **核心符号清单**：`parseToolPkgFromIndexedEntries`（容器解析）、`ToolPkgManifest`（清单模型）、`ToolPkgApiVersion`（版本模型）、`requireSupported`（版本准入）、`buildToolPkgApiRuntimeScript`（版本门禁运行时）、`registerToolPkg*`（注册入口族）。
- **主入口**：`ToolPkgParser.parseToolPkgFromIndexedEntries(…)`（`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgParser.kt:402`）。
- **数据流向一句话**：`.toolpkg`（ZIP）→ 找 `manifest.hjson/json` → 解析 `ToolPkgManifest` → 校验 `api_version` 准入 → 校验 `toolpkg_id` / `main` → 加载子包（普通 JS 包解析）→ 执行主入口 `registerToolPkg()` 注册 Hook / UI / 菜单。

## 契约 1：manifest 发现

- **条款**：解析器在 ZIP 条目里找 `manifest.hjson` 或 `manifest.json`（大小写不敏感，`ToolPkgParser.kt:1764-1768`），找不到 → 直接抛 `IllegalArgumentException("manifest.hjson or manifest.json not found")`（`:413`），整个包拒收。
- **条款**：manifest 内容按 Hjson/JSON 解析为 `ToolPkgManifest`（`:1771`），字段用 snake_case（`toolpkg_id`、`api_version`、`enabled_by_default`…，`:202-218`）。

## 契约 2：必填字段

- **条款**：`toolpkg_id` 去空白后不得为空，否则抛 `"manifest.toolpkg_id is required"`（`:422-423`）。它是容器包的稳定身份，也是依赖、Hook 上下文、资源解析的 key——改 ID 等于换包。
- **条款**：`main` 不得为空且指向的条目必须在 ZIP 里存在，否则抛 `"manifest.main is required"` / `"Cannot find manifest.main entry"`（`:424-428`）。主入口脚本必须导出 `registerToolPkg()`。
- **条款**：`api_version` 缺省为 `LEGACY_API_VERSION`（`:205`）；`schema_version` 缺省为 `1`（`:202`）——它只是 manifest 数据格式标识，不等于 API 版本。
- **条款**：`enabled_by_default` 缺省为 **`true`**（`:213`）——注意和老式 JS 包的 `enabledByDefault` 缺省 `false` 相反，别搞混。

## 契约 3：api_version 版本准入

- **条款**：`api_version` 必须是严格的 `major.minor.patch` 格式（`ToolPkgApiVersion.kt`：`^(\d+)\.(\d+)\.(\d+)$`），格式不对 → 解析时抛错。
- **条款**：`ToolPkgApiCompatibility.requireSupported(manifest.apiVersion)`（`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgParser.kt:418`）——宿主不支持的 API 版本直接拒收。版本门禁是**加载时**的，不是调用时的。

## 契约 4：subpackages（子包）

- **条款**：`subpackages[]` 每项 `{id, entry}`（`:221-224`），`entry` 指向的子包脚本**必须能解析为普通 JS 工具包**（走老式 `parseJsPackage` 流程）。
- **条款**：单个子包无效 → 记录该包加载错误并**跳过**；但如果 manifest 声明了子包却**一个都没加载成功** → 容器包解析失败。——"全军覆没"才算失败，个别掉队只记错。

## 契约 5：主入口注册

- **条款**：主入口脚本执行后，宿主调用其导出的 `registerToolPkg()` 收集注册声明（`JsToolPkgRegistration.kt`）。可注册：UI 模块（`registerToolPkgToolboxUiModule`）、UI 路由（`registerToolPkgUiRoute`）、导航入口、桌面小部件、聊天消息菜单项（`registerToolPkgChatMessageMenuItem`）等。
- **条款**：**不要在注册函数里启动常驻逻辑**——注册阶段只收集声明，Hook 回调在后续事件中执行。这条和 Pi 的 extension 契约（factory 里不许起长驻资源）是同一条军规。

## 契约 6：API 版本门禁（运行时）

- **条款**：`JsToolPkgApiRuntime` 把 API 包装成版本化方法：`method().since("1.0.1", impl).build("ToolPkg.xxx")`（`JsToolPkgApiRuntime.kt` 的 `buildToolPkgApiRuntimeScript`）。调用时按当前 `manifest.api_version` 选择满足 `since <= current` 的最新实现（`selectVariant`）。
- **条款**：当前版本低于方法引入版本 → 抛错 `"xxx requires ToolPkg API 1.0.1, but manifest.api_version is …"`（`unsupported`）。——**想用新 API，先把 manifest 的 `api_version` 抬上去**，否则调了就炸。
- **条款**：`@since` 注释、类型存在、运行时门禁是三件不同的事；只有被 `JsToolPkgApiRuntime` 明确包装的成员才会在调用时做版本校验。

## 来源

- `app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgParser.kt`：`ToolPkgManifest` 模型（:202-218）、`parseToolPkgFromIndexedEntries`（:402）、manifest 缺失抛错（:413）、`requireSupported`（:418）、`toolpkg_id`/`main` 必填（:422-428）、manifest 文件名匹配（:1764-1771）
- `app/src/main/java/com/ai/assistance/operit/core/tools/packTool/ToolPkgApiVersion.kt`：严格 `major.minor.patch` 解析
- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgApiRuntime.kt`：`buildToolPkgApiRuntimeScript`（`method()`/`since()`/`build()`、`selectVariant`、`unsupported`）
- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsToolPkgRegistration.kt`：`registerToolPkg*` 注册入口族
- `app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt`：容器与老式包解析的衔接（:2062）
