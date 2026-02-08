
# MCP：Model Context Protocol

## MCP 在 Operit 里是什么：用户视角

你可以把 MCP 理解成“把外部能力接进 Operit 的插件”。每一个 MCP 服务（也就是一个 server）在 Operit 里都会显示成一个插件条目：

 - 你能在列表里看到它是否启用
 - 你能看到它是不是在运行。一般会显示为 `active`
 - 运行起来后，它提供的工具会逐步出现在工具列表里

## 快速上手：按这三步来就够了

先打开 Operit 的 MCP 管理界面。就是你能看到“插件列表、开关、部署、编辑、导入/连接”的那一页。

### 第一步：把 MCP 加进来

点“导入/连接”，然后选一种方式：配置导入、仓库导入、ZIP 导入，或者连接远程。

![导入MCP插件](/manuals/assets/package_or_MCP/7.png)

### 第二步：让它参与工作

把插件右侧的开关打开（启用）。

### 第三步：让它真的跑起来

 - 本地插件：一般需要点一次“部署/重新部署”，让它把依赖装好、把项目准备到可运行。
 - 远程插件：不需要部署。保存后只要连接成功就能用。

正常情况下，你会看到插件状态变成“运行中”，并显示 `active`。之后工具列表会慢慢出现。

## 添加 MCP：四种方式怎么选

### 方式一：配置导入

适合 `npx` / `uvx` / `uv` 这类“一条命令就能跑”的服务。你不需要下载仓库，也不需要手动放文件。

怎么做：打开“导入/连接”，切到“配置导入”。把 JSON 粘进去，然后点“合并配置”。成功后，插件会出现在列表里。

一个最小可用的例子（只要包含 `mcpServers` 就行）：

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

这里的 `playwright` 就是插件 ID。它也会影响聊天里工具的前缀。建议只用英文字母/数字/下划线，并且尽量小写。

### 方式二：从仓库导入

适合你拿到的是一个 GitHub 项目，比如 Python/Node/TypeScript 写的项目，需要把项目文件导入到手机里。

注意：导入完成不等于“已经能用”。本地插件通常还需要你点一次“部署/重新部署”，让 Operit 自动把依赖安装好、把项目准备到可运行状态。

### 方式三：从 ZIP 导入

适合你已经有一个本地 ZIP 包，比如从电脑拷到手机的插件压缩包。

同样需要注意：导入完成后，一般还要“部署/重新部署”。

### 方式四：连接远程服务

适合你已经在电脑/服务器上把 MCP 跑起来了，手机只负责连过去。

你需要填写服务地址，例如 `http://127.0.0.1:8752`。再选择连接方式：`httpStream` 或 `sse`。

如果远端需要鉴权，可以填 Bearer Token。保存后它会作为“远程插件”出现在列表里。

## 在聊天里怎么用：自动激活调用

你只需要对 AI 说出你要做的事情。只要这件事和某个 MCP 插件的能力相关，Operit 会自动帮你选中它、激活它，然后在后台调用工具完成任务。

在聊天里你通常不需要关心 `插件ID:工具名` 这类格式，也不需要手动“先激活再调用”。

如果聊天里仍然提示某个 MCP 服务“未激活/不可用”，一般是插件当前没处于可运行状态。回到 MCP 管理界面检查下面几项就行：

 - 插件开关已打开（启用）
 - 插件状态为“运行中/active”
 - 本地插件已完成“部署/重新部署”

## `mcp_config.json` 文件格式：需要记住的部分

对普通用户来说，你只需要记住两件事：

 - `mcpServers` 是服务器列表
 - `mcpServers` 的 key 就是插件 ID

另外一个经常会用到、也最容易漏掉的是 `env`。

很多 MCP 插件需要 Key/Token 才能正常启动。通常你需要按插件的 README，把 Key 写进 `env` 里。

至于界面上显示的名称、描述等信息，软件会自动处理，你不用手动配置。

```json
{
  "mcpServers": {
    "your_plugin_id": {
      "command": "npx",
      "args": ["some-package@latest"],
      "disabled": false,
      "autoApprove": [],
      "env": {
        "YOUR_API_KEY": "YOUR_KEY_HERE",
        "YOUR_TOKEN": "YOUR_TOKEN_HERE"
      }
    }
  }
}
```

字段含义：

 - `command`：必填。
 - `args` / `env` / `autoApprove`：可选。
 - `env`：强烈建议你重点关注。很多插件缺了 Key/Token 会直接启动失败，或者工具调用时报权限/鉴权错误。
 - `disabled: true`：表示禁用。你在界面里看到的效果就是开关关闭。

建议尽量不要把 `mcpServers` 的 key（插件 ID）改来改去。它会影响插件识别和聊天工具路由。手动改 ID 最容易出现“列表里有插件，但工具对不上/调用失败”。

## 排查与进阶：只在出问题时看

### 配置文件在哪

MCP 的配置文件默认在手机的 `Download/Operit/mcp_plugins/` 目录下。

`server_status.json` 是 Operit 用来记录运行状态与工具缓存的内部文件，一般不建议手动编辑。

### “部署”到底做了什么：细节版

当你点“部署/重新部署”时，Operit 会把手机侧的插件目录复制到内置终端环境里（Ubuntu/Linux）：

`~/mcp_plugins/<pluginShortName>`

其中 `<pluginShortName>` 是插件 ID 的最后一段。比如 `owner/repo` 会取 `repo`。

复制完成后，部署流程会进入这个目录，自动执行“安装依赖、编译”等步骤。

部署阶段只负责“安装依赖/编译”，会跳过真正的启动命令。

### 自动部署命令：Python / JS 分别会跑什么

Python 项目的典型命令序列：

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install -e .
```

JavaScript/TypeScript 项目的典型命令序列：

```bash
pnpm config set registry https://registry.npmmirror.com
pnpm install
pnpm install --ignore-scripts
pnpm exec tsc -p ./tsconfig.json
```

### 启动命令是什么

部署完成后，真正启动 MCP 服务的命令来自 `mcp_config.json` 里该服务的 `command + args`，并且启动时的工作目录是：

`cwd = ~/mcp_plugins/<pluginShortName>`

常见情况：

 - Python 项目（自动部署）：通常会使用 `venv` 里的 Python，例如 `.../venv/bin/python -m <moduleName>`。
 - Node/TS 项目：通常是 `node <某个 js 文件路径>`（例如 `dist/index.js` 或 `index.js`，取决于项目结构/编译输出）。

### 常见现象怎么对照

 - 工具一直是 0 个：先确认插件开关是否打开；再看是否处于运行中；本地插件还要确认是否已部署。
 - 提示桥接器/终端环境相关问题：一般意味着用于运行 MCP 的终端环境还没准备好。比如终端服务未连接，或者 Node/pnpm 不可用。可以先完成终端环境准备，再回到 MCP 页面刷新。你可以参考[终端环境配置](/#/guide/basic-config/terminal-config)。
 - 远程服务连不上：优先检查你填的地址在当前网络环境是否可达，以及连接类型（`httpStream` / `sse`）是否与远端一致。

> 注意：部分 MCP 包自带 Docker 相关文件，但 Operit 不支持 Docker，可以忽略。
>
> 注意：Operit 的运行环境是 Linux（Ubuntu 24 / proot）。需要运行 Windows `.exe` 的插件（例如某些依赖 `.exe` 的场景）不支持。