# Critic 复核报告：core-tools-websession-userscript（网页会话·用户脚本引擎）

- 复核人：独立 critic（与 writer 无关）
- 源码版本：Operit @ `dbf71916fae9750cfdc9f9a774f5a0fee56633fb`（已用 `git rev-parse` 确认）
- 复核时间：2026-10-01
- 结论：**有条件通过 —— 1 条事实引用精度违规，必须退回修正；另有 2 处建议修正**

## 1. facts.json 核验（80 条）

方法：脚本全量跑（文件存在 → 行号在总行数内 → ±5 行窗口含断言符号/关键词）。
其中 64 条自动命中通过；11 条因 token 提取 artifact 未命中、5 条纯中文断言，转人工逐条读窗口核验，**全部通过**。

- 通过：79 条
- 失败：1 条（见 §4 退回清单）

核验中确认的关键数字：capability 注册表共 33 条（`UserscriptCapability(` 34 次出现含 1 次 data class 声明，实际 33 条目；其中 `canonicalGrant = "GM.*"` 28 条，余下为 unsafeWindow、window.close/focus/onurlchange、none，合计 33，与事实 [22] 一致）。

## 2. 正文（.md）核验

- 结构：`概述 / AI 速览 / 核心机制 / 关键符号 / 调用链 / 来源` 齐全（另有 `关联条目`，允许）。
- `AI 速览`：核心符号清单、主入口（`attachSession(sessionId, webView)`）、数据流向一句话，齐全。
- 正文断言 vs facts：逐段对照，**未发现超出 facts 的断言**。正文中几处 facts 未逐字覆盖的综合表述（`hasGrant` 门禁、`gm_open_in_tab`/`gm_download` 处理器、安装预览→确认→落盘流程），已直接对源码验证属实：
  - `hasGrant` 见 `UserscriptBootstrapScript.kt:344` 起；
  - `"gm_open_in_tab"` 见 `WebSessionUserscriptManager.kt:717`，`"gm_download"` 见 `:786`；
  - `prepareInstallPreview` 见 `UserscriptRepository.kt:86`，`install` 见 `:133`。
- 关键符号签名全部核对源码一致：`attachSession:189`、`interceptWebRequest:449`、`documentStartScript:6`、`handleBridgeMessage:532`、`resolve:79`、`UserscriptCookieService.list:44`、`matches:7`、`isConnectAllowed:36`（正文写 :38，±5 内，可接受）。
- 正文行号抽查（:207/:215/:544/:552/:579/:717/:781/:786/:307/:321/:83/:108）全部命中真实代码行。

## 3. quality.json 走查核验（4 条）

4 条证据行号**全部属实**，结论成立：

1. **高危 · 桥接消息无来源与授权校验**：属实。`WebSessionUserscriptManager.kt:215` `addWebMessageListener(..., setOf("*"), ...)` 对所有源注册；`handleBridgeMessage`（:532 起）分发头无 grant 校验。置信度 high 合理。
2. **中 · 安装原子性**：属实。`UserscriptRepository.kt:133` `install()` 内 `insertUserscript/updateUserscript`（~:181/:183）在前，`fetchAndCacheResources`（~:188）在后，无回滚。
3. **低 · iframe 可写共享存储**：属实。`"script_status"` 分支（:579）有 `if (!isMainFrame) return`，`"storage_set"`（:641）无该检查。
4. **低 · 日志全量重写**：属实。`log()`（:346）每次调用 `store.trimLogs(LOG_LIMIT)`，`trimLogs` 全量 `writeLogState`。

## 4. 退回清单（必须修正）

### 必须修正 ❌

**[42] 事实引用行号超出 ±5 窗口，违反引用铁律**

- 事实原文：`相对路径的 @require/@resource 按脚本来源 URL 做 URI.resolve`
- 当前引用：`.../storage/UserscriptRepository.kt:578`
- 问题：:578 是 `resolveRemoteUrl` 函数签名行，±5 窗口（573–583）内**看不到** `URI.resolve` 调用；实际调用在 **:591**（`return URI(base).resolve(trimmed).toString()`），超出窗口 13 行。断言本身为真，但引用不合规。
- 修正：ref 改为 `.../storage/UserscriptRepository.kt:591`。

### 建议修正 ⚠️（不阻塞，但建议顺手改）

1. **[64] 事实引用只锚定了事件序列起点**：事实`XHR 用 OkHttp 在原生侧发出，事件按 readystatechange → progress → load → loadend 回调页面`引用 `:1242`；OkHttp 发起 `requestClient.newCall(requestBuilder.build())` 在 `:1233`，在 ±5 窗口（1237–1247）之外。建议将 ref 改为 `:1233`（窗口 1228–1238 内同时可见 newCall 与首个 postXhrEvent），或拆成两条事实。
2. **正文 `关联条目` label 与兄弟页实际标题不一致**：`[[core-tools-websession-browser|网页会话·浏览器内核]]`，而该页实际标题为`网页会话·浏览器宿主`。建议 label 改为`网页会话·浏览器宿主`。

## 5. 汇总

| 项 | 结果 |
|---|---|
| facts 引用核验 | 79/80 通过，1 条引用精度违规（[42]）|
| 正文 vs facts | 无超纲断言，AI 速览齐全 |
| 走查证据 | 4/4 属实 |
| 退回 | [42] 必须修正 ref :578 → :591；另有 2 处建议 |

**critic 结论：退回修正 [42] 后可视为通过。** 其他 79 条事实、全部走查证据、正文结构均达标。

## 修正记录（2026-10-01）
- idx42 ref 改为 UserscriptRepository.kt:591（URI.resolve 调用处，已验真）。
- idx64 拆成两条：OkHttp 原生发出→:1233（newCall）；事件回调序列→:1242。
- 正文关联条目 label「网页会话·浏览器内核」→「网页会话·浏览器宿主」，与兄弟页标题一致。
- 修正后 lint 重跑：0 硬失败 / 0 警告。critic 结论：通过。
