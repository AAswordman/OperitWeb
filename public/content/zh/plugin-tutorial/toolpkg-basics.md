# ToolPkg 基础与 manifest

这一章先把 ToolPkg 最容易混掉的三件事拆开：

1. 什么时候还只是脚本包，什么时候真的该升级到 ToolPkg。
2. `manifest.json` 到底负责什么，不负责什么。
3. `manifest`、`main`、`subpackages`、`resources` 在一个包里是怎么分工的。

## 学完这一章，你应该能做到

- 判断自己的项目是否真的需要 ToolPkg。
- 看懂 `manifest.json` 的核心字段。
- 知道 `manifest` 只负责描述包结构，不负责直接写 hook 逻辑。

## 建议先具备

- 已经看过《项目结构与目录演进》。
- 已经知道普通脚本包和多文件 TypeScript 工程的基本差别。

## 本章对应的真实文件

- `docs/TOOLPKG_FORMAT_GUIDE.md`
- `examples/windows_control/manifest.json`
- `examples/linux_ssh/manifest.json`
- `examples/deepsearching/manifest.json`

## 先看一个最小例子

```json
{
  "schema_version": 1,
  "toolpkg_id": "com.example.demo_bundle",
  "version": "0.1.0",
  "main": "dist/main.js",
  "display_name": {
    "zh": "演示工具包",
    "en": "Demo Bundle"
  },
  "subpackages": [
    {
      "id": "demo_tools",
      "entry": "dist/packages/demo_tools.js",
      "enabled_by_default": true
    }
  ],
  "resources": [
    {
      "key": "demo_zip",
      "path": "resources/demo/demo.zip",
      "mime": "application/zip"
    }
  ]
}
```

## 把例子拆开理解

### 什么时候才该上 ToolPkg

最实用的判断标准不是“ToolPkg 更高级”，而是你有没有下面这些真实需求：

- 一个插件包里要同时放多个工具集合。
- 要把 UI 模块一起打进去。
- 要把资源文件一起分发。
- 要在主入口里注册 hook、消息处理插件、XML 渲染插件之类的扩展点。

如果你现在只是写一个能跑的工具函数，普通脚本包通常已经够了。  
如果你已经进入“一个包里有主入口、有子包、有资源、有 UI、有注册逻辑”的阶段，才是 ToolPkg 的主场。

### `manifest.json` 到底负责什么

`manifest` 负责的是“描述这个包长什么样”，最核心的是这几个字段：

| 字段 | 作用 | 你最该关心什么 |
|---|---|---|
| `schema_version` | 清单格式版本 | 当前一般写 `1` |
| `toolpkg_id` | 整个 ToolPkg 的唯一 ID | 建议稳定、不要频繁改 |
| `version` | 包版本 | 建议用语义化版本 |
| `main` | ToolPkg 主入口脚本路径 | 这是注册 UI / hook 的入口 |
| `subpackages` | 子包列表 | 真正暴露工具的通常还是这里 |
| `resources` | 资源列表 | 给 `ToolPkg.readResource(...)` 用 |
| `display_name` / `description` | 面向用户的显示文本 | 支持多语言对象 |

### `manifest` 不负责直接写 hook

这是 ToolPkg 初学者最容易混掉的一点：

- `manifest.json`
  负责告诉宿主“这个包有哪些部分”。
- `main`
  负责调用 `ToolPkg.register...(...)` 做注册。
- `subpackages[].entry`
  负责真正暴露工具函数。

也就是说，`manifest` 不会直接写：

- `ToolPkg.registerAppLifecycleHook(...)`
- `ToolPkg.registerMessageProcessingPlugin(...)`
- `ToolPkg.registerXmlRenderPlugin(...)`

这些都应该写在 `main.ts` / `main.js` 里。

### 一个典型 ToolPkg 目录长什么样

```text
my_toolpkg/
├── manifest.json
├── dist/
│   ├── main.js
│   └── packages/
│       └── demo_tools.js
├── ui/
│   └── demo_panel/
│       └── index.ui.js
└── resources/
    └── demo/
        └── demo.zip
```

你可以把这几个位置记成：

- `manifest.json`
  包说明书
- `main.js`
  注册中心
- `packages/*.js`
  真正的工具子包
- `ui/**`
  Compose DSL UI 模块
- `resources/**`
  跟包分发的资源文件

### `main` 和 `subpackages` 的职责不要混

这一点一定要先建立起来，不然后面读 ToolPkg 会一直糊：

- `main`
  不负责直接提供工具列表，它主要负责注册。
- `subpackages`
  才是实际工具函数的入口集合。

例如 `windows_control` 和 `linux_ssh` 这两个示例里，真正供用户调用的工具仍然在子包里；`main` 更像是把 UI 和 hook 接进宿主。

## 回到源码仓库，它为什么这样写

你去看真实仓库会发现三个很稳定的设计习惯：

### `windows_control`

- `manifest.json` 里声明 `main`、子包、资源。
- `src/main.ts` 里注册工具箱 UI 和 `application_on_create` 生命周期 hook。
- `packages/windows_control.js` 里才是实际的工具能力。

### `linux_ssh`

- 结构和 `windows_control` 基本一致。
- 重点不是业务内容，而是它也遵守同一套分层：`manifest` 描述结构，`main` 负责注册。

### `deepsearching`

- 这个示例更适合看“主入口到底能注册到什么程度”。
- 它不只注册了 `AppLifecycleHook`，还注册了：
  - `MessageProcessingPlugin`
  - `XmlRenderPlugin`
  - `InputMenuTogglePlugin`

所以如果你的目标是“真正搞懂 ToolPkg 主入口”，不能只看 `windows_control`，还要看 `deepsearching`。

## 本章自查

- 我是否已经知道什么时候该上 ToolPkg，什么时候还不必？
- 我是否已经知道 `manifest` 负责描述结构，而不是直接写 hook？
- 我是否已经知道 `main` 和 `subpackages` 的职责不一样？

## 下一章

建议继续看《[main、hooks 与注册流程](/#/plugin-tutorial/toolpkg-main-and-hooks)》。
