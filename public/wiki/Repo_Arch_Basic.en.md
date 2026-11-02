# Root Directory Folder Purposes

This document describes the repository root layout, its purposes, and current status.

## Directory Overview

```text
Operit-follow-up/
├── app/             Main Android app
├── avator/          Character and model Android modules
│   ├── dragonbones/  DragonBones animation Android library
│   ├── fbx/          FBX model Android native library
│   └── mmd/          MMD model runtime and preview module
├── ci/              CI and local automation scripts
├── docs/            Project documentation and documentation resources
├── examples/        JavaScript/TypeScript tool package examples
├── gradle/          Gradle Wrapper and version catalog
├── llm/             Local large model Android modules
│   ├── llama/        llama.cpp local inference Android module
│   └── mnn/          MNN local inference Android module
├── quickjs/         QuickJS JNI module
├── showerclient/    Shower virtual display client library
├── terminal/        OperitTerminalCore Git submodule
├── tools/           Development, debugging, and build helper tools
└── web-chat/        React + Vite Web Chat frontend
```

## Directory Details

### [`app`](app/)

This is Operit's main Android app module. The app UI, business logic, Android resources, tool system, project templates, and ObjectBox models are all concentrated here, and it is also responsible for integrating the various local native capabilities. The main application code of the final APK lives in this directory.

### [`ci`](ci/)

This is the CI and local automation scripts directory, containing PR merge candidate classification, repository hygiene, localization, Markdown, Android dependency preparation, and corresponding unit tests. GitHub Actions is responsible for preparing runners, summarizing quick checks, and orchestrating the WebChat, ToolPkg, and Android build commands by scope.

### [`docs`](docs/)

This is the project documentation and documentation resources directory, containing core development guides, script and tool package development notes, architecture and protocol documentation, and static resources such as images used by the README.

### [`avator`](avator/)

This is the centralized directory for character- and model-related Android modules. Gradle still references these subdirectories under their original module names.

### [`avator/dragonbones`](avator/dragonbones/)

This is the DragonBones Android library module. It provides loading, rendering, and animation control of DragonBones skeletal animation models via C++, OpenGL, and JNI, and offers wrappers for Android View and Compose use cases.

### [`examples`](examples/)

This is a collection of tool package and script examples, mainly in JavaScript and TypeScript, covering extension scenarios such as chat, search, drawing, browser automation, system control, and maps. Same-named `.ts` and `.js` files are usually the source example and the executable version, respectively.

### [`avator/fbx`](avator/fbx/)

This is the FBX Android native runtime module. It parses FBX models via the `ufbx` C library, providing the base capability for FBX virtual characters and model display in the app. `ufbx` is fetched by CMake from the upstream repository, defaulting to `main`.

### [`gradle`](gradle/)

This is the Gradle build support directory, containing the Gradle Wrapper configuration and the project's unified version catalog `libs.versions.toml`.

### [`llm`](llm/)

This is the centralized directory for local large model Android modules. Gradle still references these subdirectories under their original module names.

### [`llm/llama`](llm/llama/)

This is the llama.cpp Android native integration module. It integrates llama.cpp via CMake/JNI, providing the app with inference capabilities for local large language models such as GGUF. The upstream llama.cpp source is fetched by CMake from the ggml-org repository, defaulting to the upstream main branch.

### [`avator/mmd`](avator/mmd/)

This is the MMD model Android runtime and preview module, containing native integration related to model rendering, and using third-party components such as Bullet3. Bullet3 is fetched by CMake from the upstream repository, defaulting to the upstream main branch. `UPSTREAM_SABA_VIEWER_MAPPING.md` documents the mapping relationship with the upstream Saba Viewer.

### [`llm/mnn`](llm/mnn/)

This is the MNN Android native integration module. It integrates Alibaba MNN via CMake/Gradle, providing the app with local model inference and related AI native capabilities. The MNN source is fetched by CMake from the upstream repository, defaulting to the upstream main branch.

### [`quickjs`](quickjs/)

This is the QuickJS JNI module itself, containing the QuickJS C source, JNI Runtime, Kotlin wrappers, and Host Bridge.

The current README explicitly states that this module is not yet integrated into `app`.

### [`showerclient`](showerclient/)

This is the Shower client Android library, responsible for connecting to the Shower server, establishing virtual displays, sending touch and key events, requesting screenshots, and providing an optional video decoding rendering component. The host app needs to inject `ShellRunner` and handle Binder broadcasts.

### [`terminal`](terminal/)

This is the [OperitTerminalCore](https://github.com/AAswordman/OperitTerminalCore) Git submodule, corresponding to the `:terminal` module in Gradle

### [`tools`](tools/)

This is a collection of development, debugging, build, and run helper tools, containing JavaScript/ADB execution scripts, ToolPkg debugging and Hooks, Shower service tools, Compose DSL generator, MCP Bridge, native ripgrep, string processing, memory analysis, and desktop and Android helper projects. (Build and test content in it will gradually migrate to ci: Python scripts will migrate to named folders under /ci/script, tools will migrate to /ci/tools; while app built-in tools will use the tools_built-in directory)

### [`web-chat`](web-chat/)

This is the Web Chat frontend integrated into the APP, using React, Vite, and TypeScript. Built static files are placed into `app/src/main/assets/web-chat` via a sync script.

## Related Notes

- `app`, `avator/dragonbones`, `terminal`, `llm/mnn`, `llm/llama`, `avator/mmd`, `avator/fbx`, `showerclient`, `quickjs` are the Gradle modules declared in the root `settings.gradle.kts`.
- Third-party directories still maintained as Git submodules are governed by the root `.gitmodules`.
