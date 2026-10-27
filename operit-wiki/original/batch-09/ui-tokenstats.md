---
title: Token 用量统计界面
module: UI / 统计
sources: 16
date: 2026-10-01
issue: 113
---

# ui-tokenstats（Token 用量统计界面）

> 种子：`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/`（9 个 Kotlin 文件、约 4,700 行）@ `dbf71916`；另补 `app/src/main/java/com/ai/assistance/operit/ui/features/token/` 下 7 个文件（URL 配置与 DeepSeek 密钥 WebView 自动化）

> 覆盖 Token 消耗统计页：周期总览、2×2 核心指标、每日/每周/累计活跃记录、Token 构成、模型排名、模型筛选、趋势图表、配置级定价编辑、币种与汇率设置。数据聚合由数据层的统计查询服务完成，本页只负责展示与交互。

## 概述

Token 用量统计界面回答"我的 Token 花到哪去了"：把日期范围、模型筛选、币种、汇率等条件发给统计查询服务做聚合，拿到结果后渲染卡片与图表。

"Token"指大模型按量计费的基本单位，输入、缓存读取、输出分别计价；"累计"指从有记录的第一天到今天的全部历史。

图表全部用纯 Compose Canvas 自绘，不引入第三方图表库（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsCharts.kt:65`）。

另有一块 DeepSeek 密钥管理功能（`token/` 包）：用户在 WebView 里登录 DeepSeek 开放平台，App 用注入的 JS 脚本自动调用平台的密钥管理 API（查 / 删密钥），密钥列表通过 `@JavascriptInterface` 回调进原生层；目标站点可配置（默认 DeepSeek，另有 Claude / ChatGPT / Gemini / Poe 四套预设）。详见核心机制 §7。

页面按信息架构重构过，固定 10 段：时间控制 → 周期总览 → 2×2 核心指标 → 活跃记录 → Token 构成 → 模型累计 → 范围分析 → 趋势分析 → 配置详情 → 统计设置（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsScreen.kt:68`）。

## AI 速览

- **核心符号清单**：
  - `TokenUsageStatisticsScreen`（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsScreen.kt:73`）
  - `TokenUsageStatisticsViewModel`（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:72`）
  - `TokenStatsUiState`（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:47`）
  - `TokenStatsStackedBarChart`（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsCharts.kt:79`）
  - `TokenStatsLineChart`（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsCharts.kt:261`）
  - `TokenStatsAreaChart`（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsCharts.kt:438`）
  - `TokenActivitySection`（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenActivitySection.kt:79`）
  - `activityRangeForMode`（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/ActivityDateRangePolicy.kt:15`）
  - `validateCustomRange`（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/CustomRangePolicy.kt:13`）
  - `PriceSettingsDialog`（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsDialogs.kt:192`）
  - `tokenStatsColors`（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsColors.kt:75`）
  - `UrlConfig`（`app/src/main/java/com/ai/assistance/operit/ui/features/token/model/UrlConfig.kt:20`，默认 DeepSeek 四页签配置）
  - `UrlConfigManager`（`app/src/main/java/com/ai/assistance/operit/ui/features/token/preferences/UrlConfigManager.kt:19`，`url_config` DataStore + Claude/ChatGPT/Gemini/Poe 预设）
  - `UrlConfigDialog`（`app/src/main/java/com/ai/assistance/operit/ui/features/token/components/UrlConfigDialog.kt:31`，URL 配置编辑弹窗）
  - `DeepseekApiConstants`（`app/src/main/java/com/ai/assistance/operit/ui/features/token/network/DeepseekApiConstants.kt:5`，平台 URL 与密钥 API 端点常量）
  - `WebViewConfig`（`app/src/main/java/com/ai/assistance/operit/ui/features/token/webview/WebViewConfig.kt:20`，预配置 WebView 工厂）
  - `DeepseekJsInterface`（`app/src/main/java/com/ai/assistance/operit/ui/features/token/webview/DeepseekJsInterface.kt:15`，JS→原生回调桥）
  - `JsScripts`（`app/src/main/java/com/ai/assistance/operit/ui/features/token/webview/JsScripts.kt:4`，密钥查/删/抓 token 的注入脚本）
- **主入口**：入场时 `LaunchedEffect` 调 `loadForEntry()`（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsScreen.kt:96`）。
- **数据流向一句话**：用户操作 → ViewModel 更新状态并持久化 → 并发查询 → `state`（`StateFlow`）经 `asStateFlow` 发射 `TokenStatsUiState` → Compose 重组（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:86`）。

## 核心机制

### 1. ViewModel 的状态与加载

`TokenStatsUiState` 是页面唯一真相源（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:47`）。

`targetCurrency` 默认 `PricingCurrency.CNY`（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:54`）。

`tokenDisplayUnit` 默认 `TokenStatsDisplayUnit.MILLIONS`，即百万单位（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:55`）。

`selectedModels` 默认空集，空集表示全选（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:58`）。

`load()` 调 `loadInternal` 时不恢复视图模式（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:101`）。

`loadForEntry()` 调 `loadInternal` 时从设置恢复上次的活跃视图模式（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:103`）。

`loadInternal` 先取消旧 `loadJob`（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:156`）。

`loadGeneration` 递增版本号，过期协程直接 return，只有最新加载能写 state（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:157`）。

一次加载在 `coroutineScope` 内并发多路 `Dispatchers.IO` 查询（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:179`）。

全局 lifetime 查询不带 `providerModels` 筛选（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:190`）。

无模型筛选时"可用模型"查询直接返回 null，不发请求（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:203`）。

活跃快照经 `TokenActivityAggregator.rangeData` 聚合（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:238`）。

默认日期范围是最近 30 天：今天-29 天零点起到明天零点止（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:429`）。

自定义范围上限 `MAX_CUSTOM_RANGE_DAYS` 为 3*366 天，约 3 年（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:416`）。

`actionMessage` 以 `StateFlow` 对外暴露操作结果消息（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:89`）。

### 2. 三段式活跃视图与日期策略

`TokenStatsSegmentedControl` 渲染每日/每周/累计三段（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsComponents.kt:216`）。

`setActivityViewMode` 用 `activityRangeAnchorDate` 从当前范围取锚定日期（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:108`）。

`activityRangeForMode` 按模式算新区范围：每日=锚定日当天（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/ActivityDateRangePolicy.kt:15`）。

每周模式按 `(dayOfWeek.value % 7)` 回退到周日对齐（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/ActivityDateRangePolicy.kt:22`）。

累计模式无历史起点时返回 null，不切换（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/ActivityDateRangePolicy.kt:25`）。

累计模式查询 `earliestOccurredDate` 作为累计起点（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:113`）。

新模式经 `settings.saveActivityViewMode` 持久化（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:124`）。

新区范围经 `settings.saveTimeRange` 持久化，下次进页面恢复（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:125`）。

`TokenStatsDateRangeDialog` 是日期范围选择弹窗，最大宽 360.dp（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsDialogs.kt:68`）。

起止颠倒时返回 `INVALID_BOUNDS`（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/CustomRangePolicy.kt:19`）。

起止天数超过上限时返回 `TOO_LONG`（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/CustomRangePolicy.kt:21`）。

超长但与当前范围完全一致的自定义范围被视为合法 no-op，避免选不回去（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:317`）。

### 3. 图表体系：纯 Canvas + 手势仲裁

`TokenStatsStackedBarChart` 是 internal 堆叠柱状图（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsCharts.kt:79`）。

`TokenStatsLineChart` 是 internal 折线图（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsCharts.kt:261`）。

`TokenStatsAreaChart` 是 internal 面积折线图（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsCharts.kt:438`）。

交互契约：点击与水平拖动才选中/切换桶详情（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsCharts.kt:68`）。

垂直手势不消费，`LazyColumn` 纵向滚动不受影响（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsCharts.kt:70`）。

桶详情以图表下方的 tooltip 卡片呈现，无悬浮层不遮挡内容（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsCharts.kt:71`）。

折线图无有效样本的桶不画点、线段断开（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsCharts.kt:259`）。

`lineSegments` 遇到 null 断段，每段只连接相邻有效点（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsCharts.kt:859`）。

面积填充用主色 0.26 透明度到透明的纵向渐变（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsCharts.kt:564`）。

`bucketTimeLabel` 中 TEN_MINUTES/HOURLY 粒度显示 HH:mm（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsCharts.kt:770`）。

DAILY 粒度桶标签显示 MM/dd（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsCharts.kt:772`）。

`niceCeil` 把 Y 轴数值向上取整到漂亮刻度（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsCharts.kt:804`）。

`previousBucketIndex` 在已到最前或无桶时返回 null，即边界禁用（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsCharts.kt:841`）。

`nextBucketIndex` 在已到最后或无桶时返回 null（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsCharts.kt:845`）。

### 4. 活跃记录：热力图 / 周柱 / 累计线

按 `viewMode` 分发：每日热力图、每周柱状、累计折线（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenActivitySection.kt:130`）。

模式切换用 150ms `Crossfade` 过渡（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenActivitySection.kt:104`）。

热力图网格与星期标签按周一到周日排列，此前周日首列偏移导致错行已修正（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenActivitySection.kt:150`）。

`levelColor` 中 level 0 取 `heatmapInactive` 灰格，1..5 取主色透明度阶（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenActivitySection.kt:166`）。

`heatmapLevels` 为主色 5 档透明度：0.16/0.34/0.54/0.76/1.0（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsColors.kt:102`）。

热力图查看/滚动仲裁的速度阈值 `HEATMAP_VIEW_SPEED_DP_PER_S` 为 150f（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenActivitySection.kt:683`）。

标题栏右侧展示当前连续/最长连续天数胶囊（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenActivitySection.kt:94`）。

每周模式用 `TokenActivitySeriesStyle.BAR` 风格（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenActivitySection.kt:497`）。

累计模式用 `TokenActivitySeriesStyle.LINE` 风格（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenActivitySection.kt:524`）。

### 5. 模型筛选、定价编辑与统计设置

模型筛选可选项包含"已被选中但被筛选出当前结果的模型"，避免选中项消失（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsComponents.kt:810`）。

`toggleModel` 切换选中模型后重载（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:339`）。

`selectAllModels` 清空选中即全选（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:349`）。

配置详情按 Token 降序列出模型配置（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsComponents.kt:915`）。

`deletePrice` 对 CONFIG 作用域调 `resetConfigPrice`（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:390`）。

非 CONFIG 作用域调 `restoreBuiltInPrice` 恢复内置定价（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:392`）。

定价校验允许空字段（=用内置/继承），填了就必须有限且 ≥ 0（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsDialogs.kt:245`）。

CONFIG 作用域要求 `configId` 非空才可保存（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsDialogs.kt:249`）。

`mergePriceSettings` 中配置级定价覆盖模型级（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsComponents.kt:1449`）。

币种下拉遍历 `PricingCurrency.entries`（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsComponents.kt:783`）。

只有目标币种为 CNY 时才显示美元→人民币汇率编辑行（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsComponents.kt:1294`）。

`setManualRate` 拒绝非有限或 ≤ 0 的汇率（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:363`）。

### 6. 配色：中性容器 + 主色强调

`tokenStatsColors` 从 `MaterialTheme.colorScheme` 构建配色（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsColors.kt:75`）。

`visibleAccent` 在主色与容器对比度不足 3 时回退到内容色，保证数字可读（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsColors.kt:126`）。

`TokenStatsColorsProvider` 用 `CompositionLocalProvider` 下发配色（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsColors.kt:142`）。

### 7. DeepSeek 密钥管理：URL 配置 + WebView 自动化

这块功能解决"在 App 里管 DeepSeek API 密钥"：用户不用去浏览器，App 内嵌 WebView 打开 DeepSeek 开放平台，登录后 App 自动注入 JS 去调平台的密钥管理接口，把密钥列表抓回原生层展示，还能一键删除。

配置层：`UrlConfig` 是个可序列化的数据类——配置名、登录 URL、4 个标签页（标题+URL），默认就是 DeepSeek 的四页（API keys / 用量 / 充值 / 个人中心），标题走字符串资源所以跟随系统语言。
`app/src/main/java/com/ai/assistance/operit/ui/features/token/model/UrlConfig.kt:20`

`UrlConfigManager` 把配置存进名叫 `url_config` 的 DataStore（单键存 JSON）；还内置了 Claude / ChatGPT / Gemini / Poe 四套预设，英文 tab 标题会自动映射成本地化文案。`UrlConfigDialog` 是编辑这个配置的弹窗：配置名、登录 URL、4 个 tab 的标题/URL，确认即组装新 `UrlConfig` 回调 `onSave`。
`app/src/main/java/com/ai/assistance/operit/ui/features/token/preferences/UrlConfigManager.kt:19`

`DeepseekApiConstants` 集中放 DeepSeek 的 URL：登录页、用量页、密钥页，以及三个密钥管理 API 端点（查 `/api/v0/users/get_api_keys`、建、删）。
`app/src/main/java/com/ai/assistance/operit/ui/features/token/network/DeepseekApiConstants.kt:5`

自动化层：`WebViewConfig.createWebView` 造一个"全开"的 WebView——JS、DOM 存储、文件访问全开，混合内容放行，UA 伪装成 Chrome 移动版（防 Google 登录拦截），弹窗劫持后普通链接强制在当前 WebView 内打开、支付类协议（alipays:/weixin: 等）才跳外部应用。
`app/src/main/java/com/ai/assistance/operit/ui/features/token/webview/WebViewConfig.kt:20`

`JsScripts` 是注入的 JS 工具箱：`getApiKeysScript` 先从 localStorage/sessionStorage 找登录 token，带着 `Authorization: Bearer` 去 GET 密钥列表接口，从 `data.api_keys`（或 `data.biz_data.api_keys`）里只摘出 name / sensitive_id / created_at / last_use / tracking_id，经 `Android.onKeysReceived` 一次性回传；`deleteKeyScript(trackingId)` 发 POST 删密钥，按返回 `code === 0` 判成功；`injectTokenExtractorScript` 则劫持 `window.fetch`，把页面发出的 Bearer token 抓下来存进 localStorage 供后续复用。
`app/src/main/java/com/ai/assistance/operit/ui/features/token/webview/JsScripts.kt:45`

`DeepseekJsInterface` 是 JS→原生的回调桥，四个 `@JavascriptInterface` 方法（收到密钥列表 / 密钥已创建 / 密钥已删除 / 出错）各自 try/catch，异常统一走 `onError`。
`app/src/main/java/com/ai/assistance/operit/ui/features/token/webview/DeepseekJsInterface.kt:15`

注意：这套自动化的安全代价不小——JS 里硬编码了一个备用 Bearer token、WebView 全局开了调试开关与混合内容，具体见代码走查。

## 关键符号

- `TokenUsageStatisticsScreen` — 页面 @Composable 入口（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsScreen.kt:73`）
- `TokenUsageStatisticsViewModel` — 状态持有与加载编排（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:72`）
- `TokenStatsUiState` — 页面唯一真相源（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:47`）
- `loadForEntry` — 入场加载，恢复视图模式（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:103`）
- `setActivityViewMode` — 切换每日/每周/累计并重算范围（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:105`）
- `setCustomRange` — 校验并保存自定义范围（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:303`）
- `MAX_CUSTOM_RANGE_DAYS` — 自定义范围上限（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:416`）
- `TokenStatsTrendCard` — 趋势分析单卡片指标切换（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsScreen.kt:464`）
- `TokenStatsStackedBarChart` — 堆叠柱状图（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsCharts.kt:79`）
- `TokenStatsLineChart` — 折线图（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsCharts.kt:261`）
- `TokenStatsAreaChart` — 面积折线图（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsCharts.kt:438`）
- `TokenActivitySection` — 活跃记录卡（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenActivitySection.kt:79`）
- `activityRangeForMode` — 按视图模式算日期范围（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/ActivityDateRangePolicy.kt:15`）
- `validateCustomRange` — 自定义范围校验（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/CustomRangePolicy.kt:13`）
- `TokenStatsDateRangeDialog` — 日期范围弹窗（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsDialogs.kt:68`）
- `PriceSettingsDialog` — 定价编辑弹窗（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsDialogs.kt:192`）
- `tokenStatsColors` — 配色构建（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsColors.kt:75`）
- `niceCeil` — Y 轴漂亮刻度（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsCharts.kt:804`）
- `lineSegments` — 折线分段，null 断段（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsCharts.kt:859`）
- `UrlConfig` — 站点配置（名/登录 URL/4 tab），默认 DeepSeek（`app/src/main/java/com/ai/assistance/operit/ui/features/token/model/UrlConfig.kt:20`）
- `UrlConfigManager` — 配置的 DataStore 读写 + 四预设（`app/src/main/java/com/ai/assistance/operit/ui/features/token/preferences/UrlConfigManager.kt:19`）
- `UrlConfigDialog` — URL 配置编辑弹窗（`app/src/main/java/com/ai/assistance/operit/ui/features/token/components/UrlConfigDialog.kt:31`）
- `DeepseekApiConstants` — DeepSeek URL 与密钥 API 端点常量（`app/src/main/java/com/ai/assistance/operit/ui/features/token/network/DeepseekApiConstants.kt:5`）
- `WebViewConfig.createWebView` — 预配置 WebView 工厂（`app/src/main/java/com/ai/assistance/operit/ui/features/token/webview/WebViewConfig.kt:20`）
- `DeepseekJsInterface` — JS→原生回调桥（`app/src/main/java/com/ai/assistance/operit/ui/features/token/webview/DeepseekJsInterface.kt:15`）
- `JsScripts` — 注入脚本：查密钥 / 删密钥 / 抓 token（`app/src/main/java/com/ai/assistance/operit/ui/features/token/webview/JsScripts.kt:4`）

## 调用链

**入场加载**：输入=页面进入 → 处理=`loadForEntry` 读设置并发查询 → 输出=发射新状态，三态渲染（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsScreen.kt:96`）。

**切换活跃视图**：输入=点三段式 → 处理=`setActivityViewMode` 重算范围并持久化 → 输出=图表 Crossfade 切换（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:105`）。

**筛选模型**：输入=下拉勾选 → 处理=`toggleModel` 更新选中并映射为 provider 模型集合 → 输出=范围数据与图表按筛选刷新（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:339`）。

**改定价**：输入=编辑价格保存 → 处理=`savePrice` 校验并持久化 → 输出=费用按新定价重算（`app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt:371`）。

**拉取 DeepSeek 密钥**：输入=用户在 WebView 里登入 DeepSeek 平台 → 处理=`JsScripts.getApiKeysScript` 带 Bearer token 调 `DEEPSEEK_GET_API_KEYS_URL`，只摘 name/sensitive_id/created_at/last_use/tracking_id → 输出=`Android.onKeysReceived` 回调进原生层展示（`app/src/main/java/com/ai/assistance/operit/ui/features/token/webview/JsScripts.kt:89`）。

**删 DeepSeek 密钥**：输入=用户点删除某密钥 → 处理=`JsScripts.deleteKeyScript(trackingId)` POST 删密钥接口 → 输出=按 `data.code === 0` 经 `Android.onKeyDeleted` 回调成功与否（`app/src/main/java/com/ai/assistance/operit/ui/features/token/webview/JsScripts.kt:167`）。

## 来源

- `app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/ActivityDateRangePolicy.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/CustomRangePolicy.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenActivitySection.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsCharts.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsColors.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsComponents.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenStatsDialogs.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsScreen.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/tokenstats/TokenUsageStatisticsViewModel.kt`
- `app/src/main/java/com/ai/assistance/operit/ui/features/token/components/UrlConfigDialog.kt`（163 行）：URL 配置编辑弹窗
- `app/src/main/java/com/ai/assistance/operit/ui/features/token/model/UrlConfig.kt`（44 行）：站点配置数据类（默认 DeepSeek）
- `app/src/main/java/com/ai/assistance/operit/ui/features/token/network/DeepseekApiConstants.kt`（14 行）：DeepSeek URL 与密钥 API 端点常量
- `app/src/main/java/com/ai/assistance/operit/ui/features/token/preferences/UrlConfigManager.kt`（119 行）：URL 配置的 DataStore 读写与预设
- `app/src/main/java/com/ai/assistance/operit/ui/features/token/webview/DeepseekJsInterface.kt`（57 行）：JS→原生回调桥
- `app/src/main/java/com/ai/assistance/operit/ui/features/token/webview/JsScripts.kt`（324 行）：注入脚本（查/删密钥、抓 token）
- `app/src/main/java/com/ai/assistance/operit/ui/features/token/webview/WebViewConfig.kt`（223 行）：预配置 WebView 工厂
