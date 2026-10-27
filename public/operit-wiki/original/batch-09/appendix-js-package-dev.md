---
title: JS 沙盒包开发接口
module: 附录
sources: 14
date: 2026-10-02
issue: 139
---

# appendix-js-package-dev（JS 沙盒包开发接口）

> 种子：`core/tools/packTool/PackageManager.kt`（包解析）、`core/tools/ToolPackage.kt`（元数据模型）、`core/tools/javascript/JsExecutionScriptBuilder.kt`（执行入口与运行时桥）、`core/tools/javascript/JsLibraries.kt`（沙盒全局对象清单）、`core/tools/javascript/JsTimeoutConfig.kt`、`app/src/main/assets/packages/`（31 个内置包实证）@ `dbf71916`

> 一句话：写一个 `.js` 文件，顶部放 `/* METADATA {...} */`（Hjson），每个工具就是一个同名 JS 函数，`exports.工具名` 导出；运行时自动注入网络、Java 桥、env 读取等全局对象，函数 `return` 或调 `complete()` 即返回结果。

## 概述

人话：给 Operit 写插件不需要 Android 开发。一个 JS 沙盒包就是一个 `.js` 文本文件：文件头用注释写清"包叫什么、有哪几个工具、每个工具要什么参数"，文件体里每个工具对应一个同名 JavaScript 函数。装进 Operit 之后，AI 就能像调原生工具一样调你的函数，函数里可以直接发 HTTP 请求、调 Java/Android API、读写配置。

跟其他页的关系：`plugins`（插件机制与工具包桥接）讲的是 Operit 内部怎么加载执行；`core-tools-packtool` 讲 ToolPkg bundle 容器；`appendix-plugin-capabilities`（插件能力目录）讲现有插件能干什么。**本页是作者视角**：从零写一个沙盒包，接口长什么样。

## AI 速览

- **核心符号清单**：`extractMetadataFromJs`（METADATA 提取）、`parseJsPackage`（包解析）、`validateToolFunctionExists`（工具函数存在性校验）、`ToolPackage`/`PackageTool`/`PackageToolParameter`（元数据模型）、`__operitExecuteScriptFunction`（执行入口）、`findTargetFunction`（目标函数查找）、`createFactory`（CommonJS 模块包装）、`getEnv`（env 读取）、`complete`/`done`（结果回传）、`JsTimeoutConfig`（超时）。
- **主入口**：`PackageManager.parseJsPackage(jsContent)` 解析包（`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:2249`）；执行时 `JsToolManager.executeScript(script, tool)` 调 `__operitExecuteScriptFunction(callId, params, scriptText, targetFunctionName, …)`（`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:400`）。
- **数据流向一句话**：`.js` 文件 → 顶部 METADATA（Hjson）解析成 `ToolPackage` → 每个 tool 以 `包名:工具名` 注册进 AI 工具表 → AI 调用时整份脚本装进 CommonJS 模块壳，按名找到函数并以 `targetFunction(params)` 调用 → 返回值/`complete()` 回传给 AI。

## 包文件格式

### 文件与 METADATA 块

- 一个包就是一个 `.js` 文件（也接受 `.ts`、纯 `.hjson` 元数据文件），靠文件**顶部注释块**声明元数据（`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:2466`）：
  - 提取正则：`/\*\s*METADATA\s*([\s\S]*?)\*/`（`:2467`）——取第一个匹配的注释块内容
  - 内容按 **Hjson** 解析（`:2258`，`JsonValue.readHjson`），注释、尾逗号、不加引号的 key 都合法
  - 找不到 METADATA 块 → 视为空 `{}`（`:2473`），包名缺失则解析失败
- 关键：每个工具的 `script` 字段**不需要作者写**——解析器自动把**整个文件内容**填进去（`:2296`），执行时再按工具名找函数。所以一个文件可以放多个工具，互不干扰。
- 工具函数存在性校验（`:2444`）：tool 在文件中必须以以下任一形态出现，否则只记 warning 日志（不阻断）：
  - `async function 工具名(`
  - `function 工具名(`
  - `exports.工具名 = …`
  - `const/let/var 工具名 = …`
- 例外：`advice: true` 的工具免检（见下）。

### METADATA 字段全表

数据模型见 `app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:301`。Hjson 里用驼峰 key；`enabled_by_default`、`is_built_in` 两种下划线别名也认（`normalizeJsPackageMetadata`，`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:2337`），未知 key 直接忽略（`ignoreUnknownKeys`，`:2288`）。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 是 | 包名；工具注册为 `包名:工具名`（`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:3458`） |
| `display_name` | `{zh,en}` | 否 | 展示名，多语言对象 |
| `description` | `{zh,en}` | 否 | 包描述，多语言对象 |
| `category` | string | 否 | 分类，默认 `"Other"` |
| `version` | string | 否 | 版本号 |
| `author` | string \| string[] | 否 | 作者 |
| `enabledByDefault` | boolean | 否 | 是否默认启用，默认 `false` |
| `isBuiltIn` | boolean | 否 | 内置标记（随 APK 发布） |
| `env` | object[] | 否 | 环境变量声明，见"env 机制" |
| `states` | object[] | 否 | 条件工具集，见"states 机制" |
| `tools` | object[] | 是 | 工具定义数组 |

工具定义（`PackageTool`，`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:340`）：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | string | 是 | 工具名，必须与文件中函数同名 |
| `description` | `{zh,en}` | 否 | 给 AI 看的工具说明 |
| `parameters` | object[] | 否 | 参数表，见下 |
| `advice` | boolean | 否 | `true` = 只进 prompt 的建议性说明，不注册为可执行工具（`:3452`、`:3554`） |

参数定义（`PackageToolParameter`，`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:352`）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | 参数名 |
| `description` | `{zh,en}` | 参数说明 |
| `type` | string | `"string"` / `"number"` / `"boolean"` |
| `required` | boolean | 是否必填，**默认 `true`** |

## 工具函数约定

### 查找与调用

- 脚本被包进 CommonJS 模块壳：`new Function('module','exports','require','__operit_call_runtime', prelude + source)`（`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:307`）——所以包里可以直接用 `module` / `exports` / `require`。
- 目标函数查找顺序（`findTargetFunction`，`:370`）：`module.exports[工具名]` → `globalThis[工具名]`。找不到 → 工具报错并列出可用函数名。
- 调用签名固定：`targetFunction(params)`（`:1386`）——**单个对象参数**，AI 传的参数全在这个对象里。返回值或抛错决定工具结果。
- 实证写法（`time.js` / `duckduckgo.js` 都是这个套路）：
  ```js
  const myPkg = (function () {
      async function my_tool(params) {
          // params.xxx 取参数
          return { ok: true, data: … };   // return 即结果
      }
      return { my_tool };
  })();
  exports.my_tool = myPkg.my_tool;   // 必须导出，名字 = METADATA 里 tools[].name
  ```

### 返回、流式与错误

- **同步返回**：函数 `return` 任意可 JSON 序列化的值即为工具结果；`async` 函数自动 await（`handleAsync`，`:581`）。
- **显式结束**：调 `complete(value)` / `done(value)` 主动结束并回传（`:566`），之后再调无效。`duckduckgo.js` 用 `complete({success:true,…})` 包一层统一格式。
- **流式中间输出**：`emit(value)` / `delta(value)` / `log(value)` / `update(value)` / `sendIntermediateResult(value)`——同一实现，把中间结果推给调用方（`:607` 前后）。
- **日志**：`console.log/info/warn/error` 进本次调用的日志上下文，可在包管理界面查看（每包保留上限见 `ToolPkgRuntimeMonitor`）。
- **失败**：函数抛错或 Promise reject → 工具调用失败，错误信息（含 stack）回传。

### 超时

`JsTimeoutConfig`：单次工具调用主超时 **1800 秒（30 分钟）**（`MAIN_TIMEOUT_SECONDS`），预超时提前 5 秒触发。长时间任务不用自己管心跳。

## 沙盒全局对象

每次执行前由 `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsLibraries.kt:20` 注入，包作者可直接用，无需 import：

| 全局对象 | 来源文件 | 用途 |
|---|---|---|
| `OkHttp` / `OkHttpClient` / `OkHttpClientBuilder` / `RequestBuilder` | `assets/js/OkHttp3.js` | 发 HTTP 请求（联网包都用它，如 `app/src/main/assets/packages/duckduckgo.js:46` 的 `OkHttp.newClient()`） |
| `Java` / `Kotlin` | `quickjs/init/java-bridge.js` | Java 类桥接，直接调 JVM API |
| `Android` / `Intent` / `PackageManager` / `ContentProvider` / `SystemManager` / `DeviceController` | `assets/js/AndroidUtils.js` | Android 系统能力 |
| `Tools` | `quickjs/init/tools.js` | Operit 内置工具定义（如 `Tools.Files.exists`，`app/src/main/assets/packages/github.js:797` 在用） |
| `ToolPkg` | `quickjs/init/toolpkg-bridge.js` | ToolPkg bundle 注册 API（沙盒包里一般用不上） |
| `CryptoJS` | `assets/js/CryptoJS.js` | 加解密 |
| `Jimp` | `assets/js/Jimp.js` | 图片处理 |
| `UINode` | `assets/js/UINode.js` | UI 节点 |
| `pako` | `assets/js/pako.js` | gzip 压缩 |
| `_` / `dataUtils` / `Icons` | `quickjs/init/third-party-libs.js` | 工具函数（lodash 子集等） |
| `OperitComposeDslRuntime` | `quickjs/init/compose-dsl-bridge.js` | Compose DSL |

`require()` 支持包内相对/绝对路径模块（`resolveModulePath`，`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:234`；候选 `x` → `x.js` → `x.json` → `x/index.js`），单文件沙盒包用不上，多文件 bundle 结构才需要。

## 每调用运行时函数

执行前奏（`buildExecutionPreludeSource`，`app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt:7`）给**每一次工具调用**注入的上下文函数：

| 函数 | 说明 |
|---|---|
| `getEnv(key)` | 读 `env` 声明的环境变量；未设置返回 `undefined`（`:607`）。实证：`getEnv("GITHUB_TOKEN")`（`app/src/main/assets/packages/github.js:289`）、`getEnv("MINIMAX_API_KEY")`（`app/src/main/assets/packages/minimax_draw.js:100`） |
| `getPluginConfigDir([pluginId])` | 插件配置目录路径，缺省取当前包 |
| `getState()` | 当前包选中的 state（见下） |
| `getLang()` / `getCallerName()` / `getChatId()` / `getCallerCardId()` | 调用上下文：语言、调用者、会话 id 等 |
| `reportDetailedError(…)` | 上报结构化错误详情 |

## env 机制

- METADATA 里声明（`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:303` 注释有完整格式示例）：
  ```hjson
  env: [
    { name: "GITHUB_TOKEN", description: { zh: "GitHub API 认证令牌" }, required: true }
    { name: "GITHUB_API_BASE_URL", description: { zh: "基础 URL" }, required: false, defaultValue: "https://api.github.com" }
  ]
  ```
- `required: true` 的变量缺失时，`PackageManager` 在**激活包之前**校验并提示用户填写——密钥类配置走这个通道，不要硬编码在脚本里。
- 读取用 `getEnv("变量名")`；注意 `app/src/main/assets/packages/github.js:285` 的防御写法：`typeof getEnv === "function" ? getEnv(…) : void 0`。

## states 机制

- 给"同一包在不同环境下暴露不同工具"用的。`states[]` 每项：`{id, condition, inheritTools, excludeTools, tools}`（`app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt:338`）。
- 激活时按顺序求值 `condition`，**首个命中的 state 生效**（`selectToolPackageState`，`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:3468`）；都不命中则包按无 state 处理。
- `condition` 的求值上下文是能力快照（`:3497`），可用 key：`platform.name`（`"android"`）、`platform.android/windows/linux/macos`、`android.permission_level`、`android.shizuku_available`、`ui.virtual_display`、`ui.shower_display`。
- 工具合并规则（`mergeToolsForState`，`:3489`）：`inheritTools=true` 先继承基础工具 → `excludeTools` 剔除 → `state.tools` 覆盖/新增。

## 最小例子

```js
/* METADATA
{
  name: hello
  display_name: { zh: "打招呼", en: "Hello" }
  description: { zh: "第一个沙盒包", en: "My first sandbox package" }
  category: "Utility"
  enabledByDefault: false
  tools: [
    {
      name: greet
      description: { zh: "向某人打招呼", en: "Greet someone" }
      parameters: [
        { name: "who", description: { zh: "名字", en: "Name" }, type: "string", required: true }
      ]
    }
  ]
}*/
const helloPkg = (function () {
    async function greet(params) {
        return "你好，" + params.who + "！";
    }
    return { greet };
})();
exports.greet = helloPkg.greet;
```

存成 `hello.js`，通过包管理界面"导入"或放进 `Android/data/<应用包名>/files/packages/`（`getExternalPackagesPath`，`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:2482`），启用后 AI 就能调 `hello:greet`。

## 来源

- `app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt`：`parseJsPackage`（:2249）、`extractMetadataFromJs`（:2466）、`validateToolFunctionExists`（:2444）、`normalizeJsPackageMetadata`（:2337）、`registerPackageTools`（:3449）、`selectToolPackageState`（:3468）、`getExternalPackagesPath`（:2482）
- `app/src/main/java/com/ai/assistance/operit/core/tools/ToolPackage.kt`：`ToolPackage`（:301）、`PackageTool`（:340）、`PackageToolParameter`（:352）
- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt`：执行前奏（:7）、`createFactory`（:307）、`findTargetFunction`（:370）、入口函数（:400）、`complete`（:566）、`handleAsync`（:581）、`targetFunction(params)`（:1386）
- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsLibraries.kt`：沙盒全局对象清单（:20）
- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsTimeoutConfig.kt`：超时常量
- 实证包：`app/src/main/assets/packages/time.js`（IIFE + exports 写法）、`duckduckgo.js`（`OkHttp.newClient()`、`complete()` 包裹）、`github.js`（`env` 声明 + `getEnv` 防御读取）
