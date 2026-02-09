### Workspace Overview

This page summarizes workspace types, binding methods, export behavior, and `.operit/config.json` in Operit.

#### Workspace Entry Points (Chat)

In chat workspace setup, you will see 3 entry options:

- `Create Default`
- `Select Existing`
- `Attach Local Storage Repository`

#### Differences Between the 3 Options

1. **Create Default**

Best for new projects. Operit creates an internal workspace dedicated to the current chat and lets you choose a template.

Current template options in UI:

- Blank Workspace
- Office Documents
- Web Project
- Android Project
- Node.js Project
- TypeScript Project
- Python Project
- Java Project
- Go Project

Key behavior:

- **Web Project** includes `index.html` and enables `export.enabled=true` by default.
- Other templates default to `export.enabled=false`.

2. **Select Existing**

Opens the built-in file browser. Navigate to your folder and click `Bind Current Folder`.

3. **Attach Local Storage Repository (SAF)**

Uses Android Storage Access Framework to bind an external folder and save it as a named repository.

#### How to Bind SAF Workspace (User UI Steps)

1. Tap `Attach Local Storage Repository`.
2. Choose a folder in the system picker and grant permission.
3. In `Repository Name` dialog, input `Name` (non-empty, unique).
4. Confirm and current chat is bound to repository environment (for example `repo:your-name`).

Extra tip: In file manager quick path chips, you can also add SAF repositories with the `+` chip and switch between them.

#### Export / Packaging Behavior

- Export button in chat workspace is shown only when:
  - `export.enabled=true`
  - and current environment is not SAF repository (`repo:`)
- So if you want direct web packaging in chat workspace, the most reliable path is:
  - `Create Default > Web Project`

If you are using SAF or any external folder, you can still package via Toolbox HTML Packager (select folder → select main HTML → package).

---

#### `.operit/config.json` Example (Android)

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

- `projectType` (`String`, default: `"web"`): Project category label for UI and title fallback.
- `title` (`String?`, default: `null`): Custom title in command view.
- `description` (`String?`, default: `null`): Subtitle/description in command view.

`server` object:

- `server.enabled` (`Boolean`, default: `false`)
- `server.port` (`Int`, default: `8093`)
- `server.autoStart` (`Boolean`, default: `false`)
- Note: In current app logic, preview server behavior is mainly managed by internal runtime logic.

`preview` object:

- `preview.type` (`String`, default: `"browser"`): Recommended values: `browser`, `terminal`, `none`.
  - `browser`: Show embedded WebView preview by default.
  - `terminal` / `none`: Show command buttons view by default.
- `preview.url` (`String`, default: `""`): Browser preview URL.
  - If `preview.type = "browser"` and empty, fallback is `http://localhost:8093`.
- `preview.showPreviewButton` (`Boolean`, default: `false`): Whether to show browser-preview button in command view.
- `preview.previewButtonLabel` (`String`, default: `""`): Label text for that button.

`commands` array (`List<CommandConfig>`, default: empty): Each item becomes a runnable command button.

- `id` (`String`, required): Command identifier.
- `label` (`String`, required): Button label.
- `command` (`String`, required): Terminal command.
- `workingDir` (`String`, default: `"."`): Reserved working directory field.
- `shell` (`Boolean`, default: `true`): Reserved shell execution field.
- `usesDedicatedSession` (`Boolean`, default: `false`): Use dedicated terminal session for long-running commands.
- `sessionTitle` (`String?`, default: `null`): Dedicated session title; falls back to `label`.

`export` object:

- `export.enabled` (`Boolean`, default: `true`): Whether export entry is shown in workspace.

#### Runtime Notes

- Config path is fixed at `.operit/config.json` under workspace root.
- JSON parsing is lenient; unknown keys are ignored.
- If file is missing or parsing fails, app falls back to default web config (`projectType: web`, preview `http://localhost:8093`).
- In current command execution flow, commands run from workspace root; `workingDir` and `shell` are currently reserved.

