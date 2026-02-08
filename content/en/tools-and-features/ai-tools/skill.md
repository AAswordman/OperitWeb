# Skill

## What Skill Means in Operit (User View)

In Operit, a Skill is a local capability package. In chat, capabilities may come from built-in scripts, MCP plugins, or Skills.

From a user perspective, you can manage all Skills from `Package Management > Skills`.

Each Skill is one folder under:

`/sdcard/Download/Operit/skills/`

If a folder contains `SKILL.md` (`skill.md` is also recognized), Operit can load it as a Skill.

## Quick Start (3 Steps)

1. Open `Package Management > Skills`
2. Import via `+` (Repository or ZIP), or install from Skill Market
3. Keep the right-side switch ON (visible to AI), then ask naturally in chat

## How to Import Skills in the UI

### Option 1: Install from Skill Market (Recommended)

- Tap the store button on the Skills page to open `Skill Market`
- You can search, refresh, and load more items by scrolling
- Status icon on each Skill card:
  - Download icon: installable
  - Spinner: installing
  - Check icon: installed

### Option 2: Import from GitHub Repository

- Tap `+` on the Skills page, then choose `Repository`
- Paste a GitHub URL and tap `Import`
- Supported URL styles include:
  - repository root URL (default branch auto-detected)
  - `tree/...` subdirectory URL
  - `blob/.../SKILL.md` URL
  - `raw.githubusercontent.com` URL
- Operit downloads the repository ZIP and tries to locate `SKILL.md` automatically

### Option 3: Import from ZIP

- Tap `+` on the Skills page, then choose `ZIP`
- Select a `.zip` file and import
- The ZIP must contain a `SKILL.md` (subfolders are allowed)
- Duplicate Skill names are rejected

## Local Management (What You See)

- The top card shows the current Skills directory path and a `Refresh` action
- Skills are listed by name; tap one to preview `SKILL.md`
- You can delete a Skill directly from the preview dialog
- Each item has an AI visibility switch:
  - ON: AI can use this Skill (default)
  - OFF: Skill stays local, but AI will not call it

## `SKILL.md` Authoring Tips

Operit reads `name` and `description` for list display. Recommended pattern:

```md
---
name: weather_helper
description: Weather lookup and trip suggestions
---

# Weather Helper
...
```

If you do not use frontmatter, `name:` and `description:` near the top of the file can also be parsed.

For format conventions, you can follow Anthropic Skill style.

## Publish and Manage My Skills

After GitHub login in Skill Market, you can:

- publish a new Skill
- manage published Skills (edit / remove)

Note: removing from market usually closes the publish issue and does not delete your source repository.

## Troubleshooting

- “No Skills found”: verify `/sdcard/Download/Operit/skills/` and ensure each folder has `SKILL.md`
- “Only .zip files are supported”: check the file extension
- “No SKILL.md found in zip”: verify ZIP structure
- “Invalid GitHub URL”: verify repository URL format
- Installed but not used in chat: ensure the Skill visibility switch is ON
