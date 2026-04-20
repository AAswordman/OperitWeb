# 09. Tools: Sandbox Packages

This is a tool format unique to the software — more capable than Skills, yet lighter than MCP.

Following up on our discussion of progressive tool loading from the previous section: sandbox packages are JS scripts powered by the QuickJS engine combined with the software's built-in functions. They can call any built-in tool via `Tools.*`, and also interact directly with the app's Kotlin code through JavaBridge — extremely powerful.

The software includes many built-in sandbox packages that implement a wide variety of functions. This section will break down the structure and principles of sandbox packages, and list all currently available packages. (Individual tools within each package won't be listed here — you can see those in the app itself.)

The software currently includes the following **28 sandbox packages**:

| Package | Description |
|---------|-------------|
| `12306_ticket` | 12306 train ticket information lookup, including remaining tickets, transfers, and station stops |
| `code_runner` | Multi-language code execution, supports JavaScript, Python, Ruby, Go, Rust, C, C++ |
| `crossref` | Crossref academic literature search, supports DOI lookup, keyword search, author search |
| `daily_life` | Daily life tools: date/time, weather, reminders, alarms, SMS, phone calls, WeChat/QQ messaging, flashlight, volume control, Wi-Fi toggle, screenshots, camera, etc. |
| `extended_chat` | Chat management: list/find/rename/delete conversations, read messages across topics, bind character cards and send messages |
| `extended_file_tools` | Extended file tools: file_exists / move_file / copy_file / file_info / unzip_files / zip_files / open_file / share_file |
| `extended_http_tools` | Extended network tools: file uploads, GET/POST and other direct HTTP requests |
| `extended_memory_tools` | Extended memory tools: create/update/delete/query/link memories, update user preferences |
| `ffmpeg` | FFmpeg multimedia processing |
| `file_converter` | File format conversion: audio/video (MP4, MOV, MP3, WAV), images (JPG, PNG, WEBP), documents (Markdown, HTML, DOCX, PDF) |
| `super_admin` | Super admin toolkit: terminal commands and shell operations, terminal runs in Ubuntu environment, shell executes Android system commands via Shizuku/Root |
| `system_tools` | System-level tools: settings management, app install/uninstall/launch, notification retrieval, location services, device info, Intent/broadcast calls |
| `time` | Time-related functions |
| `various_search` | Multi-platform search (including image search), supports Bing, Baidu, Sogou, Quark, etc. |
| `workflow` | Workflow management: create/query/update/enable/disable/delete/trigger execution, supports on_success/on_error branching and voice triggers |
| `Automatic_ui_subagent` | UI automation sub-agent, based on an independent UI controller model, automatically plans and executes click/input/swipe interface operations |
| `bilibili_tools` | Bilibili video analysis: get subtitles, danmaku, comments, and search videos |
| `linux_ssh` | Linux SSH connections, tmux long-running tasks, and remote file operations |
| `browser` | Browser automation toolkit, aligned with Playwright MCP default browser tools |
| `operit_editor` | Operit platform configuration editor: MCP, Skills, sandbox packages, feature model binding, model parameters, context summarization, TTS/STT voice service config |
| `ctx_limiter_c` | Truncates the latest N context layers, keeps SYSTEM messages and the most recent N USER/ASSISTANT layers, mainly for APIs without caching |

Building on sandbox packages, we've also extended the Toolpkg plugin format (kind of like Minecraft's modpkg?). This will be covered in detail in a later section.

## Built-in vs External

## Structure

## Applications

### Drawing Output

### Delayed Reminders

### File Conversion