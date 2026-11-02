# ToolPkg Format Specification

## 1. Introduction

**ToolPkg** is the standard format used in the Operit project for packaging and distributing tool packages. It allows developers to bundle multiple related tool scripts, resource files, and UI modules into a single file that is easy to distribute and manage.

The format, manifest, and runtime notes in this document apply to all ToolPkg authors. The `tools/toolpkg/debug_toolpkg.*` commands mentioned here apply to a desktop development environment that has the Operit source repository and ADB; for in-app AI collaborative development, update `SandboxPackage_DEV` first and follow the directories and debugging approach specified by its local `SKILL.md`.

### 1.1 What Is ToolPkg?

- **File format**: A `.toolpkg` file is essentially a standard ZIP archive
- **Core components**: Contains a manifest file and related resource files
- **Modular design**: Supports organizing multiple functionally related subpackages together
- **Resource management**: Can include binary resources, script files, UI modules, and more
- **Multi-language support**: Built-in support for multilingual text

### 1.2 ToolPkg vs Traditional JS Scripts

| Feature | Traditional JS Script | ToolPkg |
|------|-------------|---------|
| File format | Single `.js` file | ZIP archive (`.toolpkg`) |
| Organization | Single script | Multiple subpackages + resources + UI modules |
| Resource files | Not supported | Supports packaging arbitrary resources |
| UI modules | Not supported | Supports Compose DSL UI |
| Multi-language | Must be implemented manually | Built-in support |
| Version management | No standard | Built-in version field |

## 2. ToolPkg File Structure

The internal structure of a typical `.toolpkg` file is as follows:

```
windows_control.toolpkg (ZIP 压缩包)
├── manifest.json                          # 清单文件（必需）
├── main.js                                # ToolPkg 主入口脚本（必需）
├── main.ts                                # 主入口 TypeScript 源码（建议）
├── packages/                              # 子包脚本目录
│   └── windows_control.js                 # 子包脚本
├── ui/                                    # UI 模块目录
│   └── windows_setup/
│       └── index.ui.js                    # UI 模块脚本
├── modules/                               # 可选 WASM 核心模块
│   └── core.wasm                          # AssemblyScript 编译产物
├── resources/                             # 资源文件目录
│   ├── logo.svg                            # 可选包 Logo
│   └── pc_agent/
│       └── operit-pc-agent/              # 目录资源（readResource 时自动导出为 zip）
└── i18n/                                  # 国际化文件（可选）
    ├── zh-CN.js
    └── en-US.js
```

### 2.1 Required Files

- **manifest.json** or **manifest.hjson**: The manifest file, which defines the package's metadata and structure

### 2.2 Optional Directories

- **packages/**: Stores the JavaScript script files of subpackages
- **ui/**: Stores the script files of UI modules
- **resources/**: Stores arbitrary resource files (images, archives, configuration files, etc.)
- **i18n/**: Stores internationalization files

## 3. Manifest File

The manifest file is the core of a ToolPkg, defining all of the package's metadata and structure. Two formats are supported:

- **manifest.json**: Standard JSON format
- **manifest.hjson**: HJSON format (supports comments and more lenient syntax)

### 3.1 Complete Example

```json
{
  "schema_version": 1,
  "toolpkg_id": "com.operit.windows_bundle",
  "version": "0.2.0",
  "api_version": "1.0.0",
  "requires": [],
  "author": ["Operit Team", "Alice"],
  "main": "main.js",
  "display_name": {
    "zh": "Windows 工具包",
    "en": "Windows Bundle"
  },
  "description": {
    "zh": "Windows 一键配置与控制工具包",
    "en": "Windows one-click setup and control bundle"
  },
  "logo": "package_logo",
  "subpackages": [
    {
      "id": "windows_control",
      "entry": "packages/windows_control.js",
      "enabled_by_default": false,
      "display_name": {
        "zh": "Windows 控制",
        "en": "Windows Control"
      },
      "description": {
        "zh": "通过 Operit PC Agent 控制 Windows",
        "en": "Control Windows via Operit PC Agent"
      }
    }
  ],
  "resources": [
    {
      "key": "package_logo",
      "path": "resources/logo.svg",
      "mime": "image/svg+xml"
    },
    {
      "key": "pc_agent_zip",
      "path": "resources/pc_agent/operit-pc-agent.zip",
      "mime": "application/zip"
    }
  ],
  "wasm_modules": [
    {
      "id": "core",
      "path": "modules/core.wasm",
      "exports": ["isPrime", "nthPrime"],
      "source_language": "assemblyscript",
      "abi": "assemblyscript"
    }
  ],
  "workflow_templates": [
    {
      "id": "quick_chat_workflow",
      "display_name": {
        "zh": "快速对话工作流",
        "en": "Quick Chat Workflow"
      },
      "description": {
        "zh": "手动触发后自动启动聊天并发送一条引导消息。",
        "en": "Starts a chat and sends a guidance message after a manual trigger."
      },
      "resource_key": "demo_workflow_template"
    }
  ],
  "workspace_templates": [
    {
      "id": "quick_start_workspace",
      "display_name": {
        "zh": "快速开始工作区",
        "en": "Quick Start Workspace"
      },
      "description": {
        "zh": "包含 .operit/config.json 的最小工作区模板。",
        "en": "A minimal workspace template containing .operit/config.json."
      },
      "resource_key": "demo_workspace_template",
      "project_type": "template_try"
    }
  ]
}
```

### 3.2 Field Descriptions

#### 3.2.1 Top-Level Fields

| Field | Type | Required | Description |
|------|------|------|------|
| `schema_version` | number | Yes | Manifest schema version, currently `1` |
| `toolpkg_id` | string | Yes | The package's unique identifier; reverse-domain format is recommended (e.g. `com.operit.windows_bundle`) |
| `version` | string | No | Package version; semantic versioning is recommended (e.g. `0.2.0`) |
| `api_version` | string | No | The ToolPkg API version used by the package, strictly in `major.minor.patch` format; when omitted, it is treated as `1.0.0` |
| `requires` | object[] | No | Dependencies the package must load. Each item contains the target package ID, a purpose description, and an optional version range; dependencies also determine load order |
| `author` | string \| string[] | No | Author information; supports a single author string or an array of author strings |
| `main` | string | Yes | Path of the ToolPkg main entry script (relative to the ZIP root), used to execute the registration function |
| `display_name` | LocalizedText | No | The package's display name, with multi-language support |
| `description` | LocalizedText | No | The package's description, with multi-language support |
| `logo` | string | No | The `resources[].key` corresponding to the package Logo; supports SVG, PNG, JPEG, and WebP |
| `subpackages` | array | No | List of subpackages; each subpackage is an independent tool set |
| `resources` | array | No | List of resource files, which can be files of any type |
| `wasm_modules` | array | No | List of enterprise core algorithm modules, currently used to declare and validate `.wasm` artifacts |
| `workflow_templates` | array | No | List of workflow templates registered with the host's "Workflow" entry point |
| `workspace_templates` | array | No | List of workspace templates registered with the host's "Workspace creation" entry point |

#### ToolPkg API Version

`api_version` describes the host ToolPkg API called by the package, not the package's own `version`. Historical packages that do not declare this field use `1.0.0`.

The ToolPkg API support relationship in Operit is as follows:

| Operit Version | Supported ToolPkg API |
|------|------|
| Before `1.12.1+4` | `1.0.0` |
| `1.12.1+4` and later | `1.0.0`, `1.0.1` |

`1.0.1` includes the public ToolPkg capabilities added after `1.12.1+4`, currently including chat runtime Hooks, message long-press menu registration, Compose DSL dialog components, and the `Tools.Chat.call` function model call.

Type files keep a single latest declaration, and use `@since ToolPkg API x.y.z` to mark the version in which a public capability was introduced. When using these capabilities, the manifest's `api_version` must be no lower than the corresponding version.

When the current app does not support the API version declared in the manifest, the package will appear in the package loading errors, together with the current app version and the supported API versions.

#### API Version in Marketplace Publishing

When publishing a ToolPkg, the marketplace version information records the manifest's `api_version`. This field describes the host ToolPkg API, not the package's own `version`, and not the archive format's `formatVer`. If this value needs to be adjusted before publishing, modify the manifest.

The marketplace list, details, and version history display the ToolPkg API version. For historical packages where this value was not recorded, it is understood as `1.0.0`.

#### Package Dependencies and Load Order

`requires` is the manifest's package dependency declaration; it is not part of the ToolPkg JavaScript API. Each item uses the object format and can reference a ToolPkg container, a ToolPkg subpackage, or an ordinary script package. Dependency packages load before the declaring package, so `requires` expresses both "what must be loaded" and "load order".

When enabling a package that declares `requires`, the host adds the dependency packages to the enabled set. A package depended on by another enabled ToolPkg cannot be disabled directly; the packages depending on it must be handled first.

```json
{
  "toolpkg_id": "com.example.feature",
  "requires": [
    {
      "id": "com.example.shared",
      "description": "提供共享运行能力",
      "min_version": "1.2.0",
      "max_version": "2.0.0"
    }
  ]
}
```

`description` is used in the package management UI to explain the dependency's purpose to the user. `min_version` and `max_version` are both optional, and indicate the lower and upper bounds of the target package's own version, not the ToolPkg API version. The drag order in the plugin list is the base order when there is no dependency relationship; the dependency order produced by `requires` takes precedence over this base order, and circular relationships cause the related packages to fail to load.

| Dependency Field | Type | Required | Description |
|------|------|------|------|
| `id` | string | Yes | ID of the depended-on package, which can be a ToolPkg container, a ToolPkg subpackage, or an ordinary script package |
| `description` | string | Yes | A brief description of the dependency's purpose, displayed in the package management UI |
| `min_version` | string | No | The minimum allowed version of the depended-on package, in `major.minor.patch` format |
| `max_version` | string | No | The maximum allowed version of the depended-on package, in `major.minor.patch` format |

When publishing a ToolPkg, only the `manifest.logo` resource already present in the archive is used. A marketplace entry can display the Logo corresponding to that resource.

#### Compressed Publishing

When publishing, you may choose to apply AST compression to the ToolPkg's executable JavaScript entries. The compressed artifact is still an ordinary ZIP, and keeps the original marketplace download, external import, and debug installation methods.

#### 3.2.2 LocalizedText Type

`LocalizedText` supports two formats:

**Format 1: Simple string**
```json
"display_name": "Windows Bundle"
```

**Format 2: Multi-language object**
```json
"display_name": {
  "zh": "Windows 工具包",
  "zh-CN": "Windows 工具包",
  "en": "Windows Bundle",
  "en-US": "Windows Bundle",
  "default": "Windows Bundle"
}
```

Language code priority:
1. Full language tag (e.g. `zh-CN`, `en-US`)
2. Language code (e.g. `zh`, `en`)
3. The `default` key
4. Any value in the object

#### 3.2.3 Subpackages

Subpackages are the core functional units of a ToolPkg; each subpackage contains a set of related tools.

```json
{
  "id": "windows_control",
  "entry": "packages/windows_control.js",
  "enabled_by_default": false,
  "display_name": {
    "zh": "Windows 控制",
    "en": "Windows Control"
  },
  "description": {
    "zh": "通过 Operit PC Agent 控制 Windows",
    "en": "Control Windows via Operit PC Agent"
  }
}
```

| Field | Type | Required | Description |
|------|------|------|------|
| `id` | string | Yes | The subpackage's unique identifier, which must be unique within the container |
| `entry` | string | Yes | Entry file path of the subpackage script (relative to the ZIP root) |
| `enabled_by_default` | boolean | No | Whether enabled by default; defaults to `false` |
| `display_name` | LocalizedText | No | The subpackage's display name |
| `description` | LocalizedText | No | The subpackage's description |

**Subpackage script format**:
- A subpackage script must be a standard JavaScript file
- It must contain a `METADATA` comment block (see [SCRIPT_DEV_GUIDE.md](./SCRIPT_DEV_GUIDE.en.md))
- Tools defined in the script are registered in the format `<subpackage_id>:<tool_name>`

#### 3.2.4 WASM Modules

`wasm_modules` is used to declare the enterprise plugin's core algorithm modules. It is recommended that they be compiled from AssemblyScript into `.wasm`; the plugin author entry writes `src/main.ts`, then calls WASM through a typed facade in the same directory; the packaging stage generates the `main.js` used by the host for execution.

```json
{
  "id": "core",
  "path": "modules/core.wasm",
  "exports": ["isPrime", "nthPrime"],
  "source_language": "assemblyscript",
  "abi": "assemblyscript"
}
```

| Field | Type | Required | Description |
|------|------|------|------|
| `id` | string | Yes | Module ID, which must be unique within the container |
| `path` | string | Yes | `.wasm` file path (relative to the directory containing the manifest) |
| `exports` | string[] | No | Export function names planned to be exposed to the JS bridge |
| `source_language` | string | No | Source language marker; AssemblyScript modules write `assemblyscript` |
| `abi` | string | No | Calling convention marker; AssemblyScript modules write `assemblyscript` |

Recommended structure:

```text
my_toolpkg/
├── manifest.json
├── package.json
├── src/
│   ├── main.ts
│   └── wasm/
│       ├── core.ts
│       └── core.as.ts
├── build/
│   └── main.js
└── modules/
    └── core.wasm
```

AssemblyScript core module example `src/wasm/core.as.ts`:

```ts
export function isPrime(n: i32): i32 {
  if (n < 2) return 0;
  for (let divisor: i32 = 2; divisor <= n / divisor; divisor += 1) {
    if (n % divisor === 0) return 0;
  }
  return 1;
}
```

Compilation example:

```bash
npx asc src/wasm/core.as.ts --outFile modules/core.wasm --optimize
```

Current integration scope:

- The `manifest` validates the module ID, the `.wasm` path, and the export names.
- When publishing, you may choose to apply AST compression to the executable JavaScript in the package; `.wasm` and other resources remain standard ToolPkg ZIP content.
- The JS runtime still uses `main.js` and the existing `exports` as the plugin's external interface; `main.js` may be generated by a TS build.
- `ToolPkg.wasm.call(moduleId, exportName, args)` is already connected to the native WAMR runtime; the current ABI supports `i32`, `i64`, `f32`, and `f64` numeric parameters and return values.
- `ToolPkg.wasm.call(...)` must not be called during `registerToolPkg()` execution; calling it throws an exception immediately.
- `i64` results are returned as strings; when JS passes an `i64`, using a string is recommended to avoid losing precision beyond the JS safe integer range.

TS facade example `src/wasm/core.ts`:

```ts
export async function isPrime(n: number): Promise<boolean> {
  const result = await ToolPkg.wasm.call("core", "isPrime", [{ type: "i32", value: n }]);
  if (typeof result !== "number") {
    throw new Error("core.isPrime returned a non-number result");
  }
  return result === 1;
}
```

Main entry example `src/main.ts`:

```ts
import { isPrime } from "./wasm/core";

export async function run(params: { n: number }) {
  return { is_prime: await isPrime(params.n) };
}
```

#### 3.2.5 Main Script Registration

The ToolPkg's UI modules and lifecycle hooks are no longer written in the `manifest`; instead, they are declared by the `main` script through registration functions.

`registerToolPkg()` is only used to declare registration items. `ToolPkg.readResource(...)` and `ToolPkg.wasm.call(...)` throw exceptions immediately at this stage.

`main.js` example:

```javascript
const toolboxUI = require("./ui/windows_setup/index.ui.js").default;

function registerToolPkg() {
  ToolPkg.registerToolboxUiModule({
    id: "windows_setup",
    runtime: "compose_dsl",
    screen: toolboxUI,
    params: {},
    title: {
      zh: "Windows 一键配置",
      en: "Windows Quick Setup"
    }
  });

  ToolPkg.registerUiRoute({
    id: "windows_dashboard",
    route: "toolpkg:com.example.windows_bundle:ui:windows_dashboard",
    runtime: "compose_dsl",
    screen: toolboxUI,
    title: {
      zh: "Windows 面板",
      en: "Windows Dashboard"
    }
  });

  ToolPkg.registerNavigationEntry({
    id: "windows_dashboard_toolbox",
    route: "toolpkg:com.example.windows_bundle:ui:windows_dashboard",
    surface: "toolbox",
    title: {
      zh: "Windows 面板",
      en: "Windows Dashboard"
    }
  });

  ToolPkg.registerDesktopWidget({
    id: "windows_dashboard_widget",
    route: "toolpkg:com.example.windows_bundle:ui:windows_dashboard",
    render: "toolpkg:com.example.windows_bundle:ui:windows_dashboard_widget",
    title: {
      zh: "Windows 面板小组件",
      en: "Windows Widget"
    },
    subtitle: {
      zh: "点击打开面板",
      en: "Tap to open dashboard"
    }
  });

  ToolPkg.registerAppLifecycleHook({
    id: "windows_app_create",
    event: "application_on_create",
    function: onApplicationCreate
  });

  ToolPkg.registerMessageProcessingPlugin({
    id: "windows_message_processing",
    function: onMessageProcessing
  });

  ToolPkg.registerXmlRenderPlugin({
    id: "windows_xml_status",
    tag: "windows_status",
    function: onXmlRender
  });

  ToolPkg.registerInputMenuTogglePlugin({
    id: "windows_input_menu_toggle",
    function: onInputMenuToggle
  });

  ToolPkg.registerChatMessageMenuItem({
    id: "windows_translate_message",
    title: {
      zh: "翻译",
      en: "Translate"
    },
    icon: "translate",
    order: 20,
    senders: ["user", "ai"],
    dialog: {
      screen: "dist/ui/message_dialog.ui.js",
      title: {
        zh: "消息操作",
        en: "Message Action"
      }
    },
    function: onMessageMenuItem
  });

  return true;
}

function onApplicationCreate() {
  return { ok: true };
}

function onMessageProcessing(params) {
  return { matched: false };
}

function onXmlRender(params) {
  if (params.tagName !== "windows_status") {
    return { handled: false };
  }
  return { handled: true, text: "Windows status ready" };
}

function onInputMenuToggle(params) {
  if (params.action === "create") {
    return {
      toggles: [
        {
          id: "windows_mode",
          title: "Windows Mode",
          description: "Enable Windows mode",
          isChecked: false
        }
      ]
    };
  }
  if (params.action === "toggle" && params.toggleId === "windows_mode") {
    return { ok: true };
  }
  return { ok: false };
}

function onMessageMenuItem(event) {
  return {
    dialog: {
      state: {
        message: event.eventPayload.message
      }
    }
  };
}

exports.registerToolPkg = registerToolPkg;
exports.onApplicationCreate = onApplicationCreate;
exports.onMessageProcessing = onMessageProcessing;
exports.onXmlRender = onXmlRender;
exports.onInputMenuToggle = onInputMenuToggle;
exports.onMessageMenuItem = onMessageMenuItem;
```

Registration item fields:

| Registration Function | Field | Required | Description |
|------|------|------|------|
| `ToolPkg.registerToolboxUiModule` | `id` | Yes | Unique identifier of the UI module |
| `ToolPkg.registerToolboxUiModule` | `runtime` | No | Runtime type, defaults to `compose_dsl` |
| `ToolPkg.registerToolboxUiModule` | `screen` | Yes | UI module function (passing it after `import/require ... default` is recommended) |
| `ToolPkg.registerToolboxUiModule` | `params` | No | UI module initialization parameter object |
| `ToolPkg.registerToolboxUiModule` | `title` | No | Module title (supports `LocalizedText`) |
| `ToolPkg.registerUiRoute` | `id` | Yes | Unique identifier of the UI route |
| `ToolPkg.registerUiRoute` | `route` / `routeId` | No | Stable route ID; when omitted, the host auto-generates it as `toolpkg:<toolpkg_id>:ui:<id>` |
| `ToolPkg.registerUiRoute` | `runtime` | No | Runtime type, defaults to `compose_dsl` |
| `ToolPkg.registerUiRoute` | `screen` | Yes | UI module function |
| `ToolPkg.registerUiRoute` | `params` | No | UI module initialization parameter object |
| `ToolPkg.registerUiRoute` | `title` | No | Route title (supports `LocalizedText`) |
| `ToolPkg.registerNavigationEntry` | `id` | Yes | Unique identifier of the navigation entry |
| `ToolPkg.registerNavigationEntry` | `route` | Yes | Registered route ID |
| `ToolPkg.registerNavigationEntry` | `surface` | Yes | Mount surface; currently supports `toolbox`, `main_sidebar_plugins` |
| `ToolPkg.registerNavigationEntry` | `title` | No | Navigation entry title (supports `LocalizedText`) |
| `ToolPkg.registerNavigationEntry` | `icon` | No | Icon name |
| `ToolPkg.registerNavigationEntry` | `order` | No | Sort value within the same surface; smaller values come first |
| `ToolPkg.registerDesktopWidget` | `id` | Yes | Unique identifier of the widget |
| `ToolPkg.registerDesktopWidget` | `route` / `routeId` | Yes | Registered route ID |
| `ToolPkg.registerDesktopWidget` | `render` / `renderRouteId` | No | The UI route used to render the widget; defaults to `route` |
| `ToolPkg.registerDesktopWidget` | `title` | No | Widget title (supports `LocalizedText`) |
| `ToolPkg.registerDesktopWidget` | `subtitle` | No | Widget subtitle (supports `LocalizedText`) |
| `ToolPkg.registerDesktopWidget` | `description` | No | Widget configuration description (supports `LocalizedText`) |
| `ToolPkg.registerDesktopWidget` | `icon` | No | Icon name, used in scenarios such as the host configuration page |
| `ToolPkg.registerDesktopWidget` | `order` | No | Sort value; smaller values come first |
| `ToolPkg.registerAppLifecycleHook` | `id` | Yes | Unique identifier of the lifecycle hook |
| `ToolPkg.registerAppLifecycleHook` | `event` | Yes | Lifecycle event name (see the full list below) |
| `ToolPkg.registerAppLifecycleHook` | `function` | Yes | Function reference (arrow functions supported) |
| `ToolPkg.registerMessageProcessingPlugin` | `id` | Yes | Unique identifier of the message processing plugin |
| `ToolPkg.registerMessageProcessingPlugin` | `function` | Yes | Function reference (arrow functions supported) |
| `ToolPkg.registerXmlRenderPlugin` | `id` | Yes | Unique identifier of the XML render plugin |
| `ToolPkg.registerXmlRenderPlugin` | `tag` | Yes | Target XML tag name |
| `ToolPkg.registerXmlRenderPlugin` | `function` | Yes | Function reference (arrow functions supported) |
| `ToolPkg.registerInputMenuTogglePlugin` | `id` | Yes | Unique identifier of the input menu toggle plugin |
| `ToolPkg.registerInputMenuTogglePlugin` | `function` | Yes | Function reference (arrow functions supported) |
| `ToolPkg.registerChatMessageMenuItem` | `id` | Yes | Unique identifier of the message long-press menu item, requires ToolPkg API `1.0.1` |
| `ToolPkg.registerChatMessageMenuItem` | `title` | Yes | Menu text, supports `LocalizedText` |
| `ToolPkg.registerChatMessageMenuItem` | `icon` | No | Material icon name, e.g. `translate`, `info` |
| `ToolPkg.registerChatMessageMenuItem` | `order` | No | Sort value; smaller values come first |
| `ToolPkg.registerChatMessageMenuItem` | `senders` | No | Message senders on which it is allowed to appear; currently supports `user`, `ai` |
| `ToolPkg.registerChatMessageMenuItem` | `dialog.screen` | No | Compose DSL dialog resource path or screen reference that can be opened on click |
| `ToolPkg.registerChatMessageMenuItem` | `function` | Yes | Click callback function, which can return `dialog.state` and `dialog.moduleSpec` |

The click event name for `registerChatMessageMenuItem` is `chat_message_menu_item_click`. The event payload contains `chatId`, `messageIndex`, `menuItemId`, and a snapshot of the current message. If the registration item declares `dialog.screen`, the host writes these fields into the dialog DSL's initial `state`, and the `dialog.state` returned by the plugin function is also passed into the dialog.

`event` values supported by `ToolPkg.registerAppLifecycleHook`:

- `application_on_create`
- `application_on_foreground`
- `application_on_background`
- `application_on_low_memory`
- `application_on_trim_memory`
- `application_on_terminate`
- `activity_on_create`
- `activity_on_start`
- `activity_on_resume`
- `activity_on_pause`
- `activity_on_stop`
- `activity_on_destroy`

**Compose DSL runtime**:
- Write declarative UI in JavaScript
- Provides a rich set of UI components (Column, Row, Button, TextField, etc.)
- Supports state management and event handling
- Can call tools and access resources

#### 3.2.5 Execution Contexts, Module Instances, and IPC

The ToolPkg runtime divides execution into four types of contexts by execution source:

| Context | Typical Entry | Purpose | Instance Boundary |
|------|------|------|------|
| `main` | The package entry script pointed to by `manifest.main` | ToolPkg package-level logic: registering hooks, executing hooks, registering/handling package-level IPC, and holding package-level in-memory state | The same ToolPkg container shares one package-level JS engine, with an internal context key of the form `toolpkg_main:<toolpkg_id>` |
| `ui` | Compose DSL screen / action handler of `*.ui.js` | Rendering interfaces, responding to clicks, reading UI state | Each UI route, widget, and XML render instance has its own JS engine |
| `sandbox` | Standalone tool scripts, subpackage tool scripts, debug scripts | Executing one-off tool logic; can call the owning ToolPkg's `main` via IPC | Managed by the tool script execution chain |
| `provider` | AI provider handler registered via `ToolPkg.registerAiProvider(...)` | Handling a custom AI provider's model list, connection test, message sending, and token estimation | Each ToolPkg provider uses an independent JS engine, with an internal context key of the form `toolpkg_provider:<toolpkg_id>:<provider_id>` |

`manifest.main` points to the ToolPkg's package-level entry script, and this entry script runs in the `main` context. `main` is suited to holding in-memory state that needs to be shared across UI and subpackage tools, such as current session state, background task handles, caches, and IPC handlers.

`meta.currentRuntime` of `ToolPkg.ipc` uses these literals:

- `main`: ToolPkg package-level main context.
- `ui`: Compose DSL UI context.
- `sandbox`: Standalone tool script, subpackage tool script, and debug script context.
- `provider`: Custom AI provider context.

According to the current `tsconfig` configuration of the example project, ES `import` / `export` syntax can be used normally in TypeScript source; after compilation, synchronous scripts output CommonJS form, and the runtime loads modules via `require`.

When directly `import`ing / `require`ing a shared module, the runtime creates a module instance within the current execution context. In other words, when the ToolPkg main context and each UI context each import the same file, they each get their own instance; module top-level variables are not automatically shared across contexts.

This is not an error, and it is not unusable. Modules without in-memory state, such as pure functions, constants, type helpers, and i18n text resolution, are suitable for direct import:

```javascript
const { resolveText } = require("./shared/i18n.js");
```

But modules with in-memory state need special care:

```javascript
// shared/counter.js
let count = 0;

exports.inc = function () {
  count += 1;
  return count;
};
```

When the ToolPkg main context imports it once and `ui/panel/index.ui.js` imports it again, `count` exists in two copies. A value incremented by clicking a button in the UI does not automatically change the ToolPkg main copy of the in-memory state.

To share state or invoke capabilities across contexts, explicitly use `ToolPkg.ipc`:

```javascript
// manifest.main 指向的脚本顶层
let enabled = false;

ToolPkg.ipc.on("demo.get_state", async function () {
  return { enabled };
});

ToolPkg.ipc.on("demo.set_enabled", async function (payload) {
  enabled = payload.enabled === true;
  return { enabled };
});

function registerToolPkg() {
  return true;
}

exports.registerToolPkg = registerToolPkg;
```

```javascript
// ui/panel/index.ui.js
async function loadState() {
  const state = await ToolPkg.ipc.call("demo.get_state");
  return state.enabled;
}

async function setEnabled(enabled) {
  await ToolPkg.ipc.call("demo.set_enabled", { enabled });
}
```

To call a specific runtime instance, a third parameter can be passed:

```javascript
await ToolPkg.ipc.call(
  "demo.refresh_panel",
  { reason: "settings_changed" },
  { targetRuntime: "ui", targetContextKey: panelContextKey }
);
```

Basic semantics of `ToolPkg.ipc`:

- `ToolPkg.ipc.on(channel, handler)` registers a channel handler in the current context.
- `ToolPkg.ipc.call(channel, payload)` keeps its original semantics: a non-main context calls the same package's ToolPkg main; the main context calls the local handler.
- `ToolPkg.ipc.call(channel, payload, options)` can specify `targetRuntime` / `targetContextKey` to call a target runtime instance.
- `payload` and return values should use JSON-serializable data: strings, numbers, booleans, arrays, plain objects, and `null`.
- Objects are transferred by data copy, without preserving reference identity, prototypes, method closures, or class instances.
- A call to a registered channel within the same context goes directly to the local handler.
- When specifying a `ui`, `provider`, or `sandbox` target, an explicit `targetContextKey` is required; if the target does not exist, an error is reported directly.

Decision criteria:

- Read-only constants, pure functions, text resolution: import directly.
- In-memory state to be shared, caches, current session state, background task handles: place them in the ToolPkg main logic and access them via `ToolPkg.ipc`.
- UI state that only serves the current interface display: place it in `ctx.useState` / `ctx.useMemo`.

#### 3.2.6 Resources

Resource files can be files of any type, such as images, archives, configuration files, etc.

```json
{
  "key": "pc_agent_zip",
  "path": "resources/pc_agent/operit-pc-agent.zip",
  "mime": "application/zip"
}
```

Declaring directory resources is also supported:

```json
{
  "key": "pc_agent_zip",
  "path": "resources/pc_agent/operit-pc-agent",
  "mime": "inode/directory"
}
```

| Field | Type | Required | Description |
|------|------|------|------|
| `key` | string | Yes | The resource's unique key, used to reference it in code |
| `path` | string | Yes | The resource file's path within the ZIP package |
| `mime` | string | No | The resource's MIME type |

**Accessing resources**:
- In subpackage scripts: access via the PackageManager API
- In UI modules: access via `ToolPkg.readResource(key)`
- `ToolPkg.readResource(...)` must not be called during `registerToolPkg()` execution; calling it throws an exception immediately.

Directory resource notes:
- When `mime` is a directory type (e.g. `inode/directory`, `vnd.android.document/directory`), `ToolPkg.readResource(key)` first compresses that directory into a zip, then returns the temporary file path of that zip.
- When `outputFileName` is not explicitly passed, directory resources by default automatically gain a `.zip` suffix.

#### 3.2.7 Workflow Templates

ToolPkg can now register workflow templates directly via the `manifest`. After registration, templates appear in the host's current "Workflow -> Create from template" entry, and are also shown in the package management details dialog.

Example:

```json
{
  "workflow_templates": [
    {
      "id": "quick_chat_workflow",
      "display_name": {
        "zh": "快速对话工作流",
        "en": "Quick Chat Workflow"
      },
      "description": {
        "zh": "手动触发后自动启动聊天并发送一条引导消息。",
        "en": "Starts a chat and sends a guidance message after a manual trigger."
      },
      "resource_key": "demo_workflow_template"
    }
  ]
}
```

Field descriptions:

| Field | Type | Required | Description |
|------|------|------|------|
| `id` | string | Yes | Template unique identifier, which must be unique within the current ToolPkg |
| `display_name` | LocalizedText | No | Template display name |
| `description` | LocalizedText | No | Template description |
| `resource_key` | string | Yes | Points to a file resource in `resources` |

Requirements:
- `resource_key` must reference a file resource, not a directory resource
- The file content must be `Workflow` JSON that the host can deserialize
- Nodes are recommended to keep `__type`, so they stay stably aligned with the host's current `kotlinx.serialization` structure

Import behavior:
- On import, the host regenerates the workflow `id`
- Execution statistics fields are reset
- After successful import, it is persisted as a formal `Workflow`

#### 3.2.8 Workspace Templates

ToolPkg can also register workspace templates via the `manifest`. After registration, templates appear in the host's current "Workspace -> Create default" entry, and are also shown in the package management details dialog.

Example:

```json
{
  "resources": [
    {
      "key": "demo_workspace_template",
      "path": "resources/workspaces/quick_start",
      "mime": "inode/directory"
    }
  ],
  "workspace_templates": [
    {
      "id": "quick_start_workspace",
      "display_name": {
        "zh": "快速开始工作区",
        "en": "Quick Start Workspace"
      },
      "description": {
        "zh": "包含 .operit/config.json 的最小工作区模板。",
        "en": "A minimal workspace template containing .operit/config.json."
      },
      "resource_key": "demo_workspace_template",
      "project_type": "template_try"
    }
  ]
}
```

Field descriptions:

| Field | Type | Required | Description |
|------|------|------|------|
| `id` | string | Yes | Template unique identifier, which must be unique within the current ToolPkg |
| `display_name` | LocalizedText | No | Template display name |
| `description` | LocalizedText | No | Template description |
| `resource_key` | string | Yes | Points to a directory resource in `resources` |
| `project_type` | string | No | Project type label passed to the host UI for display |

Requirements:
- `resource_key` must reference a directory resource; a common `mime` can be written as `inode/directory` or `application/x-directory`
- The directory content must contain `.operit/config.json`
- On import, the host copies the entire directory to the current chat's workspace directory

Recommended directory structure:

```text
resources/
  workspaces/
    quick_start/
      .operit/
        config.json
      README.md
      src/
        ...
```

Minimal reference example:
- `examples/template_try/`
- It also demonstrates `workflow_templates`, `workspace_templates`, directory resources, and a minimal `main.ts`

## 4. Creating a ToolPkg

### 4.1 Manual Creation

**Step 1: Prepare the file structure**

```bash
my_toolpkg/
├── manifest.json
├── packages/
│   └── my_tool.js
├── ui/
│   └── my_ui/
│       └── index.ui.js
└── resources/
    └── icon.png
```

**Step 2: Write manifest.json**

Write the manifest file following the example in Section 3.

**Step 3: Write the subpackage script**

The subpackage script must contain a `METADATA` block; see [SCRIPT_DEV_GUIDE.md](./SCRIPT_DEV_GUIDE.en.md).

**Step 4: Package as a ZIP**

Use any ZIP tool to package the entire directory, and rename it with the `.toolpkg` extension:

```bash
# Linux/macOS
cd my_toolpkg
zip -r ../my_toolpkg.toolpkg *

# Windows (PowerShell)
Compress-Archive -Path my_toolpkg\* -DestinationPath my_toolpkg.toolpkg
```

### 4.2 Automatic Packaging with a Python Script

The project provides the `tools/example_packages/sync_example_packages.py` script, which can automatically package the packages under the `examples/` directory into `.toolpkg` files.

**Usage**:

```bash
# 打包所有白名单中的包
python tools/example_packages/sync_example_packages.py

# 以“非白名单附加”的方式打包特定包
python tools/example_packages/sync_example_packages.py --include windows_control

# 例如只额外同步 template_try 这个示例
python tools/example_packages/sync_example_packages.py --include template_try

# 查看打包结果（不实际写入）
python tools/example_packages/sync_example_packages.py --dry-run

# 删除不在白名单中的包
python tools/example_packages/sync_example_packages.py --delete-extra
```

**How it works**:
1. Scan the `examples/` directory
2. Find folders containing `manifest.json` or `manifest.hjson`
3. Package each entire folder into a `.toolpkg` ZIP file
4. Output to the `app/src/main/assets/packages/` directory

When the script enables on-device hot update, it identifies the installed applicationId in Debug, then Release order, and pushes the packages to the corresponding `Android/data/<applicationId>/files/packages/` directory. When both APKs are installed at the same time, pass `--app-package <applicationId>` or set `OPERIT_APP_PACKAGE` to specify the target explicitly.

## 5. Subpackage Script Development

### 5.1 Basic Structure

Subpackage scripts must follow the standard script format, containing a `METADATA` block:

```javascript
/* METADATA
{
    "name": "windows_control",
    "description": {
        "zh": "通过 HTTP 调用 Operit PC Agent 控制 Windows 电脑",
        "en": "Control a Windows PC through Operit PC Agent over HTTP"
    },
    "enabledByDefault": false,
    "env": [
        {
            "name": "WINDOWS_AGENT_BASE_URL",
            "description": {
                "zh": "Operit PC Agent 地址",
                "en": "Operit PC Agent URL"
            },
            "required": true
        }
    ],
    "tools": [
        {
            "name": "windows_exec",
            "description": {
                "zh": "在 Windows 上执行命令",
                "en": "Execute commands on Windows"
            },
            "parameters": [
                {
                    "name": "command",
                    "description": {
                        "zh": "要执行的命令",
                        "en": "Command to execute"
                    },
                    "type": "string",
                    "required": true
                }
            ]
        }
    ]
}
*/

/// <reference path="../../types/index.d.ts" />

const WindowsControl = (function () {
    async function wrap(func, params) {
        try {
            const result = await func(params);
            complete(result);
        } catch (error) {
            complete({ success: false, message: error.message });
        }
    }

    async function windows_exec(params) {
        const { command } = params;
        // 实现逻辑...
        return { success: true, output: "..." };
    }

    return {
        windows_exec: (params) => wrap(windows_exec, params),
    };
})();

exports.windows_exec = WindowsControl.windows_exec;
```

### 5.2 Multi-Language Support

All text fields in a subpackage script's `METADATA` support multiple languages:

- `description`: Package description
- `tools[].description`: Tool description
- `tools[].parameters[].description`: Parameter description
- `env[].description`: Environment variable description

### 5.3 Environment Variables

A subpackage can declare the environment variables it requires:

```json
"env": [
    {
        "name": "API_KEY",
        "description": { "zh": "API 密钥", "en": "API Key" },
        "required": true
    },
    {
        "name": "TIMEOUT",
        "description": { "zh": "超时时间", "en": "Timeout" },
        "required": false,
        "defaultValue": "30000"
    }
]
```

### 5.4 Java / Kotlin Bridge Return Values and Automatic Type Conversion

If a subpackage uses the `Java.type(...)` / `Java.xxx.yyy` bridge, the most important thing to remember is:

- **The bridge automatically normalizes many Java types into commonly used JS structures.**

In particular, for the following return values, do not write code against the Java container APIs anymore:

| Java / Kotlin Return Value | How It Is Actually Used on the JS Side |
|------|------|
| `List` / `Set` / other `Iterable` | Use as an ordinary array: `length`, index, `map/filter` |
| Java array / `JSONArray` | Use as an ordinary array |
| `Map` / `JSONObject` | Use as an ordinary object |
| `String` / `char` | Use as a string |
| `CharSequence` value returned by a Java method | Can be used as a string |
| `Enum` / `Class<?>` | Use as a string |
| Ordinary Java / Kotlin object | Use as a Java instance proxy; you can continue to call methods / read and write fields |

Typical mistakes:

```javascript
const items = someJavaApi.listSomething();

items.size(); // 不要这样写
items.get(0); // 不要这样写

items.length; // 对
items[0];     // 对
```

Conversely, when JS passes values to Java / Kotlin, an automatic adaptation pass also happens:

- JS arrays can automatically convert to Java arrays / `Collection` / `JSONArray`
- Plain objects can automatically convert to `Map` / `JSONObject`
- Plain objects or `Java.implement(...)` results can automatically convert to an interface proxy when the target is an interface
- Java instance proxies are automatically restored to the original Java objects

Additional recommendations:

- The table above describes the normalization result of **Java/Kotlin method return values**; if you yourself `new Java.java.lang.StringBuilder()` or `new Java.java.util.ArrayList()`, what you get is still a Java instance proxy.
- Java instance proxies by default recommend the `obj.method()` syntactic sugar; the runtime preferentially interprets instance members as methods.
- `obj.call('method', ...)` is still available, but is mainly used for the rare cases of field/method name conflicts or debugging scenarios.
- JS callbacks of `Java.implement(...)` return to the QuickJS runtime thread for execution; this does not mean the JS logic is actually moved to a Java child thread.

See the detailed rules in:

- [README.md](../app/src/main/java/com/ai/assistance/operit/core/tools/javascript/README.en.md)

## 6. UI Module Development

### 6.1 Compose DSL Introduction

Compose DSL is a JavaScript-based declarative UI framework, inspired by Jetpack Compose.

**Features**:
- Declarative syntax
- Component-based design
- State management
- Event handling

### 6.2 Basic Example

```javascript
/// <reference path="../../types/index.d.ts" />

function Screen(ctx) {
    // 状态管理
    const [url, setUrl] = ctx.useState('url', '');
    const [token, setToken] = ctx.useState('token', '');

    // 事件处理
    async function handleConnect() {
        const result = await ctx.callTool('windows_control:windows_test_connection', {
            base_url: url,
            token: token
        });

        if (result.success) {
            await ctx.showToast('连接成功！');
        } else {
            await ctx.showToast('连接失败：' + result.error);
        }
    }

    // UI 布局
    return ctx.UI.Column({ padding: 16 }, [
        ctx.UI.Text({ text: 'Windows Agent 配置', fontSize: 20, bold: true }),
        ctx.UI.Spacer({ height: 16 }),

        ctx.UI.TextField({
            value: url,
            onValueChange: setUrl,
            label: 'Agent 地址',
            placeholder: 'http://192.168.1.8:58321'
        }),
        ctx.UI.Spacer({ height: 8 }),

        ctx.UI.TextField({
            value: token,
            onValueChange: setToken,
            label: 'Token',
            placeholder: '输入 Token'
        }),
        ctx.UI.Spacer({ height: 16 }),

        ctx.UI.Button({
            text: '测试连接',
            onClick: handleConnect
        })
    ]);
}

exports.default = Screen;
```

### 6.3 Available Components

#### Layout Components
- `Column`: Vertical layout
- `Row`: Horizontal layout
- `Box`: Container
- `Spacer`: Spacing
- `LazyColumn`: Scrollable list

#### Basic Components
- `Text`: Text
- `TextField`: Text input field
- `Button`: Button
- `IconButton`: Icon button
- `Switch`: Switch
- `Checkbox`: Checkbox
- `Card`: Card
- `Icon`: Icon
- `AlertDialog`: Material3 standard dialog, requires ToolPkg API `1.0.1`
- `Dialog`: Custom content dialog, requires ToolPkg API `1.0.1`
- `AiChat`: Embeds the current main chat's message list and input area, excluding the workspace
- `AdaptiveSidePanel`: Adaptive side panel with a draggable split pane on wide screens and an overlay on narrow screens

The second parameter of `AdaptiveSidePanel` is the main content, and `side` is the side panel content. Both must be passed exactly one node; `open` and `onOpenChanged` are managed by plugin state. By default, a split pane is used above 600dp, with an initial side panel width of 360dp, a minimum width of 280dp, and at least 320dp reserved for the main content.

```javascript
function Screen(ctx) {
    const [sideOpen, setSideOpen] = ctx.useState('sideOpen', true);

    return ctx.UI.AdaptiveSidePanel({
        open: sideOpen,
        onOpenChanged: setSideOpen,
        side: ctx.UI.Column({ padding: 16 }, [
            ctx.UI.Text({ text: 'Plugin side panel' })
        ])
    }, ctx.UI.AiChat());
}
```

#### Progress Components
- `LinearProgressIndicator`: Linear progress bar
- `CircularProgressIndicator`: Circular progress bar

### 6.4 Context API

UI modules access various features through the `ctx` object:

#### State Management
```javascript
const [value, setValue] = ctx.useState('key', initialValue);
const memoValue = ctx.useMemo('key', () => computeValue(), [deps]);
```

#### Tool Calls
```javascript
const result = await ctx.callTool('package:tool_name', { param: value });
```

#### Environment Variables
```javascript
const apiKey = ctx.getEnv('API_KEY');
await ctx.setEnv('API_KEY', 'new_value');
await ctx.setEnvs({ API_KEY: 'value1', TOKEN: 'value2' });
```

#### Resource Access
```javascript
const filePath = await ToolPkg.readResource('resource_key');
```

#### Package Management
```javascript
const isImported = await ctx.isPackageImported('package_name');
await ctx.importPackage('package_name');
await ctx.removePackage('package_name');
await ctx.usePackage('package_name');
const packages = await ctx.listImportedPackages();
```

#### Tool Name Resolution
```javascript
const toolName = await ctx.resolveToolName({
    packageName: 'my_package',
    subpackageId: 'my_subpackage',
    toolName: 'my_tool',
    preferImported: true
});
```

#### UI Interaction
```javascript
await ctx.showToast('消息内容');
const routes = ctx.listRoutes?.() ?? [];
const hostRoutes = ctx.getHostRoutes?.() ?? [];
await ctx.navigate('native.settings', {});
ctx.reportError(error);
```

`ctx.navigate(route, args?)` now triggers a real route navigation.
`ctx.listRoutes()` returns the currently navigable route list (including fields such as `routeId`, `runtime`, etc.).
`ctx.getHostRoutes()` returns only host Native routes, making it easy for plugins to explicitly discover available native pages.
Native route ID naming rule: `native.<Screen object name in snake_case>`, e.g. `Screen.Toolbox -> native.toolbox`.

#### File Selection

`ctx.openFilePicker(options?)` uses a `picker` field to select the source. When omitted, document selection is used.

```javascript
const images = await ctx.openFilePicker({
    picker: 'image',
    allowMultiple: true
});

const directory = await ctx.openFilePicker({
    picker: 'directory',
    persistPermission: true
});
```

- `document`: Document selection; can use `mimeTypes`, `allowMultiple`, and `persistPermission`
- `image`, `video`, `media`: System visual media selection, limited to images, videos, or both respectively; can use `allowMultiple`
- `directory`: Directory selection; can use `persistPermission`
- `camera`: Captures a JPEG image

Each result contains a `uri`. Document, visual media, and camera results also contain a temporary local `path`; directory results only provide a `uri`. Options that cannot be used for that source cause the call to fail, and cannot be silently ignored.

Compatibility notes:

- `ToolPkg.registerToolboxUiModule(...)` is still retained.
- After the call, it registers a `compose_dsl` UI route and mounts it to the `toolbox` navigation entry.
- The old interface does not automatically create a main sidebar plugin entry; if a main sidebar plugin entry is needed, additionally call `ToolPkg.registerNavigationEntry(...)` with `surface: "main_sidebar_plugins"`.

#### Other
```javascript
const locale = getLang(); // 'zh' 或 'en'
const text = ctx.formatTemplate('Hello {name}!', { name: 'World' });
const packageName = ctx.getCurrentPackageName();
const toolPkgId = ctx.getCurrentToolPkgId();
const moduleId = ctx.getCurrentUiModuleId();
const spec = ctx.getModuleSpec();
```

## 7. Resource File Management

### 7.1 Adding Resources

Declare resources in `manifest.json`:

```json
"resources": [
    {
        "key": "icon",
        "path": "resources/icon.png",
        "mime": "image/png"
    },
    {
        "key": "config",
        "path": "resources/config.json",
        "mime": "application/json"
    }
]
```

### 7.2 WASM Module Resources

`.wasm` files declared in `wasm_modules` do not need to also be written into `resources`. They are managed by the host by module ID, and are suited to holding enterprise core algorithms. On the author side, it is recommended to write a typed facade in `src/wasm/*.ts`, with the facade internally calling `ToolPkg.wasm.call(moduleId, exportName, args)`, and the business entry importing the facade directly.

### 7.3 Accessing Resources

**In UI modules**:
```javascript
const iconPath = await ToolPkg.readResource('icon');
// iconPath 是资源文件在设备上的临时路径
```

If `icon` corresponds to a directory resource, the return value will be the path of the zip file temporarily generated at runtime.

**In subpackage scripts**:
```javascript
// 通过 PackageManager API 访问（需要原生桥接）
```

## 8. Deployment and Distribution

### 8.1 Built-in Packages

Placing a `.toolpkg` file in the `app/src/main/assets/packages/` directory bundles it into the APK.

### 8.2 External Packages

Users can import external packages in the following ways:
1. Copy the `.toolpkg` file to the device's `Android/data/<applicationId>/files/packages/` directory, where `<applicationId>` is `com.ai.assistance.operit.debug` or `com.ai.assistance.operit`
2. Use the "Import package" feature in the app

### 8.3 Version Management

Semantic version numbers are recommended:
- `MAJOR.MINOR.PATCH` (e.g. `1.2.3`)
- MAJOR: Incompatible API changes
- MINOR: Backward-compatible feature additions
- PATCH: Backward-compatible bug fixes

## 9. Best Practices

### 9.1 Naming Conventions

- **toolpkg_id**: Use reverse-domain format, e.g. `com.operit.windows_bundle`
- **subpackage id**: Use lowercase letters and underscores, e.g. `windows_control`
- **resource key**: Use lowercase letters and underscores, e.g. `pc_agent_zip`
- **ui_module id**: Use lowercase letters and underscores, e.g. `windows_setup`

### 9.2 File Organization

```
my_toolpkg/
├── manifest.json              # 清单文件
├── packages/                  # 子包目录
│   ├── tool1.js
│   └── tool2.js
├── ui/                        # UI 模块目录
│   ├── setup/
│   │   └── index.ui.js
│   └── dashboard/
│       └── index.ui.js
├── resources/                 # 资源目录
│   ├── images/
│   │   └── icon.png
│   └── data/
│       └── config.json
└── i18n/                      # 国际化目录（可选）
    ├── zh-CN.js
    └── en-US.js
```

### 9.3 Multi-Language Support

- All user-facing text should provide multi-language versions
- At least provide Chinese (`zh`) and English (`en`)
- Use the `default` key as the default value

### 9.4 Resource Optimization

- Compress images and other resource files
- Avoid including unnecessary files
- Use appropriate MIME types

### 9.5 Error Handling

- Use `try-catch` in subpackage scripts to catch errors
- Use `ctx.reportError()` in UI modules to report errors
- Provide clear error messages

### 9.6 Testing

- Test all subpackage scripts before packaging
- Test the various interaction scenarios of UI modules
- Verify that resource files can be accessed correctly
- Test multi-language switching

## 10. Troubleshooting

### 10.1 Common Issues

**Issue 1: Package cannot be imported**
- Check whether the `manifest.json` format is correct
- Confirm whether `toolpkg_id` is unique
- Verify whether the ZIP file structure is correct

**Issue 2: Subpackage cannot be loaded**
- Check whether the `entry` path is correct
- Confirm that the script file contains valid `METADATA`
- Check the app logs for detailed error information

**Issue 3: Resource cannot be accessed**
- Check whether the resource `key` is correct
- Confirm that the resource `path` exists in the ZIP
- Verify that the resource file is not corrupted

**Issue 4: UI module is not displayed**
- Check whether `main.js` exports `registerToolPkg`
- Check whether `ToolPkg.registerToolboxUiModule(...)` was called
- Confirm that the `runtime` type is correct
- Confirm that `screen` is passed an imported module function (e.g. `const ui = require(...).default`)
- Verify that the UI script syntax is correct

### 10.2 Debugging Tips

1. **Use dry-run mode**:
   ```bash
   python tools/example_packages/sync_example_packages.py --dry-run
   ```

2. **View app logs**:
   ```bash
   adb logcat -s PackageManager:* JsEngine:*
   ```

3. **Manually unzip and inspect**:
   ```bash
   unzip -l my_toolpkg.toolpkg
   ```

4. **Validate JSON format**:
   Use an online JSON validation tool to check `manifest.json`

### 10.3 Quickly Flashing to a Phone with the Debug Install Script

Ordinary `.js` packages can be temporarily pushed and executed once with `tools/adb/execute_js.bat` / `tools/adb/execute_js.sh`; but a `toolpkg` is not suitable for debugging this way.

The reason is that a `toolpkg` is not just "running a function"; it also involves:

- Reading `manifest.json` / `manifest.hjson`
- Parsing `toolpkg_id`
- Loading the registration logic in the `main` script
- Synchronizing host-level registrations such as UI modules, message processing plugins, Prompt Hooks, and Tool Lifecycle Hooks
- Refreshing ToolPkg registration information

Therefore, the correct approach to `toolpkg` debugging is not "one run", but "fast reinstallation".

The project now provides dedicated debug install scripts:

- Windows: `tools/toolpkg/debug_toolpkg.bat`
- Linux/macOS: `tools/toolpkg/debug_toolpkg.sh`
- Shared implementation: `tools/toolpkg/debug_toolpkg.py`

They perform the following flow:

1. Read the `manifest` from a ToolPkg directory or an existing `.toolpkg`
2. Parse `toolpkg_id` and `main`
3. If the input is a directory, first temporarily package it into a `.toolpkg`
4. Push the package via `adb push` to the phone's `Android/data/<applicationId>/files/packages/`; the debug script automatically selects the installed Debug/Release applicationId
5. Send a debug broadcast, letting the app rescan the external packages directory
6. Enable that ToolPkg container by `toolpkg_id`
7. Reapply subpackage enabled states according to manifest defaults (optionally disabled)
8. Refresh ToolPkg registration information, and try to reactivate subpackage tools that were previously registered

This chain is closer to real installation behavior, and is suitable for debugging:

- `ToolPkg.registerToolboxUiModule(...)`
- `ToolPkg.registerMessageProcessingPlugin(...)`
- `ToolPkg.registerXmlRenderPlugin(...)`
- `ToolPkg.registerInputMenuTogglePlugin(...)`
- `ToolPkg.registerChatMessageMenuItem(...)`, requires ToolPkg API `1.0.1`
- `ToolPkg.registerChatRuntimeHook(...)`, requires ToolPkg API `1.0.1`
- `ToolPkg.registerToolLifecycleHook(...)`
- Prompt-related hooks

#### 10.3.1 Usage

Pass a ToolPkg directory directly:

```bash
python tools/toolpkg/debug_toolpkg.py examples/windows_control
```

You can also pass a `manifest.json`:

```bash
python tools/toolpkg/debug_toolpkg.py examples/windows_control/manifest.json
```

Or pass an existing `.toolpkg`:

```bash
python tools/toolpkg/debug_toolpkg.py /path/to/windows_control.toolpkg
```

On Windows, use directly:

```bat
tools\toolpkg\debug_toolpkg.bat examples\windows_control
tools\toolpkg\debug_toolpkg.bat examples\windows_control\manifest.json
tools\toolpkg\debug_toolpkg.bat D:\tmp\windows_control.toolpkg --device emulator-5554
```

On Linux/macOS, use directly:

```bash
bash tools/toolpkg/debug_toolpkg.sh examples/windows_control
bash tools/toolpkg/debug_toolpkg.sh examples/windows_control/manifest.json
```

#### 10.3.2 Common Parameters

- `--device <serial>`: Specify the adb device; when omitted, if only one device is connected it is automatically selected
- `--app-package <applicationId>`: Specify `com.ai.assistance.operit.debug` or `com.ai.assistance.operit`; when omitted, the installed Debug package is preferred, and the environment variable `OPERIT_APP_PACKAGE` can also be used
- `--no-reset-subpackage-states`: Keep the subpackage switch states already on the device, rather than resetting them to the manifest defaults
- `--log-wait-seconds <n>`: How many seconds to wait after sending the broadcast before capturing logs; by default reads `OPERIT_LOG_WAIT_SECONDS`, otherwise `6`

#### 10.3.3 Viewing Logs

The script captures these log tags by default:

```bash
adb logcat -d -s ToolPkgDebugInstallReceiver:* ToolPkg:* PackageManager:*
```

If you suspect a JS execution-time issue, you can also check:

```bash
adb logcat -d -s JsEngine:* ToolPkg:* PackageManager:*
```

#### 10.3.4 Notes

- This script depends on the phone's Operit already containing the `ToolPkgDebugInstallReceiver` debug broadcast entry; if the phone has an old version of the app installed, the broadcast will not take effect.
- The script handles overwriting installation of an external ToolPkg with the same name based on `toolpkg_id`; during debugging, keep `toolpkg_id` stable and do not rename it frequently.
- If you are debugging hook behavior, prefer this install script set, and do not try to run a `toolpkg` as an ordinary `.js` package.

## 11. Example Projects

### 11.1 Windows Control Bundle

The complete example is located at `examples/windows_control/`:

```
windows_control/
├── manifest.json
├── packages/
│   └── windows_control.js
├── ui/
│   └── windows_setup/
│       └── index.ui.js
├── resources/
│   └── pc_agent/
│       └── operit-pc-agent/
└── i18n/
    ├── zh-CN.js
    └── en-US.js
```

**Features**:
- Control a Windows PC over HTTP
- Provide a one-click configuration UI
- Include the PC Agent installation package resource
- Support Chinese and English bilingual

### 11.2 Packaging Commands

```bash
# 打包 windows_control
python tools/example_packages/sync_example_packages.py --include windows_control

# 查看打包结果
ls -lh app/src/main/assets/packages/windows_control.toolpkg
```

## 12. References

- [Script Development Guide](./SCRIPT_DEV_GUIDE.en.md): Learn how to write subpackage scripts
- [ToolPkg API Documentation](./doc-src/package-dev/toolpkg.en.md): Learn about the registration API
