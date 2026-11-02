---
title: Step 5: Tooling Directory Migration
status: draft
document_type: implementation-step
For_Agent: Do not execute compile, build, test, or publish commands without the user's explicit authorization
step: 5
depends_on:
  - 4_GradleInputNormalization.md
fork_repository: "git@github.com:Nyashiiro/Operit-follow-up.git"
last_reviewed: 2026-07-14
---

# Step 5: Tooling Directory Migration

[Previous step: Gradle Input Normalization](./4_GradleInputNormalization.en.md) · [Back to master plan](./index.en.md) · [Next step: Pixi and Asset Preparation Entry Points](./6_PixiAndAssetPreparation.en.md)

## Previous Implementation

- `tools/` simultaneously holds development scripts, debugging entry points, build scripts, standalone projects, host helper tools, and app built-in tools
- Python scripts are scattered across hotbuild, Compose DSL, GitHub, memory, string, and the directory root
- Auxiliary projects and scripts such as desktop, Shower, FFmpeg, native ripgrep, and the shell identity launcher are mixed together
- Tools that generate APK built-in assets, such as the MCP bridge, still live in the generic `tools/`
- Documentation and scripts reference this content directly through old paths, so directory responsibilities cannot be judged from paths

## Expected New Implementation

- Executable workflow scripts go into `ci/script/<intent>/`
- Each repository-owned Python entry point lives in a named `ci/script/` subdirectory
- Host auxiliary projects, binaries, and tools used by CI and development workflows go into `ci/tools/<name>/`
- Tools delivered with the app or dedicated to generating app built-in content go into `tools_built-in/<name>/`
- `tools/` no longer carries multiple conflicting directory responsibilities
- Every migrated item has its old path, new path, callers, and artifact destinations recorded

## Change Scope

Planned changes:

- `tools/`
- `ci/script/`
- `ci/tools/`
- `tools_built-in/`
- `settings.gradle.kts` and auxiliary project settings files
- package manifests, build scripts, and path callers
- Development documentation directly related to tool paths

This step does not change:

- The business algorithms and input/output protocols of the tools
- APK user-visible capabilities and data formats
- Android feature module and variant design

## Plan

1. Build a consumer list for every top-level entry in `tools/`, recording the invoking command, generated artifacts, runtime environment, and whether it is delivered with the APK.
2. Classify by runtime responsibility, not by extension or directory name in bulk moves.
3. Move Python workflow entry points to named `ci/script/` subdirectories, keeping the same workflow's shell, batch, configuration, and documentation in the same directory.
4. Move host auxiliary projects and tools to `ci/tools/`, updating Gradle settings, scripts, and documentation paths in sync.
5. Move app built-in tools such as the MCP bridge to `tools_built-in/`, updating the pnpm workspace and assets production paths in sync.
6. Migrate only one functional group at a time, and update all callers in the same change.
7. Compare the input and output file names and content lists before and after migration, to ensure directory changes do not alter tool behavior.
8. After all entries have been classified, delete empty old directories and old path descriptions.

## Acceptance

- `ci/script/` holds only directly invocable, named workflows
- `ci/tools/` holds only the host tools used by these workflows and the development process
- `tools_built-in/` holds only tools delivered with the app or producing app built-in content
- Old paths have no active callers
- Each migrated item's inputs, outputs, and behavior match those before migration
- The migration record has no unconfirmed path classifications

## Completion Record

Status: Not started. Before completion, tool build, script execution, and artifact comparison results need to be recorded.
