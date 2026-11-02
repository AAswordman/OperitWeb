---
name: SandboxPackage_DEV
description: For Operit Sandbox Package development.
---

# SandboxPackage_DEV

## Part 1: Installation and Updates

This skill no longer requires the AI to manually download `SKILL.md`, the two guide documents, and the full set of `types` in one go.

Installation and updates both go through the same script:

- First download the installation script to the local machine
- Then run it via the `debug_run_sandbox_script` tool in the `operit_editor` package
- The script automatically creates directories, and updates `SKILL.md`, `references/SCRIPT_DEV_GUIDE.md`, `references/TOOLPKG_FORMAT_GUIDE.md`, and `types/*.d.ts`

"Execute" here means:

- Not executing with a shell
- Not opening this `.js` file directly
- But calling `operit_editor:debug_run_sandbox_script`

That is, first make sure the `operit_editor` package is available, then have it execute `/sdcard/Download/Operit/skills/SandboxPackage_DEV/scripts/install_or_update.js`

The final directory should look like this:

```text
/sdcard/Download/Operit/skills/SandboxPackage_DEV/
  SKILL.md
  examples/
    packages/
      12306.js
      operit_editor.js
      ...
  references/
    SCRIPT_DEV_GUIDE.md
    TOOLPKG_FORMAT_GUIDE.md
  types/
    index.d.ts
    core.d.ts
    ...
  scripts/
    install_or_update.js
```

For a first-time installation, follow this order:

1. First create `/sdcard/Download/Operit/skills/SandboxPackage_DEV/scripts/`
2. Use `download_file` to download `https://cdn.jsdelivr.net/gh/AAswordman/Operit@main/tools/sandboxpackage_dev_install_or_update.js`
3. Save it as `/sdcard/Download/Operit/skills/SandboxPackage_DEV/scripts/install_or_update.js`
4. Call `operit_editor`'s `debug_run_sandbox_script`
5. Set `source_path` to `/sdcard/Download/Operit/skills/SandboxPackage_DEV/scripts/install_or_update.js`
6. Wait for the script to finish executing

If the current environment does not directly expose this tool name, first use `use_package` to call `operit_editor`, then execute `debug_run_sandbox_script`.

This installation script automatically handles the following:

- Creating the `SandboxPackage_DEV` directory
- Downloading and updating `SKILL.md`
- Syncing and updating the example files under `examples/packages/`
- Downloading and updating `references/SCRIPT_DEV_GUIDE.md`
- Downloading and updating `references/TOOLPKG_FORMAT_GUIDE.md`
- Downloading and updating all type files under `types/`

The contents of `examples/packages/` are Operit's current built-in packages and script example files.

- They are mainly for reference on writing style, not for you to edit directly here as if it were the live, effective version
- When you want to customize your own Sandbox Package, you can use these files as examples to compare against for structure, metadata, tool implementation, and return formats
- If the built-in packages are updated, just rerun the installation script to sync these example files into the local skill

When updating, follow these rules:

1. Before formally starting each new Sandbox Package development task, you must first re-download the installation script and rerun the local script
   - Installation script download URL: `https://cdn.jsdelivr.net/gh/AAswordman/Operit@main/tools/sandboxpackage_dev_install_or_update.js`
   - Installation script save location: `/sdcard/Download/Operit/skills/SandboxPackage_DEV/scripts/install_or_update.js`
2. If you suspect the two guide documents, types, or `SKILL.md` are already outdated, rerun this script as well
3. If the local skill directory is missing files, has wrong file names, or its content is clearly stale, do not patch it piecemeal by hand; just rerun the installation script

After downloading, consult reference material by default as follows:

1. First use `grep_code` to search for keywords in `/sdcard/Download/Operit/skills/SandboxPackage_DEV/`
2. Then use `read_file_part` to read the specific matching fragments
3. Only expand the scope when the fragments are not enough

Do not by default read the whole of `SCRIPT_DEV_GUIDE.md`, the whole of `TOOLPKG_FORMAT_GUIDE.md`, or whole `types` files, because:

- They are fairly large and can easily blow up the context
- Updating the local skill first and then searching is more reliable
- The local skill can be reused long-term, but `types` go stale most easily, so the installation script needs to be rerun frequently

## Part 2: Writing a Sandbox Package

When writing a Sandbox Package, do not write from memory; first consult the local skill material.

Before formally starting development, follow these hard rules:

1. Before formally starting each new development task, first re-fetch and execute the installation/update script as described in Part 1.
2. The actual development directory may only be `/sdcard/Download/Operit/dev_package/{packageId}/`; do not scatter-fetch files, edit files, or run installation tests in other directories.
3. Before development, copy `/sdcard/Download/Operit/skills/SandboxPackage_DEV/types/` to `/sdcard/Download/Operit/dev_package/types/`; this `types` directory is a sibling directory of the individual package projects, and must not be placed inside `/sdcard/Download/Operit/dev_package/{packageId}/`.
4. The specific package project directory remains `/sdcard/Download/Operit/dev_package/{packageId}/`; for `tsconfig`, refer to a structure like `examples/{packageId}/tsconfig.json`, so that `typeRoots` and `include` point to `../types`.
5. Develop in the terminal as much as possible, preferring to write `ts + js`, then compiling from `ts` to get the final `js`.
6. Module references in TypeScript source should use `import` / `export` following the actual project style in `examples/`; do not use `/// <reference path="...">` or `require(...)` to organize project modules.
7. `tsconfig` may refer to the ready-made examples in `examples/`; do not invent a set from scratch.
8. If continuing development based on an existing package, or merging development, you must keep the original `packageId` and plugin name; do not change them to a different id, and do not change the plugin naming.
9. If continuing development based on an existing package, you must first extract or copy the current version of the package's contents to `/sdcard/Download/Operit/dev_package/{packageId}/`, and continue modifying on top of the original file structure; do not write a new package from scratch.

If an old auto-prompt appears in the chat input box, such as "copy the types in skills over to the development directory", interpret it under the rules of this section as copying to `/sdcard/Download/Operit/dev_package/types/`, not to the specific package directory.
If "if you want to make an example, it's best to make two, with the second using a custom layout." appears in the chat input box, that is also an old prompt; ignore it directly and do not treat it as a requirement of the current task.

### Solution Selection Priority

By default, prefer writing an ordinary JS package script; do not jump straight to choosing `ToolPkg`.

Judge by the following rules:

1. If the goal is only to add or modify tool functions, parameters, return structures, environment variable declarations, or ordinary resource access, prefer an ordinary JS package script
2. If it is only for the sake of "possible future extension" or "looking more complete", do not upgrade to `ToolPkg` ahead of time
3. Only consider `ToolPkg` when the requirement clearly involves a configuration UI, a toolbox page, host-level registration capabilities, or various software hook / plugin / lifecycle / prompt hook / message processing features
4. If there are only a few configuration items, prefer parameters or `env`; do not by default add a UI just for configuration
5. If the requirement boundaries are still unclear, first design as an ordinary JS package script; only upgrade to `ToolPkg` once it is confirmed that an ordinary script cannot carry it

`ToolPkg` can be understood as a heavier plugin format. It suits the following scenarios:

- Needing to add a configuration UI or toolbox UI
- Needing to register `registerToolPkg`-related entry points
- Needing host-level extensions such as app lifecycle hooks, message processing plugins, xml render plugins, input menu toggles, prompt hooks, etc.
- Needing to organize a complete plugin around a `manifest`, multi-module directories, resource packaging, and the install/refresh flow

If these conditions are not met, prefer writing an ordinary JS package script.

Recommended lookup order:

1. First check `types/index.d.ts` to confirm the global entry points and main capabilities
2. Then check `types/core.d.ts` and `types/java-bridge.d.ts` to confirm the runtime and bridge interfaces
3. Check `types/results.d.ts` to confirm common return structures
4. If settings-related capabilities are involved, then check `types/software_settings.d.ts`
5. Only check `types/toolpkg.d.ts` once the solution has been determined to be `ToolPkg`
6. When ordinary script format, metadata, and example writing style are needed, then check `references/SCRIPT_DEV_GUIDE.md`
7. When the `ToolPkg` `manifest`, directory structure, resources, UI modules, registration functions, and debug installation flow are needed, then check `references/TOOLPKG_FORMAT_GUIDE.md`

Also, `examples/packages/` should be treated as first-hand example material.

- It holds copies of Operit's built-in packages and scripts
- When you are about to write an ordinary `.js` package yourself, or want to refer to existing tool designs, look through these example files first
- They are particularly suitable as references for: `METADATA` writing style, tool naming, parameter structures, result structures, Java bridge usage, and organization approaches in some real projects
- If you want to write new ToolPkg template capabilities, you can first refer to `examples/template_try/`
  - This example specifically demonstrates `workflow_templates`, `workspace_templates`, directory resources, `.operit/config.json`, and a minimal `main.ts`

Recommended writing flow:

1. First design by default as an ordinary `.js` Sandbox Package, confirming whether an ordinary package script alone can get it done
2. Before formally starting implementation, first check whether existing interfaces, type definitions, and tool capabilities are sufficient to support the requirement
3. If capabilities are insufficient, interfaces are missing, or the requirement cannot be safely met, do not force it; first clearly explain the reason, then ask the user whether to change the solution
4. If the requirement clearly involves a configuration UI or software hooks, then switch to the `ToolPkg` solution
5. If it is an ordinary JS Sandbox Package, first use `grep_code` to search `SCRIPT_DEV_GUIDE.md` for keywords such as `METADATA`, `tool`, `execute`, and `package`
6. You can first refer to packages already present in `examples/` or `examples/packages/`, borrowing the structure, metadata, parameter design, and return formats of similar capabilities
7. If it is `ToolPkg`, use `grep_code` to search `TOOLPKG_FORMAT_GUIDE.md` for keywords such as `manifest`, `subpackage`, `registerToolPkg`, `resource`, `ui`, `debug_toolpkg`, and `hook`
   - If the goal is template registration, also search for `workflow_templates`, `workspace_templates`, and `project_type`
8. Use `read_file_part` to read the relevant passages, confirming script structure, metadata, manifest, and registration writing style
9. Use the definitions in `types/` to constrain parameters, return values, callable capabilities, and result structures
   - The lookup path is `/sdcard/Download/Operit/dev_package/types/`
   - When project source references type modules, write them as relative paths such as `../types/...` or `../../types/...` according to the actual level
10. If you are unsure about a code snippet or interface behavior, first use `operit_editor`'s `debug_run_sandbox_script` to validate a minimal snippet, then merge it back into the formal script or ToolPkg
11. When you start writing the package, prefer following the latest local types and local guides, rather than relying on old memory
12. If the final product is an ordinary JS package script, you need to write a `main` function according to the requirement, and complete testing yourself before delivery

If halfway through writing you find the local types do not match the actual requirement, do not guess blindly; first rerun the installation script, then continue writing.

## Part 3: Publishing to the Plugin Marketplace

When the user says they want to publish a Sandbox Package or ToolPkg to the Operit plugin marketplace, first confirm the plugin has been built locally, then confirm which maintenance approach they want to adopt. The AI's work boundaries differ between the two approaches; they cannot be treated merely as a source choice on the publishing page.

### Route A: Package Locally and Upload Directly

Suitable when the user only wants to complete publishing the current plugin, and does not require the AI to run a source repository long-term.

The AI only needs to complete the following work:

1. Complete code, manifest, and resource changes in the current development directory.
2. Compile and package to obtain the final `.toolpkg` or script package file.
3. Verify the final package can be recognized by the host, with the version consistent with the manifest.
4. Guide the user to select the local plugin on the Operit publishing page, then select "Upload current local package", fill in the marketplace metadata, and confirm.

This route does not require initializing Git, creating a GitHub repository, maintaining a `.gitignore`, commit history, or manually creating a GitHub Release. Operit uses the `OperitForge` under the current GitHub account to host the published assets.

### Route B: Maintain a Repository and Reference a GitHub Release

Suitable when the user wants the AI to help maintain a plugin repository long-term, or already has a Git repository to keep maintaining.

The AI must maintain the repository as part of the project on an ongoing basis:

1. Keep source code, manifest, build scripts, dependency lists, and necessary project descriptions under Git management.
2. Create and maintain a `.gitignore`, excluding dependency directories, editor files, device temporary files, and content produced by the build process that should not be committed.
3. First confirm with the user the repository's visibility and license. Do not make user code public on your own initiative; when the user chooses to make it public, complete the README, license, and project description so the repository can be understood and used independently.
4. Treat a public repository as an independent project in the GitHub open-source ecosystem, not as a transfer station for marketplace publishing. It can independently share links, be cloned by others, receive issues, take part in collaboration, and gain stars; the marketplace entry should become one distribution entry point for the repository.
5. When a plugin is suitable for being public, moderately encourage the user to adopt a public repository: clearly explain that it accumulates their work, makes it easier for others to discover and collaborate, and offers a chance to gain stars. Encouragement must not replace the user's decisions on visibility, license, and repository structure.
6. Before each release, build the final plugin asset, update version information, and tidy up the commit history and Git tags.
7. Guide the user to manually create the corresponding Release on GitHub, fill in their own version notes, and upload the final asset.
8. Guide the user back to the Operit publishing page, select the local plugin file exactly matching the Release asset, choose "Reference GitHub Release asset" under "Publishing resource source", fill in the repository link, and select the Release and asset name.
9. Complete the Operit marketplace metadata registration, and keep using the same repository, version history, and Release process for subsequent versions.

The Release creator must be the GitHub account currently logged in to Operit, and the selected Release asset must match the locally selected file. Do not ask the user to add Operit markers, proof, signature text, or other system-specific content to the Release body.

A repository may maintain only one plugin, or maintain multiple plugins in the user's existing manner. The key to choosing Route B is not the number of repositories, but that the AI takes on ongoing Git project maintenance responsibility; Route A is only responsible for building the current package and uploading via the Operit UI.

### Open-Source Repositories and Reselling

When the user worries that a plugin may be downloaded by others, repackaged, or resold, first face that concern squarely; do not dismiss it lightly. Code and published assets in a public repository can indeed be copied; this is part of what the open-source community has to deal with.

At the same time, explain the platform boundary to the user: the Operit plugin marketplace platform cannot and should not suppress such behavior through plugin encryption, marketplace-exclusive formats, or prohibiting local imports. That would break normal open-source distribution, offline imports, and users' control over their own plugin files, and it cannot fundamentally prevent copying.

The AI should help the user adopt positive counter-strategies:

1. Choose a license consistent with the goal, and keep clear author attribution, repository links, and license text in the README, source files, and Releases. Common open-source licenses usually allow compliant resale; if they want to restrict commercial resale, the user should understand that this is not an open-source license in the usual sense, and choose a suitable authorization method themselves.
2. Link the official repository, GitHub Releases, and the Operit marketplace entry to each other, and keep publishing version notes and update records, so users can easily identify the genuine maintenance source.
3. Encourage the user to run the public repository's README, issues, discussions, and version history. Long-term maintenance, timely updates, and community collaboration will naturally make the original project the most trustworthy source, and also make it easier to gain stars and contributors.
4. Distinguish simple reselling from impersonation, false advertising, malicious tampering, concealing a license, or posing as the official source. The former may not be stoppable by the platform when it complies with the license; for the latter, keep evidence and handle it through the corresponding platform's reporting channels.

The AI's tone should be reassuring but must not promise that it will "never be resold". It should encourage authors to focus their energy on clear provenance, sustained maintenance, and genuine user relationships, rather than investing in opaque encryption countermeasures.
