### Creating Web: Using Workspace

If you want the full flow in Operit — build web pages, preview, then package — the first key is choosing the right workspace type.

![Set Workspace](/manuals/assets/workspace/image.png)

#### Choose the Right Workspace First (for direct packaging)

- **Direct web packaging in chat workspace:** `Workspace > Create Default > Web Project`
- This template creates `index.html` and enables `export.enabled=true` in `.operit/config.json` by default.
- Other default templates (Android / Node.js / TypeScript / Python / Java / Go / Office / Blank) use `export.enabled=false` by default.
- `Attach Local Storage Repository` (SAF) is for external folder collaboration and does not show export in chat workspace.

#### Three Workspace Entry Options (UI labels)

- **Create Default**: Create a new internal workspace for new projects.
- **Select Existing**: Open the built-in file browser and click `Bind Current Folder`.
- **Attach Local Storage Repository**: Bind an SAF directory through the system folder picker.

#### How to Bind an SAF Workspace (from user UI)

1. Open the workspace panel in chat and tap `Attach Local Storage Repository`.
2. Pick a target folder in the system folder picker and grant permission.
3. In the `Repository Name` dialog, enter a `Name` (cannot be empty and must be unique).
4. Confirm, then the workspace is bound and AI can read/write files in that repository.

> Tip: After binding, workspace operations use a repository environment like `repo:your-name`, useful for cross-folder collaboration.

#### Workspace Interaction

- AI can read, create, modify, and delete files.
- File listing follows `.gitignore` filtering (for example, ignores `node_modules`).
- To rollback text changes, long-press your message and choose `Edit and Resend`.

#### Next Steps

- Packaging guide: [Package Web as App](/guide/development/web-packaging)
- Full configuration reference: [Workspace Overview](/guide/development/workspace-overview)

