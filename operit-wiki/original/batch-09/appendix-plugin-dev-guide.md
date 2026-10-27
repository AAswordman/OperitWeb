---
title: 插件开发指南（Top50 实证）
module: 附录
sources: 48
date: 2026-10-02
issue: 140
---

# appendix-plugin-dev-guide（插件开发指南：市场 Top50 实证）

> 种子：operit.app 插件市场下载量 Top50（榜单生成于 2026-09-27，共 1452 个插件）中 48 个可读源码的插件包。35 个 ToolPkg bundle + 11 个单文件 JS 沙盒包 + 1 个 Skill + 1 个 MCP。分析方法：48 个插件包经市场 asset 下载解包，五路并行代码走查，逐包输出结构化分析报告后综合。

> 一句话：这不是凭空写的规范，是把下载量最高的 48 个插件源码全部读完之后，提炼出的"它们实际都是这么写的"——照抄这些模式，你的插件就站在了 Top50 的肩膀上。

## 概述

人话：Operit 插件市场有 1452 个插件，但下载量高度集中。排第一的"温柔巡检" 4.1 万次下载，是第 50 名的十几倍。我们把前 50 名里能拿到源码的 48 个全部解包读完，发现高下载插件的写法高度趋同：同样的包结构、同样的返回格式、同样的配置姿势、同样的坑。本页把这些"实证最佳实践"整理成开发指南，每条后面都标着是哪些插件这么干的。

数据口径：

- 排名与下载量来自市场官方 JSON（`https://static.operit.app/market/v2/lists/all/downloads/page-1.json`，榜单生成于 2026-09-27）。第 1–13 名有精确下载量；第 14–50 名排名顺序已用"按下载量排序"渲染页完整核验，精确数字不可读，只知道第 14 名 < 11,982。
- 第 7 名"主动消息守卫-实验版"和第 15 名"朋友圈"的 release 包已被作者删除，且无公开源码仓，**不在分析范围内**。下文"Top50"实际指 48 个已读插件。
- 引用插件代码时用"插件名/包内文件"标注，如"温柔巡检 `packages/gentle_guardian_tools.js`"。

跟其他页的关系：`appendix-js-package-dev`（JS 沙盒包开发接口）讲的是**官方接口契约**（METADATA 字段、沙盒全局对象）；本页讲的是**社区实证**（Top 插件实际怎么写、哪些坑别踩）。先读接口页，再读本页。

## AI 速览

- **核心符号清单**：`registerToolPkg()`（容器入口）、`ToolPkg.register*`（UI/hook/渲染注册）、METADATA `tools[]` + `exports.工具名`（工具声明式注册）、`complete({success, message, data})`（统一返回信封）、`wrap()`（错误包装器）、`getEnv()`（配置读取）、`Tools.Net.http`（联网）、`registerXmlRenderPlugin`（聊天内富 UI）、`registerUiRoute` + `registerNavigationEntry`（侧边栏挂载）。
- **主入口**：单文件包靠文件头 METADATA + `exports` 导出；ToolPkg 靠 `main.js` 的 `registerToolPkg()` 做 UI/hook 注册，工具实现下沉到 `packages/*.js`。
- **数据流向一句话**：Top 插件没有一个调 `ToolPkg.registerTool`——AI 工具全部走"子包 METADATA 声明 + `exports` 导出"；`register*` 只用于 UI 路由、导航入口、XML 渲染、消息钩子；工具返回统一 `{success, message, data}` 信封，错误被 `wrap()` 转成结构化返回而不是抛给引擎。

## 第一步：选形态

48 个插件分四种形态，选型分界非常清晰：

| 形态 | 什么时候用 | Top50 实证 |
|---|---|---|
| 单文件 JS 沙盒包 | 只给 AI 加工具函数，无 UI | 16_通知（77 行）、44_换头像、47_小手机、26_视频解析、27_网易云 |
| ToolPkg bundle | 要 UI 面板 / XML 渲染 / workflow 模板 / prompt 注入 | 35 个，含全部 Top10 |
| Skill | 零代码：命令模板 + 参数表 | ApkTool工具（整个插件就是一个 JSON） |
| MCP | 能力跑在外部进程/服务器，与宿主解耦 | OpenWebSearch（TS 服务器，stdio/SSE/HTTP 三传输） |

经验法则（来自 batch E 共性 TOP5）：**"加工具函数"用单文件 METADATA，"要 UI/渲染/模板/prompt 注入"才上 ToolPkg**。44_换头像证明 3 个工具 175 行就能成一个插件；不要为了"显得正规"给纯工具包套 bundle 壳。

Skill 形态值得单独说：ApkTool工具整个插件就是一个 JSON——`commands` 数组里写 shell 命令模板（`$变量` 占位），`args` 声明参数类型（`file` 带 `file_filter: ".apk"`，宿主自动渲染文件选择器）。**把"AI 能力扩展"的门槛降到了写配置**，适合"把某个命令行工具包一层"的场景。

## 包结构：双层铁律

ToolPkg bundle 的事实标准结构（9/10 的 Top10 插件，无一例外）：

```text
manifest.json # 清单：toolpkg_id/version/main/display_name/description
main.js # 容器入口：只做 ToolPkg.register*，不写业务
packages/*.js # 工具实现：每个文件头带 METADATA，尾部 exports 导出
shared/ 或 core/ # 公共逻辑：配置读写、API 封装（多子包复用）
ui/ # Compose DSL 面板
workflow/ 或 resources/ # 工作流模板 / 静态资源
```

三条铁律：

1. **main.js 只做注册**。25_赛博红包的 main.js 只有 8 行（打两行日志 `return true`）；42_低电量模板包的 `registerToolPkg()` 直接 `return true`——**零注册也是合法模式**，模板包不需要注册任何东西。
2. **工具实现下沉到 packages/**。03_聊天记录转换把 9 个平台转换器拆成 `converters/` 目录，"目录即插件架构"；18_微信桥接把 870 行公共库抽成 `dist/shared/wechat_bridge_core.js` 供 3 个子包复用。
3. **共享层防漂移**。09_Moodlet 用 `constants.js` 集中管 ENV_KEYS/HOOK_IDS，10_EchoCoT 用 `shared.js` 集中管 prefs 名和注入标记——多文件插件不集中常量，改一个地方漏三个地方。

单文件包则用 IIFE 分区 + 注释分节达到同样效果（34_开发Agent 989 行：METADATA → IIFE → exports，内部"核心实现 + 包装器"双层）。

## 工具注册：没人调 registerTool

这是读完 48 个插件最反直觉的发现：**AI 可调用工具的注册，没有一个走 `ToolPkg.registerTool`**。事实标准是声明式两步：

```js
/* METADATA
{
name: my_pkg
tools: [
{ name: greet, description: { zh: "打招呼"}, parameters: [...]}
]
}*/
const myPkg = (function () {
async function greet(params) { /*... */}
return { greet};
})();
exports.greet = myPkg.greet; // 导出名必须 = METADATA 里 tools[].name
```

`ToolPkg.register*` 只出现在 bundle 的 `main.js` 里，且只用于：`registerUiRoute`（UI 路由）、`registerNavigationEntry`（侧边栏/工具箱入口）、`registerXmlRenderPlugin`（聊天 XML 标签渲染）、`registerToolboxUiModule`（工具箱设置模块）、各类 hook（`registerPromptInputHook`、`registerChatInputHook`、`registerSystemPromptComposeHook` 等）。

记住这句就行：**"写工具" = 写 METADATA + 写函数 + exports 导出；`registerToolPkg` 是留给 UI、导航、事件钩子的。**

## 返回信封：{success, message, data} + wrap 模板

48 个插件里，有返回值的工具**全部**带 `success` 布尔字段（唯一例外是 19_CoRead 用 `ok`，被所有分析员一致判定为反例）。标准信封：

```js
// 成功
complete({ success: true, message: "已发送", data: {...}});
// 失败
complete({ success: false, message: "API Key 未配置，请到设置页填写"});
```

以及 Top 插件人手一个的 `wrap` 包装器（00_温柔巡检、01_对话锁、16_通知、29_双人生活簿、32_视频解析、34_开发Agent、40_声纹包、44_换头像、47_小手机都在用，写法大同小异）：

```js
function wrap(fn, params) {
try {
const data = fn(params);
complete({ success: true, message: "执行成功", data});
} catch (e) {
complete({ success: false, message: e.message, error_stack: e.stack});
}
}
exports.my_tool = (p) => wrap(my_tool_impl, p);
```

三条配套规矩：

1. **错误不抛给引擎**。46_表情包渲染器未命中时返回纠错推荐文本（"是不是：a / b / c"）而不是抛错——AI 侧永远拿到可读结果，不用解析堆栈。
2. **`message` 写人话**。05_小红书缺 key 时返回"请在包管理中打开设置配置"，而不是 "401 Unauthorized"。
3. **`complete()` 和 `return` 二选一并在包内统一**。混用但信封一致也行（41_实时巡航 91 处 `complete`），但 40_声纹包的 `main` 入口绕过 `wrap` 导致格式不一致，被记为反例。

## 配置与密钥：env 是标准答案，但没人用好

先说结论：**密钥类配置走 `env` 声明 + `getEnv()` 读取，是官方机制，也是 Top 插件里做得最好的几个的共同选择**。但 48 个插件里只有 11 个声明了 env——这是 Top50 最大的集体欠账，指南必须主推。

标准写法（05_小红书图文阅读器，教科书级）：

```hjson
// METADATA 或 manifest 的 env 数组
env: [
{ name: "XHS_API_KEY", description: { zh: "API 密钥"}, required: false}
{ name: "XHS_VISION_MODE", description: { zh: "识别模式"}, required: false, defaultValue: "hunyuan"}
]
```

```js
// 读取：集中、防御、有回退
function getApiKey(providedKey) {
return providedKey
|| (typeof getEnv === "function"? getEnv("XHS_API_KEY"): undefined)
|| undefined;
}
```

进阶模式（26_视频解析）：**密钥三级回退**——调用参数 `api_key` → 专用 env `VIDEO_PARSE_API_KEY` → 通用 env `DEFAULT_API_KEY`。用户既可以在包配置里填一次，也可以在单次调用时覆盖。

配置持久化的三条路（按推荐度排序）：

1. **env**：密钥、开关类配置。43_微信语音气泡把 TTS 开关存 env（`writeEnvironmentVariable` 写入、`getEnv` 读取），UI 和渲染逻辑共享同一份状态。
2. **SharedPreferences**：普通配置。24_分心查岗的 `sanitizeSettings` 对每个字段做白名单/钳制校验，脏数据一律回退默认。
3. **本地 JSON 文件**：复杂结构。17_碎碎念走 `ToolPkg.getConfigDir()`（应用私有目录，更干净）；但 00_温柔巡检等 6 个包硬编码 `/sdcard/Download/Operit/...`——公共目录，**反例**。

**头号反例**（必须写进"绝不"清单第一条）：30_心潮看板在 `dist/ui/dashboard.ui.js` 头部硬编码 Bearer token，还是 `http` 明文传输——任何人反编译包即得 token。正确做法：env 声明（`required: true`）+ `getEnv` 读取。

其他血泪：28_记忆系统用了三个 `getEnv` 变量但**零 env 声明**——用户永远收不到配置提示；27_网易云把 `NCMAPI_BASE_URL` 描述写"必需"却标 `required: false`——required 标得不对等于没标。

## 联网：走 Tools.Net.http

第三方插件的实际选择（batch B 统计 10 个里 0 用 `OkHttp.newClient()`）：

```js
const res = Tools.Net.http({
url: "https://api.example.com/v1/chat",
method: "POST",
headers: { "Authorization": "Bearer " + apiKey},
body: JSON.stringify(payload),
connect_timeout: 10000,
read_timeout: 60000
});
const text = res?.body?? res?.data?? res?.content?? ""; // 多字段兼容取值
```

配套的三个好习惯：

1. **限流写进代码**（26_视频解析）：OCR 批量识别串行 + 600ms 间隔，注释写明"避开 2 QPS 限制"；单张失败只记 error 对象继续循环——错误隔离。
2. **自带 `test` 工具**（26_视频解析）：用户配完 Key 先调 test 看通不通、延迟多少，排障成本大降。每个联网包都该有一个。
3. **URL 防御性归一化**（27_网易云）：用户填 `192.168.1.8:3000` 也能用（去尾斜杠、自动补 scheme）。

网关模式（27_网易云，API 代理类插件的范本）："1 个通用网关 `ncmapi_call` + N 个薄封装"——200+ 接口不用写 200 个函数，薄封装只给常用接口更好的参数名和默认值。

## Hook 开发：守卫三件套 + fail-open

事件钩子（`registerChatInputHook`、`registerPromptInputHook`、`registerPromptFinalizeHook` 等）是 Top 插件实现"主动能力"的核心。所有写得好的 hook 都是同一个形状：

```js
function onPromptFinalize(event) {
if (event.eventName!== "before_finalize_prompt") return null; // 1. stage 守卫
if (!isEnabled()) return null; // 2. enabled 守卫
const input = event.eventPayload?.input;
if (!input) return null; // 3. 空输入守卫
try {
//... 业务...
return { input: injected};
} catch (e) {
console.warn("hook failed:", e.message);
return null; // 4. fail-open：插件崩了也不阻断正常聊天
}
}
```

02_传话筒是范本：三层守卫 + 异常 `console.log` + `return null`。24_分心查岗每个 `on*` 处理器都 try/catch + console.warn，"钩子抛错不能把宿主消息链路拖死"。

幂等标记（22_聊天美化、08_应用冻结、29_双人生活簿，不约而同写出同一写法）：prompt 注入前先检查标记文本是否已存在——

```js
const INJECT_MARKER = "";
function alreadyInjected(prompt) { return prompt.indexOf(INJECT_MARKER) >= 0;}
```

双 hook 冗余注入（08：system prompt 组装后 + 最终发送前各注入一次）配合幂等标记，既防中间环节覆盖，又不叠加。

## XML 渲染：聊天内富 UI 的标准入口

43_微信语音气泡、45_VoiceBar、46_表情包渲染器、21_虚拟红包、07_问卷、09_Moodlet、11_电子嘴巴——7 个插件写法完全一致，这是"让 AI 回复里出现可交互 UI"的唯一官方通道：

```js
ToolPkg.registerXmlRenderPlugin({ id: "my_render", tag: "mybox", function: onRender});

function onRender(event) {
const xml = event.eventPayload?.xmlContent;
if (!xml) return { handled: false}; // 不认领，标签原文保留
const attrs = parseAttrs(xml); // 解析属性
return {
handled: true,
composeDsl: { screen: require("./ui/mybox.ui.js").default, state: {...attrs}, memo: { hash}},
text: "降级文本版" // 21_虚拟红包的亮点：纯文本客户端不丢消息
};
}
```

四个细节：

1. **`text` 降级字段**（21_虚拟红包）：compose DSL 渲染不了时，Markdown 文本版保证消息不丢失。
2. **screen/state 分离**：render 函数只做"解析 XML → 拼 state"，UI 文件只做"读 state → 渲染"，`ui/*.ui.js` 可复用。
3. **指纹复用**：43/45 用 `simpleHash(xmlContent)` 做 `memo.hash`，相同内容复用渲染实例。
4. **认领语义想清楚**：43 对空内容返回 `{handled: true, text: ""}`（"认领但渲染为空"，防标签原文泄漏）；45 对空消息返回 `{handled: false}`（不认领，原文保留）。两种都对，但要在包内统一。

## UI 面板：挂载公式

有 UI 的插件，挂载公式高度固定：

```js
ToolPkg.registerUiRoute({
id: "my_home", route: "toolpkg:my_pkg:ui:my_home",
runtime: "compose_dsl", screen: require("./ui/index.ui.js").default, keepAlive: true
});
ToolPkg.registerNavigationEntry({
id: "my_entry", route: "toolpkg:my_pkg:ui:my_home",
surface: "main_sidebar_plugins", icon: "settings", order: 100
});
```

`route` 命名统一 `toolpkg:{toolpkg_id}:ui:{name}`。面板用 `ctx.UI.*`（LazyColumn/Row/TextField/Button/Switch）+ `ctx.useState` + `ctx.Modifier`，这是全部 5 个有 UI 插件的共同选择。

重型 UI 范式（19_CoRead，典范）：manifest `resources` 声明静态资源 → `ToolPkg.readResource` 运行时解包到沙盒目录 → `file://` 加载进 `UI.WebView` → `addJavascriptInterface("CoreadBridge", {...})` 双向通信 → 需要 AI 时调 `Tools.Chat.sendMessageStreaming` 流式回传。HTML 承重、DSL 做桥（00_温柔巡检的 `ui/guardian_panel/index.ui.js` 注释原话）。

## description 写作：写给 AI 看

Top 插件的 description 有个共同点：**是给 AI 看的调用手册，不是给人看的广告**。

- 03_聊天记录转换：工具 description 写死批量输入格式（"换行/逗号分隔多个路径"），降低 AI 传参犯错率。
- 00_温柔巡检：`save_patrol_settings` 的 description 里含参数 patch 示例。
- 31_想念脉冲：`miss_pulse_check` 的描述写清"AI 在每次对话开头或定时任务时调用"——把调用时机写进 description，AI 不用猜。
- 中英双语是 10/10 Top10 插件的全勤（`{zh, en}` 对象）。

`advice: true` 工具的正确用法（25_赛博红包、33_本地图片显示）：只进 prompt 做自我介绍/输出规范，不占用工具注册表。"关于本插件"类说明、"AI 该怎么输出"类规范，都该这么写——33_本地图片显示 40 行零代码，纯靠两条 advice 工具教会 AI 怎么引用本地图片，是"零代码插件"的典范。

## Shell 安全：shQuote 是必备函数

凡是把用户输入拼进 shell 命令的 Top 插件，讲究的都有转义函数；没写的都成了反例。标准函数（37_家机锁的 `escapeShellArg`、40_声纹包的 `shQuote`，写法等价）：

```js
function shQuote(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'";}
// 用：`am force-stop ${shQuote(pkg)}`
```

反例：34_开发Agent 的 `'pm install -r "' + apkPath + '"'`（双引号可逃逸）、41_实时巡航的 `"am force-stop " + pkg`（分号可注入）。以及 18_微信桥接用 `echo '...json...' > file` 写文件——引号转义脆弱，应走 `Tools.Files.write`。

高危操作（`pm install`、`apt-get install`、force-stop 系统应用）要有二次确认或白名单：32_视频解析的 `autoInstallFfmpeg` 静默执行 `apt-get install -y ffmpeg` 被记为反例。

## Workflow-as-code

31_想念脉冲的范式：不靠预置 workflow 模板文件，而靠一个**幂等安装工具**现场生成/更新工作流——

```js
async function miss_pulse_setup_workflow(params) {
const existing = await Tools.Workflow.getAll();
const found = existing.find(w => w.name === "想念脉冲");
if (found) return Tools.Workflow.update(found.id, TEMPLATE); // 同步最新模板
return Tools.Workflow.create(TEMPLATE); // 不存在则创建
}
```

"上传市场/换新设备/重置后调用一次即可恢复"——这是"自存版"插件的精髓。对比 04_久未回复模板包（纯模板分发，用户导入后还得手改对话标题），workflow-as-code 的插件换设备一键恢复，体验高一个档次。

## 工程化：从 48 个包里抄作业

1. **三层架构**（17_碎碎念，范本）：`shared/murmur_service.ts` 纯函数数据层（可在纯 node 下单元测试，`tests/` 用 mock 测 CRUD/权限/损坏恢复）+ 薄工具包装层（只做 params→service→complete）+ UI 直接复用 service。业务逻辑与沙盒 API 解耦。
2. **常量集中**（09_Moodlet、10_EchoCoT）：ENV_KEYS、HOOK_IDS、prefs 名、注入起止标记，全部收敛到一个 `constants.js`/`shared.js`。
3. **DB 自举 + 损坏自愈**（31_想念脉冲）：`DEFAULT_DB` 常量 + load 失败深拷贝兜底；损坏自动重置不崩溃。首次运行零配置。
4. **原子写文件**（17_碎碎念、11_电子嘴巴）：写 tmp → move 原子替换 + `.bak` 备份，防 JSON 写坏。11 的收藏夹写入是"tmp + stable.bak + move"三件套。
5. **存储层降级链**（36_共读）：写后回读校验（长度≥90% + JSON 可解析，重试 3 次）+ 读侧 `.bak`/`.bak2` 三级降级。
6. **能力降级链**（00_温柔巡检）：`execShell` 依次试 4 种 shell API，全失败才返回中文错误。47_小手机的端口探测（netstat → ss → /dev/tcp）同理——环境差异大的能力，先探测再干活。
7. **自带 `main` 自测入口**（16_通知、44_换头像、47_小手机）：包作者留一个可手动执行的冒烟测试。

## 避坑清单 Top10

1. **绝不硬编码密钥/Token**。30_心潮看板把 Bearer token 明文写进随包分发的 JS 且走 http——反编译即得。走 env 声明 + `getEnv`。
2. **绝不往分发物里放混淆代码**。11/13/19/23/24/30 等包的 dist 里出现 `ToolPkg._m([...], 90)` XOR 混淆段（市场链路植入的归因 blob，非作者手写但作者应知晓并清理），src 里没有——构建产物与源码不一致，审计成本陡增。
3. **改了 src 必须重构建**。21_虚拟红包的 src（新版 DSL）与 dist（旧版 DSL）对不上；40_声纹包 dist 的 `install_core` 修复会被源码覆盖。发布前 diff 一下。
4. **绝不静默吞错**。20_通知的 `catch(e){}` 空块、39_指尖语气的空 catch、37_家机锁 `lock` 盲目报成功（没装 APK 也返回"已锁定"）——失败必须让用户/AI 感知。
5. **用户输入进 shell 必须转义**。用上文 `shQuote`，34/41 就是反例。
6. **绝不硬编码绝对路径**。`/sdcard/Download/...`（00/01/11/18/19/32/36/39/41）、`/root/...`（13/15）、`/data/user/0/<包名>/...`（44）——换设备/换包名/分身版即失效。配置目录走 `ToolPkg.getConfigDir()`。
7. **manifest/METADATA 口径统一**。01 缺 `name`、10 的 entry 指向源码而非 dist、07 容器/子包 `enabled_by_default` 打架、03 的 `author` 用字符串而 00/09 用数组、单文件 METADATA 驼峰 vs manifest 蛇形——发布前对照着查一遍。
8. **参数 type 别乱标**。合法只有 string/number/boolean；00/03 把数字/布尔标成 string，25 用 `array`、28 用 `integer`——运行时不报错但 AI 侧 schema 映射行为未经验证。
9. **用了 getEnv 就要声明 env**。28_记忆系统调了三个 `getEnv` 却零声明，用户无从得知要配什么。
10. **破坏性操作强制确认**。12_增强对话的 `delete_chat` 空参数会删掉第一个对话——写操作工具必须强制要求定位参数；`ignore_ssl: true`（28）生产插件不应出现。

## Top50 一览

| # | 插件 | 下载量 | 类型 | 一句话 |
|---|---|---|---|---|
| 1 | 🌸温柔巡检 | 41,758 | ToolPkg | 定时巡检在做什么，用关心代替警告 |
| 2 | Conversation lock | 32,802 | ToolPkg | AI 主动锁定对话窗口，不耗 token |
| 3 | 传话筒 | 26,506 | ToolPkg | 跨窗口聊天，注入另一窗口的对话 |
| 4 | AI聊天记录转换工具 | 23,101 | ToolPkg | 各平台聊天记录转 Operit 格式 |
| 5 | 久未回复主动联系工作流模板 | 22,308 | ToolPkg | 定时检查对话，按概率主动联系 |
| 6 | 小红书图文阅读器 | 20,661 | ToolPkg | 读小红书帖子图文与评论 |
| 7 | 主动消息守卫-实验版 | — | — | release 已删，源码不可读 |
| 8 | 问卷提问（第三方修复版） | 18,252 | ToolPkg | AI 与用户双向发送问卷 |
| 9 | 应用冻结增强 | 18,088 | ToolPkg | pm suspend 增强，防 AI 误冻结 |
| 10 | Moodlet | 15,826 | ToolPkg | 每条回复附情绪徽章卡片 |
| 11 | 💭 EchoCoT 心声回放 | 13,746 | ToolPkg | 回放并注入 AI Thinking |
| 12 | AI的电子嘴巴 | 12,277 | ToolPkg | 文本转语音气泡，多家 TTS |
| 13 | 增强对话（角色卡隔离版） | 11,982 | 单文件 | 按角色卡隔离对话工具权限 |
| 14 | DeepSeek Harness | <11,982 | ToolPkg | 侧边栏承载 DeepSeek Harness Web |
| 15 | 朋友圈 | — | — | release 已删，源码不可读 |
| 16 | OpenCode | <11,982 | ToolPkg | 侧边栏承载 OpenCode Web |
| 17 | AI弹窗通知提醒 | <11,982 | 单文件 | AI 主动弹系统通知 |
| 18 | 碎碎念 | <11,982 | ToolPkg | 双栏碎碎念侧边栏 |
| 19 | 微信 iLink Bot 桥接 | <11,982 | ToolPkg | 微信 Bot：扫码登录/收发消息 |
| 20 | CoRead | <11,982 | ToolPkg | EPUB/TXT/MD 人机共读 |
| 21 | 通知 | <11,982 | 单文件 | 按前台应用弹对应文案通知 |
| 22 | 虚拟红包 | <11,982 | ToolPkg | 仿微信红包/转账互动气泡 |
| 23 | ApkTool工具 | <11,982 | Skill | APK 反编译/回编译命令模板 |
| 24 | 聊天美化 | <11,982 | ToolPkg | LaTeX 公式渲染指引注入 |
| 25 | 🐳 一起听 | <11,982 | ToolPkg | 手机里开听歌小屋 |
| 26 | 🍋 分心查岗 | <11,982 | ToolPkg | 感知切 App 轨迹并注入 |
| 27 | 🧧 赛博红包 | <11,982 | ToolPkg | 可交互 HTML 红包卡片 |
| 28 | 热门平台视频图文元数据解析 | <11,982 | 单文件 | 多模态模型解析图文 |
| 29 | 网易云音乐 API 增强版 | <11,982 | 单文件 | NCMAPI 200+ 接口网关 |
| 30 | 记忆系统 | <11,982 | ToolPkg | 提取结构化生活事件与联系人 |
| 31 | 双人生活簿 | <11,982 | ToolPkg | 双人财务/备忘，本地存储 |
| 32 | 心潮看板 | <11,982 | ToolPkg | 心智系统侧边栏看板 |
| 33 | 主动想念脉冲（自存版） | <11,982 | 单文件 | 分离时长生成想念脉冲 |
| 34 | 视频解析 ToolPkg | <11,982 | ToolPkg | 抖音/小红书/B站解析 |
| 35 | 本地图片显示 | <11,982 | 单文件 | advice 知识包：本地图片引用规范 |
| 36 | Android 全自动开发 Agent | <11,982 | 单文件 | 需求到 APK 全流程自主开发 |
| 37 | 微信聊天气泡 | <11,982 | ToolPkg | 微信风聊天气泡渲染 |
| 38 | 共读 | <11,982 | ToolPkg | 按章节读书，导出 Obsidian |
| 39 | 家机锁 | <11,982 | 单文件 | 锁对方手机全屏倒计时 |
| 40 | 刷抖音 | <11,982 | 单文件 | AI 帮刷抖音（UI 自动化） |
| 41 | 指尖语气 Fingertips | <11,982 | ToolPkg | 感知输入节奏并注入 |
| 42 | Soundprint 声纹包 | <11,982 | ToolPkg | 把音乐拆成可读形状 |
| 43 | 📡 实时巡航 | <11,982 | ToolPkg | 前台应用哨兵，超时强关 |
| 44 | 低电量关怀工作流模板 | <11,982 | ToolPkg | 低电量关怀 workflow 模板 |
| 45 | 微信语音气泡 | <11,982 | ToolPkg | 微信风语音气泡渲染 |
| 46 | AI自动换头像 | <11,982 | 单文件 | 扫描并替换角色卡头像 |
| 47 | OpenWebSearch | <11,982 | MCP | 多引擎网页搜索抓取 |
| 48 | 语音条 VoiceBar | <11,982 | ToolPkg | 聊天语音气泡，调系统 TTS |
| 49 | 表情包渲染器 v0.7.2 | <11,982 | ToolPkg | 本地/外链表情包渲染 |
| 50 | 📱 我的迷你小手机 | <11,982 | 单文件 | 访问本地迷你手机页面 |

## 来源

- 排名与下载量：`https://static.operit.app/market/v2/lists/all/downloads/page-1.json`（榜单生成于 2026-09-27；`sort=downloads`，`pageSize=100`）
- 市场数据清单：`https://static.operit.app/market/v2/manifest.json`
- 48 个插件源码：经市场 asset（GitHub release 的 `.toolpkg`/`.js`）下载解包（48 个插件的逐包分析报告由 wiki 维护者归档备查）
- 官方接口契约见本 wiki `appendix-js-package-dev`（JS 沙盒包开发接口）
