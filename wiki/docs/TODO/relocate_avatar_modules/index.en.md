---
For_Agent: Consolidate model modules into the avator directory
---

# Avatar Module Directory Relocation

## Old State

- `dragonbones`, `fbx`, and `mmd` were scattered across the repository root
- Gradle, CMake, CI, and architecture docs directly used root-directory paths

## Change Intent

- Move the three modules as a whole to `avator/dragonbones`, `avator/fbx`, and `avator/mmd`
- Keep the Gradle module names `:dragonbones`, `:fbx`, and `:mmd`, without changing the app dependency interface
- Sync CMake shared script paths, CI trigger paths, and repository architecture docs

## Scope

- `avator/dragonbones/`
- `avator/fbx/`
- `avator/mmd/`
- `settings.gradle.kts`
- `.github/workflows/android-build.yml`
- `Repo_Arch_Basic.md`
- `docs/TODO/native_dependency_fetchcontent/index.md`

## Status

[DONE]
