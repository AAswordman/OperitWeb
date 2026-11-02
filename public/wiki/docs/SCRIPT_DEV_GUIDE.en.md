# Script Development Guide

## 1. Introduction

This document aims to provide developers with a comprehensive guide on how to write, build, and maintain automation scripts. **These scripts are intended as powerful tools to be imported into the Operit AI assistant and invoked by the AI according to user instructions, thereby greatly expanding the application's functional boundaries.** These scripts are based on a powerful framework that provides a range of tools for device control, UI automation, network requests, and file operations.

Scripts are mainly written in **TypeScript** to take advantage of its strong type system, but native JavaScript (ES6+) can also be used.

## 2. Determine Your Development Scenario First

Do not treat "developing a plugin" and "modifying the Operit main repository" as the same thing. They use different directories, materials, and debugging paths.

### In-App AI Collaborative Development

This is the default workflow for ordinary Sandbox Package authors. First update and run the `SandboxPackage_DEV` installation script, then develop in `/sdcard/Download/Operit/dev_package/{packageId}/`. Host types are placed in the sibling directory `/sdcard/Download/Operit/dev_package/types/`; the specific steps are governed by the `SKILL.md` installed afterwards.

### Independent Plugin Authors

Independent plugin authors can choose between two routes on the publishing page: directly uploading the current local package, or referencing an asset in their own GitHub Release. A separate Git repository suits plugins that need to independently maintain source code, build scripts, versions, and Releases; it is not a prerequisite for marketplace publishing.

### Operit Source Contributors

Only when you need to modify the Operit application itself, its built-in examples, or Android host capabilities should you enter the main repository development workflow. This requires cloning the main repository, installing dependencies, and using ADB debugging tools; it must not be treated as the default starting point for ordinary plugin authors.

---

## Publishing to the Plugin Marketplace

Marketplace publishing supports two routes, which correspond to different development and maintenance approaches:

1. Directly upload the current local package. This suits authors who only publish the current build artifact. After finishing the code, packaging, and package content check, select the local package on the Operit publishing page and upload it directly; there is no need to create or maintain a Git repository. Operit will create or update a Release in the `OperitForge` repository under the current GitHub account, and register it in the marketplace.
2. Reference a GitHub Release asset. This suits authors who maintain a plugin repository long-term. The repository should continuously hold the source code, manifest, build scripts, and dependency list, and maintain a `.gitignore` to exclude dependency directories, editor files, and device temporary files. Authors decide the publicity level and license themselves; a public repository can be shared independently, cloned, and gain collaborators and stars — the marketplace is just one distribution channel among them. For each release, the author builds the asset, updates the version, organizes commits and tags, creates a GitHub Release, and then registers it in the marketplace in Operit.

When referencing a GitHub Release asset, follow these steps in order:

1. Select the locally built plugin file.
2. Under "Publish resource source", select "Reference GitHub Release asset".
3. Fill in the author repository link; after it loads, select the Release and the corresponding asset.
4. Fill in the plugin name, introduction, category, version, and supported software versions, and confirm the marketplace registration.

Operit will check whether the Release asset matches the locally selected file, and the marketplace service will confirm that the creator of the Release is the currently logged-in GitHub author. The Release body should only contain the author's own release notes; there is no need to add Operit markers, verification text, or any other extra content.

The publishing page automatically saves unsubmitted form drafts, and clears the corresponding draft after marketplace registration succeeds. A ToolPkg's published version comes from the manifest inside the package; once identified, the publishing page does not allow manually modifying the registered version number. Whether a revised version rejected during review can be submitted is determined by the marketplace service at submission time; the client only displays the result returned by the server.

A repository may maintain only one plugin, or the author may organize multiple plugins as they see fit; the marketplace does not require a fixed number of repositories. The key to the referenced-Release route is continuously maintaining the Git project; the key to the direct-upload route is only being responsible for the current package's build and UI upload.

---

### Operit Source Contributors: Developing in the Project

This section is only for contributors who need to change the Operit main repository. Ordinary plugin authors should use the in-app Skill workflow described above or their own independent plugin repository.

**Step 1: Clone the project and install dependencies**

```bash
# 克隆项目仓库
git clone https://github.com/AAswordman/Operit.git
cd Operit

# 安装项目依赖 (主要是TypeScript编译器)
npm install
```

**Step 2: Create your first script**

All scripts are stored in the `examples/` directory. Create a new file in that directory, for example `my_first_script.ts`, and copy the following code into it.

```typescript
/*
METADATA
{
    "name": "MyFirstScript",
    "description": "我的第一个脚本，用于演示。",
    "category": "Utility",
    "tools": [
        {
            "name": "hello_world",
            "description": "向世界问好。",
            "parameters": [
                {
                    "name": "name",
                    "description": "要问好的人名",
                    "type": "string",
                    "required": true
                }
            ]
        }
    ]
}
*/

// 引用核心类型，这会给你带来代码自动补全的奇效
/// <reference path="./types/index.d.ts" />

// 这是一个标准的脚本结构，建议你直接复用
const MyFirstScript = (function () {
    // 包装函数，统一处理成功/失败的返回
    async function wrap(func: (params: any) => Promise<any>, params: any) {
        try {
            const result = await func(params);
            complete(result); // 也可以直接 return result；这里只是统一走显式完成
        } catch (error) {
            complete({ success: false, message: `执行失败: ${error.message}` });
        }
    }

    // 这是你工具的具体实现
    async function hello_world(params: { name: string }): Promise<any> {
        const message = `你好, ${params.name}! 欢迎来到 Operit 脚本世界。`;
        await Tools.System.sleep(500); // 调用内置API
        return { success: true, message: message };
    }

    // 导出你的工具，使其可以被调用
    return {
        hello_world: (params: any) => wrap(hello_world, params),
    };
})();

// 将工具函数暴露给脚本执行引擎
exports.hello_world = MyFirstScript.hello_world;
```

**Step 3: Compile the script**

TypeScript (`.ts`) files need to be compiled into JavaScript (`.js`) before they can be executed. The `tsc` command automatically reads the `tsconfig.json` file and compiles according to its configuration.

```bash
# 进入 examples 目录
cd examples

# 编译目录下的所有 TypeScript 脚本
npx tsc
```

After successful execution, you will see a `my_first_script.js` file generated next to `my_first_script.ts`.

**Step 4: Run the script on a device**

Make sure you have connected an Android device with USB debugging enabled. Then return to the project root and use the tools we provide to execute the script.

```bash
# 回到项目根目录
cd ..

# 执行脚本的 `hello_world` 函数
# Windows:
tools\\adb\\execute_js.bat examples\\my_first_script.js hello_world "{\\"name\\":\\"世界\\"}"
# Linux / macOS:
./tools/adb/execute_js.sh examples/my_first_script.js hello_world '{"name":"世界"}'
```

If you want to run the entire sandbox script directly, rather than specifying a particular exported function:

```bash
# Windows:
tools\\adb\\run_sandbox_script.bat examples\\my_first_script.js "{\\"name\\":\\"世界\\"}"
# Linux / macOS:
./tools/adb/run_sandbox_script.sh examples/my_first_script.js '{"name":"世界"}'
```

**Step 5: Check the result**

The script executor waits for a structured result file to be returned. If everything goes well, you will see a success message containing `"你好, 世界!..."` in the terminal, along with log events and the final result.

**Congratulations!**

You have completed the development and execution of your first script. You have now mastered the basics and can continue to explore **[Chapter 3: Core Concepts](#3-核心概念)** to learn the detailed configuration of `METADATA` and more uses of the `Tools` API, or jump directly to **[Chapter 6: UI Automation in Detail](#6-ui自动化详解)** to write more powerful automation scripts.

---

### Independent Plugin Repositories

If you want to manage your scripts independently, you can set up a development environment from scratch by following the steps below.

#### 2.1. Initialize the Project and Dependencies (`package.json`)

The `package.json` file is the manifest of a Node.js project, used to manage the project's metadata and dependencies.

**Step 1: Create `package.json`**

In your empty project folder, create a file named `package.json` and fill it with the following basic content:

```json
{
    "name": "my-script-project",
    "version": "1.0.0",
    "description": "My new script project.",
    "scripts": {
        "build": "tsc"
    },
    "devDependencies": {
        "@types/node": "^22.0.0",
        "typescript": "^5.4.5"
    }
}
```
*Note: We recommend using newer versions of `typescript` and `@types/node`; you can adjust the version numbers as needed.*

**Step 2: Install dependencies**

Open a terminal and run the following command in the project root to install the development dependencies:

```bash
npm install
```

This command downloads `typescript` and the Node.js type definitions according to the `devDependencies` in `package.json`.

#### 2.2. Configure TypeScript (`tsconfig.json`)

The `tsconfig.json` file specifies the TypeScript compiler options, telling it how to compile `.ts` files into `.js` files.

**Step: Create `tsconfig.json`**

Create a `tsconfig.json` file in the project root and copy in the following recommended configuration. This configuration is consistent with the standard configuration used by this project (`examples/tsconfig.json`), ensuring compatibility.

```json
{
  "compilerOptions": {
    "target": "es2020",
    "module": "commonjs",
    "lib": [
      "es2020"
    ],
    "declaration": false,
    "strict": false,
    "noImplicitAny": false,
    "strictNullChecks": true,
    "noImplicitThis": true,
    "alwaysStrict": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitReturns": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "typeRoots": [
      "./types"
    ]
  },
  "include": [
    "**/*.ts",
    "**/*.d.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

**Key configuration notes:**
-   `"target": "es2020"`: Compiles the code to ES2020 JavaScript, matching the modern syntax capabilities available in the QuickJS runtime.
-   `"module": "commonjs"`: Uses the CommonJS module system, which is what the script execution environment requires.
-   `"lib": ["es2020"]`: Uses the ECMAScript standard library as the base and does not import browser DOM types by default. Operit scripts run in a QuickJS host, not a web page environment; `console`, timers, and other host capabilities are provided separately by a platform compatibility layer.
-   `"typeRoots": ["./types"]`: Specifies the directory where type definition files (`.d.ts`) are stored. You need to manually create a `types` folder in your project and place the platform-provided core type definition files (`index.d.ts`, `files.d.ts`, etc.) into it, so that you can get intelligent prompts for global objects such as `Tools`.
-   `"include": ["**/*.ts", "**/*.d.ts"]`: Tells the compiler to include both script source code and supplementary host type declaration files.

After completing the above steps, your project is set up. You can now continue reading the following chapters to learn the specific structure of the project and how to write scripts.

#### 2.3. Copy the Platform Core Files

To allow your scripts to interact with the platform and to run on devices, you need to copy some core files from the source project where this development guide lives (i.e. the `assistance` project) into your new project.

**Content to copy:**

1.  **Type definition files**: Copy the entire `examples/types/` folder from the source project to your new project root, and make sure the folder name is exactly `types`. This corresponds to the `"typeRoots": ["./types"]` configuration in `tsconfig.json`. These files define the types of global objects such as `Tools` and are key to getting code intelligence prompts.
2.  **Execution tools**: Copy the entire `tools/` folder from the source project root to your new project root. These scripts (such as `execute_js.bat`) are used to run and test your code on devices.

**Project structure after copying**

After completing all the above steps, your new project folder should look like this:

```plaintext
my-script-project/
├── node_modules/
├── tools/
│   ├── execute_js.bat
│   └── execute_js.sh
├── types/
│   ├── core.d.ts
│   ├── files.d.ts
│   ├── index.d.ts
│   ├── network.d.ts
│   ├── system.d.ts
│   ├── ui.d.ts
│   └── ... (其他核心类型定义文件)
├── my_first_script.ts  // 这是你将要创建的脚本文件
├── package.json
└── tsconfig.json
```

Now your development environment is fully ready.

## 3. Core Concepts

Before you start writing scripts, it is important to understand the following core concepts:

### 3.1. Script Metadata (METADATA)

Every script file must begin with a `/* METADATA ... */` comment block. This block defines the script's name, description, category, and most importantly — the tools it provides. **This metadata block is the only way for Operit AI to understand and invoke the functionality you write. The AI parses the information in `METADATA` and presents it as available "tools" to the large language model (LLM), thereby enabling complex scripts to be executed through natural language instructions.**

**Example:** (`examples/automatic_bilibili_assistant.ts`)

```typescript
/*
METADATA
{
    "name": "Automatic_bilibili_assistant",
    "version": "1.0.0",
    "display_name": {
        "zh": "B站智能助手",
        "en": "Bilibili Assistant"
    },
    "description": "高级B站智能助手，通过UI自动化技术实现B站应用交互...",
    "author": ["Operit Team"],
    "category": "UI_AUTOMATION",
    "env": ["BILIBILI_SESSDATA"],
    "tools": [
        {
            "name": "search_video",
            "description": "在B站搜索视频内容",
            "parameters": [
                {
                    "name": "keyword",
                    "description": "搜索关键词",
                    "type": "string",
                    "required": true
                },
                // ... more parameters
            ]
        },
        // ... more tools
    ]
}
*/
```

-   `name`: The script's unique identifier.
-   `version`: (Optional) The version number of the script package itself; the `major.minor.patch` format is recommended. ToolPkg's `requires[].min_version` / `requires[].max_version` will use this version for constraint checks.
-   `display_name`: (Optional, recommended) The name used for interface display. It does not affect the script ID; the script ID is still determined by `name`. Strings or multilingual objects are supported (see 3.1.2).
-   `description`: A detailed description of the script's functionality.
-   `author`: (Optional) Author information, supporting a single string or an array of strings.
-   `category`: (Optional) The script category, used for grouping and retrieval in the tool list. When not filled in or empty, the system automatically classifies it as `Other` (see 3.1.3).
-   `env`: (Optional) An array of strings declaring the names of the environment variables that this script/package depends on at runtime, such as various API Keys. The app will display corresponding input items in the "Environment Configuration" interface based on the keys listed here, and will verify whether these variables have been configured before activating the package.
-   `tools`: An array defining all the tools (functions) that this script exposes for external invocation.
    -   `name`: The function name of the tool.
    -   `description`: A description of the tool's functionality.
    -   `parameters`: The list of parameters the tool accepts; each parameter should define `name`, `description`, `type`, and `required`.
    -   `advice`: (Optional) Marks a "prompt/instruction-only" tool (such as usage_advice / workflow_guide).
        -   When `advice: true`, the tool does not require a function implementation of the same name in the script.
        -   Applies to pure prompt/rule-description scenarios; at runtime the "tool does not exist" check is skipped.

### 3.1.1. Dynamic Tool Sets: `states`

When the same script needs to expose different tool sets under different device capabilities/permission levels (or the same tool needs different descriptions/parameter constraints), you can use the `states` field in `METADATA`.

`states` is an array, each element of which is a "state". The system evaluates each state's `condition` in order according to runtime capabilities, selects the first state whose condition is `true`, and activates it.

#### State Structure

-   `id`: The state ID (string), used by the script side to identify the current state.
-   `condition`: A condition expression (string), using "JS-like" boolean expression syntax.
-   `inheritTools`: Whether to inherit the top-level `tools` (boolean).
-   `excludeTools`: A list of tool names to exclude from the inherited tools (array of strings).
-   `tools`: The list of additional tools provided by this state (same element structure as `tools`). If a tool has the same name as an inherited tool, it overrides that tool's definition.

#### Selection Rules

-   If `states` is empty: use the top-level `tools`.
-   If `states` is non-empty: scan from top to bottom for the first state whose `condition` is satisfied.
    -   If no match is found: fall back to the top-level `tools`.

#### Merging Rules

-   When `inheritTools=true`: start from the top-level `tools` as the base.
-   First apply `excludeTools` to remove the specified tools.
-   Then merge in the state's `tools` (same names override, different names are added).

#### Condition Syntax (Summary)

-   Literals: `true` / `false` / `null`
-   Logic: `!` / `&&` / `||`
-   Comparison: `==` / `!=` / `>` / `>=` / `<` / `<=`
-   Membership test: `in` (example: `android.permission_level in ['ADMIN','ROOT']`)
-   Parentheses: `(...)`
-   Array literals: `[...]`

#### Available capability keys (built-in)

-   `ui.virtual_display`: Whether virtual screen capability is available (boolean)
-   `android.permission_level`: Permission level (enum, participating in comparisons as a string)
-   `android.shizuku_available`: Whether Shizuku is available (boolean)
-   `ui.shower_display`: Whether the Shower virtual screen is available (boolean)

#### Getting the current state from the script side

At runtime, the global function `getState(): string` is provided to the script environment, returning the `id` of the currently activated state.

#### Getting the current language from the script side

At runtime, the global function `getLang(): string` is provided to the script environment, returning the language code currently in use (such as `zh` / `en`). If the language is unavailable, it returns `en`.

### 3.1.2. Bilingual/Multilingual Text Fields (LocalizedText)

In `METADATA`, the following text fields all support two forms: a "single-language string" or a "multilingual object":

-   Package level: `display_name`
-   Package level: `description`
-   Tool level: `tools[].description`
-   Parameter level: `tools[].parameters[].description`
-   Environment variables (if using the object-format env declaration): `env[].description`

#### Two Forms

1) **Single language (string)**

```json
"description": "一个简短描述"
```

2) **Bilingual/multilingual (object)**

```json
"description": {
  "zh": "中文描述",
  "en": "English description",
  "default": "Fallback description"
}
```

#### Language Key Selection and Fallback

At runtime, the selection is made according to the system language, roughly in the following priority order:

-   Prefer matching the full language tag (such as `zh-CN`, `en-US`, including case variants)
-   Then match the language code (such as `zh`, `en`)
-   Then fall back to `default`
-   If still no match, fall back to any value in the object

#### Example (package/tool/parameter/environment variable all bilingual)

```typescript
/*
METADATA
{
  "name": "MyBilingualPackage",
  "category": "Utility",
  "display_name": {
    "zh": "双语示例包",
    "en": "Bilingual Demo Package",
    "default": "Bilingual Demo Package"
  },
  "description": {
    "zh": "演示双语元数据",
    "en": "Bilingual metadata demo",
    "default": "Bilingual metadata demo"
  },
  "env": [
    {
      "name": "MY_API_KEY",
      "description": {
        "zh": "用于访问某 API 的密钥",
        "en": "API key for accessing a service",
        "default": "API key"
      },
      "required": true
    }
  ],
  "tools": [
    {
      "name": "hello",
      "description": {
        "zh": "向指定的人问好",
        "en": "Say hello to someone",
        "default": "Say hello"
      },
      "parameters": [
        {
          "name": "name",
          "description": {
            "zh": "要问好的人名",
            "en": "Name to greet",
            "default": "Name"
          },
          "type": "string",
          "required": true
        }
      ]
    }
  ]
}
*/
```

### 3.1.3. The `category` Field Specification

`category` is an **optional field** of string type, used for script category display and retrieval. It is recommended to directly reuse categories already used in `examples/` and avoid creating new categories with duplicate semantics.

```json
"category": "Utility"
```

When `category` is missing, an empty string, or contains only whitespace characters, the parsing stage automatically classifies it as:

```json
"category": "Other"
```

Category values that can be referenced in the current `examples/`:

-   `Automatic`
-   `Chat`
-   `Development`
-   `Draw`
-   `File`
-   `Life`
-   `Map`
-   `Media`
-   `Memory`
-   `Network`
-   `Search`
-   `System`
-   `Utility`
-   `Workflow`
-   `Other` (system default fallback category)

### 3.3. Using Built-in Tools (Tools)

The platform provides a global `Tools` object containing all APIs for interacting with the underlying system. These APIs are grouped into different namespaces:

-   `Tools.System`: System-level operations, such as `sleep()`, `startApp()`, `stopApp()`.
-   `Tools.UI`: UI automation operations, such as `getPageInfo()`, `pressKey()`, `swipe()`, `setText()`.
-   `Tools.Files`: File system operations, such as `read()`, `write()`, `list()`.
-   `Tools.Network`: Network requests, such as `httpGet()`, `httpPost()`.
-   `UINode`: A class for representing and manipulating UI elements.

All of these tool functions are **asynchronous** and must be called with `await`.

**Example:**
```typescript
// 等待3秒
await Tools.System.sleep(3000);

// 获取当前页面信息
const pageInfo = await Tools.UI.getPageInfo();

// 在屏幕上滑动
await Tools.UI.swipe(540, 1800, 540, 900);
```

### 3.4. Java/Kotlin Class Bridging (Java Bridge)

In addition to `Tools`, the script runtime also injects the global `Java` / `Kotlin` objects for directly calling Java/Kotlin/Android classes.

This capability is suitable for:

-   Directly accessing Android SDK classes (such as `android.os.Build`, `android.os.SystemClock`).
-   Calling classes and singleton objects exposed by the host application.
-   Implementing Java interface callbacks in scripts (such as `Runnable`, `Callable`, Listeners).

#### 3.4.1. Two Layers of API

1.  **High-level API (recommended)**: `Java` / `Kotlin` (Rhino style)
2.  **Low-level API (debugging / low-level control)**: `NativeInterface.java*`

`Kotlin` is a synonym/alias for `Java`, with an identical API.

#### 3.4.2. Common High-Level API Capabilities

-   Class retrieval:
    -   Syntactic sugar (recommended): `Java.java.lang.StringBuilder`, `Java.android.os.Build.VERSION`, `Java.android.app.AlertDialog.Builder`
    -   Compatible form: `Java.type("java.lang.StringBuilder")`
    -   Aliases: `Java.use(...)` / `Java.importClass(...)`
-   Package-chain access: `Java.java.lang.System.currentTimeMillis()`
-   Static calls: `Java.callStatic(className, methodName, ...args)`
-   Async suspend calls: `Java.callSuspend(className, methodName, ...args)` (returns a Promise)
-   Constructing instances: `Java.newInstance(className, ...args)` or `new Java.java.util.ArrayList()`
-   Interface implementation:
    -   `Java.implement(interfaceNameOrNames, impl)` (supports a string interface name or a `Java.xxx` class proxy)
    -   `Java.proxy(interfaceNameOrNames, impl)` (alias of `implement`)
    -   **Syntactic sugar**: When a Java/Kotlin method parameter is of an interface type, you can directly pass a JS function/object, and the bridge will automatically infer the interface and create a proxy (no explicit `implement` needed)
-   Lifecycle management:
    -   Java instance handles and JS interface callbacks are automatically managed by the runtime; there is no need to manually release script-side callback markers

#### 3.4.3. Handle and Lifecycle Recommendations

Java complex objects crossing the bridge are wrapped as "instance proxies" (internally handle references). Recommendations:

-   Callback markers produced by `Java.implement` / `Java.proxy` no longer need to be manually released; after the corresponding Java proxy is GC'd, the runtime will automatically remove the current JS callback registration.
-   Handle unbinding for Java instance proxies is handled automatically by the runtime; business scripts no longer expose `obj.release()` / `Java.release(...)` / `Java.releaseAll()`.
-   The runtime will try to unbind the corresponding handle after a proxy object is GC'd, and will also clean up remaining handles when the engine is destroyed; the timing of GC itself remains uncertain.
-   The Java Bridge instance default recommendation is the `obj.methodName()` dynamic syntactic sugar; the runtime will preferentially interpret instance members as methods, aiming to keep this form usable as much as possible.
-   `obj.call('methodName', ...)` can still be used for the rare cases of field/method name conflicts, or for explicitly calling when debugging bridging issues.
-   JS callbacks of `Java.implement(...)` / `Java.proxy(...)` are scheduled back to the QuickJS runtime thread for execution, rather than being executed directly on the Java caller's thread; do not treat this as a true multithreaded execution model on the JS side.
-   "Java return values are normalized" and "explicitly constructing Java objects" are two different things: for example, `JSONArray` / `JSONObject` / `Map` / `List` returned by Java methods will be used on the JS side as arrays or plain objects; but the results of explicit constructions such as `new Java.java.lang.StringBuilder()` and `new Java.java.util.ArrayList()` remain Java instance proxies themselves.

#### 3.4.4. Example: Package-Chain Syntax + Callbacks

```typescript
const Thread = Java.java.lang.Thread;
const Runnable = Java.java.lang.Runnable;

let runCount = 0;
const runnable = Java.implement(Runnable, () => {
    runCount += 1;
});

const worker = new Thread(runnable);
worker.start();
worker.join(2000);
console.log("runCount=", runCount);
```

#### 3.4.5. Example: Android Classes and Inner Classes

```typescript
const Build = Java.android.os.Build;
const Version = Java.android.os.Build.VERSION;
const AlertDialogBuilder = Java.android.app.AlertDialog.Builder;

console.log("brand=", String(Build.BRAND || ""));
console.log("sdk=", Number(Version.SDK_INT));
```

#### 3.4.6. Low-Level `NativeInterface.java*` (Only Use When Necessary)

The high-level API automatically handles parameter conversion, exception throwing, and handle wrapping. Direct use of `NativeInterface.java*` is only recommended when debugging low-level behavior:

```typescript
const raw = NativeInterface.javaCallStatic(
    "java.lang.Integer",
    "parseInt",
    JSON.stringify(["42"])
);
const parsed = JSON.parse(raw);
if (!parsed.success) throw new Error(parsed.error);
console.log(parsed.data); // 42
```

If you develop in TypeScript, it is recommended to first reference `examples/types/index.d.ts` to get type hints for the Java Bridge (including `Java`, `Kotlin`, `NativeInterface`).

#### 3.4.7. Example: suspend Calls (callback / Promise)

`callSuspend` is used to call Kotlin `suspend` methods and always returns a `Promise`.

```typescript
const EnhancedAIService = Java.com.ai.assistance.operit.api.chat.EnhancedAIService;

// Promise 形式
const service = await EnhancedAIService.callSuspend(
    "getAIServiceForFunction",
    ctx,
    FunctionType.CHAT
);
```

## 4. Writing Your First Script (TypeScript)

Using TypeScript to write scripts is recommended, so that you can fully leverage the type definitions provided in the `types/` directory for a better development experience.

### Step 1: Create a `.ts` File

Create a new `.ts` file in your chosen script directory, for example `my_new_script.ts`.

### Step 2: Add Metadata

Add a `METADATA` block at the top of the file to define your script and tools.

```typescript
/*
METADATA
{
    "name": "MyNewScript",
    "description": "一个用于演示脚本开发的新脚本。",
    "category": "Utility",
    "tools": [
        {
            "name": "hello_world",
            "description": "向指定的人问好。",
            "parameters": [
                {
                    "name": "name",
                    "description": "要问好的人名",
                    "type": "string",
                    "required": true
                }
            ]
        }
    ]
}
*/
```

### Step 3: Write the Main Logic

Use an Immediately Invoked Function Expression (IIFE) to encapsulate the script logic and avoid polluting the global scope.

```typescript
// 引用核心类型，以获得代码提示
/// <reference path="./types/index.d.ts" />

const MyNewScript = (function () {
    // 辅助函数，用于统一返回结果
    async function wrapToolExecution(func: (params: any) => Promise<any>, params: any) {
        try {
            const result = await func(params);
            return result;
        } catch (error) {
            console.error(`工具 ${func.name} 执行失败`, error);
            return {
                success: false,
                message: `工具执行时发生意外错误: ${error.message}`,
            };
        }
    }

    // 实现 `hello_world` 工具
    async function hello_world(params: { name: string }): Promise<any> {
        const { name } = params;
        
        // 使用内置工具
        await Tools.System.sleep(500);
        
        const message = `你好, ${name}! 欢迎使用脚本。`;
        
        // 返回成功结果
        return { success: true, message: message };
    }

    // 导出工具
    return {
        hello_world: (params: any) => wrapToolExecution(hello_world, params),
    };
})();

// 导出模块，使其可以被系统加载
exports.hello_world = MyNewScript.hello_world;
```

### Step 4: Use Types

-   Adding `/// <reference path="./types/index.d.ts" />` at the top of the file allows the TypeScript compiler and your IDE (such as VS Code) to find the global type definitions.
-   The `.d.ts` files in the `types/` directory define in detail the signatures and return types of all available tools. For the Java Bridge contract description, [dev-core/JAVA_BRIDGE_INTERFACE.md](doc-src/dev-core/JAVA_BRIDGE_INTERFACE.en.md) takes precedence.

## 5. Going Deeper: Analyzing Example Scripts

Once you have mastered the basics of script writing, the best way to learn is to read existing excellent code. The `examples/` directory contains many scripts with various functions; we have selected the following as recommended advanced learning materials:

### 5.1. The Ultimate Introductory Tutorial: `examples/quick_start.ts`

This script is a textbook with super-detailed comments, starting from scratch. It is not just a tool, but a dynamic development document.

*   **Learning focus**:
    *   **Syntax basics**: Explains variables, data types, `async/await`, and `try/catch` error handling in detail.
    *   **Design pattern evolution**: Starting from a simple global function, it gradually refactors to using the `IIFE` pattern to isolate scope, and finally evolves to the `Wrapper` pattern we strongly recommend, giving you a deep understanding of why our code is organized this way.
    *   **`Tools` API calls**: Demonstrates how to call `Tools.System` and `Tools.Files` to interact with the system.
*   **Recommendation**: If you are unfamiliar with TypeScript/JavaScript, or confused about the `IIFE` and `Wrapper` patterns, be sure to read this file completely.

### 5.2. Network Requests and Concurrency: `examples/various_search.ts`

This script implements a practical multi-platform search engine aggregation tool and is the best example for learning network operations.

*   **Learning focus**:
    *   **Network requests**: Demonstrates how to use `Tools.Net.visit` to visit web pages and obtain readable content. It is not equivalent to a raw HTTP GET/POST; if you need an interface response body, use `httpGet` / `httpPost` / `http` instead.
    *   **Multi-tool aggregation**: The `combined_search` function shows how to call the logic of several other tools inside one tool, and use `Promise.all` to wait for multiple `toolCall()` calls simultaneously. Note: this does not mean the underlying tools are necessarily truly parallel; the actual degree of concurrency still depends on the host implementation and the specific tool executors.
    *   **Code reuse**: `performSearch`, as an internal helper function, is reused by multiple exported tools, demonstrating good code organization.

### 5.3. A Pure Toolset: `examples/time.ts`

This is a very concise toolkit that provides various time formatting functions.

*   **Learning focus**:
    *   **Standard IIFE usage**: Perfectly demonstrates how to use the `IIFE` pattern to encapsulate a set of related, side-effect-free pure functions.
    *   **Multiple function exports**: Demonstrates how to define and export multiple small, well-crafted functions in one file.
    *   **No external dependencies**: This script does not depend on the `Tools` API at all; it is a purely logical computation example.

### 5.4. Advanced "Metadata" Techniques: `examples/various_output.ts`

This script looks simple, but it demonstrates a special technique for interacting with AI.

*   **Learning focus**:
    *   **Leveraging descriptions**: The `description` field of the `output_image` tool does not simply describe functionality, but directly provides a prompt instructing the AI how to display images by outputting Markdown text in a specific format.
    *   **Alternative tools**: This shows that `METADATA` can not only be used to define executable functions, but also serves as a flexible mechanism for passing "instructions" or "knowledge" to the AI.

By studying the above scripts, you can master the core ideas and best practices of script development more quickly.

## 6. UI Automation in Detail

UI automation is at the core of many scripts.

### The `UINode` Object

The page structure returned by `Tools.UI.getPageInfo()` is a `UINode` object tree. Each `UINode` represents a UI element on the screen, through which you can:
-   Find child elements (`findById`, `findByText`, `findByClass`, `findAllBy...`)
-   Get element attributes (`text`, `contentDesc`, `bounds`, `resourceId`)
-   Perform actions (`click()`)

### Finding Elements

Finding elements is the first step in automation.

```typescript
// 获取当前页面的根节点
const page = await UINode.getCurrentPage();

// 1. 通过资源ID查找 (最稳定)
const searchBox = page.findById('com.example:id/search_box');

// 2. 通过文本内容查找
const loginButton = page.findByText("登录");

// 3. 通过类名查找
const allTextViews = page.findAllByClass('TextView');

// 4. 通过内容描述 (contentDescription) 查找
const backButton = page.findByContentDesc("返回");
```

### Interacting with Elements

After finding an element, you can operate on it.

```typescript
if (loginButton) {
    await loginButton.click();
    await Tools.System.sleep(2000); // 等待页面跳转
}
```

## 7. Debugging

-   Use functions such as `console.log()`, `console.error()`, etc. to output logs. Log information can be viewed in the execution environment.
-   Break complex logic into small functions and add clear log output to each function.
-   After performing UI operations, add an appropriate `Tools.System.sleep()` to wait for UI updates, avoiding failures caused by operating too quickly.
-   If you are not sure whether a piece of code itself is runnable, what a certain API's return value is, how the Java bridge behaves, or whether a small snippet's syntax is correct, do not write guesses directly into a formal package; you can first use the `debug_run_sandbox_script` tool in the `operit_editor` package to execute a small sandbox script for quick verification.
-   This kind of small-snippet testing is especially suitable for verifying:
    -   Whether a certain `Tools.*` interface exists and how its parameters are passed
    -   Whether a certain Java type/method can be called normally in the current host
    -   Whether a certain JSON / return structure / file path logic matches expectations
-   It is recommended to first reduce uncertain logic to a minimal runnable snippet, verify it, and then merge it into the formal script or ToolPkg.

## 8. Compilation

TypeScript scripts (`.ts`) need to be compiled into JavaScript (`.js`) before they can be executed. The project has `tsconfig.json` already configured, and usually the `tsc` command can be used to compile all scripts.

## 9. Running and Testing Scripts on a Device

After you have written a script and compiled it into JavaScript, you can use the helper scripts in the `tools/` directory to run it on a connected Android device via ADB (Android Debug Bridge).

### 9.1. Prerequisites

- **Android SDK (ADB)**: Make sure you have installed the Android SDK and that the `adb` command is available in your system path.
- **Android device**: Connect an Android device with "USB debugging" enabled and authorized for debugging from the computer.
- **Operit application**: Make sure `com.ai.assistance.operit.debug` or `com.ai.assistance.operit` is installed and running on the target device. Scripts will prefer the installed Debug package; either one can also be specified via `OPERIT_APP_PACKAGE`. Script execution depends on the `ScriptExecutionReceiver` inside the app to receive and process commands from ADB.

If both the Debug and Release APKs are installed, `com.ai.assistance.operit.debug` is used by default. To debug the Release APK, set the following before launching the script:

```cmd
set OPERIT_APP_PACKAGE=com.ai.assistance.operit
```

For Linux/macOS:

```bash
export OPERIT_APP_PACKAGE=com.ai.assistance.operit
```

The script will output the actually selected applicationId, and generate the temporary directory, broadcast action, and receiver accordingly.

### 9.2. Executing Script Functions

The `tools` directory provides the `execute_js.bat` (Windows) and `execute_js.sh` (Linux/macOS) scripts to simplify the execution flow.

**Usage (using Windows as an example):**

Open a command-line tool and execute the following command:

```cmd
tools\\adb\\execute_js.bat <JS文件路径> <要调用的函数名> [JSON格式的参数]
```

**Example:**

Suppose we want to execute the `hello_world` function in `my_new_script.js`, passing the parameter `{ "name": "世界" }`:

```cmd
tools\\adb\\execute_js.bat examples\\my_new_script.js hello_world "{\\"name\\":\\"世界\\"}"
```

- If multiple devices are connected, the script will prompt you to select the device to operate on.
- Note: In Windows `cmd`, double quotes inside the JSON string need to be escaped with `\`.

### 9.3. Checking Output and Debugging

After script execution, `tools/adb/execute_js.*` no longer relies on `adb logcat` to capture output, but instead waits for the app to write out a **structured result JSON**. The terminal will directly print this JSON, which contains:

- `success`
- `result`
- `error`
- `events`
- `durationMs`

`events` will include the `console.log/info/warn/error` output during script execution, as well as intermediate results generated during the process, so subsequent debugging no longer requires clearing logcat first and hoping to catch logs by chance.

If script execution takes a long time, the waiting time can be adjusted via an environment variable:

```bash
OPERIT_RESULT_WAIT_SECONDS=30 ./tools/adb/execute_js.sh examples/my_script.js main '{}'
```

This completes a full development cycle from writing to testing on a device.

### 9.4. VS Code Integration (Recommended)

To further simplify the development workflow, the project comes with preconfigured VS Code launch configurations that let you run and test scripts directly in the editor with one click.

**How to use:**

1.  Open the script file (`.ts` or `.js`) you want to test in VS Code.
2.  Switch to the "Run and Debug" view (shortcut `Ctrl+Shift+D`).
3.  In the dropdown menu at the top, you will see two available configurations:
    -   **`在Android设备上运行TS (编译+运行)`**: **Recommended usage**. When you are editing a `.ts` file, select this option. It will automatically compile your code, then prompt you to enter the function name and parameters to execute, and finally run it on the device.
    -   **`在Android设备上运行JS`**: Used to directly run an already compiled `.js` file. The flow is similar to the above, but without the compilation step.
4.  Click the green "Start Debugging" button (F5).
5.  Following the prompts at the top, enter the **function name** and **JSON-formatted parameters** in turn, then press Enter.

VS Code will automatically open a new terminal panel and execute the corresponding script, and you can see the structured JSON execution result directly in that panel. This integrated workflow greatly improves development and debugging efficiency.

## 10. VS Code Configuration (Optional)

For safety and to avoid conflicts between different developer environments, the `.vscode` folder is usually added to `.gitignore`, and this project is no exception. This means that the `launch.json` and `tasks.json` configuration files will not be committed to version control.

If you want to use the VS Code one-click launch feature described in the previous chapter, you need to manually create these files in the project root.

### 10.1. Creating tasks.json

1.  Create a folder named `.vscode` in the project root.
2.  Inside the `.vscode` folder, create a file named `tasks.json`.
3.  Copy and paste the following content into the `tasks.json` file:

```json
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "运行JavaScript到Android设备",
            "type": "shell",
            "command": ".\\tools\\adb\\execute_js.bat",
            "args": [
                "${fileDirname}\\${fileBasenameNoExtension}.js",
                "${input:jsFunction}",
                "${input:jsParameters}"
            ],
            "windows": {
                "command": ".\\tools\\adb\\execute_js.bat"
            },
            "linux": {
                "command": "./tools/adb/execute_js.sh"
            },
            "osx": {
                "command": "./tools/adb/execute_js.sh"
            },
            "problemMatcher": [],
            "group": {
                "kind": "build",
                "isDefault": true
            },
            "presentation": {
                "reveal": "always",
                "panel": "new",
                "focus": true
            }
        },
        {
            "label": "tsc-watch",
            "type": "shell",
            "command": "tsc",
            "args": [
                "--watch",
                "--project",
                "."
            ],
            "isBackground": true,
            "problemMatcher": "$tsc-watch",
            "group": "build",
            "presentation": {
                "reveal": "always",
                "panel": "dedicated",
                "focus": false
            }
        },
        {
            "label": "运行TypeScript到Android设备",
            "dependsOn": [
                "tsc-watch"
            ],
            "dependsOrder": "sequence",
            "type": "shell",
            "command": ".\\tools\\adb\\execute_js.bat",
            "args": [
                "${fileDirname}\\${fileBasenameNoExtension}.js",
                "${input:jsFunction}",
                "${input:jsParameters}"
            ],
            "windows": {
                "command": ".\\tools\\adb\\execute_js.bat"
            },
            "linux": {
                "command": "./tools/adb/execute_js.sh"
            },
            "osx": {
                "command": "./tools/adb/execute_js.sh"
            },
            "problemMatcher": [],
            "group": "test",
            "presentation": {
                "reveal": "always",
                "panel": "new",
                "focus": true
            }
        }
    ],
    "inputs": [
        {
            "id": "jsFunction",
            "description": "要执行的JavaScript函数名",
            "default": "main",
            "type": "promptString"
        },
        {
            "id": "jsParameters",
            "description": "函数参数(JSON格式)",
            "default": "{}",
            "type": "promptString"
        }
    ]
}
```

### 10.2. Creating launch.json

1.  Likewise, inside the `.vscode` folder, create a file named `launch.json`.
2.  Copy and paste the following content into the `launch.json` file:

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Python Debugger: Current File",
            "type": "debugpy",
            "request": "launch",
            "program": "${file}",
            "console": "integratedTerminal"
        },
        {
            "name": "在Android设备上运行JS",
            "type": "node",
            "request": "launch",
            "preLaunchTask": "运行JavaScript到Android设备",
            "presentation": {
                "hidden": false,
                "group": "",
                "order": 1
            }
        },
        {
            "name": "在Android设备上运行TS (编译+运行)",
            "type": "node",
            "request": "launch",
            "preLaunchTask": "运行TypeScript到Android设备",
            "presentation": {
                "hidden": false,
                "group": "",
                "order": 2
            }
        }
    ]
}
```

After creating these two files, restart VS Code, and the configuration items in "Run and Debug" should be available.
