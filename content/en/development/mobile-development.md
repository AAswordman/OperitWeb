### Mobile Development

This section explains how to use AIDE and Operit AI to build native Android projects on your phone.

Version: 1.8.1+

This guide assumes your terminal environment is already set up. If you run into terminal issues, open `super_admin` in `Package Manager`; AI can help solve many problems.

### Create a New Android Project

> Example model: `deepseek-chat` (from DeepSeek Open Platform)

1. Create a new workspace. Path: `Workspace > Create Default > Android Project`

2. Send your requirements to AI.

```txt
Build a check-in app for me. It should require daily check-ins,
but if a user misses two consecutive days, they can no longer check in.
Users should be able to customize check-in items and add/remove them.
```

3. AI may create an Android project from scratch. You can also tell AI: `You can create the project directly through the terminal`, or manually click `Workspace > Initialize Android Build Environment`. After waiting for a moment, AI will have a faster and more convenient setup path.

![583104cc6330d73ff1afa9dbd5a5a5bf](/manuals/assets/submissions/aae0960a-de35-4822-9345-096e041aa078/img_a30806414374422899e8ecd091527029-583104cc6330d73ff1afa9dbd5a5a5bf.png)

4. Packaging and Testing

You still have two choices: open the workspace and click `Build Debug APK`, or let AI run terminal commands directly.

![89a0629358433e38d01d14d04751fc74](/manuals/assets/submissions/aae0960a-de35-4822-9345-096e041aa078/img_f7f398aa946d4f5a820e8f399089eaba-89a0629358433e38d01d14d04751fc74.png)
![c43738399417b3fb23737f996ec87f0b](/manuals/assets/submissions/aae0960a-de35-4822-9345-096e041aa078/img_964e3328e9444c54a38500ec4e405689-c43738399417b3fb23737f996ec87f0b.png)

This app is relatively simple. If there are no errors, the APK build process can usually finish in about 7–11 seconds. Below is the app AI produced.

![696dcd2faaf9d50876836a2b05610ad8](/manuals/assets/submissions/aae0960a-de35-4822-9345-096e041aa078/img_520d3a36b13341ea8e78c4bec38a846d-696dcd2faaf9d50876836a2b05610ad8.jpg)
![5af89324972ad9b05975337c0fe053b5](/manuals/assets/submissions/aae0960a-de35-4822-9345-096e041aa078/img_6f69aedb47a04efca85239e640bfd2fb-5af89324972ad9b05975337c0fe053b5.jpg)

5. Error Handling

If you encounter an error, open the terminal panel (the one you were asked to open at the beginning) and send it directly to AI. If the issue still exists, you can join the user group and contact the developers.

#### Q&A

- About AAPT2 failing to package on ARM64:

Use the built-in Android workspace. It will automatically download precompiled ARM64 AAPT2 (run `Workspace > Initialize Android Build Environment`).

### How to Tell Whether the Terminal Is Running

Most of the time, you will see a long and hard-to-read progress bar, like the one below (currently at 7%). If it is too slow, click `Ctrl+C Interrupt` on the left, then send the command again. Occasionally, you will get a clearer progress bar.

![5dd5ca6458d8c646b050a7d10230dfef](/manuals/assets/submissions/aae0960a-de35-4822-9345-096e041aa078/img_2ce88cd2635e43a4971821a851fa78f5-5dd5ca6458d8c646b050a7d10230dfef.jpg)

### Quickly Reproduce a GitHub Repository

Once AI has terminal capability, it can feel like it can do almost anything. So I only tell AI the project name and let it handle the rest, then rely on Operit's parallel conversation ability to run tests while modifying code (?)

#### How to Configure Shortcut Commands

There is a `config.json` file in the `.operit` folder where you can configure shortcut commands.

Example `.operit/config.json`:

```json
{
  "projectType": "android",
  "title": "Android Project",
  "description": "For Android development, provides quick buttons for common Gradle tasks",
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
      "label": "Initialize Android Build Environment",
      "command": "bash setup_android_env.sh",
      "workingDir": ".",
      "shell": true
    },
    {
      "id": "gradle_assemble_debug",
      "label": "Build Debug APK",
      "command": "./gradlew assembleDebug",
      "workingDir": ".",
      "shell": true
    },
    {
      "id": "gradle_install_debug",
      "label": "Install Debug APK",
      "command": "./gradlew installDebug",
      "workingDir": ".",
      "shell": true
    },
    {
      "id": "gradle_lint",
      "label": "Run Lint",
      "command": "./gradlew lint",
      "workingDir": ".",
      "shell": true
    },
    {
      "id": "gradle_test",
      "label": "Run Tests",
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

#### `config.json` Field Reference (Source-Based)

- `projectType` (`String`, default: `"web"`): Project category label. Mainly used for display fallback (for example, default workspace title).
- `title` (`String?`, default: `null`): Custom title shown at the top of command view.
- `description` (`String?`, default: `null`): Optional subtitle/description in command view.

`server` object:

- `server.enabled` (`Boolean`, default: `false`)
- `server.port` (`Int`, default: `8093`)
- `server.autoStart` (`Boolean`, default: `false`)
- Note: In the current app implementation, workspace preview server behavior is managed by internal server logic, and this `server` block is not the primary runtime switch for command execution UI.

`preview` object:

- `preview.type` (`String`, default: `"browser"`): Recommended values are `browser`, `terminal`, or `none`.
  - `browser`: Show embedded WebView preview as the default workspace page.
  - `terminal` / `none`: Show command buttons as the default page.
- `preview.url` (`String`, default: `""`): URL for browser preview.
  - If `preview.type = "browser"` and URL is empty, the app falls back to `http://localhost:8093`.
- `preview.showPreviewButton` (`Boolean`, default: `false`): Whether to show a separate "open browser preview" button in command view.
- `preview.previewButtonLabel` (`String`, default: `""`): Label text for that preview button.
  - Practical tip: if you set `showPreviewButton` to `true`, set a non-empty label for better UX.

`commands` array (`List<CommandConfig>`, default: empty): Each item becomes one runnable button.

- `id` (`String`, required): Command identifier.
- `label` (`String`, required): Button text shown in UI.
- `command` (`String`, required): Terminal command to execute.
- `workingDir` (`String`, default: `"."`): Intended working directory field.
- `shell` (`Boolean`, default: `true`): Intended shell execution field.
- `usesDedicatedSession` (`Boolean`, default: `false`): Run command in a dedicated terminal session (useful for long-running tasks like watchers/dev servers).
- `sessionTitle` (`String?`, default: `null`): Title for dedicated terminal session; falls back to `label` when omitted.

`export` object:

- `export.enabled` (`Boolean`, default: `true`): Whether to show workspace export action.

#### Runtime Notes

- Config file path is fixed at `.operit/config.json` under the workspace root.
- JSON parsing is lenient and unknown keys are ignored.
- If the file is missing or parsing fails, the app falls back to default Web config (`projectType: web`, browser preview at `http://localhost:8093`).
- In current command execution flow, commands run from workspace root, and `workingDir` / `shell` are reserved fields that are not actively applied yet.

**(Feel free to keep extending this config.)**

