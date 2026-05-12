# 12. Workspace Basics

We've covered tools in the previous chapters. Now let's talk about another important concept — the workspace.

## What is a Workspace

A workspace is simply **a folder bound to your current conversation**, giving the AI a place to read and write files.

Without a workspace, the AI can still create and read files, but they end up scattered everywhere with no fixed directory structure. With a workspace, the AI knows which folder to work in, and files stay organized — think of it as the AI's *desk*, where it does its work.

As mentioned back in Chapter 7, the workspace content gets injected into the *prompt context*, so the AI knows the current project structure and file contents. That's how it knows what to work on without you having to explain everything from scratch.

## Setting Up a Workspace

In the workspace setup panel, you'll see two options.

![Setup Workspace](</manuals/assets/workspace/setup_workspace.jpg>)

### Create Default

This is the easiest way, perfect for starting a new project from scratch. Tap "**Create Default**", and the app creates a dedicated internal workspace for your conversation, then shows a template selection dialog for you to pick a project type.

![Workspace Template Selector](</manuals/assets/workspace/template_selector.jpg>)

Available templates include Blank Workspace, Office Documents, Web Project, Android Project, Flutter Project, Node.js Project, and more. Each template type comes with different *presets* — Web Project includes `index.html` and enables the export entry, Android Project comes with Gradle quick commands. If you're not sure which to pick, Office Documents and Web Project are the most general-purpose.

Different templates also change the workspace UI. The Web Project template shows a browser preview by default, so you can see the web page in real time. The Android Project template shows a row of quick command buttons instead, like init environment, build APK, run tests. Other templates follow the same pattern — each one's interface is tailored to its purpose.

### Select Existing

If you already have a project folder and want the AI to work on it, choose this option. It opens the built-in file browser, you find your folder, and tap "**Bind Current Folder**". Great for importing existing projects that you want the AI to continue developing or modify.

One thing to note: "Select Existing" doesn't automatically create the `.operit` config directory, so features like preview may show "not found" errors. If you need those features, you can manually place a config file in the workspace root by referencing one from a template.

![Built-in File Browser](</manuals/assets/workspace/file_browser.jpg>)

At the top of the file browser, there are several tabs (Linux, SDCard, Workspace) and a **+ button** on the right. Tapping the + button uses Android's *SAF (Storage Access Framework)* to pick an external directory and bind it as a *repository* — for example, to access Termux's internal storage. You give it a name, and the AI reads and writes files in this repository environment. This is useful for reaching directories that aren't accessible through normal paths.

Which option to pick depends on your situation: new project → "Create Default", existing project → "Select Existing", need cross-directory or external storage → open the file browser and tap the + button to bind a repository.

## What's Inside a Workspace

Once the workspace is set up, the AI can do a lot — create files, edit code, delete things it doesn't need. If you're using the Web Project template, you can even preview the web page directly in the workspace — CORS restrictions are lifted for this preview, so cross-origin issues won't be a problem. The preview server runs on port 8093 by default, and you can also open `http://127.0.0.1:8093` in other browsers on your phone to see the page. If you need the AI to do automated web development, you can ask it to use the browser automation tool to open this address for debugging. You can also **rename** or **unbind** the workspace. **Unbinding doesn't delete your files** — they stay right where they are. But one important thing: if you unbind and then tap "Create Default" again, **it won't overwrite** the old workspace — it creates a brand new one. So if you still need the old workspace, it's better to **start a new conversation** instead.

There's also a *rollback* feature: when you go back to a previous point in the conversation, the workspace files get restored to their state at that point too. It's not always *100% reliable*, but it's way better than having nothing. The `.backup` directory in your workspace stores these backup files — that's what makes the rollback possible.

![Workspace Dashboard](</manuals/assets/workspace/workspace_dashboard.jpg>)

Every workspace has a hidden `.operit/config.json` file at its root. This file stores the workspace configuration, including *project type*, *preview settings*, *quick command buttons*, and more. If you know what you're doing, you can edit this file to tweak the workspace behavior. But for beginners, the template defaults are good enough.

The workspace also supports a special `AGENTS.md` file — if you place this file in the workspace root, its content gets appended to the system prompt every time you send a message. It's great for writing behavior rules or project background that you want the AI to keep in mind throughout the conversation.

If you want to browse workspace files directly with a file manager like MT Manager, you can use the "Add Local Storage" option to add the workspace directory. This way you can view and manage workspace files just like any other folder.

![Workspace in MT Manager](</manuals/assets/workspace/mt_manager_workspace.jpg>)
![Add Local Storage](</manuals/assets/workspace/mt_add_storage.jpg>)

## Exporting

If you used "Create Default" and picked Web Project, there's an export button in the bottom-right corner of the workspace. Tap it to package your web page into an Android app (*APK*) or Windows app (*EXE*). After tapping export, you can choose the platform, fill in package name, app name, version, icon, and more. The output is saved to `Download/Operit/exports/` by default.

![Export Package](</manuals/assets/teach_step/1-1.png>)
![Choose Platform](</manuals/assets/teach_step/1-2.png>)
![Fill App Info](</manuals/assets/teach_step/1-3.jpg>)

One thing to note: **only the Web Project template supports export**. Other workspace types don't have an export button — for Android projects, you need to manually tap the build button to compile the APK and then share it; for Office Documents, ask the AI to generate the file and share it from there.