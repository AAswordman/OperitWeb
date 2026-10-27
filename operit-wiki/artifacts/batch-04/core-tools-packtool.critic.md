# Critic 复核报告：core-tools-packtool（插件包 ToolPkg 管理与解析）

- 复核对象：`review/batch-04/core-tools-packtool.*`
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已核对 `git rev-parse HEAD` 一致）
- 复核方式：181 条 facts 逐条取 ref ±5 行窗口与源码对照；关键符号用 grep 全文件定位真实行号；4 条 quality evidence 全文检索逐字比对；正文结构与 status 人工检查
- **结论：退回修正（系统性引用漂移，断言本身基本为真）**

## 总览

| 项 | 结果 |
|---|---|
| facts 181 条 | **128 条通过 / 46 条引用错位或复合事实 / 7 条窗口边缘（偏差 1–8 行）** |
| quality 4 条 | **4/4 通过**，evidence 均为源码逐字复制，定性与 severity 合理 |
| 正文 .md | §9 结构完整，通过；但调用链 2 处引用继承了 facts 的错位行号 |
| .status.json | **1 处问题**：`source_repo` 为 `Operit`（大写），`check_staleness.py` 只认 `operit`/`wiki`，大写会导致过期检查判 UNKNOWN；batch-03 全部为小写 |
| lint | 0 硬失败 / 0 警告 |

核心问题：writer 的引用行号系统性漂移（偏差 6–124 行），属"凭印象写行号"，不是内容造假。writer 自报"引用铁律校验脚本逐条核（文件存在+行号越界+±5 行内符号）"——实测其脚本只验了文件存在与行号范围，**没有真正验证窗口支撑**（本页 181 条 fact 无一条用反引号标注符号，机械检查形同虚设）。

抽查的断言内容本身基本属实，未发现事实性错误（计数类断言已人工复核：`ToolPkgMainRegistration` 23 个 List 桶 + marketOrigin ✓、`TOOLPKG_REGISTRATION_*` 23 个且值均以 registerToolPkg 开头 ✓、6 个应用生命周期事件 ✓、7 个 Activity 事件 ✓、Kahn 算法 indegree 实现 ✓）。

## 必须修正：46 条引用错位/复合事实（按 facts 数组下标）

| # | 当前 ref | 断言摘要 | 实测与建议 ref |
|---|---|---|---|
| 13 | PackageManager.kt:672 | 初始化序列：清旧缓存→建外部目录→读插件排序→… | 前两步在 :661/:665，窗口 667–677 看不到；建议 ref 改 :665 或拆分 |
| 14 | :859 | 外部包缓存签名由路径、大小、修改时间、版本、main 入口组成 | EXTERNAL 分支在 :831–848；建议 :831 |
| 15 | :877 | assets 包缓存签名由 APK 内 CRC 与大小组成 | crc/size 在 :865–866，窗口 872–882 看不到；建议 :865 |
| 17 | :919 | reconcileToolPkgCaches 保留 assets 与已启用容器缓存 | 函数定义在 :907；建议 :907 |
| 21 | :1233 | 外部包与非内置容器重名报 Duplicate package name | 错误字符串在 :1201；建议 :1201 |
| 22 | :1335 | 外部扫描前经 PluginDenylistRepository.findDeniedImport 检查 | 实际调用在 :1292（经 pluginDenylistRejection）；建议 :1292 |
| 23 | :1327 | 扫描签名混入拒绝名单 cacheSignature 与 API 版本文本 | 在 :1236–1247（buildExternalPackageScanSignature）；建议 :1243 |
| 25 | :2052 | 注册引擎每包全新 JsEngine，finally 中 destroy | withToolPkgRegistrationEngine 在 :2004–2012；建议 :2007 |
| 26 | :2261 | parseJsPackage 从 /* METADATA */ 提取 HJSON 转 JSONObject | 复合：METADATA 正则在 :2467（extractMetadataFromJs），HJSON 转换在 :2258；建议拆两条 |
| 27 | :2320 | normalizeJsPackageMetadata 归一化别名 | 函数定义在 :2337；建议 :2337 |
| 31 | :2540 | importPackageFileFromExternalStorage 支持 4 种文件导入 | 函数定义在 :2507；建议 :2507 |
| 33 | :2640 | 导入成功消息追加市场来源声明 beware of resales | 字符串在 :2660；建议 :2660 |
| 36 | :2860 | installDebugToolPkg 删除重复包、重置子包开关等 | 函数定义在 :2736，偏差 124 行；建议重锚到安装流程的真实行 |
| 37 | :3060 | enablePackage 调 collectRequiredToolPkgPackages 解析 requires | enablePackage 定义在 :3145（collectRequired 在 :3041）；建议 :3145 |
| 41 | :3220 | usePackage 拒绝激活容器本身 | usePackage 定义在 :3246；建议 :3246 |
| 42 | :3260 | usePackage 校验 required 环境变量 | 同上；建议 :3246 |
| 45 | :3464 | 多 state 包按 ConditionEvaluator 选 state | ConditionEvaluator.evaluate 在 :3477；建议 :3477 |
| 46 | :3985 | deletePackage 删子包只做 disable | deletePackage 定义在 :3952；建议 :3952 |
| 47 | :3985 | deletePackage 删容器时移除 map、删缓存、销毁引擎 | 同上；建议 :3952 |
| 54 | ToolPkgParser.kt:324 | ToolPkgMainRegistration 含 23 个注册桶 + marketOrigin | 类定义在 :338（窗口 319–329 是另一个类）；建议 :338 |
| 55 | :402 | parseToolPkgFromIndexedEntries 主流程 | requireSupported 调用在 :418；建议 :418 |
| 61 | :660 | parseMainRegistration 失败则整个包加载失败 | 实际调用在 :695；建议 :695 |
| 67 | :850 | AI Provider 要求 4 个 handler 必填 | 窗口 845–855 是桌面小部件代码；handler 校验在 ToolPkgMainRegistrationScriptParser.kt（parseHandler，约 :615–645）；建议重锚到该文件 |
| 68 | :900 | 解析产出 ToolPackage 的 category 固定为 ToolPkg | 窗口 895–905 是生命周期钩子代码；建议重找 ToolPackage 产出代码行 |
| 70 | :1557 | buildZipEntryIndex 与 buildDirectoryEntryIndex 大小写不敏感查找 | buildZipEntryIndex 定义在 :1477；建议 :1477 |
| 71 | :1614 | normalizeZipEntryPath 拒绝 .. 路径（ZipSlip 防护） | 函数定义在 :1527；建议 :1527（注：源码无 "ZipSlip" 字样，属 writer 定性，可保留但建议 ref 指向函数） |
| 72 | :1684 | extractZipEntriesFromExternal/Asset 跳过 normalize null 条目 | extractZipEntriesFromExternal 定义在 :1669；建议 :1669 |
| 76 | :1815 | resolveLogoResource 要求 key 存在且为文件 | 函数定义在 :1823；建议 :1823 |
| 80 | PackageManagerToolPkgFacade.kt:115 | 导航条目按 surface/order/title 排序 | 窗口 110–120 是 UI 路由排序（title/containerPackageName/uiModuleId）；建议重找导航条目与小部件排序代码 |
| 81 | :252 | getToolPkgContainerDetails 中 toolbox UI 模块仅容器启用时返回 | 函数定义在 :270；建议 :270 |
| 82 | :290 | 子包 enabled = 容器启用且子包在启用集合 | 同上；建议 :270（子包逻辑在函数体内，需确认窗口覆盖） |
| 89 | :577 | setToolPkgSubpackageEnabled 写开关并二次读取校验 | 函数定义在 :562；建议 :562 |
| 96 | :950 | runToolPkgMainHook 中 eventPayload 含 chatId 时注入参数 | runToolPkgMainHook 定义在 :891；chatId 注入逻辑在 :898 附近；建议 :898 |
| 97 | :958 | inlineFunctionSource 非空时注入两个参数 | 同上；建议 :898 |
| 98 | :1062 | 执行上下文 key 缺省为 toolpkg_main:<容器包名> | key 缺省逻辑在 :1041 附近；建议 :1041 |
| 100 | :1033 | runToolPkgNavigationEntryAction 复用 runToolPkgMainHook | TOOLPKG_EVENT_NAVIGATION_ENTRY_ACTION 使用在 :1044；建议 :1044 |
| 105 | ToolPkgMainRegistrationScriptParser.kt:191 | 注册解析失败返回 Failure，错误信息格式 … | buildDeveloperFacingFailureMessage 定义在 :179；建议 :179 |
| 107 | :234 | UI 路由 route 缺省回退 routeId、buildToolPkgRouteId | 回退逻辑在 :252–257；建议 :252 |
| 112 | :560 | AI Provider 4 个 handler 必须为对象且含 function 字段 | parseRegisteredAiProviders 在 :582，handler 解析在 :638–641；建议 :638 |
| 114 | :640 | parseLocalizedText 支持 4 种形态 | 函数定义在 :661；建议 :661 |
| 115 | :620 | parseStringList 接受 JSONArray 或单个字符串 | 函数定义在 :648；建议 :648 |
| 117 | ToolPkgRuntimeMonitor.kt:92 | beginCall 从 params 的 6 个键解析包名 | 6 个键在 resolvePackageName（:366–373），:92 窗口只有函数签名；建议拆两条（:92 说解析失败返回 null，:366 说 6 个键） |
| 140 | ToolPkgLoadOrder.kt:185 | 加载排序用 Kahn 算法 | 比较器在 :185–193，但 Kahn 主体（indegree）在 :199–225；建议 :199 或拆两条 |
| 157 | ToolPkgCommonPluginConstants.kt:11 | 7 个 Activity 生命周期事件常量 | ON_DESTROY 在 :17，窗口 6–16 差 1 行；建议 :12 |
| 159 | :41 | 23 个 TOOLPKG_REGISTRATION_* 常量 | 人工计数验证为真（23 个，值均以 registerToolPkg 开头）；单窗口无法覆盖 41–81 行，建议 ref 锚 :41 并在修错记录注明为人工计数 |
| 179 | ToolPkgHookModels.kt:28 | ToolPkgPromptHookObjectResult 可改写 6 个字段 | 类定义在 :39（窗口 23–33 是另一个类）；建议 :39 |

## 建议顺手修：7 条窗口边缘（偏差 1–8 行）

| # | 当前 ref | 建议 |
|---|---|---|
| 16 | PackageManager.kt:749 | hash 在 :755，窗口 744–754 差 1 行；建议 :750 |
| 18 | :1830 | loadAvailablePackages 定义在 :1839；建议 :1839 |
| 35 | :2730 | installDebugToolPkg 定义在 :2736，差 1 行；建议 :2736 |
| 39 | :3800 | disablePackage 定义在 :3791；建议 :3791 |
| 74 | ToolPkgParser.kt:1735 | findManifestEntry 定义在 :1729，差 1 行；建议 :1729 |
| 93 | PackageManagerToolPkgFacade.kt:716 | getToolPkgResourceOutputFileName 定义在 :708；建议 :708 |
| 99 | :898 | "仅 toolpkg_message_processing 事件记分段耗时"——:898 附近代码需核实窗口是否覆盖该断言 |

## quality.json（4 条，全部通过）

- Q0 warning/high：市场来源自证式声明 + XOR(0x5a) 可逆伪造 —— evidence 逐字命中 `ToolPkgMarketOrigin.kt:50`，XOR_KEY 与编解码逻辑已核实（:17/:25/:39），定性无夸大。
- Q1 suggestion/medium：readToolPkgTextResource 直接查容器未归一化 —— evidence 逐字命中（`toolPkgContainersInternal[target]`），属实。
- Q2 suggestion/medium：工作空间模板导入失败残留目录 —— evidence 逐字命中，mkdirs 后两处 throw 均无清理，属实。
- Q3 suggestion/medium：新旧两套引擎释放 API 混用风险 —— evidence 逐字命中，旧版注释"Kept for existing callers"属实，severity 为 suggestion 措辞恰当（"可能"）。
- 4 条 evidence 均与源码逐字一致（全文检索验证），无虚构。

## 正文（通过，2 处引用需同步）

- §9 结构完整：概述 / ## AI 速览（9 符号清单 + 主入口 + 数据流向一句话）/ 核心机制（4 小节）/ 关键符号 / 调用链（3 条输入→处理→输出三段式）/ 来源。
- 简体中文短句，符号名英文原文，术语首现有解释（ToolPkg、manifest、子包、compose_dsl 等）。
- 来源 18 文件与 seed 一致；概述段 3 处行号引用已抽查（:62/:401/:24 均有效）。
- **需同步修正**：调用链一引用 `PackageManager.kt:2540`（应为 :2507）、调用链二引用 `:3060`（应为 :3145），与 facts [31][37] 同错。

## .status.json（1 处问题）

```json
{"id":"core-tools-packtool","title":"插件包（ToolPkg）管理与解析","issue":23,"status":"review-pending",
 "source_repo":"Operit",  // ← 应为小写 "operit"，否则 check_staleness.py 判 UNKNOWN（batch-03 全部小写）
 "source_commit":"dbf71916fae9750cfdc9f9a774f5a0fee56633fb","critic":""}
```
- id / issue 23 / review-pending / source_commit 正确；critic 留空正确。

## 给 writer 的修正要求

1. 按上表修正 46 条 ref（含 [26][117][140] 的拆分、[67][68][80] 的重找行号）。
2. 顺手修 7 条窗口边缘。
3. 正文调用链两处引用同步修正（:2540→:2507、:3060→:3145）。
4. `.status.json` 的 `source_repo` 改为小写 `operit`。
5. 改完重跑 `scripts/lint.py` 保持 0/0，并对每个新 ref 自查 ±5 窗口支撑，然后通知复检（只需复检本次列出的问题条目）。

## 复检（2026-10-01T14:01 CST，修错后复验）——**通过**

复检方式：源码钉住 commit `dbf71916fae9750cfdc9f9a774f5a0fee56633fb` 已用 `git rev-parse HEAD` 核实；12 处偏离逐条 sed 导出窗口人工核对；[157] 亲自逐数；拆分项 [26][45][67][117][140] 逐条验窗；正文 4 处 grep 核实；196 条 facts 全量程序化校验（文件存在 / 行号不越界 / 每个反引号符号落 ±5 窗口）；单页 lint 隔离重跑。

### 1. 12 处偏离的最终结论——修错员 12 处全对

| # | critic 建议 | 修错员实际 | 亲验结论 |
|---|---|---|---|
| 17 | :907 | :930 | **修错员对**。:930 窗口（925–935）同时覆盖 ASSET 保留、已启用容器合并、删除其余缓存三段逻辑；:907 只是函数定义行。 |
| 31 | :2507 | :2518 | **修错员对**。:2518 窗口（2513–2523）完整覆盖 4 种文件类型判断（.toolpkg/.js/.ts/.hjson）；:2507 只是函数定义。 |
| 35 | :2736 | :2772 | **修错员对**。:2772 窗口（2767–2777）覆盖 canonical 路径校验与"expects file inside external packages dir"报错；:2736 只是函数定义。 |
| 39 | :3791 | :3796 | **修错员对**。:3791 窗口（3786–3796）盖不住 3797 行的错误字符串；:3796 窗口（3791–3801）同时覆盖定义、dependents 检查与错误信息。 |
| 42 | :3246 | :3320 | **修错员对**。:3320 窗口（3315–3325）覆盖 required 环境变量缺失检查与缺失清单构造；:3246 只是 usePackage 定义。 |
| 61 | :695 | :704 | **修错员对**。:704 窗口（699–709）覆盖 Failure→throw IllegalArgumentException；:695 只是调用点。 |
| 74 | :1729 | :1750 | **修错员对**。:1750 窗口（1745–1755）覆盖 manifestEntryPriority 的 0/1/2/3 优先级映射；:1729 是 findManifestEntry 定义。 |
| 93 | :708 | :729 | **修错员对**。:729 窗口（724–734）覆盖 baseName 取最后一段与目录型资源补 .zip 后缀；:708 只是函数定义。 |
| 98 | :1041 | :1062 | **修错员对**。:1062 窗口（1057–1067）覆盖默认 key `toolpkg_main:<容器包名>` 返回；:1041 只是上下文。 |
| 115 | :648 | :652 | **修错员对**。:652 窗口（647–657）同时覆盖 JSONArray 分支、String 分支与 else→emptyList；:648 窗口盖不住 657 行。 |
| 105 | :179 | :191（保持） | **修错员对**。:191 是错误信息格式字符串原文（`main script '…' failed while loading or running registerToolPkg(): …`）；:179 只是 buildDeveloperFacingFailureMessage 签名，critic 建议有误。 |

规律：critic 建议多为"函数定义行"，修错员改用"证据行"——引用铁律下修错员的选择更合规。

### 2. [157] 事实错误修正——属实

亲手逐数 `ToolPkgCommonPluginConstants.kt`：Activity 生命周期常量确为 **6 个**（ON_CREATE/ON_START/ON_RESUME/ON_PAUSE/ON_STOP/ON_DESTROY，11–16 行）。critic 原报告"7 个 ✓"是把 APPLICATION_ON_CREATE 等也数进去了（grep 粗数得 7 含应用级）。修错员改述为 6 个正确。

### 3. 拆分项抽查（5 处全部通过）

- [26]：:2467（METADATA 正则）/:2258（HJSON→JSONObject）✓
- [45]：:3476（ConditionEvaluator.evaluate）/:3533（能力快照）✓
- [67]：:639（4 个 handler 解析）/:610（parseHandler 缺失抛错）✓
- [117]：:92（beginCall 定义）/:369（6 个键 resolvePackageName）✓
- [140]：:192（同级比较器）/:201（Kahn indegree）✓

### 4. 其余改动条目抽查（20+ 条全部通过）

idx22(:1201 Duplicate package name)、idx23(:1292 拒绝名单检查)、idx29(:2337 normalizeJsPackageMetadata)、idx35(:2660 beware of resales)、idx42(:3158 enablePackage)、idx54(:3993 deletePackage)、idx80(:1477)、idx81(:1527 ZipSlip)、idx86(:1823)、idx99(:562)、idx111(:1044)、idx174(:41 23 常量)——窗口均完全支撑断言。

### 5. 正文 4 处——全部到位

- 第 68 行 `enablePackage` :3060→:3158 ✓
- 第 90 行四函数 :3145/:3791/:3246/:3952 ✓
- 调用链一 :2540→:2507 ✓、调用链二 :3060→:3145 ✓
- （注：正文第 68 行 `disablePackage` 用 :3800，facts 用 :3796，两窗口均有效，非问题）

### 6. 程序化与 lint

- 196 条 facts 全量校验：文件存在、行号不越界、每个反引号符号落 ±5 窗口——**196/196 通过，0 失败**。
- 单页隔离 lint：**0 硬失败 / 0 警告**。
- status.json：`source_repo: "operit"` 小写 ✓，issue 23 ✓，review-pending ✓，commit 钉住 ✓。

**未通过条目：无。本页已达收货标准，可进入发布队列。**
