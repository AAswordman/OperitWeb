# 09. 工具：沙盒包

这是软件特有的一种工具形式，比skill能力大，比mcp轻量级。
承接我们上一节关于渐进式工具加载的内容继续。沙盒包是以quickjs引擎，配合软件预制的函数运行的一种js脚本。目前它可以使用Tools.*调用软件的一切内置工具，也可以使用JavaBridge直接交互和触碰软件的Kotlin代码，非常的强悍。

软件有很多的内置沙盒包，实现了各种各样的功能。这一节内容，将会详细解析沙盒包的构造和原理，以及软件目前的所有沙盒包。（包内工具就不介绍了，这个在软件里面也是能看到的）

目前软件内置了以下 **28 个沙盒包**：

| 包名 | 说明 |
|------|------|
| `12306_ticket` | 12306火车票信息查询，包括余票、中转、经停站等 |
| `code_runner` | 多语言代码执行，支持 JavaScript、Python、Ruby、Go、Rust、C、C++ |
| `crossref` | Crossref 学术文献查询，支持 DOI 查询、关键词搜索、作者搜索 |
| `daily_life` | 日常生活工具集：日期时间、天气、提醒、闹钟、短信、电话、微信/QQ消息发送、手电筒、音量调节、Wi-Fi开关、截图、拍照等 |
| `extended_chat` | 对话管理工具：列出/查找/重命名/删除对话、跨话题读取消息、绑定角色卡对话并发送消息 |
| `extended_file_tools` | 扩展文件工具：file_exists / move_file / copy_file / file_info / unzip_files / zip_files / open_file / share_file |
| `extended_http_tools` | 扩展网络工具：文件上传、GET/POST 等直接网络请求 |
| `extended_memory_tools` | 扩展记忆工具：创建/更新/删除/查询/链接记忆，以及更新用户偏好 |
| `ffmpeg` | FFmpeg 多媒体处理工具 |
| `file_converter` | 文件格式转换：音视频（MP4、MOV、MP3、WAV）、图像（JPG、PNG、WEBP）、文档（Markdown、HTML、DOCX、PDF）互转 |
| `super_admin` | 超级管理员工具集：终端命令和 Shell 操作，terminal 运行在 Ubuntu 环境中，shell 通过 Shizuku/Root 执行 Android 系统命令 |
| `system_tools` | 系统级操作工具：设置管理、应用安装卸载与启动、通知获取、位置服务、设备信息查询、Intent/广播调用 |
| `time` | 时间相关功能 |
| `various_search` | 多平台搜索（含图片搜索），支持必应、百度、搜狗、夸克等 |
| `workflow` | 工作流管理：创建/查询/更新/启用/禁用/删除/触发执行，支持 on_success/on_error 分支和语音触发 |
| `Automatic_ui_subagent` | UI 自动化子代理，基于独立 UI 控制器模型，自动规划并执行点击/输入/滑动等界面操作 |
| `bilibili_tools` | B站视频信息分析：获取字幕、弹幕、评论和搜索视频 |
| `linux_ssh` | Linux SSH 连接、tmux 长任务与远程文件操作 |
| `browser` | 浏览器自动化工具集，对齐 Playwright MCP 默认 browser 工具 |
| `operit_editor` | Operit 平台配置直改：MCP、Skill、沙盒包、功能模型绑定、模型参数、上下文总结与 TTS/STT 语音服务配置 |
| `ctx_limiter_c` | 截取最近 N 层上下文，保留 SYSTEM 消息和最近 N 层 USER/ASSISTANT，主要用于无缓存 API |

在沙盒包的基础上，我们拓展了Toolpkg插件格式（有点像mc的modpkg？）这个内容放到后面再详细讲解。

## 内置与外置

## 结构

## 应用

### 绘图输出

### 延时提醒

### 转换文件