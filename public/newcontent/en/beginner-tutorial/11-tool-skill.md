# 11. Tools: SKILL

We've covered sandbox packages and MCP in the previous two chapters. Now let's talk about the lightest tool type — Skill.

A Skill is essentially a **formatted document** that tells the AI how to do something. No separate process, no dependencies to install, no extra resource consumption. Think of it as an "instruction manual" for the AI — telling it what steps to follow when a certain need comes up.

It's the lightest of the three tool types. Sandbox packages run in the QuickJS engine, MCP spins up separate processes, but a Skill is just a Markdown file. If the functionality you need is simple, or it's a fixed workflow, Skill is the best choice.

From the AI's perspective, Skills are no different from sandbox packages or MCP. It uses `use_package` to activate them and `package_proxy` to call the tools inside. It doesn't know or care whether it's running a script or reading a document.

## Skill Description

Based on what we've covered earlier, the AI needs a description for each package to know which one to activate. So where does a Skill's description come from?

Simple — it's written right inside the Skill itself. Each Skill folder contains a `SKILL.md` file, and at the top of that file there's a metadata section called frontmatter, containing `name` and `description`. When the app detects the Skill, it reads this info and uses it as the display content in the package manager list. The AI sees this information and knows what the Skill does.

## Installing Skills

Open the Package Manager, switch to the Skills tab, and you'll see several import methods.

![Skill list and import](</manuals/assets/tools/skill_list_import.jpg>)

### Install from Skill Market

This is the recommended way. Tap the store button in the bottom right corner to enter the Skill Market. You'll find many Skills shared by others — you can search and browse them. Each Skill card has a circular button on the right: a download icon means it's available to install, a spinner means it's installing, and a checkmark means it's already installed. Just tap to download.

### Import from Repo

If you come across a Skill repository on GitHub, use this method. Tap the "+" button, switch to the "Repo" tab, paste the GitHub link, and tap import. The app will automatically download the repo and find the `SKILL.md` inside. It supports various URL formats: root repo URLs, subdirectory URLs, and even direct links to `SKILL.md`.

### Import from ZIP

If you already have a local Skill archive, tap "+", switch to ZIP, and select the file to import. The ZIP must contain a `SKILL.md` file — it can be in a subdirectory. If a Skill with the same name already exists, you'll get a notification and the import will be rejected.

## Managing Skills

Once installed, Skills appear in the list. Each entry has a visibility toggle on the right — on means the AI can use it, off means it stays locally but the AI won't call it. Tap an entry to view the `SKILL.md` content, and you can delete it from the detail dialog. The detail dialog has several tabs — "Description" shows your `name` and `description`, "Content" shows the `SKILL.md` body, and "Attachments" lets you manage resource files.

![Skill detail dialog](</manuals/assets/tools/skill_detail.jpg>)

Skills are stored in `/sdcard/Download/Operit/skills/`. Each Skill is a folder containing `SKILL.md`. The app recognizes a Skill by this file — if it has `SKILL.md` (or `skill.md`), it counts as a Skill.

When the AI activates a Skill, the entire folder structure and all files inside are exposed to the AI — not just `SKILL.md`. So if you need to include reference files, templates, or configurations, put them in subdirectories inside the Skill folder. The AI will see them when it's activated.

## How to Write SKILL.md

If you want to write your own Skill, the format is simple. The app reads metadata from the file header first, so it's recommended to start like this:

```markdown
---
name: weather_helper
description: Provides weather queries and travel suggestions
---

# Weather Helper

When you need to check the weather, follow these steps...
```

The part wrapped in `---` is called frontmatter. Put `name` and `description` in there, and the app will use this info in the list display. Without frontmatter, the app will still try to find `name:` and `description:` tags in the first few lines.

The body is the instruction for the AI. The format follows Anthropic's Skill specification — basically tell the AI: when to activate this Skill, what information it needs, what steps to follow, and what output to produce.
