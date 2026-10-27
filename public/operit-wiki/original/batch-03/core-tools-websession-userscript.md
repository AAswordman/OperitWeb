---
title: 网页会话·用户脚本引擎
module: core
sources: 15
date: 2026-10-01
---

# 网页会话·用户脚本引擎

## 概述

- 这是 Tampermonkey 式用户脚本引擎：用户装 `.user.js` 脚本，脚本按 `@match` 等规则自动注入到 WebSession（内置浏览器）的页面里跑，能改页面、调 `GM.*` 特权 API。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/WebSessionUserscriptManager.kt:215`
- 三个支柱：**解析**（`UserscriptMetadataParser` 读 `// ==UserScript==` 头）、**匹配**（`UserscriptMatcher` 判 URL）、**存储**（`UserscriptRepository` + JSON 文件注册表）。
- 运行时分两层：Kotlin 原生侧（`WebSessionUserscriptManager`）管注入与特权能力，JS 侧（`UserscriptBootstrapScript` 生成的启动脚本）在页面里搭 `GM` 对象并执行脚本。两层经 `OperitUserscriptBridge` 消息通道 RPC 通信。

## AI 速览

- 核心符号：`UserscriptMetadataParser.parse`（解析）、`UserscriptMatcher.matches/isConnectAllowed`（匹配）、`UserscriptCapabilityRegistry`（33 个 grant）、`UserscriptRepository.install/buildBootstrapPayload`（存储/打包）、`WebSessionUserscriptManager.attachSession/handleBridgeMessage/interceptWebRequest`（注入/桥接/拦截）、`UserscriptBootstrapScript.documentStartScript`（JS 启动脚本）、`UserscriptWebRequestEngine.resolve`（请求改写）。
- 主入口：`WebSessionUserscriptManager.attachSession(sessionId, webView)` 绑定会话并注入；页面就绪后 JS 发 `bootstrap_request`，原生回传 `buildBootstrapPayload` 打包的脚本。
- 数据流向一句话：脚本文件/URL → 解析元数据 → JSON 注册表落盘 → 页面加载时按 URL 匹配打包（含源码/依赖/键值/资源）→ document-start 注入启动脚本 → `new Function` 执行，特权调用经 Bridge 回到原生。

## 核心机制

### 元数据解析

- 脚本头是 `// ==UserScript==` 到 `// ==/UserScript==` 的注释块，正则定位；找不到直接抛异常。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/UserscriptMetadataParser.kt:10`
- 每行 `// @key value` 解析成键值对；`@name` 缺失装不上，`@version` 缺省为 `"0"`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/UserscriptMetadataParser.kt:24`
- 注入时机只有三种：`document-start` / `document-end` / `document-idle`，`@run-at` 写错或不写都按 `document-end`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/UserscriptModels.kt:12`
- `@resource` 按 `名字 URL` 解析。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/UserscriptMetadataParser.kt:28`
- `@webRequest` 规则原样保留；全部原始头存 `rawHeaders` 供 `GM.info` 回放。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/UserscriptMetadataParser.kt:93`

### URL 匹配

- 匹配顺序是"先排除后包含"：`@exclude-match`、 `@exclude` 命中任一直接不跑；`@noframes` 的脚本在 iframe 里永不运行。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/UserscriptMatcher.kt:18`
- `@match` 按 scheme/host/path 拆段比：scheme 写 `*` 只认 http/https；host `*` 匹配任意非空 host，`*.example.com` 连裸域一起匹配；path 段是 glob。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/UserscriptMatcher.kt:111`
- `@include` 不拆段，直接对完整 URL 做 glob。glob 里 `*` 变成 `.*`，其余正则字符转义，忽略大小写。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/UserscriptMatcher.kt:134`
- `@connect` 管跨域请求能访问哪些目标：同源永远放行；跨域且 `@connect` 为空直接拒绝；支持 `*`、self、精确 host、`*.后缀`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/UserscriptMatcher.kt:50`

### 权限（grant）模型

- 注册表共 33 个 capability：28 个 GM.*（存储/通知/下载/cookie/标签页/webRequest 等），含 `unsafeWindow`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/UserscriptCapabilityRegistry.kt:184`
- `window.close/focus/onurlchange`、`none` 等也在注册表内。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/UserscriptCapabilityRegistry.kt:201`
- `GM_setValue` 这类下划线写法是别名，统一归一到 `GM.setValue`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/UserscriptCapabilityRegistry.kt:135`
- 不认识的 grant 进 `unknownGrants`，在安装预览里展示给用户看。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/UserscriptCapabilityRegistry.kt:225`
- `@grant none` 不能混用其他 grant；`GM.audio` 在 WebView 不支持静音控制时直接被拦。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/UserscriptCapabilityRegistry.kt:228`
- 门禁是声明式的：注入的 JS 只给脚本挂它声明过的 `GM.*` 函数（`hasGrant` 检查）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/UserscriptBootstrapScript.kt:953`

### 存储

- 不用数据库，用 JSON 文件：`state/registry.json` 存脚本与资源索引，`state/logs.json` 存日志，`state/values/<脚本id>.json` 按脚本存 `GM.setValue` 的键值；脚本源码存 `scripts/<安全前缀>_<sha12>.user.js`，`@require/@resource` 缓存在 `cache/`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/storage/UserscriptJsonStore.kt:52`
- 写操作全经 `Mutex`；脚本 id 自增。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/storage/UserscriptJsonStore.kt:54`
- 安装拒绝降级（低版本覆盖高版本抛异常）；更新按 `updateUrl → downloadUrl → sourceUrl` 找地址，只有远端版本更新才提示。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/storage/UserscriptRepository.kt:135`
- 相对路径的 `@require/@resource` 按脚本来源 URL 解析；`data:` URL 的依赖也支持。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/storage/UserscriptRepository.kt:578`

### 运行时注入与桥接

- 会话绑定入口是 `attachSession`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/WebSessionUserscriptManager.kt:189`
- 绑定时做两件事：`addDocumentStartJavaScript` 注入启动脚本（对所有源）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/WebSessionUserscriptManager.kt:207`
- `addWebMessageListener` 注册桥接通道（对所有源 `*`）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/WebSessionUserscriptManager.kt:215`
- 桥接通道名为 `OperitUserscriptBridge`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/UserscriptBootstrapScript.kt:4`
- 引擎要求 WebView 支持 DOCUMENT_START_SCRIPT 与 WEB_MESSAGE_LISTENER，否则整个用户脚本功能禁用。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/WebSessionUserscriptManager.kt:108`
- 页面就绪后启动脚本发 `bootstrap_request`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/WebSessionUserscriptManager.kt:544`
- 原生用 `buildBootstrapPayload` 打包（只含启用、grant 合法、URL 匹配的脚本：源码、`@require` 正文、键值、resource 文本/base64），经 RPC 回传。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/WebSessionUserscriptManager.kt:552`
- 脚本以 `new Function(GM, GM_info, ..., unsafeWindow, window, close, focus)` 执行；`@require` 拼在源码前面；末尾带 `//# sourceURL=userscript:<名>` 方便调试。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/UserscriptBootstrapScript.kt:991`
- 时机调度：document-start 的脚本立即装。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/UserscriptBootstrapScript.kt:1085`
- document-end 等 `DOMContentLoaded`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/UserscriptBootstrapScript.kt:1110`
- document-idle 等 `requestIdleCallback`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/UserscriptBootstrapScript.kt:1104`
- 或等 `load` 事件。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/UserscriptBootstrapScript.kt:1117`
- `GM.*` 点式和 `GM_*` 下划线式两套 API 同时给，点式返回 Promise，兼容 Tampermonkey 脚本习惯；`GM.info` 里 `scriptHandler` 直接写 `"Tampermonkey"`、`version` 写 `"5.3.3"`。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/UserscriptBootstrapScript.kt:326`
- 特权调用走 Bridge 回到原生：`gm_cookie` 读写系统 Cookie（另有 mirror 补 domain/path 等属性）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/WebSessionUserscriptManager.kt:781`
- `gm_xmlhttp_request` 在原生侧经 OkHttp 发出。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/WebSessionUserscriptManager.kt:787`
- `gm_notification` 发系统通知（Android 13+ 先要权限）；`gm_download` 调下载。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/WebSessionUserscriptManager.kt:785`
- `gm_open_in_tab` 开新标签。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/WebSessionUserscriptManager.kt:717`
- `GM_xmlhttpRequest` 在原生侧二次校验 `@connect`，不通过记 error 日志并拒绝；二进制请求体（ArrayBuffer/Blob/FormData）不支持。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/WebSessionUserscriptManager.kt:1155`
- `GM.webRequest` 做请求拦截改写：规则按注册顺序合并（cancel 取或、redirect 后者覆盖前者、头合并），命中 cancel 的直接回 204 "Blocked"；`@webRequest` 元数据声明的规则免调用自动注册。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/UserscriptWebRequestEngine.kt:79`
- `GM.setValue` 变更广播给同脚本的其他会话（`storage_changed`，`remote=true`），跨标签页同步；`GM.getTab` 状态只放内存，会话结束即清。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/WebSessionUserscriptManager.kt:951`
- 脚本状态机：`script_status` 上报 running→success/error。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/WebSessionUserscriptManager.kt:579`
- UI 侧基线：DISABLED（禁用）/ UNSUPPORTED（grant 被拦）/ NOT_MATCHED / QUEUED（待注入）。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/WebSessionUserscriptManager.kt:1457`

### 安装流程

- 三种来源：远端 URL（只认 http/https）、本地文件（系统选择器）、页面链接/更新/工具输入。远端非 2xx 直接失败。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/WebSessionUserscriptManager.kt:321`
- 先出安装预览（元数据 + 已知/未知 grant + 拦截原因），用户确认后才真正落盘。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/storage/UserscriptRepository.kt:86`
- `GM.registerMenuCommand` 注册的命令存在会话绑定里。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/WebSessionUserscriptManager.kt:297`
- 原生经 `evaluateJavascript` 回调页面执行命令。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/WebSessionUserscriptManager.kt:307`

## 关键符号

- `UserscriptMetadataParser.parse(rawSource): ParsedUserscriptMetadata` —— 解析头，缺块/缺名抛异常。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/UserscriptMetadataParser.kt:11`
- `UserscriptMatcher.matches(metadata, pageUrl, isTopFrame)` —— 先排除后包含的 URL 判定。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/UserscriptMatcher.kt:7`
- `UserscriptMatcher.isConnectAllowed(metadata, pageUrl, targetUrl)` —— `@connect` 跨域放行判定。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/UserscriptMatcher.kt:38`
- `UserscriptCapabilityRegistry.{canonicalGrant,knownGrants,unknownGrants,blockedReasons}` —— grant 归一与校验。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/UserscriptCapabilityRegistry.kt:228`
- `UserscriptRepository.install(preview)` —— 拒绝降级、落盘、缓存依赖。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/storage/UserscriptRepository.kt:133`
- `UserscriptRepository.buildBootstrapPayload(sessionId, pageUrl, isTopFrame)` —— 打包本页要跑的脚本。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/storage/UserscriptRepository.kt:260`
- `UserscriptRepository.checkForUpdate(scriptId)` —— 按优先级找更新地址。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/storage/UserscriptRepository.kt:209`
- `WebSessionUserscriptManager.attachSession(sessionId, webView)` —— 注入启动脚本 + 注册 Bridge。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/WebSessionUserscriptManager.kt:189`
- `WebSessionUserscriptManager.handleBridgeMessage(...)` —— 二十余种桥接消息的分发。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/WebSessionUserscriptManager.kt:532`
- `WebSessionUserscriptManager.interceptWebRequest(sessionId, request)` —— webRequest 拦截改写。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/WebSessionUserscriptManager.kt:449`
- `UserscriptBootstrapScript.documentStartScript()` —— 生成注入页面的 JS 启动脚本。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/UserscriptBootstrapScript.kt:6`
- `UserscriptWebRequestEngine.resolve(sessionId, url, requestType)` —— 规则匹配与动作合并。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/UserscriptWebRequestEngine.kt:79`
- `UserscriptCookieService.{list,set,delete}` —— 经 CookieManager 的 cookie 读写。`app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/UserscriptCookieService.kt:44`

## 调用链

**安装**：输入（URL/本地文件）→ `beginUrlInstall`/`beginLocalImport` 取源码 → `prepareInstallPreview` 解析并算出已知/未知 grant → 用户确认 → `install` 落盘（拒绝降级）→ 下载缓存 `@require/@resource` → 输出 `UserscriptListItem`。

**页面注入**：输入（页面 URL + 是否主帧）→ `attachSession` 注入启动脚本 → 启动脚本发 `bootstrap_request` → `buildBootstrapPayload` 过滤（启用/grant 合法/URL 匹配）并打包 → 输出 payloadJson → 按 `runAt` 调度 `installScript` → `new Function` 执行 → 上报 `script_status`。

**特权调用**（以 `GM_xmlhttpRequest` 为例）：输入（method/url/headers）→ JS 发 `gm_xmlhttp_request` → 原生查脚本元数据 → `isConnectAllowed` 校验 `@connect` → 不通过则记日志并拒绝 → 通过则叠加 webRequest 规则 → OkHttp 执行 → 事件流（readystatechange/progress/load/loadend）回传 → 输出响应给页面回调。

## 关联条目

- [[core-tools|工具系统（总览）]]：本页所属章节的总览。
- [[core-tools-websession-browser|网页会话·浏览器宿主]]：WebView 会话与注入载体（兄弟页）。
- [[core-tools-jsengine|JS 引擎]]：脚本执行环境的另一实现（兄弟页）。

## 来源

- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/UserscriptMetadataParser.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/UserscriptMatcher.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/UserscriptCapabilityRegistry.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/UserscriptModels.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/storage/UserscriptRepository.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/storage/UserscriptJsonStore.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/storage/UserscriptEntities.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/install/UserscriptImportCoordinator.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/install/UserscriptImportPickerActivity.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/WebSessionUserscriptManager.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/UserscriptBootstrapScript.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/UserscriptCookieService.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/UserscriptStorageNotifier.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/runtime/UserscriptTabStateStore.kt`
- `app/src/main/java/com/ai/assistance/operit/core/tools/defaultTool/websession/userscript/ui/WebSessionUserscriptUiStateStore.kt`
