---
title: 插件最小实例集
module: 附录
sources: 9
date: 2026-10-03
issue: 154
---

# appendix-plugin-examples（插件最小实例集）

> 种子：`app/src/main/assets/packages/`（31 个内置包实证：`time.js`、`duckduckgo.js`、`github.js`、`tavily.js`、`minimax_draw.js`、`automatic_ui_subagent.js`）@ `dbf71916`

> 一句话：每个例子只演示**一个**集成点，代码完整可直接存成 `.js` 导入。先抄再改——这是 Pi 的 `examples/` 哲学：从最小的匹配示例开始。

## 概述

人话：看契约手册（`appendix-plugin-contract`）知道"机器保证什么"，看这一页知道"具体怎么写"。每个例子都提炼自真实内置包，删掉了业务逻辑，只剩骨架。例子按"先能跑 → 再取配置 → 再联网 → 再处理长任务 → 再玩条件"排序。

## AI 速览

- **核心符号清单**：`exports.工具名`（工具导出）、`targetFunction(params)`（单对象参数调用）、`getEnv`（环境变量读取）、`OkHttp.newClient()`（网络请求）、`complete(value)`（显式回传）、`states[]`（条件工具集）、`advice: true`（建议性工具）。
- **主入口**：所有例子存成 `.js` 后，通过包管理界面"导入"或放进 `Android/data/<应用包名>/files/packages/`（`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:2482`）。
- **数据流向一句话**：METADATA 声明工具 → `exports.工具名` 导出同名函数 → AI 以 `targetFunction(params)` 调用 → return / `complete()` 回传。

## 例 1：最小可运行包

一个工具，无参数，同步返回。提炼自 `time.js`（`get_time` 骨架）。

```js
/* METADATA
{
  name: hello
  display_name: { zh: "打招呼", en: "Hello" }
  description: { zh: "最小可运行包", en: "Minimal runnable package" }
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
async function greet(params) {
    return "你好，" + params.who + "！";
}
exports.greet = greet;
```

要点：函数名必须等于 `tools[].name`；`params` 是单个对象；`async` 可省略，这里保留是提醒你异步也一样写。

## 例 2：环境变量读取

密钥不硬编码，走 env 声明 + `getEnv` 防御读取。提炼自 `app/src/main/assets/packages/github.js:285`。

```js
/* METADATA
{
  name: env_demo
  display_name: { zh: "环境变量演示", en: "Env demo" }
  description: { zh: "演示 env 声明与读取", en: "Demo env declaration and reading" }
  category: "Utility"
  env: [
    { name: "API_TOKEN", description: { zh: "接口令牌", en: "API token" }, required: true }
    { name: "API_BASE_URL", description: { zh: "接口地址", en: "API base URL" }, required: false, defaultValue: "https://api.example.com" }
  ]
  tools: [
    {
      name: whoami
      description: { zh: "回显当前配置", en: "Echo current config" }
      parameters: []
    }
  ]
}*/
async function whoami(params) {
    const get = (typeof getEnv === "function") ? getEnv : () => undefined;
    const token = get("API_TOKEN");
    if (!token) return { ok: false, message: "API_TOKEN 未配置" };
    return { ok: true, baseUrl: get("API_BASE_URL"), tokenSet: true };
}
exports.whoami = whoami;
```

要点：`required: true` 的 env 缺失时包**无法激活**（不是调用时报错）；`getEnv` 前先做 `typeof` 防御，因为有些执行路径不注入它。

## 例 3：网络请求

用注入的 `OkHttp` 发请求。提炼自 `app/src/main/assets/packages/duckduckgo.js:46`（`OkHttp.newClient()`）。

```js
/* METADATA
{
  name: http_demo
  display_name: { zh: "网络请求演示", en: "HTTP demo" }
  description: { zh: "演示 OkHttp 请求", en: "Demo OkHttp request" }
  category: "Utility"
  tools: [
    {
      name: fetch_title
      description: { zh: "抓取网页标题", en: "Fetch page title" }
      parameters: [
        { name: "url", description: { zh: "网址", en: "URL" }, type: "string", required: true }
      ]
    }
  ]
}*/
async function fetch_title(params) {
    const client = OkHttp.newClient();
    const resp = client.newCall({ url: params.url }).execute();
    const html = resp.body().string();
    const m = html.match(/<title>([\s\S]*?)<\/title>/i);
    return { ok: true, title: m ? m[1].trim() : "(无标题)" };
}
exports.fetch_title = fetch_title;
```

要点：`OkHttp` 是沙盒注入的全局对象，无需 import；抛错会直接变成工具调用失败回传给 AI。

## 例 4：complete 统一回传

长流程中拿到结果就提前结束，并统一成功/失败格式。提炼自 `duckduckgo.js:200-204`。

```js
/* METADATA
{
  name: complete_demo
  display_name: { zh: "回传演示", en: "Complete demo" }
  description: { zh: "演示 complete 显式回传", en: "Demo explicit complete" }
  category: "Utility"
  tools: [
    {
      name: divide
      description: { zh: "除法", en: "Division" }
      parameters: [
        { name: "a", description: { zh: "被除数", en: "Dividend" }, type: "number", required: true }
        { name: "b", description: { zh: "除数", en: "Divisor" }, type: "number", required: true }
      ]
    }
  ]
}*/
async function divide(params) {
    try {
        if (params.b === 0) throw new Error("除数不能为 0");
        complete({ success: true, data: params.a / params.b });
    } catch (e) {
        complete({ success: false, message: e.message });
    }
}
exports.divide = divide;
```

要点：`complete(value)` 后函数就结束了，后续代码不执行；适合"分支很多、拿到结果就走"的写法。不调 `complete` 直接 `return` 也一样，只是少了提前结束的能力。

## 例 5：states 条件工具

同一包在不同环境下暴露不同工具。提炼自 `automatic_ui_subagent.js`（`states[]` 骨架）。

```js
/* METADATA
{
  name: states_demo
  display_name: { zh: "条件工具演示", en: "States demo" }
  description: { zh: "演示 states 条件工具集", en: "Demo conditional tool sets" }
  category: "Utility"
  tools: [
    {
      name: ping
      description: { zh: "基础连通性检查", en: "Basic connectivity check" }
      parameters: []
    }
  ]
  states: [
    {
      id: "with_shizuku"
      condition: "android.shizuku_available"
      inheritTools: true
      tools: [
        {
          name: shell_adv
          description: { zh: "高级 shell（需 Shizuku）", en: "Advanced shell (needs Shizuku)" }
          parameters: [
            { name: "cmd", description: { zh: "命令", en: "Command" }, type: "string", required: true }
          ]
        }
      ]
    }
  ]
}*/
async function ping(params) { return "pong"; }
async function shell_adv(params) { return { cmd: params.cmd, note: "此处接 Shizuku 调用" }; }
exports.ping = ping;
exports.shell_adv = shell_adv;
```

要点：`condition` 按顺序求值，首个命中的 state 生效；`inheritTools: true` 保留基础工具再叠加。`condition` 的 key 只能用能力快照里的（`platform.*`、`android.*`、`ui.*`），写别的永远为假。

## 例 6：advice 建议性工具

只想让 AI"知道"，不想让它"调用"——比如使用手册。提炼自 `automatic_ui_base.js` 模式。

```js
/* METADATA
{
  name: advice_demo
  display_name: { zh: "建议工具演示", en: "Advice demo" }
  description: { zh: "演示 advice 建议性工具", en: "Demo advice-only tool" }
  category: "Utility"
  tools: [
    {
      name: real_tool
      description: { zh: "真正可调用的工具", en: "A really callable tool" }
      parameters: []
    }
    {
      name: usage_manual
      description: { zh: "使用手册：调用 real_tool 前请先确认用户意图；返回结果为 JSON 字符串，需自行解析。", en: "Manual: confirm user intent before calling real_tool; results are JSON strings." }
      advice: true
    }
  ]
}*/
async function real_tool(params) { return { ok: true }; }
exports.real_tool = real_tool;
// 注意：advice 工具不需要写同名函数，也不会被调用
```

要点：`advice: true` 的工具免函数存在性校验，不注册为可执行工具，只把 description 塞进 prompt。这是"给 AI 的说明书"的标准做法。

## 例 7：长任务轮询模式

调用异步接口后轮询等结果，超时兜底。提炼自 `minimax_draw.js`（生图任务模式）。

```js
/* METADATA
{
  name: poll_demo
  display_name: { zh: "轮询演示", en: "Poll demo" }
  description: { zh: "演示长任务轮询", en: "Demo long-task polling" }
  category: "Utility"
  env: [
    { name: "TASK_API_TOKEN", description: { zh: "任务接口令牌", en: "Task API token" }, required: true }
  ]
  tools: [
    {
      name: run_long_task
      description: { zh: "提交长任务并轮询等结果", en: "Submit long task and poll" }
      parameters: [
        { name: "prompt", description: { zh: "任务描述", en: "Task prompt" }, type: "string", required: true }
      ]
    }
  ]
}*/
async function run_long_task(params) {
    const get = (typeof getEnv === "function") ? getEnv : () => undefined;
    const client = OkHttp.newClient();
    const headers = { "Authorization": "Bearer " + get("TASK_API_TOKEN") };
    // 1. 提交任务
    const submit = client.newCall({
        url: "https://api.example.com/tasks",
        method: "POST",
        headers: headers,
        body: JSON.stringify({ prompt: params.prompt })
    }).execute();
    const taskId = JSON.parse(submit.body().string()).id;
    // 2. 轮询等结果（单次调用上限 30 分钟，这里设 5 分钟兜底）
    const deadline = Date.now() + 5 * 60 * 1000;
    while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 3000));
        const q = client.newCall({
            url: "https://api.example.com/tasks/" + taskId,
            headers: headers
        }).execute();
        const st = JSON.parse(q.body().string());
        if (st.status === "done") return { ok: true, result: st.result };
        if (st.status === "failed") return { ok: false, message: st.error };
    }
    return { ok: false, message: "任务超时，请稍后用 taskId 查询：" + taskId };
}
exports.run_long_task = run_long_task;
```

要点：单次工具调用上限 30 分钟，轮询一定要设自己的 deadline；把 taskId 返回给 AI，超时后 AI 可以再调一次继续查。

## 例 8：一文件多工具

一个文件放多个工具，互不干扰。提炼自 `time.js`（`get_time` + `format_time`）。

```js
/* METADATA
{
  name: multi_demo
  display_name: { zh: "多工具演示", en: "Multi-tool demo" }
  description: { zh: "演示一文件多工具", en: "Demo multiple tools in one file" }
  category: "Utility"
  tools: [
    { name: tool_a, description: { zh: "工具 A", en: "Tool A" }, parameters: [] }
    { name: tool_b, description: { zh: "工具 B", en: "Tool B" }, parameters: [] }
  ]
}*/
const multiPkg = (function () {
    // 内部共享逻辑放闭包里，工具函数保持干净
    function shared() { return "shared"; }
    async function tool_a(params) { return { a: 1, s: shared() }; }
    async function tool_b(params) { return { b: 2, s: shared() }; }
    return { tool_a, tool_b };
})();
exports.tool_a = multiPkg.tool_a;
exports.tool_b = multiPkg.tool_b;
```

要点：解析器把**整个文件内容**填进每个工具的 `script`（`app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt:2296`），所以多工具共享闭包是零成本的；每个工具调用时都是独立执行上下文，互不干扰。

## 来源

- `app/src/main/assets/packages/time.js`：IIFE + exports 写法、一文件多工具
- `app/src/main/assets/packages/duckduckgo.js`：`OkHttp.newClient()`（:46）、`complete()` 统一回传（:200-204）、限流器模式
- `app/src/main/assets/packages/github.js`：env 声明 + `getEnv` 防御读取（:285）
- `app/src/main/assets/packages/tavily.js`：搜索类包写法参考
- `app/src/main/assets/packages/minimax_draw.js`：长任务提交 + 轮询模式
- `app/src/main/assets/packages/automatic_ui_subagent.js`：`states[]` 条件工具集
- `app/src/main/assets/packages/automatic_ui_base.js`：`advice` 建议性工具模式
- `app/src/main/java/com/ai/assistance/operit/core/tools/packTool/PackageManager.kt`：包解析与注册（:2249、:2296、:2444、:3458）
- `app/src/main/java/com/ai/assistance/operit/core/tools/javascript/JsExecutionScriptBuilder.kt`：执行入口（:400）、`targetFunction(params)`（:1386）
