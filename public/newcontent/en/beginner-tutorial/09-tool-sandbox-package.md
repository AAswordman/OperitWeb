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

Sandbox packages come in two types: built-in and external.

Built-in packages are the ones that ship with the app — the ones listed in the table above. They come pre-installed and don't need any setup. You can't delete them, but you can toggle them on and off — just disable the ones you don't need.

External packages are ones you import yourself. The process is straightforward: just place a `.js` script file or a `.toolpkg` plugin file into the external packages directory (`Android/data/com.ai.assistance.operit/files/packages`), and the app will detect it automatically. When you no longer need one, you can simply delete it by its file path.

What's interesting is that from the AI's perspective, there's absolutely no difference between built-in and external packages. It just uses `use_package` to activate them and `package_proxy` to call the tools inside — it doesn't need to know where a package came from.

## Structure

As mentioned earlier, a sandbox package is essentially a JS script running in the QuickJS engine. But it's not just any script — it interacts with the system through the app's built-in functions and interfaces.

A basic sandbox package is simply a `.js` file. Inside the script, you can use `Tools.*` to call any of the app's built-in tools — meaning everything you saw in chapter 08 (read_file, apply_file, visit_web, etc.) is fully available inside sandbox packages. Beyond that, it can also interact directly with the app's Kotlin code through JavaBridge, making it extremely capable.

Building on regular sandbox packages, we've extended a plugin format called **ToolPkg**. You can think of it as a bundled plugin package that can contain multiple scripts, resource files, and a configuration manifest. It's somewhat like Minecraft's modpkg — pack everything together, install one package, and get a whole suite of features. We'll cover ToolPkg in detail in a later tutorial.

If you want to write your own sandbox packages, you can refer to the official script development documentation (available on GitHub), which includes complete API references and examples.

## Applications

Talking about principles can be a bit abstract, so let's look at a few real-world scenarios to get a feel for what sandbox packages can actually do.

### Drawing Output

You might wonder — how does the AI draw pictures? The drawing feature is actually implemented through sandbox packages. The app includes multiple drawing-related packages, each integrating a different drawing service — such as MiniMax, OpenAI, SiliconFlow, Qwen, xAI, Zhipu, and more.

![Drawing package list](</manuals/assets/tools/draw_package_list.jpg>)

You just need to enable one of the available drawing packages in the package manager — you don't need all of them. When the AI needs to generate an image, it automatically activates the corresponding package, calls the drawing tools inside, and presents the result to you.

One thing to keep in mind: drawing packages are a bit different from regular sandbox packages. They usually require **environment variables** to be configured (such as API Keys). In the package manager, each package has a few buttons on the right side — the first button opens the "Manage Configuration" dialog. Inside, you'll see exactly which environment variables need to be filled in. For example, the MiniMax drawing package requires `MINIMAX_API_KEY` before it can make API calls.

![Drawing package environment variable configuration](</manuals/assets/tools/draw_package_env_config.jpg>)

### Delayed Reminders

"Set an alarm for 8am tomorrow" or "Remind me about the meeting at 3pm" — these everyday tasks are handled by the `daily_life` sandbox package. It wraps system capabilities like alarms and reminders into tools the AI can call directly. When the AI receives your instruction, it activates this package and uses the reminder or alarm tools to complete the action. All you need to do is say what you want — the AI and the sandbox package handle everything else.

### File Conversion

If you have a `.webp` image and want to convert it to `.jpg`, or a `.wav` audio file you'd like as `.mp3`, the format conversion is handled by the `file_converter` sandbox package. It wraps the power of FFmpeg and other conversion tools, supporting a wide range of conversions between audio, video, image, and document formats. Just tell the AI what file you want converted and to which format, and it will activate this package to get it done.