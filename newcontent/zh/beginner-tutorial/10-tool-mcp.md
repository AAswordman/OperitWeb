# 10. 工具：MCP

上一节我们讲了沙盒包，这一节继续讲另一种工具扩展方式——MCP。

MCP 全称是 Model Context Protocol，是一个开放协议标准，目的就是让 AI 能够通过标准化的方式去调用外部的工具和服务。你可以把它理解成 AI 世界的 USB 接口——只要大家都按这个标准来，不管背后是什么服务，AI 都能即插即用。

## MCP 在什么位置

从前面几章你应该已经感觉到了，Operit 的工具有三个层次：

一是08章讲的内置工具，read_file、apply_file 这些，是系统自带的、最基础的能力。二是09章讲的沙盒包，是跑在 QuickJS 引擎里的 JS 脚本，和软件深度绑定，能力很强但只能在 Operit 里用。三是 MCP，它比沙盒包更重一些，但好处是标准化——MCP 是跨平台的协议，你在其他 AI 工具里也能用同一套 MCP。

简单来说，如果你需要的功能市面上已经有现成的 MCP 服务，优先用 MCP；如果你是给 Operit 深度定制功能，用沙盒包；如果只是写一个简单的指令集，用 Skill。

## 从哪里找 MCP

Operit 有自己的 MCP 市场，地址是 GitHub 上的一个 Issues 仓库，里面有人分享各种可用的 MCP 插件。你可以在 https://github.com/AAswordman/OperitMCPMarket/issues 这里看到。

当然，MCP 是一个开放标准，你从其他社区或者 GitHub 上找到的 MCP 项目，只要是符合协议的，都能用。比如那些常见的 `npx` 开头的 MCP（像 `@modelcontextprotocol/server-filesystem` 这种），或者 `uvx` 开头的 Python MCP，都可以直接配置。

## 怎么安装 MCP

在软件里点开「包管理」，切到 MCP 那一栏，点右下角的加号或者「导入/连接」按钮，会看到一个弹窗，里面有好几种导入方式。

### 配置导入

适合 `npx`、`uvx` 这种一条命令就能跑的服务。打开「配置导入」的页面，把 MCP 的 JSON 贴进去，点「合并配置」就行了。不需要你手动下载仓库或者放文件。

![配置导入界面](</manuals/assets/tools/mcp_config_import.jpg>)

比如说你要加一个 Playwright 的 MCP，粘贴这样一段 JSON 就行：

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"],
      "env": {},
      "autoApprove": []
    }
  }
}
```

里面的 `playwright` 就是插件 ID，建议只用英文字母、数字和下划线，尽量小写。合并成功后，插件就会出现在列表里。

### 从仓库导入

适合你拿到的 MCP 是一个 GitHub 上的项目，比如用 Python、Node.js 或 TypeScript 写的。切到「仓库」页面，填上仓库链接，再给个插件名称，点获取 MCP 之后点导入就行。

![仓库导入界面](</manuals/assets/tools/mcp_repo_import.jpg>)

不过有一点要注意：导入完成不等于马上能用。本地插件一般还需要你点一下「部署/重新部署」，让软件自动装好依赖、完成编译。

### 从 ZIP 导入

适合你已经有一个本地的插件压缩包，比如从电脑拷过来的。操作很简单，选 ZIP 文件导入就行。导入之后同样需要点一下部署。

### 连接远程服务

适合你已经在电脑或服务器上把 MCP 跑起来了，手机只管连过去用。切到「远程」页面，填上服务地址（比如 `http://192.168.1.100:8752`），选连接类型（`httpStream` 或 `sse`）。

![远程连接界面](</manuals/assets/tools/mcp_remote_connect.jpg>)

如果远程服务需要鉴权，可以填 Bearer Token。如果需要额外的请求头，下面还可以添加自定义请求头。保存后它会以远程插件的身份出现在列表里，不需要部署，连接成功就能用。

### 手动编辑配置文件

除了上面几种通过界面导入的方式，你也可以直接编辑配置文件。MCP 的配置目录在 `/sdcard/Download/Operit/mcp_plugins/` 路径下，主要的配置文件是 `mcp_config.json`。你可能会注意到还有一个 `server_status.json`，那个只是状态缓存，不用管它。

`mcp_config.json` 的顶层结构有一个 `mcpServers` 对象，里面的每个 key 就是一个 MCP 插件的 ID。每个插件用以下字段配置：

- `command`：启动命令，必填。比如 `node`、`python`、`npx`、`uvx` 这些。
- `args`：命令参数，数组形式。比如 `["dist/index.js"]`。
- `env`：环境变量，键值对形式。API Key 之类的敏感信息写在这里。
- `autoApprove`：不需要确认就能自动执行的操作列表。不太常用的可以不加。
- `disabled`：设为 `true` 可以禁用这个插件，不用删掉配置。

有一点需要特别注意：MCP 的启动工作目录是固定的 Linux 路径 `~/mcp_plugins/<插件ID最后一段>/`，所以 `args` 里的路径要写相对于这个目录的路径，不要把 Android 路径（比如 `/sdcard/...`）写进去。

举个例子，如果你有个插件叫 `my-org/my-plugin`，它的启动目录就是 `~/mcp_plugins/my-plugin/`。如果入口文件在 `~/mcp_plugins/my-plugin/dist/index.js`，那 args 就应该写 `["dist/index.js"]`，而不是写 Android 那边的路径。

对于 `npx` 类型的 MCP，还有一点要说明：配置里还是按常规写 `"command": "npx"`，但软件内部实际启动的时候会自动把它转成 `pnpm dlx` 来执行。所以 Linux 环境里需要装 `pnpm`，不要手动改成 `npm` 或 `pnpm`，改了反而可能有兼容问题。

## 本地 MCP 和远程 MCP

MCP 分两种：本地和远程。

本地 MCP 就是上面说的那种，在设备上跑一个进程来提供服务。软件会在启动时读取 `mcp_config.json`，按配置启动各个插件。可不可以启动成功，主要看依赖有没有装好、路径对不对、环境变量是否完整。

远程 MCP 则是连接到外部的 MCP 服务端，不需要本地跑进程。配置方式不一样，主要在 `pluginMetadata` 里配置 `endpoint` 和连接方式（比如 bearerToken 或者自定义 headers）。这个适合那种已经有现成服务的场景。

## MCP 的包兼容模型

这一点挺有意思的：在 AI 看来，MCP、沙盒包、Skill 这三种东西是没有区别的。AI 都用 `use_package` 去激活，然后用 `package_proxy` 去调用里面的工具。你不需要告诉 AI 这个功能来自哪种包，它自己通过统一的接口就能用。

所以你在包管理界面看到的三个 TAB——MCP、沙盒包、Skill——只是方便你管理，对 AI 来说它们就是一回事。这也解释了为什么09章讲沙盒包的时候提到 `use_package` 是三兼容的入口。

## 常见问题

MCP 用不起来的时候，大部分情况下都是以下几类问题：

**开关没打开**：先确认一下插件有没有被禁用。`mcp_config.json` 里如果写了 `"disabled": true`，插件是启动不了的。

**路径写错了**：这是最容易犯的错。`args` 里写了 Android 路径（比如 `/sdcard/...`），但启动工作目录是 Linux 那边的 `~/mcp_plugins/`，对不上当然跑不起来。

**依赖没装**：比如 node 类的 MCP 需要 `pnpm`，Python 类的需要 `uv` 或 `pip` 装好依赖。在 Linux 终端里检查一下这些依赖是不是齐全。

**环境变量没填**：有些 MCP 需要 API Key 之类的环境变量，写在 `env` 字段里。漏掉了或者填错了，MCP 能启动但功能用不了。

**目录不存在**：插件部署到 Linux 侧的目录是自动创建的，但如果自动分析构建命令失败了，目录可能是空的。可以检查一下 `~/mcp_plugins/<插件名>/` 里有没有文件。

排查的时候，建议从第一步开始：先看开关有没有开，再看目录有没有文件，然后检查配置里的 command/args/env 是否完整，再确认 args 没写 Android 路径，最后看 Linux 终端里的依赖情况。按这个顺序走，大部分问题都能定位到。

## 导航

- [返回欢迎页](/#/guide/new)
- [上一篇：09. 工具：沙盒包](/#/guide/new/beginner-tutorial/09-tool-sandbox-package)
- [下一篇：11. 工具：SKILL](/#/guide/new/beginner-tutorial/11-tool-skill)

