# 沙盒包（Package）

> 这里的“沙盒包”对应 Operit 界面里的 `Packages` 标签。  
> 本页已按 `D:\Code\prog\assistance\app\src\main\assets\packages` 同步更新。

## 它是什么

沙盒包是用脚本定义的动态工具包。你可以把它理解为：

- 一组可被 AI 调用的工具函数
- 一份包级元数据（名称、说明、参数、环境变量、状态切换等）

使用方式是先 `use_package(package_name)` 激活，再通过 `包名:工具名` 调用。

## 当前内置包统计（基于 packages 目录）

- 内置包总数：`30`
- 默认启用：`19`
- 默认不启用：`11`

默认启用包：

- `12306_ticket`
- `all_about_myself`
- `Automatic_ui_base`
- `code_runner`
- `crossref`
- `daily_life`
- `extended_chat`
- `extended_file_tools`
- `extended_http_tools`
- `extended_memory_tools`
- `ffmpeg`
- `file_converter`
- `super_admin`
- `system_tools`
- `time`
- `various_output`
- `various_search`
- `web`
- `workflow`

默认不启用包：

- `Automatic_ui_subagent`
- `duckduckgo`
- `github`
- `google_search`
- `nanobanana_draw`
- `openai_draw`
- `qwen_draw`
- `tasker`
- `tavily`
- `vflow_trigger`
- `xai_draw`

## 全部内置包清单

| 包名（use_package） | 默认启用 | 源文件 | 作用概述 |
|---|---|---|---|
| `12306_ticket` | 是 | `12306.js` | 12306 火车票信息查询（余票/中转/经停等） |
| `all_about_myself` | 是 | `all_about_myself.js` | AI 自我说明与能力认知提示 |
| `Automatic_ui_base` | 是 | `automatic_ui_base.js` | 基础 UI 自动化（点击/滑动/输入等） |
| `Automatic_ui_subagent` | 否 | `automatic_ui_subagent.js` | UI 子代理执行复杂自动化流程 |
| `code_runner` | 是 | `code_runner.js` | 多语言代码执行（如 JS/Python/C++ 等） |
| `crossref` | 是 | `crossref.js` | Crossref 学术文献检索 |
| `daily_life` | 是 | `daily_life.js` | 日常工具（时间/提醒/闹钟/设备状态等） |
| `duckduckgo` | 否 | `duckduckgo.js` | DuckDuckGo 网络搜索与内容抓取 |
| `extended_chat` | 是 | `extended_chat.js` | 对话查询、跨话题读取、消息发送 |
| `extended_file_tools` | 是 | `extended_file_tools.js` | 扩展文件操作（复制/移动/压缩/解压/分享等） |
| `extended_http_tools` | 是 | `extended_http_tools.js` | 扩展 HTTP 请求与文件上传 |
| `extended_memory_tools` | 是 | `extended_memory_tools.js` | 扩展记忆管理（创建/更新/删除/链接） |
| `ffmpeg` | 是 | `ffmpeg.js` | FFmpeg 多媒体处理 |
| `file_converter` | 是 | `file_converter.js` | 多格式文件转换（音视频/图片/文档） |
| `github` | 否 | `github.js` | GitHub REST API 与本地补丁/终端能力 |
| `google_search` | 否 | `google_search.js` | Google 与 Google Scholar 搜索 |
| `nanobanana_draw` | 否 | `nanobanana_draw.js` | Nano Banana 文生图/图生图 |
| `openai_draw` | 否 | `openai_draw.js` | OpenAI 图像生成 |
| `qwen_draw` | 否 | `qwen_draw.js` | DashScope（通义）图像生成 |
| `super_admin` | 是 | `super_admin.js` | 高权限终端与系统命令操作 |
| `system_tools` | 是 | `system_tools.js` | 系统设置、应用、通知、位置、Intent 等 |
| `tasker` | 否 | `tasker.js` | 触发 Tasker 事件 |
| `tavily` | 否 | `tavily.js` | Tavily 搜索/提取/爬取/站点地图 |
| `time` | 是 | `time.js` | 时间相关能力 |
| `various_output` | 是 | `various_output.js` | 多样输出能力（含图片输出） |
| `various_search` | 是 | `various_search.js` | 多平台搜索（含图片搜索） |
| `vflow_trigger` | 否 | `vflow_trigger.js` | 触发 vflow App 工作流 |
| `web` | 是 | `web.js` | 浏览器驱动的网页自动化操作 |
| `workflow` | 是 | `workflow.js` | 工作流创建/查询/更新/触发 |
| `xai_draw` | 否 | `xai_draw.js` | xAI 图像生成 |

## 用户视角：你会在界面看到什么

在 `包管理 > Packages`：

- 查看可用包和已导入包
- 导入外部包（当前界面导入器主要支持 `.js`）
- 启用/停用某个包
- 查看包详情、工具列表和环境变量要求

外部包目录（应用提示路径）：

`Android/data/com.ai.assistance.operit/files/packages`

## 环境配置按钮在哪里

请按下面路径找：

1. 进入 `包管理`
2. 切到 `Packages` 标签（不是 `Skills` / `MCP`）
3. 看页面**右下角**的浮动按钮区：
   - 大号 `+` 按钮：导入外部包
   - 小号齿轮按钮（`管理环境变量`）：这就是环境配置入口

点击齿轮后会弹出 `配置环境变量` 对话框，你可以按包填写该包 `env` 里声明的变量（如 API Key）。

补充：当存在包加载错误时，右下角还会多一个红色错误按钮；这时“环境配置”按钮通常位于红色错误按钮和 `+` 按钮之间。

## 调用方式（统一且清晰）

1. 激活包：`use_package(package_name)`
2. 调用工具：`packageName:toolName`

示例：

- `use_package("daily_life")`
- `daily_life:get_current_date`

> 系统也支持“先直接调用 `packageName:toolName` 再自动尝试激活”，但建议仍按“先激活后调用”理解。

## 包的高级能力（给进阶用户）

沙盒包支持：

- `env`：声明包所需环境变量（可必填 / 可选 / 默认值）
- `states`：按设备条件自动切换工具集（如权限等级、是否可用 Shizuku、虚拟显示能力等）

这意味着同一个包在不同设备或授权级别下，最终可用工具可能不同。

## 如何编写自己的沙盒包

官方脚本开发文档：

- GitHub 页面：`https://github.com/AAswordman/Operit/blob/main/docs/SCRIPT_DEV_GUIDE.md`
- Raw 链接：`https://raw.githubusercontent.com/AAswordman/Operit/main/docs/SCRIPT_DEV_GUIDE.md`

最小结构（示意）：

```js
/*
METADATA
{
  "name": "my_package",
  "description": { "zh": "我的包", "en": "My package" },
  "tools": [
    {
      "name": "hello",
      "description": { "zh": "打招呼", "en": "Say hello" },
      "parameters": []
    }
  ]
}
*/

async function hello(params) {
  complete({ success: true, message: "hello" });
}

exports.hello = hello;
```

## 常见问题

- **导入失败：仅支持 JavaScript 文件**
  - 在当前 Packages 页导入流程中，请优先使用 `.js` 文件
- **激活成功但工具不可用**
  - 检查是否漏配 `env`
  - 检查该包当前 `state` 是否把工具排除了
- **调用报“包未激活”**
  - 先显式执行一次 `use_package(package_name)`
