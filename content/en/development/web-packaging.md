### How to Package Web Applications

Quick takeaway:

- **If you want the Export button directly inside chat workspace, choose `Workspace > Create Default > Web Project`.**
- That template enables export by default (`export.enabled=true`).
- Other default templates do not show export by default.
- If your workspace is bound via `Attach Local Storage Repository` (SAF), export is not shown in chat workspace.

#### Method 1: Export Directly from Chat Workspace (Recommended)

1. Bind a workspace for the current chat, preferably `Create Default > Web Project`.
2. Ensure your web entry file is `index.html` in workspace root.
3. Open the bottom-right workspace floating menu and tap `Export`.
4. Choose export platform (Android / Windows).
5. Fill in app info in dialogs (package name, app name, version, icon, etc.) and export.
6. After completion, open output directly; files are saved under `Download/Operit/exports/` by default.

![Enter Packaging](/manuals/assets/teach_step/1-1.png)
![Start Packaging](/manuals/assets/teach_step/1-2.png)
![Set Information](/manuals/assets/teach_step/1-3.jpg)
![Download Share](/manuals/assets/teach_step/1-4.jpg)

#### Method 2: Toolbox HTML Packager (for any folder / SAF)

If your project is in SAF workspace or outside chat workspace, use Toolbox HTML Packager:

1. In HTML Packager, click `Select Folder`.
2. In step 2, select the “main HTML file” from dropdown (it does not have to be `index.html`).
3. Click `Generate Package`, then choose Android or Windows.

> Internally, this flow copies files to a temp directory and renames the selected main HTML file to `index.html` before packaging.

#### FAQ

- **Why is Export not visible?**
  - Current workspace is not Web template, or `.operit/config.json` has `export.enabled=false`.
  - Current workspace is SAF repository mode (`repo:` environment).
- **Can old projects be exported directly?**
  - Yes, if it is a normal path workspace (not SAF) and `export.enabled=true`.
- **Where is the full workspace config reference?**
  - See [Workspace Overview](/guide/development/workspace-overview).

