### 工作区概述

这篇文档用于统一说明 Operit 的工作区类型、绑定方式、导出能力和 `.operit/config.json` 配置。

#### 工作区入口（聊天页）

在聊天页打开工作区后，你会看到 3 个入口：

- `创建默认`
- `选择现有`
- `附加本地储存仓库`

#### 三种入口的区别

1. **创建默认**

适合新项目。会在应用内部为当前对话创建独立工作区，并可选择项目模板。

可选模板（当前 UI）：

- 空白工作区
- 办公文档
- Web 项目
- Android 项目
- Node.js 项目
- TypeScript 项目
- Python 项目
- Java 项目
- Go 项目

其中：

- **Web 项目**默认会有 `index.html`，并默认 `export.enabled=true`（可直接显示导出入口）。
- 其他模板默认 `export.enabled=false`。

2. **选择现有**

进入内置文件浏览器，定位目标目录后点击 `绑定当前文件夹`。

3. **附加本地储存仓库（SAF）**

通过系统文件选择器绑定外部目录（Storage Access Framework），并保存为一个“仓库名称”。

#### SAF 绑定操作（按用户看到的 UI）

1. 点击 `附加本地储存仓库`。
2. 在系统文件夹选择器里选择目录并授权。
3. 弹出 `仓库名称` 对话框，填写 `名称`（不能为空、不能和已有仓库重名）。
4. 确认后，当前聊天会绑定到该仓库环境（形如 `repo:你的名称`）。

补充：在文件管理器顶部快捷路径中，也可以通过 `+` 新增 SAF 仓库并切换。

#### 导出 / 打包能力说明

- 聊天工作区里的导出按钮显示条件：
  - `export.enabled=true`
  - 且当前不是 SAF 仓库环境（`repo:`）
- 所以“想直接在工作区打包 Web”，最稳妥路径是：
  - `创建默认 > Web 项目`

如果你是 SAF 仓库或任意外部目录，也可以走工具箱 HTML 打包流程（先选文件夹、再选主 HTML、再打包）。

---

#### `.operit/config.json` 示例（Android）

```json
{
  "projectType": "android",
  "title": "Android 项目",
  "description": "适用于 Android 工程开发，提供 Gradle 常用任务快捷按钮",
  "server": {
    "enabled": false,
    "port": 8080,
    "autoStart": false
  },
  "preview": {
    "type": "terminal",
    "url": "",
    "showPreviewButton": false,
    "previewButtonLabel": ""
  },
  "commands": [
    {
      "id": "android_setup_env",
      "label": "初始化 Android 构建环境",
      "command": "bash setup_android_env.sh",
      "workingDir": ".",
      "shell": true
    },
    {
      "id": "gradle_assemble_debug",
      "label": "构建 Debug APK",
      "command": "./gradlew assembleDebug",
      "workingDir": ".",
      "shell": true
    },
    {
      "id": "gradle_install_debug",
      "label": "安装 Debug APK",
      "command": "./gradlew installDebug",
      "workingDir": ".",
      "shell": true
    },
    {
      "id": "gradle_lint",
      "label": "运行 Lint",
      "command": "./gradlew lint",
      "workingDir": ".",
      "shell": true
    },
    {
      "id": "gradle_test",
      "label": "运行测试",
      "command": "./gradlew test",
      "workingDir": ".",
      "shell": true
    }
  ],
  "export": {
    "enabled": false
  }
}
```

#### `config.json` 参数说明（基于源码）

- `projectType`（`String`，默认：`"web"`）：项目类型标识，主要用于界面展示和标题兜底。
- `title`（`String?`，默认：`null`）：命令页顶部标题。
- `description`（`String?`，默认：`null`）：命令页副标题/描述。

`server` 对象：

- `server.enabled`（`Boolean`，默认：`false`）
- `server.port`（`Int`，默认：`8093`）
- `server.autoStart`（`Boolean`，默认：`false`）
- 说明：当前版本中，工作区预览服务主要由应用内部逻辑统一管理；该字段组不是命令页执行逻辑的主要开关。

`preview` 对象：

- `preview.type`（`String`，默认：`"browser"`）：建议使用 `browser`、`terminal`、`none`。
  - `browser`：默认显示内嵌 WebView 预览。
  - `terminal` / `none`：默认显示命令按钮页。
- `preview.url`（`String`，默认：`""`）：浏览器预览地址。
  - 当 `preview.type = "browser"` 且为空时，会回退到 `http://localhost:8093`。
- `preview.showPreviewButton`（`Boolean`，默认：`false`）：是否在命令页显示“浏览器预览”按钮。
- `preview.previewButtonLabel`（`String`，默认：`""`）：该按钮文字。
  - 实践建议：若 `showPreviewButton=true`，建议设置非空标签，避免按钮文案为空。

`commands` 数组（`List<CommandConfig>`，默认：空）：每一项都会渲染为一个可执行按钮。

- `id`（`String`，必填）：命令唯一标识。
- `label`（`String`，必填）：按钮显示文案。
- `command`（`String`，必填）：实际执行的终端命令。
- `workingDir`（`String`，默认：`"."`）：预留的工作目录字段。
- `shell`（`Boolean`，默认：`true`）：预留的 shell 执行字段。
- `usesDedicatedSession`（`Boolean`，默认：`false`）：是否使用独立终端会话（适合 watch/dev server 这类长驻命令）。
- `sessionTitle`（`String?`，默认：`null`）：独立会话标题，不填时回退为 `label`。

`export` 对象：

- `export.enabled`（`Boolean`，默认：`true`）：是否显示工作区导出入口。

#### 运行行为说明

- 配置文件固定读取路径：工作区根目录下的 `.operit/config.json`。
- JSON 解析为宽松模式：未知字段会被忽略。
- 文件不存在或解析失败时，会回退到默认 Web 配置（`projectType: web`，浏览器预览地址为 `http://localhost:8093`）。
- 当前命令执行流程里，命令以工作区根目录为基准执行，`workingDir` / `shell` 目前属于预留字段，尚未被执行链路实际使用。

